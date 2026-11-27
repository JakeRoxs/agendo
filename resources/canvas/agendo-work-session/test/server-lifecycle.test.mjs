import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInstanceServer, listen, closeServer } from '../server.mjs';

function todoRoot() {
  const root = mkdtempSync(join(tmpdir(), 'agendo-lifecycle-'));
  const dir = join(root, 'docs', 'todos');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '001-pending-p2-example.md'), '---\nstatus: pending\npriority: p2\n---\n\n# Todo\n');
  return root;
}

test('closeServer resolves promptly when no connection lingers and the server stops accepting', async t => {
  const root = todoRoot();
  const entry = createInstanceServer(root, {});
  await listen(entry);
  const port = entry.server.address().port;
  t.after(async () => {
    await new Promise(resolve => entry.server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });

  const start = Date.now();
  await closeServer(entry.server);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 5000, `closeServer should resolve promptly without a lingering connection, took ${elapsed}ms`);

  // The server must no longer accept new connections after close.
  const refused = await new Promise((resolve) => {
    const s = createConnection({ port, host: '127.0.0.1' });
    s.on('error', () => resolve(true));
    s.on('connect', () => { s.end(); resolve(false); });
  });
  assert.strictEqual(refused, true, 'server should stop accepting new connections after close');
});

test('closeServer resolves within a bounded timeout even when a keep-alive connection lingers', async t => {
  const root = todoRoot();
  const entry = createInstanceServer(root, {});
  await listen(entry);
  const port = entry.server.address().port;
  t.after(async () => {
    await new Promise(resolve => entry.server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });

  // Hold a raw keep-alive connection open without responding. This mirrors the canvas page,
  // which polls /version every few seconds and would otherwise keep a socket active, causing
  // a plain server.close() to hang until the host force-kills the extension process.
  const socket = await new Promise((resolve, reject) => {
    const s = createConnection({ port, host: '127.0.0.1' });
    s.on('connect', () => {
      s.write('GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n');
      resolve(s);
    });
    s.on('error', reject);
  });

  const start = Date.now();
  await closeServer(entry.server);
  const elapsed = Date.now() - start;
  // closeServer must always resolve within the bounded timeout plus socket teardown.
  assert.ok(elapsed < 20000, `closeServer should resolve within a bounded timeout, took ${elapsed}ms`);

  // The server must no longer accept new connections after close.
  const refused = await new Promise((resolve) => {
    const s = createConnection({ port, host: '127.0.0.1' });
    s.on('error', () => resolve(true));
    s.on('connect', () => { s.end(); resolve(false); });
  });
  assert.strictEqual(refused, true, 'server should stop accepting new connections after close');

  socket.end();
});
