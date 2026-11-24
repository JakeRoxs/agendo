'use strict';

/**
 * Shared, runtime-neutral todo lifecycle transition core.
 *
 * Pure planning/serialization: given a document's content and status metadata,
 * it computes the next frontmatter body, the next filename, and the target
 * status folder. It performs no file-system or editor operations, so the same
 * core is consumed by the standalone Node canvas/MCP adapter and the VS Code
 * StatusService adapter, each of which supplies its own file adapter.
 *
 * Canonical lifecycle values: pending, in-progress, ready, backlogged,
 * completed, cancelled.
 */

const CANCELLED_BANNER_RE = /^>\s*\*\*CANCELLED[\s\S]*?(?:\r?\n>.*)*\r?\n?/m;

const STATUSES = ['pending', 'in-progress', 'ready', 'backlogged', 'completed', 'cancelled'];
const TERMINAL_STATUSES = ['completed', 'cancelled'];
const ACTIVE_STATUSES = ['pending', 'in-progress', 'ready'];
const PRIORITIES = ['p1', 'p2', 'p3'];

/** Filename naming contract: `<id>-<status>-<priority>-<description>.md`. */
const FILENAME_RE = /^((?:(?:cql|sq)-)?\d{3,})-(pending|in-progress|ready|backlogged|completed|cancelled)-(p[123])-(.+)\.md$/i;

function isValidStatus(status) {
  return STATUSES.includes(status);
}

/** Normalize a todo description into a safe filename segment. */
function sanitizeDescription(description) {
  const normalized = description
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[._]+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  const withoutLeadingHyphen = normalized.startsWith('-') ? normalized.slice(1) : normalized;
  const withoutTrailingHyphen = withoutLeadingHyphen.endsWith('-')
    ? withoutLeadingHyphen.slice(0, -1)
    : withoutLeadingHyphen;
  return withoutTrailingHyphen || 'todo';
}

/** Build a filename from its component parts. */
function buildFileName(id, status, priority, description) {
  const safeDescription = sanitizeDescription(description);
  return `${id}-${status}-${priority}-${safeDescription}.md`;
}

function eolOf(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

/** Split a document into its frontmatter data and body, preserving line endings. */
function splitFrontmatter(content) {
  const eol = eolOf(content);
  const lines = content.split(eol);
  if (lines[0]?.trim() !== '---') return { data: '', body: content };
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) return { data: '', body: content };
  return { data: lines.slice(1, end).join(eol), body: lines.slice(end + 1).join(eol) };
}

/** Rewrite one flow-style frontmatter field, or add it when missing. Preserves EOL. */
function rewriteFrontmatterField(content, key, value) {
  const eol = eolOf(content);
  const lines = content.split(eol);
  if (lines[0].trim() !== '---') {
    // No frontmatter block: create one, preserving document EOL.
    return `---${eol}${key}: ${value}${eol}---${eol}${eol}${content}`;
  }
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) {
    throw new Error('Malformed frontmatter: missing closing ---');
  }
  let found = false;
  for (let i = 1; i < end; i++) {
    if (new RegExp(`^${key}\\s*:`).test(lines[i])) {
      lines[i] = `${key}: ${value}`;
      found = true;
      break;
    }
  }
  if (!found) {
    lines.splice(end, 0, `${key}: ${value}`);
  }
  return lines.join(eol);
}

