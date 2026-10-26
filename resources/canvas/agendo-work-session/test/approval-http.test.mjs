import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInstanceServer, listen, navigate } from '../server.mjs';

const change = index => ({ criterionIndex: index, met: true, rationale: 'Regression verified', evidence: 'Targeted test result' });

async function fixture(t, actions = { assertWritable: async () => {} }) {
  const root = mkdtempSync(join(tmpdir(), 'agendo-approval-http-'));
  const dir = join(root, 'docs', 'todos');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'sq-001-pending-p1-finding.md');
  const other = join(dir, '002-pending-p2-task.md');
  const content = title => `---\nstatus: pending\npriority: p1\n---\n\n# ${title}\n\n## Acceptance Criteria\n\n- [ ] First check\n- [ ] Second check\n\n## Notes\n\nPreserve notes.\n`;
  writeFileSync(file, content('Scanner finding'));
  writeFileSync(other, content('Other task').replace('priority: p1', 'priority: p2'));
  const entry = createInstanceServer(root, actions);
  navigate(entry, 'sq-001');
  await listen(entry);
  t.after(async () => {
    entry.disposeProposals();
    await new Promise(resolve => entry.server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });
  const post = (path, body, protectedRequest = true) => fetch(new URL(path, entry.url), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(protectedRequest ? { 'X-Agendo-Canvas': '1' } : {}) },
    body: JSON.stringify({ view: entry.view, ...body })
  });
  const create = async (requestId, changes = [change(0)]) => {
    const response = await post('/proposals/create', { requestId, changes });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  const policy = async value => {
    const response = await post('/proposals/policy', { policy: value });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  const list = async () => (await post('/proposals/list', {})).json();
  return { root, file, other, entry, post, create, policy, list };
}

test('explicit native auto mode applies new changes without accepting old pending work and reports the outcome', async t => {
  let guards = 0;
  const { file, entry, create, policy, list } = await fixture(t, { assertWritable: async () => { guards++; } });
  const original = readFileSync(file, 'utf8');
  const pending = await create('manual-first');
  assert.equal(readFileSync(file, 'utf8'), original);
  const active = await policy({ mode: 'auto', scope: 'workspace' });
  assert.equal(active.sessionOnly, true);
  assert.equal(readFileSync(file, 'utf8'), original, 'enabling auto does not apply old pending work');
  const applied = await create('automatic-second', [change(1)]);
  assert.equal(applied.state, 'applied');
  assert.equal(applied.approval.outcome, 'applied');
  assert.equal(guards, 1);
  assert.match(readFileSync(file, 'utf8'), /- \[ \] First check\n- \[x\] Second check/);
  assert.match(readFileSync(file, 'utf8'), /status: pending/);
  assert.equal((await list()).proposals.find(item => item.id === pending.id).state, 'pending');
  const html = await (await fetch(entry.url)).text();
  assert.match(html, /Auto-approval: applied/);
  assert.match(html, /Targeted test result/);
  assert.match(html, /Pause Auto-Approval/);
});

test('todo scope does not expand on navigation; workspace scope and manual review are explicit choices', async t => {
  const { file, other, entry, create, policy } = await fixture(t);
  await policy({ mode: 'auto', scope: 'todo' });
  navigate(entry, '002');
  assert.equal(entry.approval.getPolicy().effectiveMode, 'manual');
  const deferred = await create('outside-todo-scope');
  assert.equal(deferred.state, 'pending');
  assert.doesNotMatch(readFileSync(other, 'utf8'), /- \[x\]/);
  await policy({ mode: 'auto', scope: 'workspace' });
  assert.equal((await create('explicit-workspace')).state, 'applied');
  assert.doesNotMatch(readFileSync(file, 'utf8'), /- \[x\]/);
  await policy({ mode: 'manual' });
  assert.equal((await create('focused-manual', [change(1)])).state, 'pending');
  assert.match(readFileSync(other, 'utf8'), /- \[ \] Second check/);
});

test('an in-flight automatic submission can be paused, and the same request is not silently retried after re-enabling', async t => {
  let entered;
  let release;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let guards = 0;
  const { file, post, create, policy } = await fixture(t, { assertWritable: async () => { guards++; entered(); await gate; } });
  const original = readFileSync(file, 'utf8');
  await policy({ mode: 'auto', scope: 'workspace' });
  const pending = post('/proposals/create', { requestId: 'pause-during-guard', changes: [change(0)] });
  try {
    await started;
    await policy({ mode: 'manual' });
    await policy({ mode: 'auto', scope: 'workspace' });
  } finally {
    release();
  }
  const response = await pending;
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.state, 'pending');
  assert.notEqual(result.approval.outcome, 'applied');
  assert.equal(readFileSync(file, 'utf8'), original);
  assert.equal((await create('pause-during-guard')).id, result.id);
  assert.equal(guards, 1);
});

