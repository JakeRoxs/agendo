import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createInstanceServer, listen, navigate } from '../server.mjs';

const change = (criterionIndex = 0) => ({ criterionIndex, met: true, rationale: 'Reviewed test result', evidence: 'Targeted regression test passed' });

async function fixture(t, actions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'agendo-proposal-http-'));
  const dir = join(root, 'docs', 'todos');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'sq-001-pending-p1-finding.md');
  writeFileSync(file, '---\nstatus: pending\npriority: p1\ngroup: security\n---\n\n# Scanner finding\n\n## Acceptance Criteria\n\n- [ ] First check\n- [ ] Second check\n\n## Notes\n\nPreserve my notes.\n');
  writeFileSync(join(dir, '002-ready-p2-other.md'), '---\nstatus: ready\npriority: p2\n---\n\n# Other\n');
  const entry = createInstanceServer(root, actions);
  navigate(entry, 'sq-001');
  await listen(entry);
  t.after(async () => {
    await new Promise(resolve => entry.server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });
  const view = { kind: 'todo', todoId: 'sq-001' };
  const post = (path, body, protectedRequest = true) => fetch(new URL(path, entry.url), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(protectedRequest ? { 'X-Agendo-Canvas': '1' } : {}) },
    body: JSON.stringify({ view, ...body })
  });
  const create = async (changes = [change()]) => {
    const response = await post('/proposals/create', { changes });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  return { entry, file, post, create };
}

test('proposal import is read-only, updates version, and renders evidence as escaped text', async t => {
  let guardCalls = 0;
  const { entry, file, create } = await fixture(t, { assertWritable: async () => { guardCalls++; } });
  const original = readFileSync(file, 'utf8');
  const before = await (await fetch(new URL('/version', entry.url))).text();
  const proposal = await create([{ ...change(), rationale: '<script>doNotExecute()</script>' }]);
  assert.equal(guardCalls, 0);
  assert.equal(readFileSync(file, 'utf8'), original);
  const after = await (await fetch(new URL('/version', entry.url))).text();
  assert.notEqual(before, after);
  const html = await (await fetch(entry.url)).text();
  assert.match(html, /&lt;script&gt;doNotExecute\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>doNotExecute/);
  assert.match(html, /data-proposal-confirm/);
  assert.match(html, /data-proposal-apply disabled/);
  assert.ok(html.includes(proposal.id));
});

test('only user-selected changes apply through the native guard, and remaining changes can be rejected', async t => {
  const guarded = [];
  const { file, post, create } = await fixture(t, { assertWritable: async id => { guarded.push(id); } });
  const proposal = await create([change(0), change(1)]);
  const response = await post('/proposals/apply', { proposalId: proposal.id, changeIds: [proposal.changes[0].id] });
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(guarded, ['sq-001']);
  assert.match(readFileSync(file, 'utf8'), /- \[x\] First check\n- \[ \] Second check/);
  assert.match(readFileSync(file, 'utf8'), /status: pending/);
  assert.match(readFileSync(file, 'utf8'), /Preserve my notes\./);
  const afterApply = readFileSync(file, 'utf8');
  assert.equal((await post('/proposals/reject', { proposalId: proposal.id, changeIds: [proposal.changes[1].id] })).status, 200);
  assert.equal(readFileSync(file, 'utf8'), afterApply);
  const list = await (await post('/proposals/list', {})).json();
  assert.equal(list.proposals[0].changes[0].state, 'applied');
  assert.equal(list.proposals[0].changes[1].state, 'rejected');
});

test('unsupported hosts can inspect and reject but cannot apply through a file-write fallback', async t => {
  const { entry, file, post, create } = await fixture(t);
  const original = readFileSync(file, 'utf8');
  const proposal = await create();
  const list = await (await post('/proposals/list', {})).json();
  assert.equal(list.canApply, false);
  const html = await (await fetch(entry.url)).text();
  assert.match(html, /data-can-apply="false"/);
  assert.match(html, /data-proposal-copy/);
  assert.equal((await post('/proposals/apply', { proposalId: proposal.id, changeIds: [proposal.changes[0].id] })).status, 400);
  assert.equal(readFileSync(file, 'utf8'), original);
  assert.equal((await post('/proposals/reject', { proposalId: proposal.id, changeIds: [proposal.changes[0].id] })).status, 200);
});

test('native permission or dirty-document refusal prevents every file write', async t => {
  const { file, post, create } = await fixture(t, { assertWritable: async () => { throw new Error('Unsaved document or untrusted workspace'); } });
  const original = readFileSync(file, 'utf8');
  const proposal = await create();
  assert.notEqual((await post('/proposals/apply', { proposalId: proposal.id, changeIds: [proposal.changes[0].id] })).status, 200);
  assert.equal(readFileSync(file, 'utf8'), original);
});

test('external edits while the native guard is pending are preserved and make the proposal stale', async t => {
  let file;
  const context = await fixture(t, { assertWritable: async () => { writeFileSync(file, readFileSync(file, 'utf8') + '\nA concurrent note.\n'); } });
  file = context.file;
  const proposal = await context.create();
  assert.equal((await context.post('/proposals/apply', { proposalId: proposal.id, changeIds: [proposal.changes[0].id] })).status, 400);
  assert.match(readFileSync(file, 'utf8'), /A concurrent note\./);
  assert.match(readFileSync(file, 'utf8'), /- \[ \] First check/);
});

