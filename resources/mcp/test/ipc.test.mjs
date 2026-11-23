import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  IPC_ENDPOINT,
  getIpcEndpoint,
  EDITOR_UNAVAILABLE_CODE,
  MAX_REQUEST_BYTES,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  sendGetProblemsRequest,
  getProblemsInputSchema,
  getProblemsHandler,
  setCreateConnection,
} from '../ipc.mjs';

/** Fake socket driven by the test: captures written bytes and emits 'data' when the test wants a response. */
class FakeSocket {
  constructor() {
    this.listeners = {};
    this.destroyed = false;
    this.written = [];
  }
  on(event, listener) {
    (this.listeners[event] ??= []).push(listener);
    return this;
  }
  once(event, listener) {
    (this.listeners[event] ??= []).push(listener);
    return this;
  }
  emit(event, ...args) {
    for (const listener of (this.listeners[event] ?? [])) listener(...args);
  }
  write(data) {
    this.written.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    return false;
  }
  destroy() {
    this.destroyed = true;
    this.emit('close');
  }
}

function mockCreateConnection(socket) {
  setCreateConnection(() => socket);
}

/** Parse the request bytes written to the fake socket. */
function captureRequest(socket) {
  const frame = Buffer.concat(socket.written).toString('utf8');
  assert.ok(frame.endsWith('\n'), 'IPC requests must end with a newline');
  return JSON.parse(frame);
}

describe('IPC endpoint constant', () => {
  it('is a non-empty platform-appropriate string', () => {
    assert.strictEqual(typeof IPC_ENDPOINT, 'string');
    assert.ok(IPC_ENDPOINT.length > 0);
    assert.strictEqual(IPC_ENDPOINT, getIpcEndpoint());
    if (process.platform === 'win32') {
      assert.strictEqual(IPC_ENDPOINT, String.raw`\\.\pipe\agendo-problems.sock`);
    } else {
      assert.ok(IPC_ENDPOINT.includes(os.tmpdir()));
    }
  });
});

describe('getProblemsInputSchema', () => {
  it('accepts valid params', () => {
    const schema = z.object(getProblemsInputSchema());
    assert.ok(
      schema.safeParse({
        path: 'docs/todos/001-pending-p1.md',
        workspaceFolder: 'docs/todos',
        severity: ['error', 'warning'],
        limit: 10,
      }).success
    );
  });

  it('accepts omitted params (all optional)', () => {
    const schema = z.object(getProblemsInputSchema());
    assert.ok(schema.safeParse({}).success);
  });

  it('rejects invalid severity values', () => {
    const schema = z.object(getProblemsInputSchema());
    assert.ok(
      !schema.safeParse({ path: 'x', workspaceFolder: 'x', severity: ['bogus'], limit: 1 }).success
    );
    assert.ok(
      !schema.safeParse({ path: 'x', workspaceFolder: 'x', severity: 'error', limit: 1 }).success
    );
  });

  it('rejects non-integer limit', () => {
    const schema = z.object(getProblemsInputSchema());
    assert.ok(
      !schema.safeParse({ path: 'x', workspaceFolder: 'x', severity: [], limit: 1.5 }).success
    );
    assert.ok(
      !schema.safeParse({ path: 'x', workspaceFolder: 'x', severity: [], limit: '1' }).success
    );
  });
});