/** YAML-safe scalar: quote only values that need it. */
function yamlScalar(value) {
  if (/^[\w.-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

/** Ensure a tag is present in the frontmatter `tags` list.
 * Supports flow-style (`tags: [a, b]`) and block-style (`tags:\n  - a`) tags.
 */
function ensureTag(content, tag) {
  const { data, body } = splitFrontmatter(content);
  if (!data) return content;

  const eol = eolOf(content);
  const lines = data.split(eol);
  const tagsLineIndex = lines.findIndex((line) => /^tags\s*:/.test(line));
  if (tagsLineIndex === -1) {
    // No tags field: add one with the new tag
    lines.push(`tags: [${yamlScalar(tag)}]`);
    return `---${eol}${lines.join(eol)}${eol}---${eol}${body}`;
  }

  const tagsLine = lines[tagsLineIndex];
  const match = tagsLine.match(/^tags\s*:\s*(.*)$/);
  if (!match) return content;

  const value = match[1].trim();
  let tags;
  let format;
  let blockItemCount = 0;

  if (value.startsWith('[')) {
    // Flow-style
    tags = value.slice(1, -1).split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    format = 'flow';
  } else if (value === '') {
    // Empty value - check next lines for block-style
    const nextLine = lines[tagsLineIndex + 1];
    if (nextLine && /^(-|\s*-)/.test(nextLine)) {
      // Block-style: read existing items so they are preserved
      tags = [];
      format = 'block';
      let idx = tagsLineIndex + 1;
      while (idx < lines.length && /^\s*-/.test(lines[idx])) {
        const item = lines[idx].match(/^\s*-\s*(.+)$/);
        if (item) {
          tags.push(item[1].trim());
          blockItemCount++;
        }
        idx++;
      }
    } else {
      tags = [];
      format = 'scalar';
    }
  } else {
    // Scalar
    tags = [value];
    format = 'scalar';
  }

  // Add cancelled if not present
  if (!tags.some((t) => t.replace(/["']/g, '') === tag)) {
    tags.push(tag);
  }

  // Write back — always serialize as flow-style for safe, round-trippable output
  let newTagsLine = `tags: [${tags.map((t) => yamlScalar(t)).join(', ')}]`;

  // Replace the tags line
  lines[tagsLineIndex] = newTagsLine;

  // Remove original block-style item lines so they are not duplicated
  if (format === 'block' && blockItemCount > 0) {
    lines.splice(tagsLineIndex + 1, blockItemCount);
  }

  // Reassemble full document: frontmatter delimiters + modified data + body
  return `---${eol}${lines.join(eol)}${eol}---${eol}${body}`;
}

/** Insert the contextual cancelled banner directly under the `# title`. */
function insertCancelledBanner(content, todo) {
  if (CANCELLED_BANNER_RE.test(content)) return content;
  const supersede = todo && todo.supersededBy ? ` / SUPERSEDED by [${todo.supersededBy}]` : '';
  const banner = `> **CANCELLED${supersede}**`;
  const lines = content.split('\n');
  const headingIndex = lines.findIndex((line) => line.startsWith('# '));
  if (headingIndex >= 0) {
    const before = lines.slice(0, headingIndex + 1).join('\n');
    const after = lines.slice(headingIndex + 1).join('\n');
    const afterSection = after ? `\n\n${after}` : '';
    return `${before}\n\n${banner}${afterSection}`;
  }
  return `${banner}\n\n${content}`;
}

/**
 * Check whether a todo is blocked from being set to "ready" by its dependencies.
 * A todo is blocked when at least one of its declared dependencies is not yet
 * in a terminal state (`completed` or `cancelled`), or when a dependency ID is
 * missing or ambiguous (multiple records for the same ID). Duplicate records are
 * treated as blocked regardless of which record is encountered first.
 */
function isReadyBlocked(dependencies, allTodos) {
  const terminalSet = new Set(TERMINAL_STATUSES);
  const idCounts = new Map();
  const idStatus = new Map();
  for (const t of allTodos) {
    idCounts.set(t.id, (idCounts.get(t.id) || 0) + 1);
    if (!idStatus.has(t.id)) {
      idStatus.set(t.id, t.status);
    }
  }
  return dependencies.some((depId) => {
    const count = idCounts.get(depId);
    // Missing or ambiguous (duplicate) dependency is a blocker, regardless of order.
    if (count === undefined || count > 1) return true;
    const status = idStatus.get(depId);
    return status === undefined || !terminalSet.has(status);
  });
}

/**
 * Plan a status transition. Pure: no file system, no editor API.
 *
 * Returns null when the status is unchanged (no-op). Otherwise returns the
 * next document content, the next filename, and the target status folder
 * (relative to the todo's source base; the adapter prepends that base).
 *
 * @param {object} params
 * @param {string} params.content - current document text
 * @param {string} params.id - todo id
 * @param {string} params.status - current status (from filename/todo)
 * @param {string} params.priority - current priority
 * @param {string} params.description - description token
 * @param {string} params.newStatus - target status
 * @param {object} params.folders - { backlogged, completed, cancelled } folder names
 * @param {object} [params.todo] - optional todo record (for supersededBy)
 * @returns {object|null}
 */
function planTransition(params) {
  const { content, id, status: oldStatus, priority, description, newStatus, folders, todo } = params;
  if (!isValidStatus(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }
  if (oldStatus === newStatus) return null;

  let next = rewriteFrontmatterField(content, 'status', newStatus);

  if (newStatus === 'cancelled') {
    next = ensureTag(next, 'cancelled');
    next = insertCancelledBanner(next, todo);
  } else if (oldStatus === 'cancelled') {
    next = next.replace(CANCELLED_BANNER_RE, '');
  }

  const fileName = buildFileName(id, newStatus, priority, description);
  const targetFolder = folders && folders[newStatus] !== undefined ? folders[newStatus] : '';
  return { newContent: next, fileName, targetFolder, oldStatus, newStatus };
}

module.exports = {
  STATUSES,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  PRIORITIES,
  FILENAME_RE,
  isValidStatus,
  isReadyBlocked,
  buildFileName,
  sanitizeDescription,
  planTransition,
};
