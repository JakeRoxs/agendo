import { readdir, readFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { basename, dirname, isAbsolute, join } from 'node:path';

const uuid = '[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
const registrationName = new RegExp(`^${uuid}\\.json$`);
const unixDirectory = new RegExp(`^agendo-ipc-${uuid}$`);
const pipePrefix = String.raw`\\.\pipe\agendo-`;
const pipeToken = new RegExp(`^${uuid}$`);

function validEndpoint(endpoint) {
  if (typeof endpoint !== 'string') return false;
  return process.platform === 'win32'
    ? endpoint.startsWith(pipePrefix) && pipeToken.test(endpoint.slice(pipePrefix.length))
    : isAbsolute(endpoint) && basename(endpoint) === 'socket' && unixDirectory.test(basename(dirname(endpoint)));
}

async function readEndpoint(directory, entry) {
  if (!entry.isFile() || !registrationName.test(entry.name)) return undefined;
  try {
    const record = JSON.parse(await readFile(join(directory, entry.name), 'utf8'));
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

export async function discoverEndpoint(directory, hostPid) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    entries = [];
  }
  const records = (await Promise.all(entries.map((entry) => readEndpoint(directory, entry)))).filter(Boolean);
  const candidates = hostPid === undefined ? records : records.filter((record) => record.hostPid === hostPid);
  const endpoints = [...new Set(candidates.map((record) => record.endpoint))];
  const live = (await Promise.all(endpoints.map(async (endpoint) => await isListening(endpoint) ? endpoint : undefined))).filter(Boolean);
  if (live.length === 1) return live[0];
  if (live.length > 1) {
    throw new Error('ambiguous_window: Multiple VS Code diagnostics bridges match and the originating window cannot be uniquely identified. Use an explicit --endpoint or leave only one matching window open.');
  }
  if (hostPid !== undefined) throw new Error('editor_unavailable: The originating VS Code window has no listening Agendo diagnostics bridge.');
  throw new Error('editor_unavailable: No VS Code diagnostics bridge is listening for this workspace. Open it in VS Code with Agendo enabled.');
}
