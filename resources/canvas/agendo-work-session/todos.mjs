import { CanvasError } from './errors.mjs';
import { existsSync, mkdirSync, openSync, closeSync, fchmodSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, parse, resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

const TODO_DIRS = ['docs/todos', 'todos'];
const FILENAME_RE = /^((?:(?:cql|sq)-)?\d{3,})-(pending|in-progress|ready|backlogged|completed|cancelled)-(p[123])-.*\.md$/;
const CRITERION_RE = /^(\s*-\s*\[)([ xX])(\]\s*)(.+)$/;
const TODO_ID_RE = /^(?:(?:cql|sq)-)?\d{3,}$/;
// Both satisfy a dependency; a cancelled blocker will never be delivered, so the UI flags it.
const SATISFYING_STATUSES = new Set(['completed', 'cancelled']);

export function assertTodoId(todoId) {
  if (typeof todoId !== 'string' || !TODO_ID_RE.test(todoId)) {
    throw new CanvasError('invalid_todo_id', 'todoId must be an Agendo ID, for example "033" or "cql-001"');
  }
  return todoId;
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const decoded = JSON.parse(trimmed);
      if (typeof decoded === 'string') return decoded;
    } catch { /* Also accept ordinary YAML quoted strings. */ }
  }
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  return trimmed;
}

function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== '---') return { frontmatter: {}, body: content };

  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) return { frontmatter: {}, body: content };

  const frontmatter = {};
  for (let index = 1; index < end; index++) {
    const match = lines[index].match(/^(\w+):\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (!value) {
      const items = [];
      while (index + 1 < end) {
        const item = lines[index + 1].match(/^\s+-\s+(.+)$/);
        if (!item) break;
        items.push(unquote(item[1]));
        index++;
      }
      value = items.length ? items : '';
    } else if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(unquote).filter(Boolean);
    } else {
      value = unquote(value);
    }
    frontmatter[match[1]] = value;
  }
  return { frontmatter, body: lines.slice(end + 1).join('\n') };
}

/**
 * Find the repository whose todos this canvas should show. A project install
 * at <repo>/.github/extensions/<name>/ knows its repo from its own location.
 * A user-level install has no repo of its own, so it starts from the process
 * working directory and walks up to the nearest folder that has a todos folder.
 */
export function resolveWorkspaceRoot(installDir, cwd = process.cwd()) {
  const extensionsDir = dirname(installDir);
  if (basename(extensionsDir) === 'extensions' && basename(dirname(extensionsDir)) === '.github') {
    return dirname(dirname(extensionsDir));
  }
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (TODO_DIRS.some(todoDir => existsSync(join(dir, todoDir)))) return dir;
    if (dir === parse(dir).root) return resolve(cwd);
  }
}

function normalizeDependencies(value) {
  const list = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];
  return [...new Set(list.map(String).filter(id => TODO_ID_RE.test(id)))];
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