test('duplicate successful requests cannot reapply an externally undone change and conflicting reuse is rejected', async t => {
  let guards = 0;
  const { file, post, create, policy } = await fixture(t, { assertWritable: async () => { guards++; } });
  await policy({ mode: 'auto', scope: 'todo' });
  const first = await create('once-only');
  writeFileSync(file, readFileSync(file, 'utf8').replace('- [x] First check', '- [ ] First check'));
  assert.equal((await create('once-only')).id, first.id);
  assert.match(readFileSync(file, 'utf8'), /- \[ \] First check/);
  assert.equal(guards, 1);
  assert.equal((await post('/proposals/create', { requestId: 'once-only', changes: [change(1)] })).status, 400);
});

test('rejected manual work remains rejected when its request is replayed after auto mode is enabled', async t => {
  const { file, post, create, policy } = await fixture(t);
  const original = readFileSync(file, 'utf8');
  const first = await create('rejected-once');
  assert.equal((await post('/proposals/reject', { proposalId: first.id, changeIds: [first.changes[0].id] })).status, 200);
  await policy({ mode: 'auto', scope: 'workspace' });
  const replay = await create('rejected-once');
  assert.equal(replay.id, first.id);
  assert.equal(replay.state, 'rejected');
  assert.equal(readFileSync(file, 'utf8'), original);
});

test('unsupported hosts and forged policy payloads cannot authorize automatic writes', async t => {
  const { file, entry, post, create, list } = await fixture(t, {});
  const original = readFileSync(file, 'utf8');
  assert.equal((await post('/proposals/policy', { policy: { mode: 'auto', scope: 'workspace' } })).status, 400);
  assert.equal((await post('/proposals/policy', { policy: { mode: 'auto', scope: 'workspace' } }, false)).status, 403);
  assert.equal((await list()).policy.mode, 'manual');
  assert.equal((await create('unsupported')).state, 'pending');
  const html = await (await fetch(entry.url)).text();
  assert.match(html, /value="auto-workspace" disabled/);
  assert.equal(readFileSync(file, 'utf8'), original);
});

test('a failed automatic attempt remains visible and a later manual application is not reported as auto success', async t => {
  let guards = 0;
  const { file, post, create, policy, list } = await fixture(t, { assertWritable: async () => { if (++guards === 1) throw new Error('Dirty document'); } });
  await policy({ mode: 'auto', scope: 'workspace' });
  const first = await create('guard-failed');
  assert.equal(first.state, 'pending');
  assert.notEqual(first.approval.outcome, 'applied');
  assert.doesNotMatch(readFileSync(file, 'utf8'), /- \[x\]/);
  await policy({ mode: 'manual' });
  assert.equal((await post('/proposals/apply', { proposalId: first.id, changeIds: [first.changes[0].id] })).status, 200);
  const record = (await list()).proposals[0];
  assert.equal(record.state, 'applied');
  assert.notEqual(record.approval.outcome, 'applied');
  assert.equal(record.approval.manualAction, 'applied');
});

test('workspace auto policy is instance-local and does not authorize another canvas', async t => {
  const first = await fixture(t);
  const second = await fixture(t);
  await first.policy({ mode: 'auto', scope: 'workspace' });
  assert.equal((await second.list()).policy.mode, 'manual');
  assert.equal((await second.create('other-instance')).state, 'pending');
  assert.doesNotMatch(readFileSync(second.file, 'utf8'), /- \[x\]/);
});

test('manual admission is not elevated by an immediate policy change before asynchronous execution', async t => {
  let guards = 0;
  const { entry, file } = await fixture(t, { assertWritable: async () => { guards++; } });
  const original = readFileSync(file, 'utf8');
  const pending = entry.approval.create({ todoId: 'sq-001', changes: [change(0)], requestId: 'manual-at-admission' });
  entry.approval.setPolicy({ mode: 'auto', scope: 'workspace' });
  const record = await pending;
  assert.equal(record.approval.mode, 'manual');
  assert.equal(record.state, 'pending');
  assert.equal(guards, 0);
  assert.equal(readFileSync(file, 'utf8'), original);
});

test('revocation accepts a stale rendered selection, but new authorization cannot choose a caller-provided target', async t => {
  const { entry, post, policy, list } = await fixture(t);
  await policy({ mode: 'auto', scope: 'workspace' });
  navigate(entry, '002');
  const stopped = await post('/proposals/policy', { view: { kind: 'todo', todoId: 'sq-001' }, policy: { mode: 'manual' } });
  assert.equal(stopped.status, 200);
  assert.equal((await list()).policy.mode, 'manual');
  assert.equal((await post('/proposals/policy', { policy: { mode: 'auto', scope: 'workspace', todoId: 'sq-001' } })).status, 400);
  assert.equal((await list()).policy.mode, 'manual');
});
