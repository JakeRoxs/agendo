import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

  try {
    // No bridge registered, no PID: unavailable.
    const call = await connect();
    assert.match(JSON.stringify(await call()), /editor_unavailable/);

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
