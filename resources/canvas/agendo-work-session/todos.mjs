import { CanvasError } from './errors.mjs';
import {
  FILENAME_RE,
  isReadyBlocked,
  isValidStatus,
  planTransition,
  PRIORITIES,
  STATUSES,
  TERMINAL_STATUSES,
} from './statusLifecycle.js';
import { existsSync, mkdirSync, openSync, closeSync, fchmodSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, parse, resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

const TODO_DIRS = ['docs/todos', 'todos'];
const CRITERION_RE = /^(\s*-\s*\[)([ xX])(\])(.+)$/;
const TODO_ID_RE = /^(?:cql-|sq-)?\d{3,}$/;
export function assertTodoId(todoId) {
  if (typeof todoId !== 'string' || !TODO_ID_RE.test(todoId)) {
    throw new CanvasError('invalid_todo_id', 'todoId must be an Agendo ID, for example "033" or "cql-001"');
  }
  return todoId;
}

function isQuoted(value) {
  return (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
}

function parseQuotedValue(trimmed) {
  try {
    const decoded = JSON.parse(trimmed);
    if (typeof decoded === 'string') return decoded;
  } catch { /* Also accept ordinary YAML quoted strings. */ }
  return null;
}

function unquote(value) {
  const trimmed = value.trim();
  if (isQuoted(trimmed)) {
    const decoded = parseQuotedValue(trimmed);
    return decoded !== null ? decoded : trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatterScalar(value) {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').map(unquote).filter(Boolean);
  }
  return unquote(value);
}

function parseFrontmatterListItems(lines, index, end) {
  const items = [];
  let consumed = 0;
  while (index + 1 + consumed < end) {
    const item = lines[index + 1 + consumed].match(/^\s+-\s+(\S.*)$/);
    if (!item) break;
    items.push(unquote(item[1]));
    consumed++;
  }
  return { items, consumed };
}

function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== '---') return { frontmatter: {}, body: content };

  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) return { frontmatter: {}, body: content };

  const frontmatter = {};
  let skip = 0;
  for (let index = 1; index < end; index++) {
    if (skip > 0) {
      skip--;
      continue;
    }
    const match = lines[index].match(/^(\w+):(.*)$/);
    if (!match) continue;
    let value;
    if (match[2].trim() === '') {
      const { items, consumed } = parseFrontmatterListItems(lines, index, end);
      value = items.length ? items : '';
      skip = consumed;
    } else {
      value = parseFrontmatterScalar(match[2].trim());
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
  let list;
  if (Array.isArray(value)) {
    list = value;
  } else if (typeof value === 'string' && value) {
    list = [value];
  } else {
    list = [];
  }
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
    return text.match(/^"agendo\.root"\s*:\s*"([^"]+)"/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Resolve the state-folder names from a `.agendo-config.json` projection, falling back to defaults. */
function folderNames(config) {
  const name = (value, fallback) => (typeof value === 'string' && /^[\w.-]+$/.test(value) ? value : fallback);
  return {
    backlogged: name(config.backloggedFolder, 'backlogged'),
    completed: name(config.completedFolder, 'completed'),
    cancelled: name(config.cancelledFolder, 'cancelled'),
  };
}

/**
 * Every todos root with its state folders. Like the skill, this honors `agendo.root` and the
 * `.agendo-config.json` inside each root (custom folder names), falling back to the defaults.
 *
 * When `rootMode` is `"manual"`, `workspaceRoot` is the todo directory itself (a manually added
 * root), so todos are read directly from it rather than from a `docs/todos` or `todos` subfolder.
 */
export function todoLocations(workspaceRoot, rootMode = "workspace") {
  if (rootMode === "manual") {
    // A manually added root is the todo directory itself; read its
    // `.agendo-config.json` projection and look for todos directly inside it.
    const config = readJson(join(workspaceRoot, '.agendo-config.json')) ?? {};
    const folders = folderNames(config);
    const sourceBases = [workspaceRoot, join(workspaceRoot, 'code-scanning', 'codeql'), join(workspaceRoot, 'code-scanning', 'sonarqube')];
    return sourceBases.map(sourceBase => ({
      base: sourceBase,
      folders,
      dirs: ['', ...Object.values(folders)].map(sub => join(sourceBase, sub)),
    }));
  }
  const custom = configuredRoot(workspaceRoot);
  const roots = [...new Set([...(custom ? [custom] : []), ...TODO_DIRS])];
  return roots.flatMap(dir => {
    const base = resolve(workspaceRoot, dir);
    const config = readJson(join(base, '.agendo-config.json')) ?? {};
    const folders = folderNames(config);
    return [base, join(base, 'code-scanning', 'codeql'), join(base, 'code-scanning', 'sonarqube')]
      .map(sourceBase => ({ base: sourceBase, folders, dirs: ['', ...Object.values(folders)].map(sub => join(sourceBase, sub)) }));
  });
}

function todoFiles(workspaceRoot, rootMode = "workspace") {
  const files = [];
  for (const { dirs } of todoLocations(workspaceRoot, rootMode)) {
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
export function todoFingerprint(workspaceRoot, rootMode = "workspace") {
  return todoFiles(workspaceRoot, rootMode).map(f => `${f}:${statSync(f).mtimeMs}`).sort((a, b) => a.localeCompare(b)).join('|');
}

export function listTodoSummaries(workspaceRoot, rootMode = "workspace") {
  const byId = new Map();
  const dupes = new Set();
  for (const filePath of todoFiles(workspaceRoot, rootMode)) {
    const nameMatch = basename(filePath).match(FILENAME_RE);
    if (byId.has(nameMatch[1])) {
      dupes.add(nameMatch[1]);
      continue;
    }
    const { frontmatter, body } = parseFrontmatter(readFileSync(filePath, 'utf-8'));
    byId.set(nameMatch[1], {
      id: nameMatch[1],
      title: frontmatter.title || body.match(/^#\s+(\S.*)$/m)?.[1].trim() || `Todo ${nameMatch[1]}`,
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

export function getRelations(todoId, workspaceRoot, rootMode = "workspace") {
  assertTodoId(todoId);
  const all = listTodoSummaries(workspaceRoot, rootMode);
  const self = all.get(todoId);
  if (!self) throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);

  const dependencies = self.dependencies.map(id => {
    const dep = all.get(id);
    if (!dep) return { id, missing: true, satisfied: false, ambiguous: false };
    const { title, status, priority } = dep;
    const ambiguous = !!dep.ambiguous;
    return {
      id, title, status, priority,
      satisfied: !ambiguous && TERMINAL_STATUSES.includes(status),
      ambiguous,
      circular: dep.dependencies.includes(todoId)
    };
  });

  const dependents = [...all.values()]
    .filter(t => t.dependencies.includes(todoId))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, title, status, priority }) => ({ id, title, status, priority, active: !TERMINAL_STATUSES.includes(status) && status !== 'backlogged' }));

  return {
    blocked: dependencies.some(d => !d.satisfied),
    dependencies,
    dependents
  };
}

// List all unique group names from todos in the workspace.
export function listGroups(workspaceRoot, rootMode = "workspace") {
  const groups = new Set();
  for (const { dirs } of todoLocations(workspaceRoot, rootMode)) {
    for (const fullPath of dirs) {
      visitTodoFiles(fullPath, workspaceRoot, rootMode, todo => {
        if (todo.group) groups.add(todo.group);
      });
    }
  }
  return [...groups].sort((a, b) => a.localeCompare(b));
}

// Visit every loadable todo under a directory, skipping files that fail to load.
function visitTodoFiles(dir, workspaceRoot, rootMode, visitor) {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    const nameMatch = file.match(FILENAME_RE);
    if (!nameMatch) continue;
    try {
      visitor(loadTodo(nameMatch[1], workspaceRoot, rootMode));
    } catch {
      // Skip files that fail to load
    }
  }
}

// Load all todos that belong to a specific group.
export function loadGroupTodos(groupName, workspaceRoot, rootMode = "workspace") {
  if (typeof groupName !== 'string' || !groupName.trim()) {
    throw new CanvasError('invalid_group', 'groupName must be a non-empty string');
  }
  const members = [];
  for (const { dirs } of todoLocations(workspaceRoot, rootMode)) {
    for (const fullPath of dirs) {
      visitTodoFiles(fullPath, workspaceRoot, rootMode, todo => {
        if (todo.group === groupName) members.push(todo);
      });
    }
  }
  members.sort(compareGroupTodos);
  return members;
}

function compareGroupTodos(a, b) {
  const statusOrder = { 'in-progress': 0, 'pending': 1, 'ready': 2, 'backlogged': 3, 'completed': 4, 'cancelled': 5 };
  const sa = statusOrder[a.status] ?? 6;
  const sb = statusOrder[b.status] ?? 6;
  if (sa !== sb) return sa - sb;
  return a.id.localeCompare(b.id);
}

function scanDirForTodo(dir, todoId, matches) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (f.startsWith(`${todoId}-`) && FILENAME_RE.test(f)) {
      matches.add(resolve(join(dir, f)));
    }
  }
}

export function findTodoFile(todoId, workspaceRoot, rootMode = "workspace") {
  if (!todoId || !TODO_ID_RE.test(todoId)) return null;
  const matches = new Set();
  for (const { dirs } of todoLocations(workspaceRoot, rootMode)) {
    for (const fullPath of dirs) {
      scanDirForTodo(fullPath, todoId, matches);
    }
  }
  if (matches.size === 0) return null;
  if (matches.size > 1) {
    throw new CanvasError('invalid_input', `Ambiguous todo ID ${todoId}: ${matches.size} files match`);
  }
  return [...matches][0];
}

// Locate a "## Heading" section as [start, end) over raw file lines.
function toggleScanner(line, scanner) {
  if (line.startsWith('<!-- agendo:scan-evidence:start -->')) return true;
  if (line.startsWith('<!-- agendo:scan-evidence:end -->')) return false;
  return scanner;
}

function findSection(lines, heading) {
  let start = -1;
  let scanner = false;
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    scanner = toggleScanner(line, scanner);
    if (scanner) continue;
    const marker = line.match(/^(`{3,}|~{3,})/);
    if (marker) {
      fence = updateFence(marker, fence);
      continue;
    }
    if (fence) continue;
    if (start === -1) {
      const headingLine = `## ${heading}`;
      if (line.startsWith(headingLine) && line.length === headingLine.length) start = i;
    } else if (lines[i].startsWith('## ')) {
      return { start, end: i };
    }
  }
  return start === -1 ? null : { start, end: lines.length };
}

function updateFence(marker, fence) {
  if (!fence) return marker[1];
  if (marker[1][0] === fence[0] && marker[1].length >= fence.length) return null;
  return fence;
}

function criterionLineIndices(lines) {
  const range = findSection(lines, 'Acceptance Criteria');
  const indices = [];
  let scanner = false;
  let fence = null;
  if (!range) return indices;
  for (let i = range.start + 1; i < range.end; i++) {
    const line = lines[i].trim();
    if (line.startsWith('<!-- agendo:scan-evidence:start -->')) { scanner = true; continue; }
    if (line.startsWith('<!-- agendo:scan-evidence:end -->')) { scanner = false; continue; }
    if (scanner) continue;
    const marker = line.match(/^(`{3,}|~{3,})/);
    if (marker) {
      fence = updateFence(marker, fence);
      continue;
    }
    if (fence) continue;
    if (!fence && CRITERION_RE.test(lines[i])) indices.push(i);
  }
  return indices;
}

function extractScannerEvidenceFromBlock(scannerBlock) {
  if (!scannerBlock) return null;
  return scannerBlock[1]
    .replace(/<!-- agendo:scan-snapshot\n[\s\S]*?\n-->/g, '')
    .replace(/^\s*## Scanner Evidence\s*/, '')
    .trim() || null;
}

function parseCriteria(bodyLines) {
  return criterionLineIndices(bodyLines).map(index => {
    const match = bodyLines[index].match(CRITERION_RE);
    return { met: match[2].toLowerCase() === 'x', text: match[4].trim() };
  });
}

function parseWorkLog(logText) {
  const workLog = [];
  if (!logText) return workLog;
  let sourceOrder = 0;
  for (const entry of logText.split(/^### /m).filter(e => e.trim())) {
    const [date, ...rest] = entry.split(/\r?\n/);
    const heading = date.trim();
    const timestamp = heading.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})\b/);
    const day = heading.match(/\b\d{4}-\d{2}-\d{2}\b/);
    const sortTime = timestamp ? Date.parse(timestamp[0]) : day ? Date.parse(`${day[0]}T00:00:00Z`) : Number.NEGATIVE_INFINITY;
    workLog.push({ date: heading, content: rest.join('\n').trim(), sortTime, sourceOrder: sourceOrder++ });
  }
  return workLog.sort((a, b) => b.sortTime - a.sortTime || a.sourceOrder - b.sourceOrder)
    .map(({ date, content }) => ({ date, content }));
}

function computeValidation(ctx) {
  const {
    filenameStatus,
    frontmatterStatus,
    filenamePriority,
    frontmatterPriority,
    titleIndex,
    criteria,
    bodyLines,
    workLog,
    sectionText,
  } = ctx;
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
  return validation;
}

function computeTitle(frontmatter, body, todoId) {
  return frontmatter.title || body.match(/^#\s+(\S.*)$/m)?.[1].trim() || `Todo ${todoId}`;
}

export function loadTodo(todoId, workspaceRoot, rootMode = "workspace") {
  assertTodoId(todoId);
  const filePath = findTodoFile(todoId, workspaceRoot, rootMode);
  if (!filePath) {
    throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);
  }

  const { frontmatter, body: rawBody } = parseFrontmatter(readFileSync(filePath, 'utf-8'));
  const scannerBlock = rawBody.match(/<!-- agendo:scan-evidence:start -->([\s\S]*?)<!-- agendo:scan-evidence:end -->/);
  const scannerEvidence = extractScannerEvidenceFromBlock(scannerBlock);
  // Scanner explanations may contain headings and example checkboxes, not user-owned sections.
  const body = scannerBlock ? rawBody.replace(scannerBlock[0], '') : rawBody;
  const bodyLines = body.split(/\r?\n/);
  const sectionText = heading => {
    const range = findSection(bodyLines, heading);
    return range ? bodyLines.slice(range.start + 1, range.end).join('\n').trim() : null;
  };

  const criteria = parseCriteria(bodyLines);

  // Text under the title before the first section, then the Problem Statement.
  const titleIndex = bodyLines.findIndex(line => /^#\s+/.test(line));
  const firstSection = bodyLines.findIndex((line, i) => i > titleIndex && /^##\s+/.test(line));
  const intro = bodyLines
    .slice(titleIndex + 1, firstSection === -1 ? bodyLines.length : firstSection)
    .join('\n')
    .trim();
  const description = [intro, sectionText('Problem Statement')].filter(Boolean).join('\n\n');

  const workLog = parseWorkLog(sectionText('Work Log'));

  // Filename is authoritative for status and priority; frontmatter is only a fallback.
  const nameMatch = basename(filePath).match(FILENAME_RE);
  const filenameStatus = nameMatch?.[2];
  const filenamePriority = nameMatch?.[3];
  const frontmatterStatus = typeof frontmatter.status === 'string' ? frontmatter.status.toLowerCase() : null;
  const frontmatterPriority = typeof frontmatter.priority === 'string' ? frontmatter.priority.toLowerCase() : null;

  const validation = computeValidation({
    filenameStatus,
    frontmatterStatus,
    filenamePriority,
    frontmatterPriority,
    titleIndex,
    criteria,
    bodyLines,
    workLog,
    sectionText,
  });

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
    title: computeTitle(frontmatter, body, todoId),
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
export function getTodoRevision(todoId, workspaceRoot, rootMode = "workspace") {
  assertTodoId(todoId);
  const filePath = findTodoFile(todoId, workspaceRoot, rootMode);
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
function validateCriterionChanges(changes) {
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new CanvasError('invalid_input', 'changes must be a non-empty array');
  }
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
}

function readBaselineRevision(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return {
    content,
    revision: {
      content: createHash('sha256').update(content, 'utf-8').digest('hex'),
      path: filePath
    }
  };
}

function verifyExpectedRevision(expectedRevision, baselineRevision, filePath, todoId) {
  if (!expectedRevision) return;
  if (expectedRevision.path !== filePath) {
    throw new CanvasError('stale_revision', `Todo ${todoId} file has moved`);
  }
  if (expectedRevision.content !== baselineRevision.content) {
    throw new CanvasError('stale_revision', `Todo ${todoId} has changed since revision was captured`);
  }
}

function applyChangesToLines(content, changes, filePath) {
  const separators = content.match(/\r?\n/g) ?? [];
  const lines = content.split(/\r?\n/);
  const criterionLines = criterionLineIndices(lines);
  for (const ch of changes) {
    if (ch.criterionIndex >= criterionLines.length) {
      throw new CanvasError('invalid_index', `Criterion index ${ch.criterionIndex} out of range`);
    }
  }
  const mode = statSync(filePath).mode & 0o777;
  for (const ch of changes) {
    const lineIndex = criterionLines[ch.criterionIndex];
    lines[lineIndex] = lines[lineIndex].replace(CRITERION_RE, `$1${ch.met ? 'x' : ' '}$3$4`);
  }
  const nextContent = lines.map((line, index) => line + (separators[index] ?? '')).join('');
  return { nextContent, lines, criterionLines, mode };
}

// Shared validated criterion-editing operation. Applies a set of {criterionIndex, met} changes
// atomically via temp file + rename, with EOL preservation and an optimistic revision recheck
// performed AFTER temp write and immediately BEFORE rename.
export function applyCriteriaChanges(todoId, changes, workspaceRoot, expectedRevision, rootMode = "workspace") {
  assertTodoId(todoId);
  validateCriterionChanges(changes);

  const filePath = findTodoFile(todoId, workspaceRoot, rootMode);
  if (!filePath) {
    throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);
  }

  const { content, revision: baselineRevision } = readBaselineRevision(filePath);
  verifyExpectedRevision(expectedRevision, baselineRevision, filePath, todoId);

  const { nextContent, lines, criterionLines, mode } = applyChangesToLines(content, changes, filePath);
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
export function setCriterionMet(todoId, index, met, workspaceRoot, rootMode = "workspace") {
  const result = applyCriteriaChanges(todoId, [{ criterionIndex: index, met }], workspaceRoot, null, rootMode);
  return {
    success: true,
    message: `Criterion ${index + 1} marked as ${met ? 'met' : 'not met'}`,
    completed: result.completed,
    total: result.total
  };
}

// Rewrite one flow-style frontmatter field, or add it when missing.
function setFrontmatterField(lines, key, value) {
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) {
    throw new CanvasError('invalid_input', 'Malformed frontmatter: missing closing ---');
  }
  const index = lines.findIndex((line, i) => i > 0 && i < end && new RegExp(String.raw`^${key}\s*:`).test(line));
  if (index !== -1) lines[index] = `${key}: ${value}`;
  else lines.splice(end, 0, `${key}: ${value}`);
}

// Resolve the todo location and state folders for a file path.
function resolveTodoLocation(filePath, workspaceRoot, rootMode) {
  const locations = todoLocations(workspaceRoot, rootMode);
  const location = locations.find((l) => l.dirs.includes(dirname(filePath)));
  const folders = location ? location.folders : {
    backlogged: 'backlogged',
    completed: 'completed',
    cancelled: 'cancelled',
  };
  return { location, folders };
}

// Enforce the shared ready gate: an ambiguous dependency is unsatisfied even
// when one copy is terminal.
function enforceReadyGate(todo, all, allTodos, newStatus) {
  if (newStatus !== 'ready') return;
  const blocked = isReadyBlocked(todo.dependencies, allTodos) ||
    todo.dependencies.some((depId) => all.get(depId)?.ambiguous);
  if (blocked) {
    const blockedBy = todo.dependencies.filter((depId) => {
      const dep = all.get(depId);
      return !dep || !TERMINAL_STATUSES.includes(dep.status) || dep.ambiguous;
    }).join(', ');
    throw new CanvasError('invalid_input', `Cannot set to ready: unresolved dependencies ${blockedBy}`);
  }
}

export function setTodoStatus(todoId, newStatus, workspaceRoot, rootMode = "workspace") {
  assertTodoId(todoId);
  if (!isValidStatus(newStatus)) {
    throw new CanvasError('invalid_input', `status must be one of: ${STATUSES.join(', ')}`);
  }
  const filePath = findTodoFile(todoId, workspaceRoot, rootMode);
  if (!filePath) throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);

  const name = basename(filePath);
  const nameMatch = name.match(FILENAME_RE);
  if (!nameMatch) {
    throw new CanvasError('invalid_input', `Todo ${todoId} has an invalid filename`);
  }
  const [, id, oldStatus, priority, description] = nameMatch;
  if (oldStatus === newStatus) return { success: true, message: `Already ${newStatus}`, changed: false };

  const content = readFileSync(filePath, 'utf-8');

  // Derive the todo record and dependency statuses for the shared ready gate.
  const todo = loadTodo(todoId, workspaceRoot, rootMode);
  const all = listTodoSummaries(workspaceRoot, rootMode);
  const allTodos = [...all.values()].map((t) => ({ id: t.id, status: t.status }));
  enforceReadyGate(todo, all, allTodos, newStatus);

  const { location, folders } = resolveTodoLocation(filePath, workspaceRoot, rootMode);

  let plan;
  try {
    plan = planTransition({
      content,
      id,
      status: oldStatus,
      priority,
      description,
      newStatus,
      folders,
    });
  } catch (e) {
    // The core is pure and throws plain Errors (e.g. malformed frontmatter);
    // the canvas adapter surfaces them as actionable CanvasErrors.
    if (e instanceof CanvasError) throw e;
    throw new CanvasError('invalid_input', `Failed to plan transition: ${e.message}`);
  }
  if (!plan) return { success: true, message: `Already ${newStatus}`, changed: false };

  const { newContent, fileName, targetFolder } = plan;
  const targetDir = targetFolder ? join(location.base, targetFolder) : location.base;

  // Atomic temp write + rename + move, mirroring the criteria editor's transaction.
  const temp = join(dirname(filePath), `.${name}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, newContent, 'utf-8');
  renameSync(temp, filePath);
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  renameSync(filePath, join(targetDir, fileName));
  return { success: true, message: `Status changed to ${newStatus}`, changed: true, filePath: join(targetDir, fileName) };
}

export function setTodoPriority(todoId, newPriority, workspaceRoot, rootMode = "workspace") {
  assertTodoId(todoId);
  if (!PRIORITIES.includes(newPriority)) {
    throw new CanvasError('invalid_input', `priority must be one of: ${PRIORITIES.join(', ')}`);
  }
  const filePath = findTodoFile(todoId, workspaceRoot, rootMode);
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

function updateGroupField(lines, trimmed, hasFrontmatter) {
  if (!trimmed) {
    if (hasFrontmatter) {
      const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
      if (end !== -1) {
        const groupIndex = lines.findIndex((line, i) => i > 0 && i < end && /^group\s*:/.test(line));
        if (groupIndex !== -1) lines.splice(groupIndex, 1);
      }
    }
  } else if (hasFrontmatter) {
    setFrontmatterField(lines, 'group', yamlScalar(trimmed));
  } else {
    lines.unshift('---', `group: ${yamlScalar(trimmed)}`, '---');
  }
}

export function setTodoGroup(todoId, newGroup, workspaceRoot, rootMode = "workspace") {
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
  const filePath = findTodoFile(todoId, workspaceRoot, rootMode);
  if (!filePath) throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const hasFrontmatter = lines[0].trim() === '---';
  if (hasFrontmatter && !lines.some((line, i) => i > 0 && line.trim() === '---')) {
    throw new CanvasError('invalid_input', 'Malformed frontmatter: missing closing ---');
  }
  const { frontmatter } = parseFrontmatter(content);
  const currentGroup = typeof frontmatter.group === 'string' ? frontmatter.group : undefined;
  const nextGroup = trimmed || undefined;
  if (currentGroup === nextGroup) {
    return {
      success: true,
      message: nextGroup ? `Already ${nextGroup}` : 'Already cleared',
      changed: false,
    };
  }

  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  updateGroupField(lines, trimmed, hasFrontmatter);

  const text = lines.join(eol);
  const temp = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, text, 'utf-8');
  renameSync(temp, filePath);
  return { success: true, message: trimmed ? `Group set to ${trimmed}` : 'Group cleared', changed: true, filePath };
}

export { PRIORITIES, STATUSES };