// The `agendo.root` workspace setting, read from .vscode/settings.json (which may contain comments).
function configuredRoot(workspaceRoot) {
  try {
    const text = readFileSync(join(workspaceRoot, '.vscode', 'settings.json'), 'utf-8');
    return text.match(/^\s*"agendo\.root"\s*:\s*"([^"]+)"/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Every todos root with its state folders. Like the skill, this honors `agendo.root` and the
 * `.agendo-config.json` inside each root (custom folder names), falling back to the defaults.
 */
export function todoLocations(workspaceRoot) {
  const custom = configuredRoot(workspaceRoot);
  const roots = [...new Set([...(custom ? [custom] : []), ...TODO_DIRS])];
  return roots.map(dir => {
    const base = resolve(workspaceRoot, dir);
    const config = readJson(join(base, '.agendo-config.json')) ?? {};
    const name = (value, fallback) => (typeof value === 'string' && /^[\w.-]+$/.test(value) ? value : fallback);
    const folders = {
      backlogged: name(config.backloggedFolder, 'backlogged'),
      completed: name(config.completedFolder, 'completed'),
      cancelled: name(config.cancelledFolder, 'cancelled')
    };
    return [base, join(base, 'code-scanning', 'codeql'), join(base, 'code-scanning', 'sonarqube')]
      .map(sourceBase => ({ base: sourceBase, folders, dirs: ['', ...Object.values(folders)].map(sub => join(sourceBase, sub)) }));
  }).flat();
}

function todoFiles(workspaceRoot) {
  const files = [];
  for (const { dirs } of todoLocations(workspaceRoot)) {
    for (const fullPath of dirs) {
      if (!existsSync(fullPath)) continue;
      for (const name of readdirSync(fullPath)) {
        if (FILENAME_RE.test(name)) files.push(join(fullPath, name));
      }
    }
  }
  return [...new Set(files)];
}

// Cheap change marker over every todo file, so the page reloads when a related todo changes or moves.
export function todoFingerprint(workspaceRoot) {
  return todoFiles(workspaceRoot).map(f => `${f}:${statSync(f).mtimeMs}`).sort().join('|');
}

export function listTodoSummaries(workspaceRoot) {
  const byId = new Map();
  const dupes = new Set();
  for (const filePath of todoFiles(workspaceRoot)) {
    const nameMatch = basename(filePath).match(FILENAME_RE);
    if (byId.has(nameMatch[1])) {
      dupes.add(nameMatch[1]);
      continue;
    }
    const { frontmatter, body } = parseFrontmatter(readFileSync(filePath, 'utf-8'));
    byId.set(nameMatch[1], {
      id: nameMatch[1],
      title: frontmatter.title || body.match(/^#\s+(.+)$/m)?.[1].trim() || `Todo ${nameMatch[1]}`,
      status: nameMatch[2],
      priority: nameMatch[3],
      dependencies: normalizeDependencies(frontmatter.dependencies),
      ambiguous: false
    });
  }
  for (const id of dupes) {
    const existing = byId.get(id);
    if (existing) existing.ambiguous = true;
  }
  return byId;
}

export function getRelations(todoId, workspaceRoot) {
  assertTodoId(todoId);
  const all = listTodoSummaries(workspaceRoot);
  const self = all.get(todoId);
  if (!self) throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);

  const dependencies = self.dependencies.map(id => {
    const dep = all.get(id);
    if (!dep) return { id, missing: true, satisfied: false, ambiguous: false };
    const { title, status, priority } = dep;
    const ambiguous = !!dep.ambiguous;
    return {
      id, title, status, priority,
      satisfied: !ambiguous && SATISFYING_STATUSES.has(status),
      ambiguous,
      circular: dep.dependencies.includes(todoId)
    };
  });

  const dependents = [...all.values()]
    .filter(t => t.dependencies.includes(todoId))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, title, status, priority }) => ({ id, title, status, priority, active: !SATISFYING_STATUSES.has(status) && status !== 'backlogged' }));

  return {
    blocked: dependencies.some(d => !d.satisfied),
    dependencies,
    dependents
  };
}

// List all unique group names from todos in the workspace.
export function listGroups(workspaceRoot) {
  const groups = new Set();
  for (const { dirs } of todoLocations(workspaceRoot)) {
    for (const fullPath of dirs) {
      if (!existsSync(fullPath)) continue;
      for (const file of readdirSync(fullPath)) {
        const nameMatch = file.match(FILENAME_RE);
        if (!nameMatch) continue;
        try {
          const todo = loadTodo(nameMatch[1], workspaceRoot);
          if (todo.group) groups.add(todo.group);
        } catch {
          // Skip files that fail to load
        }
      }
    }
  }
  return [...groups].sort();
}

