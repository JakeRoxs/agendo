import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { workspaceIdentity } from '../discovery.mjs';

test('workspace discovery routes by Kilo parent PID, CWD, and sole-endpoint fallback', async () => {
  const registry = await mkdtemp(join(tmpdir(), 'agendo-discovery-'));
  const cleanups = [];
  const clients = [];
  const cwdIdentity = workspaceIdentity(resolve(process.cwd()));

  async function openBridge(label, hostPid, subdirectory = '') {
    const token = randomUUID();
    const directory = join(tmpdir(), `agendo-ipc-${token}`);
    const endpoint = process.platform === 'win32'
      ? String.raw`\\.\pipe\agendo-${token}`
      : join(directory, 'socket');
    if (process.platform !== 'win32') {
      await mkdir(directory, { mode: 0o700 });
      cleanups.push(() => rm(directory, { recursive: true, force: true }));
    }
    const bridge = createServer((socket) => {
      let frame = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk) => {
        frame += chunk;
        if (!frame.endsWith('\n')) return;
        const { id } = JSON.parse(frame);
        const result = { workspaceFolder: label, capturedAt: new Date().toISOString(), total: 0, truncated: false, diagnostics: [] };
        socket.end(`${JSON.stringify({ id, ok: true, result })}\n`);
      });
    });
    const close = () => new Promise((resolve) => bridge.close(() => resolve()));
    cleanups.push(close);
    await new Promise((resolve, reject) => {
      bridge.once('error', reject);
      bridge.listen(endpoint, resolve);
    });
    const registrationDir = subdirectory ? join(registry, subdirectory) : registry;
    await mkdir(registrationDir, { recursive: true });
    const registration = `${randomUUID()}.json`;
    const registrationPath = join(registrationDir, registration);
    await writeFile(registrationPath, JSON.stringify({ endpoint, hostPid }));
    return { close, unregister: () => rm(registrationPath) };
  }

  async function connect(hostPid = '') {
    const client = new Client({ name: 'agendo-discovery-test', version: '1.0.0' });
    clients.push(client);
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('../server.mjs', import.meta.url)), '--workspace-discovery', registry],
      env: { KILO_PARENT_PID: hostPid },
    }));
    return async () => {
      try {
        return await client.callTool({ name: 'get_problems', arguments: {} });
      } catch (e) {
        return { error: { message: e.message } };
      }
    };
  }

  async function connectTodoClient() {
    const client = new Client({ name: 'agendo-todo-envelope-test', version: '1.0.0' });
    clients.push(client);
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('../server.mjs', import.meta.url)), '--workspace-discovery', registry],
      env: {},
    }));
    return client;
  }

  try {
    // No bridge registered, no PID: unavailable.
    const call = await connect();
    assert.match(JSON.stringify(await call()), /editor_unavailable/);

    // Root todo tools must return MCP CallToolResult envelopes, including
    // array-valued handlers such as list_groups.
    const todoClient = await connectTodoClient();
    const groupsResult = await todoClient.callTool({ name: 'list_groups', arguments: {} });
    assert.notEqual(groupsResult.isError, true);
    assert.equal(groupsResult.content[0].type, 'text');
    assert.deepEqual(JSON.parse(groupsResult.content[0].text), groupsResult.structuredContent.result);
    assert.ok(Array.isArray(groupsResult.structuredContent.result));

    // One bridge, no PID: sole-endpoint fallback succeeds.
    const first = await openBridge('first');
    const firstResult = await call();
    assert.equal(firstResult.structuredContent.workspaceFolder, 'first');
    assert.match(firstResult.content[0].text, /"workspaceFolder": "first"/);

    // Stale registration (bridge closed, left behind) is not live -> unavailable.
    await first.close();
    assert.match(JSON.stringify(await call()), /editor_unavailable/);

    // Restart registration replaces stale endpoint without config edit.
    await openBridge('restarted', 34342);
    assert.equal((await call()).structuredContent.workspaceFolder, 'restarted');

    // Second bridge with a different PID, no PID set: ambiguous.
    const second = await openBridge('second-window', 34343);
    assert.match(JSON.stringify(await call()), /ambiguous_window/);
    await second.close();

    // Kilo PID selects the matching endpoint among two bridges.
    const selected = await connect('34343');
    assert.match(JSON.stringify(await selected()), /editor_unavailable/);
    const originating = await openBridge('originating-window', 34343);
    const selectedResult = await selected();
    assert.equal(selectedResult.structuredContent.workspaceFolder, 'originating-window');
    assert.match(selectedResult.content[0].text, /"diagnostics": \[\]/);

    // The other PID still routes to its own bridge.
    const other = await connect('34342');
    assert.equal((await other()).structuredContent.workspaceFolder, 'restarted');

    // Configured but missing host returns unavailable, not another window.
    await originating.close();
    await originating.unregister();
    assert.match(JSON.stringify(await selected()), /editor_unavailable/);

    // Re-enabled registration with the same PID is selected.
    await openBridge('originating-window-reenabled', 34343);
    assert.equal((await selected()).structuredContent.workspaceFolder, 'originating-window-reenabled');

    // Invalid PID value is rejected before any IPC.
    const invalid = await connect('{env:KILO_PARENT_PID}');
    assert.match(JSON.stringify(await invalid()), /invalid_input/);

    // CWD-based routing: register under the CWD identity subdirectory, no PID.
    const cwdBridge = await openBridge('cwd-window', process.pid, cwdIdentity);
    const cwdCall = await connect();
    assert.equal((await cwdCall()).structuredContent.workspaceFolder, 'cwd-window');
    await cwdBridge.close();
    await cwdBridge.unregister();

    // CWD differs from every workspace registration: multiple live endpoints
    // remain ambiguous, not guessed.
    const cwdAmbiguous = await connect();
    assert.match(JSON.stringify(await cwdAmbiguous()), /ambiguous_window/);
  } finally {
    await Promise.all(clients.map((client) => client.close()));
    for (const cleanup of cleanups.reverse()) await cleanup();
    await rm(registry, { recursive: true, force: true });
  }
});