describe('sendGetProblemsRequest', () => {
  it('returns the result for a successful response', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = sendGetProblemsRequest('endpoint', {
      path: 'docs/todos',
      workspaceFolder: 'docs/todos',
      severity: ['error'],
      limit: 5,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = captureRequest(socket);
    socket.emit(
      'data',
      Buffer.from(
        JSON.stringify({
          id: request.id,
          ok: true,
          result: { problems: [{ code: 'E001', message: 'x' }] },
        }) + '\n'
      )
    );
    const result = await promise;
    assert.deepStrictEqual(result, { problems: [{ code: 'E001', message: 'x' }] });
  });

  it('turns an IPC error response into a rejected promise', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = sendGetProblemsRequest('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = captureRequest(socket);
    socket.emit(
      'data',
      Buffer.from(
        JSON.stringify({ id: request.id, ok: false, error: { code: 'editor_error', message: 'workspace not found' } }) + '\n'
      )
    );
    await assert.rejects(promise, (err) => {
      assert.ok(err.message.includes('editor_unavailable:'));
      assert.ok(err.message.includes('workspace not found'));
      return true;
    });
  });

  it('turns a malformed response into a rejected promise', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = sendGetProblemsRequest('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    captureRequest(socket);
    socket.emit('data', Buffer.from('not-json\n'));
    await assert.rejects(promise, (err) => {
      assert.ok(err.message.includes('editor_unavailable:'));
      assert.ok(err.message.includes('invalid IPC response'));
      return true;
    });
  });

  it('times out when the endpoint does not respond', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    await assert.rejects(sendGetProblemsRequest('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: 1 }), (err) => {
      assert.ok(err.message.includes('editor_unavailable:'));
      assert.ok(err.message.includes('timed out'));
      return true;
    });
  });

  it('reports connection failures as editor_unavailable', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = sendGetProblemsRequest('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: 1 });
    // Allow the client to register its error handler, then fail the connection.
    await new Promise((resolve) => setTimeout(resolve, 0));
    socket.emit('error', new Error('ECONNREFUSED connect ...'));
    await assert.rejects(promise, (err) => {
      assert.ok(err.message.includes('editor_unavailable:'));
      return true;
    });
  });

  it('omits undefined fields and clamps limit when serializing', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = getProblemsHandler('endpoint', { limit: 600 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = captureRequest(socket);
    assert.strictEqual(request.params.limit, 500);
    assert.ok(!('path' in request.params));
    assert.ok(!('workspaceFolder' in request.params));
    assert.ok(!('severity' in request.params));
    // Respond so the promise resolves.
    socket.emit('data', Buffer.from(JSON.stringify({ id: request.id, ok: true, result: {} }) + '\n'));
    const result = await promise;
    assert.deepStrictEqual(result, {});
  });

  it('rejects oversized response (>1 MiB)', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = sendGetProblemsRequest('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    captureRequest(socket);
    const oversize = Buffer.alloc(MAX_RESPONSE_BYTES + 1, 0x41);
    socket.emit('data', oversize);
    await assert.rejects(promise, (err) => {
      assert.ok(err.message.includes('editor_unavailable:'));
      assert.ok(err.message.includes('response exceeds'));
      return true;
    });
  });

  it('rejects mismatched response id', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = sendGetProblemsRequest('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = captureRequest(socket);
    socket.emit('data', Buffer.from(JSON.stringify({ id: 'different-id', ok: true, result: {} }) + '\n'));
    await assert.rejects(promise, (err) => {
      assert.ok(err.message.includes('editor_unavailable:'));
      assert.ok(err.message.includes('response id mismatch'));
      return true;
    });
  });

  it('handles multibyte chunk framing', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = getProblemsHandler('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = captureRequest(socket);
    const responseObj = { id: request.id, ok: true, result: { message: 'caf\u00e9' } };
    const responseBytes = Buffer.from(JSON.stringify(responseObj) + '\n', 'utf8');
    // Split the 2-byte UTF-8 sequence of 'é' (C3 A9) across chunks.
    const splitIndex = Buffer.from('caf', 'utf8').length + 1;
    socket.emit('data', responseBytes.subarray(0, splitIndex));
    await new Promise((resolve) => setTimeout(resolve, 0));
    socket.emit('data', responseBytes.subarray(splitIndex));
    const result = await promise;
    assert.deepStrictEqual(result, { message: 'caf\u00e9' });
  });

  it('rejects when no endpoint is configured', async () => {
    await assert.rejects(sendGetProblemsRequest(undefined, { path: 'x', workspaceFolder: 'x', severity: [], limit: 1 }), (err) => {
      assert.ok(err.message.includes('editor_unavailable:'));
      assert.ok(err.message.includes('no IPC endpoint configured'));
      return true;
    });
  });

  it('rejects when endpoint is an empty string', async () => {
    await assert.rejects(sendGetProblemsRequest('', { path: 'x', workspaceFolder: 'x', severity: [], limit: 1 }), (err) => {
      assert.ok(err.message.includes('editor_unavailable:'));
      return true;
    });
  });
});

describe('getProblemsHandler', () => {
  it('forwards a valid request to the endpoint and returns the result', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = getProblemsHandler('endpoint', {
      path: 'docs/todos',
      workspaceFolder: 'docs/todos',
      severity: ['error'],
      limit: 3,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = captureRequest(socket);
    socket.emit('data', Buffer.from(JSON.stringify({ id: request.id, ok: true, result: { ok: true } }) + '\n'));
    const result = await promise;
    assert.deepStrictEqual(result, { ok: true });
  });

  it('applies safe defaults when fields are omitted', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = getProblemsHandler('endpoint', {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = captureRequest(socket);
    assert.strictEqual(request.params.limit, 100);
    assert.ok(!('path' in request.params));
    assert.ok(!('workspaceFolder' in request.params));
    assert.ok(!('severity' in request.params));
    socket.emit('data', Buffer.from(JSON.stringify({ id: request.id, ok: true, result: {} }) + '\n'));
    const result = await promise;
    assert.deepStrictEqual(result, {});
  });

  it('clamps limit greater than 500 to 500', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = getProblemsHandler('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: 600 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = captureRequest(socket);
    assert.strictEqual(request.params.limit, 500);
    socket.emit('data', Buffer.from(JSON.stringify({ id: request.id, ok: true, result: {} }) + '\n'));
    const result = await promise;
    assert.deepStrictEqual(result, {});
  });

  it('rejects negative limit', async () => {
    await assert.rejects(getProblemsHandler('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: -1 }), (err) => {
      assert.ok(err.message.startsWith('invalid_input:'));
      return true;
    });
  });

  it('rejects fractional limit', async () => {
    await assert.rejects(getProblemsHandler('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: 1.5 }), (err) => {
      assert.ok(err instanceof TypeError);
      assert.ok(err.message.startsWith('invalid_input:'));
      return true;
    });
  });

  it('turns an IPC timeout into an editor_unavailable rejection', async () => {
    const socket = new FakeSocket();
    mockCreateConnection(socket);
    const promise = getProblemsHandler('endpoint', { path: 'x', workspaceFolder: 'x', severity: [], limit: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Never respond; the client should time out.
    await assert.rejects(promise, (err) => {
      assert.ok(err.message.includes('editor_unavailable:'));
      assert.ok(err.message.includes('timed out'));
      return true;
    });
  });
});