// Load all todos that belong to a specific group.
export function loadGroupTodos(groupName, workspaceRoot) {
  if (typeof groupName !== 'string' || !groupName.trim()) {
    throw new CanvasError('invalid_group', 'groupName must be a non-empty string');
  }
  const members = [];
  for (const { dirs } of todoLocations(workspaceRoot)) {
    for (const fullPath of dirs) {
      if (!existsSync(fullPath)) continue;
      for (const file of readdirSync(fullPath)) {
        const nameMatch = file.match(FILENAME_RE);
        if (!nameMatch) continue;
        const filePath = join(fullPath, file);
        try {
          const todo = loadTodo(nameMatch[1], workspaceRoot);
          if (todo.group === groupName) {
            members.push(todo);
          }
        } catch {
          // Skip files that fail to load
        }
      }
    }
  }
  // Sort by status order, then by ID
  const statusOrder = { 'in-progress': 0, 'pending': 1, 'ready': 2, 'backlogged': 3, 'completed': 4, 'cancelled': 5 };
  members.sort((a, b) => {
    const sa = statusOrder[a.status] ?? 6;
    const sb = statusOrder[b.status] ?? 6;
    if (sa !== sb) return sa - sb;
    return a.id.localeCompare(b.id);
  });
  return members;
}

export function findTodoFile(todoId, workspaceRoot) {
  if (!todoId || !TODO_ID_RE.test(todoId)) return null;
  const matches = [];
  for (const { dirs } of todoLocations(workspaceRoot)) {
    for (const fullPath of dirs) {
      if (!existsSync(fullPath)) continue;
      for (const f of readdirSync(fullPath)) {
        if (f.startsWith(`${todoId}-`) && FILENAME_RE.test(f)) {
          const abs = resolve(join(fullPath, f));
          if (!matches.some(m => resolve(m) === abs)) matches.push(abs);
        }
      }
    }
  }
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new CanvasError('invalid_input', `Ambiguous todo ID ${todoId}: ${matches.length} files match`);
  }
  return matches[0];
}