test('get_problems supports explicit bridgeId selection; list_diagnostic_bridges enumerates live bridges', async () => {
  const registry = await mkdtemp(join(tmpdir(), 'agendo-discovery-bridge-'));
  const cleanups = [];
  const clients = [];

  async function openBridge(label, hostPid, workspace, subdirectory = '') {
    const token = randomUUID();
    const directory = join(tmpdir(), `agendo-ipc-${token}`);
    const endpoint = process.platform === 'win32'
      ? String.raw`\\.\pipe\agendo-${token}`
      : join(directory, 'socket');
    if (process.platform !== 'win32') {
      await mkdir(directory, { mode: 0o700 });
      cleanups.push(() => rm(directory, { recursive: true, force: true }));
    }
    const bridge = createServer((socket) => {
      let frame = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk) => {
        frame += chunk;
        if (!frame.endsWith('\n')) return;
        const { id } = JSON.parse(frame);
        const result = { workspaceFolder: label, capturedAt: new Date().toISOString(), total: 0, truncated: false, diagnostics: [] };
        socket.end(`${JSON.stringify({ id, ok: true, result })}\n`);
      });
    });
    const close = () => new Promise((resolve) => bridge.close(() => resolve()));
    cleanups.push(close);
    await new Promise((resolve, reject) => {
      bridge.once('error', reject);
      bridge.listen(endpoint, resolve);
    });
    const registrationDir = subdirectory ? join(registry, subdirectory) : registry;
    await mkdir(registrationDir, { recursive: true });
    const registration = `${randomUUID()}.json`;
    const registrationPath = join(registrationDir, registration);
    await writeFile(registrationPath, JSON.stringify({ endpoint, hostPid, workspace, label }));
    return { close, unregister: () => rm(registrationPath), id: registration.replace(/\.json$/, ''), endpoint, label };
  }

  async function connect(hostPid = '') {
    const client = new Client({ name: 'agendo-bridge-test', version: '1.0.0' });
    clients.push(client);
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('../server.mjs', import.meta.url)), '--workspace-discovery', registry],
      env: { KILO_PARENT_PID: hostPid },
    }));
    return client;
  }

  let ws;
  try {
    // Two bridges share the same workspace; automatic routing is ambiguous.
    ws = await mkdtemp(join(tmpdir(), 'agendo-shared-ws-'));
    const a = await openBridge('bridge-a', undefined, ws);
    const b = await openBridge('bridge-b', undefined, ws);

    const client = await connect();

    // list_diagnostic_bridges lists both live bridges with ID/workspace/label.
    const listResult = await client.callTool({ name: 'list_diagnostic_bridges', arguments: {} });
    assert.notEqual(listResult.isError, true);
    const bridges = listResult.structuredContent.bridges;
    assert.equal(bridges.length, 2);
    const ids = bridges.map((b) => b.id);
    assert.ok(ids.includes(a.id));
    assert.ok(ids.includes(b.id));
    // Every entry carries workspace and label.
    assert.ok(bridges.every((b) => typeof b.workspace === 'string' && b.workspace.length > 0));
    assert.ok(bridges.every((b) => typeof b.label === 'string' && b.label.length > 0));
    // Both share the same workspace.
    assert.equal(bridges[0].workspace, ws);
    assert.equal(bridges[1].workspace, ws);
    // Raw endpoint paths and PIDs are not exposed.
    assert.ok(!bridges.some((b) => 'endpoint' in b));
    assert.ok(!bridges.some((b) => 'hostPid' in b));

    // Automatic routing with no bridgeId is ambiguous (multiple live endpoints).
    const autoResult = await client.callTool({ name: 'get_problems', arguments: {} });
    assert.ok(autoResult.isError);
    assert.match(JSON.stringify(autoResult), /ambiguous_window/);

    // Explicit bridgeId selects bridge A even though both share the workspace.
    const resultA = await client.callTool({ name: 'get_problems', arguments: { bridgeId: a.id } });
    assert.ok(!resultA.isError);
    assert.equal(resultA.structuredContent.workspaceFolder, 'bridge-a');
    assert.match(resultA.content[0].text, /"workspaceFolder": "bridge-a"/);

    // Explicit bridgeId selects bridge B.
    const resultB = await client.callTool({ name: 'get_problems', arguments: { bridgeId: b.id } });
    assert.ok(!resultB.isError);
    assert.equal(resultB.structuredContent.workspaceFolder, 'bridge-b');

    // Stale bridgeId (registration removed) fails safely with invalid_input.
    await a.close();
    await a.unregister();
    const staleResult = await client.callTool({ name: 'get_problems', arguments: { bridgeId: a.id } });
    assert.ok(staleResult.isError);
    assert.match(JSON.stringify(staleResult), /invalid_input/);

    // Registration present but bridge not live fails with editor_unavailable.
    await b.close();
    const deadResult = await client.callTool({ name: 'get_problems', arguments: { bridgeId: b.id } });
    assert.ok(deadResult.isError);
    assert.match(JSON.stringify(deadResult), /editor_unavailable/);

    // Unknown bridgeId fails safely.
    const unknownResult = await client.callTool({ name: 'get_problems', arguments: { bridgeId: '00000000-0000-0000-0000-000000000000' } });
    assert.ok(unknownResult.isError);
    assert.match(JSON.stringify(unknownResult), /invalid_input/);

    // list_diagnostic_bridges only lists live endpoints: after both bridges
    // are dead, the list is empty.
    const emptyList = await client.callTool({ name: 'list_diagnostic_bridges', arguments: {} });
    assert.notEqual(emptyList.isError, true);
    assert.equal(emptyList.structuredContent.bridges.length, 0);

    await client.close();
  } finally {
    await Promise.all(clients.map((client) => client.close()));
    for (const cleanup of cleanups.reverse()) await cleanup();
    await rm(registry, { recursive: true, force: true });
    await rm(ws, { recursive: true, force: true });
  }
});