test('navigation while the native guard is pending aborts rather than applying behind another view', async t => {
  let entry;
  const context = await fixture(t, { assertWritable: async () => { navigate(entry, '002'); } });
  entry = context.entry;
  const original = readFileSync(context.file, 'utf8');
  const proposal = await context.create();
  assert.equal((await context.post('/proposals/apply', { proposalId: proposal.id, changeIds: [proposal.changes[0].id] })).status, 400);
  assert.equal(readFileSync(context.file, 'utf8'), original);
});

test('proposal HTTP actions reject stale selections, unknown proposals, and lifecycle fields', async t => {
  const { entry, post, create } = await fixture(t, { assertWritable: async () => {} });
  assert.equal((await post('/proposals/create', { changes: [{ ...change(), status: 'completed' }] })).status, 400);
  const proposal = await create();
  assert.equal((await post('/proposals/apply', { proposalId: 'unknown', changeIds: [proposal.changes[0].id] })).status, 400);
  navigate(entry, '002');
  for (const path of ['/proposals/create', '/proposals/list', '/proposals/apply', '/proposals/reject']) {
    assert.equal((await post(path, { changes: [change()], proposalId: proposal.id, changeIds: [proposal.changes[0].id] })).status, 400);
  }
});

test('proposal endpoints require the canvas request protection header', async t => {
  const { post } = await fixture(t);
  for (const path of ['/proposals/create', '/proposals/list', '/proposals/apply', '/proposals/reject']) {
    assert.equal((await post(path, {}, false)).status, 403);
  }
});

test('proposal IDs cannot cross instance boundaries', async t => {
  const first = await fixture(t);
  const second = await fixture(t, { assertWritable: async () => {} });
  const proposal = await first.create();
  assert.equal((await second.post('/proposals/apply', { proposalId: proposal.id, changeIds: [proposal.changes[0].id] })).status, 400);
});

test('proposal application does not target scanner-managed or fenced example checkboxes', async t => {
  const { file, post, create } = await fixture(t, { assertWritable: async () => {} });
  const managed = '<!-- agendo:scan-evidence:start -->\n## Scanner Evidence\n- [ ] Scanner example only\n<!-- agendo:scan-evidence:end -->';
  const fenced = '```md\n- [ ] Fenced example only\n```';
  writeFileSync(file, readFileSync(file, 'utf8').replace('- [ ] First check', `${managed}\n${fenced}\n- [ ] First check`));
  const proposal = await create([change(1)]);
  assert.equal(proposal.changes[0].text, 'Second check');
  assert.equal((await post('/proposals/apply', { proposalId: proposal.id, changeIds: [proposal.changes[0].id] })).status, 200);
  const updated = readFileSync(file, 'utf8');
  assert.ok(updated.includes(managed));
  assert.ok(updated.includes(fenced));
  assert.match(updated, /- \[ \] First check\n- \[x\] Second check/);
});

test('proposal application preserves mixed line endings and all unrelated bytes', async t => {
  const { file, post, create } = await fixture(t, { assertWritable: async () => {} });
  const original = readFileSync(file, 'utf8').replace(/\n/g, '\r\n').replace('## Notes\r\n', '## Notes\n');
  writeFileSync(file, original);
  const proposal = await create();
  assert.equal((await post('/proposals/apply', { proposalId: proposal.id, changeIds: [proposal.changes[0].id] })).status, 200);
  assert.equal(readFileSync(file, 'utf8'), original.replace('- [ ] First check', '- [x] First check'));
});

test('pending capacity is bounded and only resolved proposals are evicted', async t => {
  const { entry } = await fixture(t);
  const store = entry.proposals;
  for (let i = 0; i < 20; i++) store.create({ todoId: 'sq-001', changes: [change()] });
  assert.equal(store.list('sq-001').length, 20);
  assert.throws(() => store.create({ todoId: 'sq-001', changes: [change()] }), /capacity/i);
  const first = store.list('sq-001')[0];
  store.reject(first.id, [first.changes[0].id]);
  store.create({ todoId: 'sq-001', changes: [change()] });
  assert.equal(store.list('sq-001').length, 20);
  assert.equal(store.list('sq-001').some(item => item.id === first.id), false);
});

test('a genuinely pending guard locks create, reject, and duplicate application', async t => {
  const { entry } = await fixture(t);
  const store = entry.proposals;
  const proposal = store.create({ todoId: 'sq-001', changes: [change()] });
  let entered;
  let release;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const pending = store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: async () => { entered(); await gate; } });
  try {
    await started;
    assert.throws(() => store.create({ todoId: 'sq-001', changes: [change()] }), /in progress/i);
    assert.throws(() => store.reject(proposal.id, [proposal.changes[0].id]), /in progress/i);
    await assert.rejects(store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: async () => {} }), /in progress/i);
  } finally {
    release();
    await pending;
  }
  assert.equal(store.list('sq-001')[0].state, 'applied');
});

test('an atomic rename failure leaves the file and proposal unchanged and cleans temporary files', async t => {
  const { entry, file } = await fixture(t);
  const original = readFileSync(file, 'utf8');
  const proposal = entry.proposals.create({ todoId: 'sq-001', changes: [change()] });
  t.mock.method(fs, 'renameSync', () => { throw new Error('Simulated atomic rename failure'); });
  syncBuiltinESMExports();
  try {
    await assert.rejects(entry.proposals.apply(proposal.id, [proposal.changes[0].id], { assertWritable: async () => {} }), /Simulated atomic rename failure/);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
  assert.equal(readFileSync(file, 'utf8'), original);
  assert.equal(entry.proposals.list('sq-001')[0].changes[0].state, 'pending');
  assert.deepEqual(entry.proposals.list('sq-001')[0].revision, proposal.revision);
  assert.equal(fs.readdirSync(dirname(file)).some(name => name.includes('.tmp.')), false);
});