// Locate a "## Heading" section as [start, end) over raw file lines.
function findSection(lines, heading) {
  let start = -1;
  let scanner = false;
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '<!-- agendo:scan-evidence:start -->') { scanner = true; continue; }
    if (line === '<!-- agendo:scan-evidence:end -->') { scanner = false; continue; }
    if (scanner) continue;
    const marker = line.match(/^(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    if (start === -1 && line === `## ${heading}`) start = i;
    else if (start !== -1 && /^## /.test(lines[i])) return { start, end: i };
  }
  return start === -1 ? null : { start, end: lines.length };
}

function criterionLineIndices(lines) {
  const range = findSection(lines, 'Acceptance Criteria');
  const indices = [];
  let scanner = false;
  let fence = null;
  if (!range) return indices;
  for (let i = range.start + 1; i < range.end; i++) {
    const line = lines[i].trim();
    if (line === '<!-- agendo:scan-evidence:start -->') { scanner = true; continue; }
    if (line === '<!-- agendo:scan-evidence:end -->') { scanner = false; continue; }
    if (scanner) continue;
    const marker = line.match(/^(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (!fence && CRITERION_RE.test(lines[i])) indices.push(i);
  }
  return indices;
}

export function loadTodo(todoId, workspaceRoot) {
  assertTodoId(todoId);
  const filePath = findTodoFile(todoId, workspaceRoot);
  if (!filePath) {
    throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);
  }

  const { frontmatter, body: rawBody } = parseFrontmatter(readFileSync(filePath, 'utf-8'));
  const scannerBlock = rawBody.match(/<!-- agendo:scan-evidence:start -->([\s\S]*?)<!-- agendo:scan-evidence:end -->/);
  const scannerEvidence = scannerBlock?.[1].replace(/<!-- agendo:scan-snapshot\n[\s\S]*?\n-->/g, '').replace(/^\s*## Scanner Evidence\s*/, '').trim() || null;
  // Scanner explanations may contain headings and example checkboxes, not user-owned sections.
  const body = scannerBlock ? rawBody.replace(scannerBlock[0], '') : rawBody;
  const bodyLines = body.split(/\r?\n/);
  const sectionText = heading => {
    const range = findSection(bodyLines, heading);
    return range ? bodyLines.slice(range.start + 1, range.end).join('\n').trim() : null;
  };

  const criteria = criterionLineIndices(bodyLines).map(index => {
    const match = bodyLines[index].match(CRITERION_RE);
    return { met: match[2].toLowerCase() === 'x', text: match[4].trim() };
  });

  // Text under the title before the first section, then the Problem Statement.
  const titleIndex = bodyLines.findIndex(line => /^#\s+/.test(line));
  const firstSection = bodyLines.findIndex((line, i) => i > titleIndex && /^##\s+/.test(line));
  const intro = bodyLines
    .slice(titleIndex + 1, firstSection === -1 ? bodyLines.length : firstSection)
    .join('\n')
    .trim();
  const description = [intro, sectionText('Problem Statement')].filter(Boolean).join('\n\n');

  const workLog = [];
  const logText = sectionText('Work Log');
  if (logText) {
    for (const entry of logText.split(/^### /m).filter(e => e.trim())) {
      const [date, ...rest] = entry.split(/\r?\n/);
      workLog.push({ date: date.trim(), content: rest.join('\n').trim() });
    }
  }

  // Filename is authoritative for status and priority; frontmatter is only a fallback.
  const nameMatch = basename(filePath).match(FILENAME_RE);
  const filenameStatus = nameMatch?.[2];
  const filenamePriority = nameMatch?.[3];
  const frontmatterStatus = typeof frontmatter.status === 'string' ? frontmatter.status.toLowerCase() : null;
  const frontmatterPriority = typeof frontmatter.priority === 'string' ? frontmatter.priority.toLowerCase() : null;

  const validation = [];
  if (filenameStatus && frontmatterStatus && filenameStatus !== frontmatterStatus) {
    validation.push(`status mismatch: filename says "${filenameStatus}" but frontmatter says "${frontmatterStatus}"`);
  }
  if (filenamePriority && frontmatterPriority && filenamePriority !== frontmatterPriority) {
    validation.push(`priority mismatch: filename says "${filenamePriority}" but frontmatter says "${frontmatterPriority}"`);
  }
  if (!filenameStatus && !frontmatterStatus) {
    validation.push('status missing: neither filename nor frontmatter specifies status');
  }
  if (!filenamePriority && !frontmatterPriority) {
    validation.push('priority missing: neither filename nor frontmatter specifies priority');
  }
  if (titleIndex === -1) {
    validation.push('title missing: no "# Title" heading found');
  }
  const status = filenameStatus || frontmatterStatus || 'pending';
  if (['pending', 'in-progress', 'ready'].includes(status) && criteria.length === 0 && !findSection(bodyLines, 'Acceptance Criteria')) {
    validation.push('acceptance criteria missing: active todo has no Acceptance Criteria section');
  }
  if (['in-progress', 'ready'].includes(status) && workLog.length === 0 && !findSection(bodyLines, 'Work Log')) {
    validation.push('work log missing: active todo has no Work Log section');
  }
  if (status === 'in-progress' && !sectionText('Resume Context')) {
    validation.push('resume context missing: in-progress todo has no Resume Context section');
  }

  return {
    id: todoId,
    filePath,
    criteria,
    workLog,
    description,
    scannerEvidence,
    resumeContext: sectionText('Resume Context'),
    triage: ['Findings', 'Proposed Solutions', 'Recommended Action']
      .map(heading => ({ heading, text: sectionText(heading) }))
      .filter(section => section.text),
    title: frontmatter.title || body.match(/^#\s+(.+)$/m)?.[1].trim() || `Todo ${todoId}`,
    status: filenameStatus || frontmatterStatus || 'pending',
    priority: filenamePriority || frontmatterPriority || 'p3',
    dependencies: normalizeDependencies(frontmatter.dependencies),
    group: frontmatter.group || undefined,
    validation,
    scan: {
      source: frontmatter.scan_source || undefined,
      scope: frontmatter.scan_scope || undefined,
      grouping: frontmatter.scan_grouping || undefined,
      target: frontmatter.scan_target || undefined,
      refreshedAt: frontmatter.scan_refreshed_at || undefined,
      reviewRequired: frontmatter.scan_review_required === 'true'
    }
  };
}

// Revision: exact content hash + resolved path for optimistic concurrency.
export function getTodoRevision(todoId, workspaceRoot) {
  assertTodoId(todoId);
  const filePath = findTodoFile(todoId, workspaceRoot);
  if (!filePath) {
    throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);
  }
  const content = readFileSync(filePath, 'utf-8');
  return {
    content: createHash('sha256').update(content, 'utf-8').digest('hex'),
    path: filePath
  };
}

// Shared validated criterion-editing operation. Applies a set of {criterionIndex, met} changes
// atomically via temp file + rename, with EOL preservation and an optimistic revision recheck
// performed AFTER temp write and immediately BEFORE rename.
export function applyCriteriaChanges(todoId, changes, workspaceRoot, expectedRevision) {
  assertTodoId(todoId);
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new CanvasError('invalid_input', 'changes must be a non-empty array');
  }

  // Detect duplicate criterion indices
  const seen = new Set();
  for (const ch of changes) {
    if (!ch || typeof ch !== 'object' || Array.isArray(ch)) throw new CanvasError('invalid_input', 'Each criterion change must be an object');
    if (seen.has(ch.criterionIndex)) {
      throw new CanvasError('invalid_input', `duplicate criterion index ${ch.criterionIndex}`);
    }
    seen.add(ch.criterionIndex);
    if (!Number.isInteger(ch.criterionIndex) || ch.criterionIndex < 0) {
      throw new CanvasError('invalid_input', `criterionIndex must be a non-negative integer`);
    }
    if (typeof ch.met !== 'boolean') {
      throw new CanvasError('invalid_input', 'met must be a boolean');
    }
  }

  const filePath = findTodoFile(todoId, workspaceRoot);
  if (!filePath) {
    throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);
  }

  // Read content and compute baseline revision from the actual bytes
  const content = readFileSync(filePath, 'utf-8');
  const baselineRevision = {
    content: createHash('sha256').update(content, 'utf-8').digest('hex'),
    path: filePath
  };

  // Verify expected revision matches both path and content
  if (expectedRevision) {
    if (expectedRevision.path !== filePath) {
      throw new CanvasError('stale_revision', `Todo ${todoId} file has moved`);
    }
    if (expectedRevision.content !== baselineRevision.content) {
      throw new CanvasError('stale_revision', `Todo ${todoId} has changed since revision was captured`);
    }
  }

  const separators = content.match(/\r?\n/g) ?? [];
  const lines = content.split(/\r?\n/);
  const criterionLines = criterionLineIndices(lines);
  for (const ch of changes) {
    if (ch.criterionIndex >= criterionLines.length) {
      throw new CanvasError('invalid_index', `Criterion index ${ch.criterionIndex} out of range`);
    }
  }
  const mode = statSync(filePath).mode & 0o777;

  // Apply changes to the in-memory lines
  for (const ch of changes) {
    const lineIndex = criterionLines[ch.criterionIndex];
    lines[lineIndex] = lines[lineIndex].replace(CRITERION_RE, `$1${ch.met ? 'x' : ' '}$3$4`);
  }
  const nextContent = lines.map((line, index) => line + (separators[index] ?? '')).join('');
  const revision = { content: createHash('sha256').update(nextContent, 'utf-8').digest('hex'), path: filePath };

  // Write to a unique crypto-random temp file with exclusive creation (O_EXCL)
  const tempName = `.${basename(filePath)}.tmp.${randomBytes(12).toString('hex')}`;
  const temp = join(dirname(filePath), tempName);
  let fd = null;
  try {
    fd = openSync(temp, 'wx', mode);
    fchmodSync(fd, mode);
    writeFileSync(fd, nextContent, 'utf-8');
    closeSync(fd);
    fd = null;

    // Optimistic final revision recheck: read current file again, compare
    // BEFORE renaming temp over it. No async work between this read and rename.
    const currentContent = readFileSync(filePath, 'utf-8');
    const currentRevision = {
      content: createHash('sha256').update(currentContent, 'utf-8').digest('hex'),
      path: filePath
    };
    if (currentRevision.content !== baselineRevision.content || findTodoFile(todoId, workspaceRoot) !== filePath) {
      throw new CanvasError('stale_revision', `Todo ${todoId} changed during apply`);
    }

    // Atomic rename
    renameSync(temp, filePath);
  } catch (e) {
    if (fd !== null) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
    try { unlinkSync(temp); } catch { /* already gone */ }
    if (e instanceof CanvasError) throw e;
    throw new CanvasError('apply_failed', `Failed to write todo: ${e.message}`);
  }

  return {
    success: true,
    applied: changes.length,
    revision,
    completed: criterionLines.filter(index => lines[index].match(CRITERION_RE)[2].toLowerCase() === 'x').length,
    total: criterionLines.length
  };
}

// Edit only the targeted checkbox line, then replace the file atomically so a
// concurrent reader or the Agendo file watcher never sees a partial write.
export function setCriterionMet(todoId, index, met, workspaceRoot) {
  const result = applyCriteriaChanges(todoId, [{ criterionIndex: index, met }], workspaceRoot, null);
  return {
    success: true,
    message: `Criterion ${index + 1} marked as ${met ? 'met' : 'not met'}`,
    completed: result.completed,
    total: result.total
  };
}

export const STATUSES = ['pending', 'in-progress', 'ready', 'backlogged', 'completed', 'cancelled'];
export const PRIORITIES = ['p1', 'p2', 'p3'];
const CANCELLED_BANNER_RE = /^>\s*\*\*CANCELLED[^\n]*\n?(?:\r?\n)?/m;

// Rewrite one flow-style frontmatter field, or add it when missing.
function setFrontmatterField(lines, key, value) {
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) {
    throw new CanvasError('invalid_input', 'Malformed frontmatter: missing closing ---');
  }
  const index = lines.findIndex((line, i) => i > 0 && i < end && new RegExp(`^${key}\\s*:`).test(line));
  if (index !== -1) lines[index] = `${key}: ${value}`;
  else lines.splice(end, 0, `${key}: ${value}`);
}

function addCancelledTag(lines) {
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  const index = lines.findIndex((line, i) => i > 0 && i < end && /^tags\s*:/.test(line));
  const existing = parseFrontmatter(lines.join('\n')).frontmatter.tags;
  const tags = Array.isArray(existing) ? existing : existing ? [existing] : [];
  if (!tags.includes('cancelled')) tags.push('cancelled');
  const field = `[${tags.map(yamlScalar).join(', ')}]`;
  if (index === -1) setFrontmatterField(lines, 'tags', field);
  else {
    let next = index + 1;
    while (next < end && /^\s+-\s+/.test(lines[next])) next++;
    lines.splice(index, next - index, `tags: ${field}`);
  }
}

/**
 * Change a todo's status the way the extension does: update the frontmatter mirror, add or strip the
 * cancelled banner, rename the file and move it into the status's folder, all in one rename.
 */
export function setTodoStatus(todoId, newStatus, workspaceRoot) {
  assertTodoId(todoId);
  if (!STATUSES.includes(newStatus)) {
    throw new CanvasError('invalid_input', `status must be one of: ${STATUSES.join(', ')}`);
  }
  const filePath = findTodoFile(todoId, workspaceRoot);
  if (!filePath) throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);

  const name = basename(filePath);
  const [, , oldStatus, priority] = name.match(FILENAME_RE) ?? [];
  if (oldStatus === newStatus) return { success: true, message: `Already ${newStatus}`, changed: false };

  if (newStatus === 'ready') {
    const relations = getRelations(todoId, workspaceRoot);
    if (relations.blocked) {
      const blockedBy = relations.dependencies.filter(d => !d.satisfied).map(d => d.id).join(', ');
      throw new CanvasError('invalid_input', `Cannot set to ready: unresolved dependencies ${blockedBy}`);
    }
  }

  const content = readFileSync(filePath, 'utf-8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  let lines = content.split(/\r?\n/);
  if (lines[0].trim() === '---') {
    setFrontmatterField(lines, 'status', newStatus);
  } else {
    lines.unshift('---', `status: ${newStatus}`, '---');
  }
  if (newStatus === 'cancelled') addCancelledTag(lines);

  let text = lines.join(eol);
  if (newStatus === 'cancelled' && !CANCELLED_BANNER_RE.test(text)) {
    lines = text.split(/\r?\n/);
    const heading = lines.findIndex(l => l.startsWith('# '));
    if (heading !== -1) lines.splice(heading + 1, 0, '', '> **CANCELLED**');
    text = lines.join(eol);
  } else if (oldStatus === 'cancelled') {
    text = text.replace(CANCELLED_BANNER_RE, '');
  }

  const location = todoLocations(workspaceRoot).find(l => l.dirs.includes(dirname(filePath)));
  const targetDir = location.folders[newStatus] ? join(location.base, location.folders[newStatus]) : location.base;
  const slug = name.replace(/^(?:(?:cql|sq)-)?\d{3,}-[a-z-]+?-p[123]-/, '');
  const target = join(targetDir, `${todoId}-${newStatus}-${priority}-${slug}`);

  const temp = join(dirname(filePath), `.${name}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, text, 'utf-8');
  renameSync(temp, filePath);
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  renameSync(filePath, target);
  return { success: true, message: `Status changed to ${newStatus}`, changed: true, filePath: target };
}

export function setTodoPriority(todoId, newPriority, workspaceRoot) {
  assertTodoId(todoId);
  if (!PRIORITIES.includes(newPriority)) {
    throw new CanvasError('invalid_input', `priority must be one of: ${PRIORITIES.join(', ')}`);
  }
  const filePath = findTodoFile(todoId, workspaceRoot);
  if (!filePath) throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);

  const name = basename(filePath);
  const [, , status, oldPriority] = name.match(FILENAME_RE) ?? [];
  if (oldPriority === newPriority) return { success: true, message: `Already ${newPriority}`, changed: false };

  const content = readFileSync(filePath, 'utf-8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  let lines = content.split(/\r?\n/);
  if (lines[0].trim() === '---') {
    setFrontmatterField(lines, 'priority', newPriority);
  } else {
    lines.unshift('---', `priority: ${newPriority}`, '---');
  }

  const text = lines.join(eol);
  const slug = name.replace(/^(?:(?:cql|sq)-)?\d{3,}-[a-z-]+?-p[123]-/, '');
  const target = join(dirname(filePath), `${todoId}-${status}-${newPriority}-${slug}`);

  const temp = join(dirname(filePath), `.${name}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, text, 'utf-8');
  renameSync(temp, filePath);
  renameSync(filePath, target);
  return { success: true, message: `Priority changed to ${newPriority}`, changed: true, filePath: target };
}

function yamlScalar(value) {
  if (/^[\w.-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

export function setTodoGroup(todoId, newGroup, workspaceRoot) {
  assertTodoId(todoId);
  if (typeof newGroup !== 'string') {
    throw new CanvasError('invalid_input', 'group must be a string');
  }
  const trimmed = newGroup.trim();
  if (newGroup.length > 200) {
    throw new CanvasError('invalid_input', 'group must be at most 200 characters');
  }
  if (/[\r\n\0]/.test(newGroup)) {
    throw new CanvasError('invalid_input', 'group must be a single line');
  }
  const filePath = findTodoFile(todoId, workspaceRoot);
  if (!filePath) throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);

  const content = readFileSync(filePath, 'utf-8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  let lines = content.split(/\r?\n/);

  if (lines[0].trim() === '---' && lines.findIndex((line, i) => i > 0 && line.trim() === '---') === -1) {
    throw new CanvasError('invalid_input', 'Malformed frontmatter: missing closing ---');
  }
  if (!trimmed) {
    if (lines[0].trim() === '---') {
      const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
      const groupIndex = lines.findIndex((line, i) => i > 0 && i < end && /^group\s*:/.test(line));
      if (groupIndex !== -1) lines.splice(groupIndex, 1);
    }
  } else if (lines[0].trim() === '---') {
    setFrontmatterField(lines, 'group', yamlScalar(trimmed));
  } else {
    lines.unshift('---', `group: ${yamlScalar(trimmed)}`, '---');
  }

  const text = lines.join(eol);
  const temp = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, text, 'utf-8');
  renameSync(temp, filePath);
  return { success: true, message: trimmed ? `Group set to ${trimmed}` : 'Group cleared', changed: true, filePath };
}
