import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('workspace discovery recovers unbound bridges and never substitutes another host for a configured one', async () => {
  const registry = await mkdtemp(join(tmpdir(), 'agendo-discovery-'));
  const cleanups = [];
  const clients = [];

  async function openBridge(label, hostPid) {
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
        socket.end(`${JSON.stringify({ id, ok: true, result: { workspaceFolder: label } })}\n`);
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
    await writeFile(registrationPath, JSON.stringify({ endpoint, hostPid }));
    return { close, unregister: () => rm(registrationPath) };
  }

  async function connect(hostPid = '') {
    const client = new Client({ name: 'agendo-discovery-test', version: '1.0.0' });
    clients.push(client);
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('../server.mjs', import.meta.url)), '--workspace-discovery', registry],
      env: { AGENDO_VSCODE_HOST_PID: hostPid },
    }));
    return () => client.callTool({ name: 'get_problems', arguments: {} });
  }

  try {
    const call = await connect();
    assert.match(JSON.stringify(await call()), /editor_unavailable/);
    const first = await openBridge('first');
    assert.equal((await call()).workspaceFolder, 'first');
    await first.close(); // Leave a stale registration, as after a crash.
    assert.match(JSON.stringify(await call()), /editor_unavailable/);
    await openBridge('restarted', 34342);
    assert.equal((await call()).workspaceFolder, 'restarted');
    const second = await openBridge('second-window', 34343);
    assert.match(JSON.stringify(await call()), /ambiguous_window/);
    await second.close();
    const selected = await connect('34343');
    assert.match(JSON.stringify(await selected()), /editor_unavailable/);
    const originating = await openBridge('originating-window', 34343);
    assert.equal((await selected()).workspaceFolder, 'originating-window');
    const other = await connect('34342');
    assert.equal((await other()).workspaceFolder, 'restarted');
    await originating.close();
    await originating.unregister();
    assert.match(JSON.stringify(await selected()), /editor_unavailable/);
    await openBridge('originating-window-reenabled', 34343);
    assert.equal((await selected()).workspaceFolder, 'originating-window-reenabled');
    const invalid = await connect('{env:KILO_PARENT_PID}');
    assert.match(JSON.stringify(await invalid()), /invalid_input/);
  } finally {
    await Promise.all(clients.map((client) => client.close()));
    for (const cleanup of cleanups.reverse()) await cleanup();
    await rm(registry, { recursive: true, force: true });
  }
});