test('diagnostics bridge lists actual VS Code folders separately from registered workspaces', async () => {
  const registry = await mkdtemp(join(tmpdir(), 'agendo-workspace-metadata-'));
  const socketDirectory = join(tmpdir(), `agendo-ipc-${randomUUID()}`);
  const endpoint = process.platform === 'win32'
    ? String.raw`\\.\pipe\agendo-${randomUUID()}`
    : join(socketDirectory, 'socket');
  const registeredWorkspace = '/home/jake/repos/random';
  const selectedFolder = {
    name: 'llama-catalog-proxy',
    path: '/home/jake/repos/llama-catalog-proxy',
  };
  const workspaceFolders = [
    { name: 'random', path: registeredWorkspace },
    selectedFolder,
  ];
  const hostPid = 7001;
  const bridge = createServer((socket) => {
    let frame = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      frame += chunk;
      if (!frame.endsWith('\n')) return;
      const request = JSON.parse(frame);
      const result = request.method === 'list_workspace_folders'
        ? { workspaceName: 'random', folders: workspaceFolders, truncated: false }
        : {
            workspaceName: 'random',
            workspaceFolder: selectedFolder.name,
            workspaceFolderDetails: selectedFolder,
            capturedAt: new Date().toISOString(),
            total: 1,
            truncated: false,
            diagnostics: [],
          };
      socket.end(`${JSON.stringify({ id: request.id, ok: true, result })}\n`);
    });
  });
  let client;
  const registrationPath = join(registry, `${randomUUID()}.json`);
  try {
    if (process.platform !== 'win32') await mkdir(socketDirectory, { mode: 0o700 });
    await new Promise((resolve, reject) => {
      bridge.once('error', reject);
      bridge.listen(endpoint, resolve);
    });
    const id = basename(registrationPath).replace(/\.json$/, '');
    await writeFile(registrationPath, JSON.stringify({
      endpoint,
      hostPid,
      workspace: registeredWorkspace,
      rootMode: 'workspace',
      label: 'todos',
    }));
    client = new Client({ name: 'agendo-workspace-metadata-test', version: '1.0.0' });
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('../server.mjs', import.meta.url)), '--workspace-discovery', registry],
      env: { KILO_PARENT_PID: String(hostPid) },
    }));

    const list = await client.callTool({ name: 'list_diagnostic_bridges', arguments: {} });
    assert.notEqual(list.isError, true);
    assert.deepEqual(list.structuredContent.bridges, [{
      id,
      workspace: registeredWorkspace,
      label: 'todos',
      registeredWorkspaces: [{ path: registeredWorkspace, label: 'todos', rootMode: 'workspace' }],
      workspaceName: 'random',
      folders: workspaceFolders,
      foldersTruncated: false,
      folderMetadataAvailable: true,
    }]);

    const query = await client.callTool({
      name: 'get_problems',
      arguments: { bridgeId: id, workspaceFolder: selectedFolder.path, path: 'internal/benchmark/benchmark_test.go' },
    });
    assert.notEqual(query.isError, true);
    assert.equal(query.structuredContent.workspaceName, 'random');
    assert.deepEqual(query.structuredContent.workspaceFolderDetails, selectedFolder);
    assert.deepEqual(query.structuredContent.registeredWorkspace, {
      path: registeredWorkspace,
      label: 'todos',
      rootMode: 'workspace',
    });
  } finally {
    await client?.close();
    await new Promise((resolve) => bridge.close(resolve));
    await rm(registry, { recursive: true, force: true });
    if (process.platform !== 'win32') await rm(socketDirectory, { recursive: true, force: true });
  }
});

