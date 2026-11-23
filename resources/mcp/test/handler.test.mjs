import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { getProblemsHandler, sendGetProblemsRequest } from '../ipc.mjs';

async function createIpcServer(handler) {
  const socketPath = path.join(os.tmpdir(), `agendo-handler-test-${process.pid}-${Date.now()}.sock`);
  const server = net.createServer({ uds: socketPath }, (socket) => {
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const idx = buffer.indexOf('\n');
      if (idx === -1) return;
      const line = buffer.slice(0, idx);
      buffer = '';
      let finished = Promise.resolve();
      try {
        const request = JSON.parse(line);
        const result = handler(request, socket);
        if (result instanceof Promise) {
          finished = result;
        }
      } catch (err) {
        finished = Promise.resolve();
        socket.write(JSON.stringify({ id: 'test', ok: false, error: { code: 'bad_request', message: err.message } }) + '\n');
      }
      finished.then(() => {
        socket.destroy();
      });
    });
  });
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, socketPath };
}

describe('getProblemsHandler', () => {
  it('forwards a valid request to the endpoint and returns the result', async () => {
    const { server, socketPath } = await createIpcServer((_request, socket) => {
      socket.write(JSON.stringify({ id: 'test', ok: true, result: { ok: true } }) + '\n');
      socket.destroy();
      return undefined;
    });
    try {
      const result = await getProblemsHandler(socketPath, {
        path: 'docs/todos',
        workspaceFolder: 'docs/todos',
        severity: ['error'],
        limit: 3,
      });
      assert.deepStrictEqual(result, { ok: true });
    } finally {
      server.close();
    }
  });

  it('rejects invalid input shape with invalid_input errors (no socket needed)', async () => {
    // Validation throws before any IPC is attempted.
    await assert.rejects(getProblemsHandler('endpoint', { path: '', workspaceFolder: 'x', severity: [], limit: 1 }), (err) => {
      assert.ok(err.message.startsWith('invalid_input:'));
      return true;
    });
    await assert.rejects(getProblemsHandler('endpoint', { path: 'x', workspaceFolder: '', severity: [], limit: 1 }), (err) => {
      assert.ok(err.message.startsWith('invalid_input:'));
      return true;
    });
    await assert.rejects(getProblemsHandler('endpoint', { path: 'x', workspaceFolder: 'x', severity: ['bogus'], limit: 1 }), (err) => {
      assert.ok(err.message.startsWith('invalid_input:'));
      return true;
    });
    await assert.rejects(getProblemsHandler('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: 1.5 }), (err) => {
      assert.ok(err.message.startsWith('invalid_input:'));
      return true;
    });
  });

  it('turns an IPC timeout into an editor_unavailable rejection', async () => {
    const { server, socketPath } = await createIpcServer(() => new Promise(() => {}));
    try {
      await assert.rejects(getProblemsHandler(socketPath, { path: 'x', workspaceFolder: 'x', severity: [], limit: 1 }), (err) => {
        assert.ok(err.message.includes('editor_unavailable:'));
        assert.ok(err.message.includes('timed out'));
        return true;
      });
    } finally {
      server.close();
    }
  });
});
