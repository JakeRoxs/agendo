import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
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
    return {
      endpoint: record.endpoint,
      hostPid: Number.isSafeInteger(record.hostPid) && record.hostPid > 1 ? record.hostPid : undefined,
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

async function collectRegistrations(directory) {
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

function isListening(endpoint) {
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
