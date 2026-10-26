import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInstanceServer, listen } from '../server.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'agendo-report-http-'));
  const dir = join(root, 'docs', 'todos');
  mkdirSync(dir, { recursive: true });
  // Completed todo in a group
  writeFileSync(join(dir, '100-completed-p2-security-audit-completed.md'),
    '---\nstatus: complete\npriority: p2\ngroup: security\n---\n\n# Security audit completed\n\nCompleted the security audit for Q4.\n\n## Outcome\n\nAll findings addressed and verified.\n');
  // Incomplete todo (should not be included)
  writeFileSync(join(dir, '101-pending-p2-security-review-pending.md'),
    '---\nstatus: pending\npriority: p2\ngroup: security\n---\n\n# Security review pending\n');
  return { root, dir };
}

describe('Report endpoints', () => {
  let entry;
  let root;

  beforeEach(async () => {
    const f = fixture();
    root = f.root;
    entry = createInstanceServer(root, {});
    await listen(entry);
  });

  afterEach(async () => {
    await new Promise(resolve => entry.server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });

  const post = async (path, body) => {
    const res = await fetch(new URL(path, entry.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
      body: JSON.stringify(body)
    });
    return res;
  };

  it('preview returns matched/included/omitted counts for completed todos', async () => {
    const res = await post('/report/preview', { view: { kind: 'group', groupName: 'security' } });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.matched, 1);
    assert.equal(data.included, 1);
    assert.equal(data.omitted, 0);
    assert.ok(data.prompt);
    assert.match(data.prompt, /Synthesize this accomplishments evidence/);
  });

  it('preview excludes incomplete todos from report packet', async () => {
    const res = await post('/report/preview', { view: { kind: 'group', groupName: 'security' } });
    const data = await res.json();
    assert.ok(data.prompt.includes('100'));
    assert.ok(!data.prompt.includes('101'));
  });

  it('preview returns zero counts when no completed todos match', async () => {
    const res = await post('/report/preview', { view: { kind: 'group', groupName: 'nonexistent-group' } });
    assert.equal(res.status, 400);
    const text = await res.text();
    assert.match(text, /No todos match/);
  });

  it('generate requires a preview prompt', async () => {
    const res = await post('/report/generate', {});
    assert.equal(res.status, 400);
    const text = await res.text();
    assert.match(text, /Report preview required/);
  });

  it('generate returns unsupported when no sendAgentRequest provided', async () => {
    const res = await post('/report/generate', { prompt: 'Test report' });
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.reason, 'unsupported');
  });

  it('report prompt includes read-only constraints and TOON packet', async () => {
    const res = await post('/report/preview', { view: { kind: 'group', groupName: 'security' } });
    const data = await res.json();
    assert.match(data.prompt, /Do not modify any todos or files/);
    assert.match(data.prompt, /Evidence packet \(TOON\)/);
    assert.match(data.prompt, /link back to source todo IDs/);
  });
});