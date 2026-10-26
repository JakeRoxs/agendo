import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInstanceServer, listen, navigate } from '../server.mjs';

async function fixture(t, actions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'agendo-agent-http-'));
  const dir = join(root, 'docs', 'todos');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'sq-001-pending-p1-finding.md');
  writeFileSync(file, '---\nstatus: pending\npriority: p1\ngroup: security\n---\n\n# Scanner finding\n\n## Problem Statement\n\nInvestigate the query.\n\n## Acceptance Criteria\n\n- [ ] Test the fix\n');
  writeFileSync(join(dir, '002-ready-p2-other.md'), '---\nstatus: ready\npriority: p2\ngroup: security\n---\n\n# Other work\n');
  const entry = createInstanceServer(root, actions);
  navigate(entry, 'sq-001');
  await listen(entry);
  t.after(async () => {
    await new Promise(resolve => entry.server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });
  const post = (path, body, protectedRequest = true) => fetch(new URL(path, entry.url), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(protectedRequest ? { 'X-Agendo-Canvas': '1' } : {}) },
    body: JSON.stringify(body)
  });
  const preview = async (intent = 'explain') => {
    const res = await post('/agent/preview', { view: entry.view, intent });
    assert.equal(res.status, 200, await res.clone().text());
    return res.json();
  };
  return { root, entry, file, post, preview };
}

test('rendering and previewing never submit; only explicit send uses the exact preview', async t => {
  const prompts = [];
  const { entry, file, post, preview } = await fixture(t, {
    getAgentState: () => ({ supported: true, status: 'idle' }),
    sendAgentRequest: async ({ prompt }) => { prompts.push(prompt); return { success: true, reason: 'accepted', message: 'Request admitted, not completed' }; }
  });
  const original = readFileSync(file, 'utf8');
  const html = await (await fetch(entry.url)).text();
  assert.match(html, /data-agent-preview/);
  const packet = await preview();
  assert.match(packet.prompt, /sq-001/);
  assert.equal(prompts.length, 0);
  const res = await post('/agent/send', { requestId: packet.requestId, prompt: 'DO NOT SEND THIS' });
  assert.equal((await res.json()).success, true);
  assert.deepEqual(prompts, [packet.prompt]);
  assert.equal(readFileSync(file, 'utf8'), original);
  assert.equal((await (await post('/agent/send', { requestId: packet.requestId })).json()).success, true);
  assert.equal(prompts.length, 1, 'an admitted preview is idempotent');
});

test('unsupported hosts expose a copyable preview without sending', async t => {
  const { post, preview } = await fixture(t);
  const packet = await preview('suggest-fix');
  assert.equal(packet.state.supported, false);
  assert.ok(packet.prompt.length > 0);
  assert.equal((await (await post('/agent/send', { requestId: packet.requestId })).json()).reason, 'unsupported');
});

test('request endpoints require the canvas protection header', async t => {
  const { post, entry } = await fixture(t);
  for (const path of ['/agent/preview', '/agent/send', '/agent/state']) {
    assert.equal((await post(path, { view: entry.view, intent: 'explain' }, false)).status, 403);
  }
});

test('invalid intent and missing preview tokens cannot submit', async t => {
  const { entry, post } = await fixture(t);
  assert.equal((await post('/agent/preview', { view: entry.view, intent: 'implement' })).status, 400);
  assert.equal((await post('/agent/send', { requestId: 'invented' })).status, 400);
});

test('preview rejects a stale rendered selection', async t => {
  const { entry, post } = await fixture(t);
  navigate(entry, '002');
  assert.equal((await post('/agent/preview', { view: { kind: 'todo', todoId: 'sq-001' }, intent: 'explain' })).status, 400);
});

test('changed navigation, filters, and evidence invalidate previews', async t => {
  let sent = 0;
  const { entry, file, post, preview } = await fixture(t, { sendAgentRequest: async () => { sent++; return { success: true }; } });
  let packet = await preview();
  navigate(entry, '002');
  assert.equal((await post('/agent/send', { requestId: packet.requestId })).status, 400);
  navigate(entry, 'sq-001');
  packet = await preview();
  entry.filters = { status: 'pending' };
  assert.equal((await post('/agent/send', { requestId: packet.requestId })).status, 400);
  packet = await preview();
  writeFileSync(file, readFileSync(file, 'utf8').replace('Investigate the query.', 'Changed evidence.'));
  assert.equal((await post('/agent/send', { requestId: packet.requestId })).status, 400);
  assert.equal(sent, 0);
});

test('tokens cannot be reused across canvas instances', async t => {
  const first = await fixture(t);
  const second = await fixture(t);
  const packet = await first.preview();
  await second.preview();
  assert.equal((await second.post('/agent/send', { requestId: packet.requestId })).status, 400);
});

test('expired previews require a new explicit preview', async t => {
  let sent = false;
  const { post, preview } = await fixture(t, { sendAgentRequest: async () => { sent = true; return { success: true }; } });
  const packet = await preview();
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 300_001);
  assert.equal((await post('/agent/send', { requestId: packet.requestId })).status, 400);
  assert.equal(sent, false);
});

test('group request scope matches active filters without unrelated todos', async t => {
  const { entry, preview } = await fixture(t);
  navigate(entry, { kind: 'group', groupName: 'security' });
  entry.filters = { status: 'pending' };
  const packet = await preview('investigate');
  assert.match(packet.prompt, /sq-001/);
  assert.doesNotMatch(packet.prompt, /Other work/);
});

test('in-flight duplicate clicks are rejected and failed sends can be explicitly retried', async t => {
  let release;
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  let calls = 0;
  const { post, preview } = await fixture(t, { sendAgentRequest: async () => {
    calls++;
    if (calls === 1) { started(); return new Promise(resolve => { release = resolve; }); }
    return { success: true, reason: 'accepted', message: 'Admitted' };
  } });
  const packet = await preview();
  const pending = post('/agent/send', { requestId: packet.requestId });
  await entered;
  assert.equal((await post('/agent/send', { requestId: packet.requestId })).status, 400);
  release({ success: false, reason: 'send_failed', message: 'Not admitted' });
  assert.equal((await (await pending).json()).success, false);
  assert.equal((await (await post('/agent/send', { requestId: packet.requestId })).json()).success, true);
  assert.equal(calls, 2);
});
