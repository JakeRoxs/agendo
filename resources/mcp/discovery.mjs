import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { createConnection } from 'node:net';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

const uuid = '[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
const registrationName = new RegExp(String.raw`^${uuid}\.json$`);
const unixDirectory = new RegExp(`^agendo-ipc-${uuid}$`);
const pipePrefix = String.raw`\\.\pipe\agendo-`;
const pipeToken = new RegExp(`^${uuid}$`);

/** Canonicalize an absolute filesystem path for cross-platform identity comparison. */
function normalizePath(path) {
  const normalized = resolve(path).replaceAll('\\', '/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/**
 * Stable identity for a workspace root: SHA-256 of the normalized absolute
 * path. The extension and the bundled MCP server compute the same identity from
 * a path, so the server can match a client's CWD to a registration.
 */
export function workspaceIdentity(workspacePath) {
  return createHash('sha256').update(normalizePath(workspacePath)).digest('hex');
}

function validEndpoint(endpoint) {
  if (typeof endpoint !== 'string') return false;
  return process.platform === 'win32'
    ? endpoint.startsWith(pipePrefix) && pipeToken.test(endpoint.slice(pipePrefix.length))
    : isAbsolute(endpoint) && basename(endpoint) === 'socket' && unixDirectory.test(basename(dirname(endpoint)));
}

async function readEndpoint(fullPath, name) {
  if (!registrationName.test(name)) return undefined;
  try {
    const record = JSON.parse(await readFile(fullPath, 'utf8'));
    if (!validEndpoint(record?.endpoint)) return undefined;
    // rootMode is validated at consumption time; preserve the raw value so
    // buildCandidates can apply its safe default ('workspace').
    const rootMode = typeof record.rootMode === 'string' ? record.rootMode : undefined;
    const label = typeof record.label === 'string' ? record.label : undefined;
    // The registration filename (without extension) is a registration-scoped,
    // opaque bridge ID. It may change after restart because a new UUID is
    // generated for each registration.
    const id = name.replace(/\.json$/, '');
    return {
      id,
      endpoint: record.endpoint,
      hostPid: Number.isSafeInteger(record.hostPid) && record.hostPid > 1 ? record.hostPid : undefined,
      // Preserve the workspace path published by the bridge so consumers can
      // bind the endpoint to a specific workspace root. Old records without the
      // field yield undefined and are ignored by todo-root resolution.
      workspace: typeof record.workspace === 'string' ? record.workspace : undefined,
      rootMode,
      label,
    };
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

async function readDirectory(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function readRegistrations(directory, identity) {
  const entries = await readDirectory(directory);
  const files = entries.filter((entry) => entry.isFile() && registrationName.test(entry.name));
  const records = await Promise.all(files.map((entry) => readEndpoint(join(directory, entry.name), entry.name)));
  return records.filter(Boolean).map((record) => ({ ...record, identity }));
}

export async function collectRegistrations(directory) {
  const entries = await readDirectory(directory);
  const directIdentity = /^[a-f0-9]{64}$/.test(basename(directory)) ? basename(directory) : undefined;
  const directories = entries.filter((entry) => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name));
  const nested = await Promise.all(directories.map((entry) => readRegistrations(join(directory, entry.name), entry.name)));
  const direct = await readRegistrations(directory, directIdentity);
  return [...direct, ...nested.flat()];
}

function selectHostRecords(records, hostPid) {
  if (hostPid === undefined) return records;
  const matching = records.filter((record) => record.hostPid === hostPid);
  if (matching.length === 0) {
    throw new Error('editor_unavailable: The originating VS Code window has no listening Agendo diagnostics bridge.');
  }
  return matching;
}

function scopeToWorkspace(records, cwdIdentity) {
  if (cwdIdentity === undefined) return records;
  const matching = records.filter((record) => record.identity === cwdIdentity);
  return matching.length ? matching : records;
}

async function liveEndpoints(records) {
  const endpoints = [...new Set(records.map((record) => record.endpoint))];
  const live = await Promise.all(endpoints.map(async (endpoint) => await isListening(endpoint) ? endpoint : undefined));
  return live.filter(Boolean);
}

function selectEndpoint(live, { hostPid, cwdIdentity }) {
  if (live.length === 1) return live[0];
  if (live.length > 1) {
    throw new Error('ambiguous_window: Multiple VS Code diagnostics bridges match and the originating window cannot be uniquely identified. Use an explicit --endpoint or leave only one matching window open.');
  }
  if (hostPid !== undefined) {
    throw new Error('editor_unavailable: The originating VS Code window has no listening Agendo diagnostics bridge.');
  }
  if (cwdIdentity !== undefined) {
    throw new Error('editor_unavailable: No VS Code diagnostics bridge is listening for this workspace. Open it in VS Code with Agendo enabled.');
  }
  throw new Error('editor_unavailable: No VS Code diagnostics bridge is listening for this workspace. Open it in VS Code with Agendo enabled.');
}

export function isListening(endpoint) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(endpoint);
    const finish = () => {
      clearTimeout(timeout);
      socket.destroy();
    };
    const timeout = setTimeout(() => {
      finish();
      reject(new Error('editor_unavailable: timed out checking the workspace diagnostics bridge'));
    }, 1000);
    socket.once('connect', () => {
      finish();
      resolve(true);
    });
    socket.once('error', (error) => {
      finish();
      if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') resolve(false);
      else reject(new Error(`editor_unavailable: ${error.message}`));
    });
  });
}

/**
 * Resolve the diagnostics endpoint for an MCP client.
 *
 * `directory` is the registration root: either the `--workspace-discovery`
 * override or the `workspaces/` sibling of the executing stable server bundle.
 *
 * Routing:
 * - When `hostPid` is supplied (Kilo via inherited `KILO_PARENT_PID`), filter
 *   registration records to that host PID only and never fall back to another
 *   PID. If none is live, report `editor_unavailable`.
 * - Otherwise (generic clients), prefer registrations whose workspace identity
 *   matches the client's CWD. If exactly one live endpoint matches, use it.
 *   If no CWD match but exactly one live endpoint exists overall, use it.
 *   Otherwise report `ambiguous_window` rather than guessing.
 */
export async function discoverEndpoint(directory, options = {}) {
  const { hostPid, cwd } = options;
  const cwdIdentity = cwd ? workspaceIdentity(resolve(cwd)) : undefined;
  const records = await collectRegistrations(directory);
  const candidates = selectHostRecords(records, hostPid);
  const scoped = scopeToWorkspace(candidates, cwdIdentity);
  return selectEndpoint(await liveEndpoints(scoped), { hostPid, cwdIdentity });
}

/**
 * List live diagnostics bridges selectable for `get_problems`.
 *
 * Returns registration-scoped IDs with workspace and label details. Raw
 * endpoint paths and PIDs are not exposed. IDs are registration-scoped and may
 * change after restart. When `hostPid` is supplied (Kilo via inherited
 * `KILO_PARENT_PID`), only registrations from that host are considered. Listing
 * includes only endpoints that are currently listening.
 */
export async function listLiveBridges(directory, { hostPid } = {}) {
  const records = await collectRegistrations(directory);
  const candidates = hostPid === undefined ? records : records.filter((record) => record.hostPid === hostPid);
  const live = await liveEndpoints(candidates);
  const liveSet = new Set(live);
  const seen = new Set();
  const bridges = [];
  for (const record of candidates) {
    if (!liveSet.has(record.endpoint)) continue;
    if (seen.has(record.endpoint)) continue;
    seen.add(record.endpoint);
    bridges.push({
      id: record.id,
      workspace: record.workspace,
      label: record.label,
    });
  }
  return bridges;
}

/**
 * Collect registration records that carry a workspace path, optionally filtered
 * by host PID. Host PID filtering mirrors the diagnostics endpoint: when a PID
 * is supplied (Kilo), only registrations from that host are considered and the
 * absence of a match is reported as `editor_unavailable` rather than falling
 * back to another window. Records without a workspace path are ignored.
 */
export async function collectWorkspaceRegistrations(directory, hostPid) {
  const records = await collectRegistrations(directory);
  const candidates = selectHostRecords(records, hostPid);
  return candidates.filter((record) => record.workspace !== undefined);
}

/**
 * Build one candidate per registered todo root. Only records carrying a
 * workspace path that resolves to a directory are considered; workspace-file
 * aliases are files, not directories, so they are never roots. Duplicate
 * registrations for the same workspace path are collapsed.
 */
function buildCandidates(registrations) {
  const candidates = [];
  const seen = new Set();
  for (const r of registrations) {
    if (r.workspace === undefined) continue;
    let isDirectory;
    try {
      isDirectory = statSync(r.workspace).isDirectory();
    } catch {
      continue;
    }
    if (!isDirectory) continue;
    if (seen.has(r.workspace)) continue;
    seen.add(r.workspace);
    candidates.push({
      workspace: r.workspace,
      rootMode: r.rootMode === 'manual' ? 'manual' : 'workspace',
      label: typeof r.label === 'string' && r.label.length > 0 ? r.label : undefined,
    });
  }
  return candidates;
}

/**
 * Select a root by an explicit `workspaceFolder` selector. Exact path match
 * (absolute or relative, resolved) always wins and disambiguates name
 * collisions. Otherwise matches by root label or basename. Throws
 * `ambiguous_root` when a name collides across roots, or `invalid_input` when
 * no registered root matches.
 */
function selectByWorkspaceFolder(candidates, workspaceFolder) {
  // Exact path match (absolute or relative, resolved) always wins.
  const exactMatches = candidates.filter((c) => {
    const ws = c.workspace;
    if (ws === workspaceFolder) return true;
    try {
      return normalizePath(ws) === normalizePath(resolve(workspaceFolder));
    } catch {
      return false;
    }
  });
  if (exactMatches.length === 1) {
    return { workspaceRoot: exactMatches[0].workspace, rootMode: exactMatches[0].rootMode, workspaceFolder };
  }

  // Name match by root label or basename.
  const nameMatches = candidates.filter((c) => {
    const name = workspaceFolder;
    if (c.label !== undefined && c.label === name) return true;
    if (basename(c.workspace) === name) return true;
    return false;
  });

  // A name that matches multiple roots is ambiguous unless an exact path
  // selects exactly one (handled above).
  if (nameMatches.length > 1) {
    throw new Error(`ambiguous_root: Multiple registered roots match "${workspaceFolder}".`);
  }
  if (nameMatches.length === 1) {
    return { workspaceRoot: nameMatches[0].workspace, rootMode: nameMatches[0].rootMode, workspaceFolder };
  }
  // No match: invalid selector.
  throw new Error(`invalid_input: No registered root matches "${workspaceFolder}".`);
}

/**
 * Select a root when no `workspaceFolder` is given: prefer a CWD identity
 * match, then a sole root. Throws `ambiguous_root` when multiple CWD matches
 * or multiple roots exist. Returns `undefined` when no editor registration
 * exists (caller falls back to the standalone CWD root).
 */
function selectWithoutSelector(candidates, cwd) {
  const cwdIdentity = cwd ? workspaceIdentity(resolve(cwd)) : undefined;
  if (cwdIdentity !== undefined) {
    const cwdMatches = candidates.filter((c) => c.workspace && workspaceIdentity(c.workspace) === cwdIdentity);
    if (cwdMatches.length === 1) {
      return { workspaceRoot: cwdMatches[0].workspace, rootMode: cwdMatches[0].rootMode, workspaceFolder: undefined };
    }
    if (cwdMatches.length > 1) {
      throw new Error(`ambiguous_root: Multiple registered roots match the current directory.`);
    }
  }

  if (candidates.length === 1) {
    return { workspaceRoot: candidates[0].workspace, rootMode: candidates[0].rootMode, workspaceFolder: undefined };
  }
  if (candidates.length > 1) {
    throw new Error(`ambiguous_root: Multiple registered roots exist; specify workspaceFolder to select one.`);
  }

  // No editor registration: caller uses standalone fallback.
  return undefined;
}

/**
 * Resolve the todo root for one MCP invocation from registration records.
 *
 * `registrations` are registration records (with workspace paths) already
 * filtered by host PID when in Kilo mode. Duplicate registrations for the same
 * workspace path are collapsed into one candidate.
 *
 * `workspaceFolder` is optional: a root label, a root name (basename), or an
 * exact absolute path. When a name matches multiple roots it is ambiguous
 * unless an exact path selects exactly one.
 *
 * Returns `{ workspaceRoot, rootMode, workspaceFolder }` or `undefined` when no
 * editor registration exists (caller should use the standalone CWD fallback).
 *
 * Throws:
 * - `invalid_input: ...` when `workspaceFolder` names no registered root.
 * - `ambiguous_root: ...` when multiple registered roots match.
 */
export function resolveRootForCall(registrations, { workspaceFolder, cwd }) {
  const candidates = buildCandidates(registrations);
  if (workspaceFolder !== undefined) {
    return selectByWorkspaceFolder(candidates, workspaceFolder);
  }
  return selectWithoutSelector(candidates, cwd);
}

/**
 * Resolve the todo root path for an MCP invocation. Kept for callers that only
 * need the root path; prefer {@link resolveRootForCall} when the root mode is
 * also needed.
 */
export function resolveTodoRoot(registrations, { workspaceFolder, cwd }) {
  const resolved = resolveRootForCall(registrations, { workspaceFolder, cwd });
  return resolved ? resolved.workspaceRoot : undefined;
}