test('get_problems --endpoint takes precedence over bridgeId and remains backward compatible', async () => {
  const registry = await mkdtemp(join(tmpdir(), 'agendo-discovery-endpoint-'));
  const cleanups = [];
  const clients = [];

  async function openBridge(label) {
    const token = randomUUID();
    const directory = join(tmpdir(), `agendo-ipc-${token}`);
    const endpoint = process.platform === 'win32'
      ? String.raw`\\.\pipe\agendo-${token}`
      : join(directory, 'socket');
    if (process.platform !== 'win32') {
      await mkdir(directory, { mode: 0o700 });
      cleanups.push(() => rm(directory, { recursive: true, force: true }));
    }
    const bridge = createServer((socket) => {
      let frame = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk) => {
        frame += chunk;
        if (!frame.endsWith('\n')) return;
        const { id } = JSON.parse(frame);
        const result = { workspaceFolder: label, capturedAt: new Date().toISOString(), total: 0, truncated: false, diagnostics: [] };
        socket.end(`${JSON.stringify({ id, ok: true, result })}\n`);
      });
    });
    const close = () => new Promise((resolve) => bridge.close(() => resolve()));
    cleanups.push(close);
    await new Promise((resolve, reject) => {
      bridge.once('error', reject);
      bridge.listen(endpoint, resolve);
    });
    const registration = `${randomUUID()}.json`;
    const registrationPath = join(registry, registration);
    await writeFile(registrationPath, JSON.stringify({ endpoint }));
    return { close, endpoint, id: registration.replace(/\.json$/, ''), label };
  }

  async function connectWithEndpoint(endpoint) {
    const client = new Client({ name: 'agendo-endpoint-test', version: '1.0.0' });
    clients.push(client);
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [
        fileURLToPath(new URL('../server.mjs', import.meta.url)),
        '--endpoint', endpoint,
        '--workspace-discovery', registry,
      ],
      env: {},
    }));
    return client;
  }

  try {
    const bridge = await openBridge('endpoint-bridge');

    const client = await connectWithEndpoint(bridge.endpoint);

    try {
      // bridgeId is rejected when --endpoint is configured.
      const rejected = await client.callTool({ name: 'get_problems', arguments: { bridgeId: bridge.id } });
      assert.ok(rejected.isError);
      assert.match(JSON.stringify(rejected), /invalid_input/);

      // Without bridgeId, --endpoint routes to the configured bridge.
      const result = await client.callTool({ name: 'get_problems', arguments: {} });
      assert.ok(!result.isError);
      assert.equal(result.structuredContent.workspaceFolder, 'endpoint-bridge');
    } finally {
      await client.close();
    }
  } finally {
    await Promise.all(clients.map((client) => client.close()));
    for (const cleanup of cleanups.reverse()) await cleanup();
    await rm(registry, { recursive: true, force: true });
  }
});

test('list_diagnostic_bridges rejects an invalid Kilo parent PID instead of listing all windows', async () => {
  const registry = await mkdtemp(join(tmpdir(), 'agendo-discovery-invalid-pid-'));
  const client = new Client({ name: 'agendo-invalid-pid-test', version: '1.0.0' });
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('../server.mjs', import.meta.url)), '--workspace-discovery', registry],
      env: { KILO_PARENT_PID: 'not-a-pid' },
    }));

    const result = await client.callTool({ name: 'list_diagnostic_bridges', arguments: {} });
    assert.ok(result.isError);
    assert.match(JSON.stringify(result), /invalid_input: KILO_PARENT_PID/);
  } finally {
    await client.close();
    await rm(registry, { recursive: true, force: true });
  }
});
