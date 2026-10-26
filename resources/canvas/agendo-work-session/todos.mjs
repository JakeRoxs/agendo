import { CanvasError } from './errors.mjs';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, parse, resolve } from 'node:path';

const TODO_DIRS = ['docs/todos', 'todos'];
const FILENAME_RE = /^((?:(?:cql|sq)-)?\d{3,})-(pending|in-progress|ready|backlogged|complete|cancelled)-(p[123])-.*\.md$/;
const CRITERION_RE = /^(\s*-\s*\[)([ xX])(\]\s*)(.+)$/;
const TODO_ID_RE = /^(?:(?:cql|sq)-)?\d{3,}$/;
// Both satisfy a dependency; a cancelled blocker will never be delivered, so the UI flags it.
const SATISFYING_STATUSES = new Set(['complete', 'cancelled']);

export function assertTodoId(todoId) {
  if (typeof todoId !== 'string' || !TODO_ID_RE.test(todoId)) {
    throw new CanvasError('invalid_todo_id', 'todoId must be an Agendo ID, for example "033" or "cql-001"');
  }
  return todoId;
}

function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== '---') return { frontmatter: {}, body: content };

  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) return { frontmatter: {}, body: content };

  const frontmatter = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, '');
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
      backlogged: name(config.backlogFolder, 'backlog'),
      complete: name(config.completeFolder, 'complete'),
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
  return files;
}

// Cheap change marker over every todo file, so the page reloads when a related todo changes or moves.
export function todoFingerprint(workspaceRoot) {
  return todoFiles(workspaceRoot).map(f => `${f}:${statSync(f).mtimeMs}`).sort().join('|');
}

export function listTodoSummaries(workspaceRoot) {
  const byId = new Map();
  for (const filePath of todoFiles(workspaceRoot)) {
    const nameMatch = basename(filePath).match(FILENAME_RE);
    if (byId.has(nameMatch[1])) continue;
    const { frontmatter, body } = parseFrontmatter(readFileSync(filePath, 'utf-8'));
    byId.set(nameMatch[1], {
      id: nameMatch[1],
      title: frontmatter.title || body.match(/^#\s+(.+)$/m)?.[1].trim() || `Todo ${nameMatch[1]}`,
      status: nameMatch[2],
      priority: nameMatch[3],
      dependencies: normalizeDependencies(frontmatter.dependencies)
    });
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
    if (!dep) return { id, missing: true, satisfied: false };
    const { title, status, priority } = dep;
    return {
      id, title, status, priority,
      satisfied: SATISFYING_STATUSES.has(status),
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

export function findTodoFile(todoId, workspaceRoot) {
  if (!todoId || !TODO_ID_RE.test(todoId)) return null;
  for (const { dirs } of todoLocations(workspaceRoot)) {
    for (const fullPath of dirs) {
      if (!existsSync(fullPath)) continue;
      const file = readdirSync(fullPath).find(f => f.startsWith(`${todoId}-`) && FILENAME_RE.test(f));
      if (file) return join(fullPath, file);
    }
  }
  return null;
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

  const criteria = [];
  const criteriaRange = findSection(bodyLines, 'Acceptance Criteria');
  if (criteriaRange) {
    for (const line of bodyLines.slice(criteriaRange.start + 1, criteriaRange.end)) {
      const match = line.match(CRITERION_RE);
      if (match) criteria.push({ met: match[2].toLowerCase() === 'x', text: match[4].trim() });
    }
  }

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
    status: nameMatch?.[2] || frontmatter.status || 'pending',
    priority: nameMatch?.[3] || frontmatter.priority || 'p3',
    dependencies: normalizeDependencies(frontmatter.dependencies)
  };
}

// Edit only the targeted checkbox line, then replace the file atomically so a
// concurrent reader or the Agendo file watcher never sees a partial write.
export function setCriterionMet(todoId, index, met, workspaceRoot) {
  assertTodoId(todoId);
  if (typeof met !== 'boolean') {
    throw new CanvasError('invalid_input', 'met must be a boolean');
  }
  const filePath = findTodoFile(todoId, workspaceRoot);
  if (!filePath) {
    throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const range = findSection(lines, 'Acceptance Criteria');

  const criterionLines = [];
  if (range) {
    for (let i = range.start + 1; i < range.end; i++) {
      if (CRITERION_RE.test(lines[i])) criterionLines.push(i);
    }
  }
  if (!Number.isInteger(index) || index < 0 || index >= criterionLines.length) {
    throw new CanvasError('invalid_index', `Criterion index ${index} out of range`);
  }

  const lineIndex = criterionLines[index];
  lines[lineIndex] = lines[lineIndex].replace(CRITERION_RE, `$1${met ? 'x' : ' '}$3$4`);

  const temp = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, lines.join(eol), 'utf-8');
  renameSync(temp, filePath);

  const todo = loadTodo(todoId, workspaceRoot);
  return {
    success: true,
    message: `Criterion ${index + 1} marked as ${met ? 'met' : 'not met'}`,
    completed: todo.criteria.filter(c => c.met).length,
    total: todo.criteria.length
  };
}

export const STATUSES = ['pending', 'in-progress', 'ready', 'backlogged', 'complete', 'cancelled'];
const CANCELLED_BANNER_RE = /^>\s*\*\*CANCELLED[^\n]*\n?(?:\r?\n)?/m;

// Rewrite one flow-style frontmatter field, or add it when missing.
function setFrontmatterField(lines, key, value) {
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  const index = lines.findIndex((line, i) => i > 0 && i < end && new RegExp(`^${key}\\s*:`).test(line));
  if (index !== -1) lines[index] = `${key}: ${value}`;
  else lines.splice(end, 0, `${key}: ${value}`);
}

function addCancelledTag(lines) {
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  const index = lines.findIndex((line, i) => i > 0 && i < end && /^tags\s*:\s*\[.*\]\s*$/.test(line));
  if (index === -1) return;
  const tags = lines[index].match(/\[(.*)\]/)[1].split(',').map(t => t.trim()).filter(Boolean);
  if (!tags.some(t => t.replace(/["']/g, '') === 'cancelled')) {
    lines[index] = `tags: [${[...tags, 'cancelled'].join(', ')}]`;
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

  const content = readFileSync(filePath, 'utf-8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  let lines = content.split(/\r?\n/);
  if (lines[0].trim() === '---') {
    setFrontmatterField(lines, 'status', newStatus);
    if (newStatus === 'cancelled') addCancelledTag(lines);
  }

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
