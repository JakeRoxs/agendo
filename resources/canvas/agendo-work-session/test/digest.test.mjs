import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderDigestCanvas } from '../digest.mjs';
import { createInstanceServer, listen, navigate } from '../server.mjs';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const testDir = join(tmpdir(), 'agendo-digest-test-' + Date.now());
mkdirSync(testDir, { recursive: true });

function createTodoFile(id, frontmatter = '', body = '') {
  const dir = join(testDir, 'docs', 'todos');
  mkdirSync(dir, { recursive: true });
  const content = `---\n${frontmatter}---\n\n${body}`;
  const path = join(dir, `${id}.md`);
  writeFileSync(path, content, 'utf-8');
  return path;
}

function cleanTodoFiles() {
  rmSync(testDir, { recursive: true, force: true });
}

describe('Digest canvas server flow', () => {
  it('renders digest page with navigation when view kind is digest', async () => {
    createTodoFile('001-pending-p3-test', 'status: pending\npriority: p3\n', '# Test');
    const entry = createInstanceServer(testDir, {
      getDigest: async (scope) => ({ content: `# Digest for ${scope}\n\n- Active: **1**` }),
    });
    await listen(entry);
    try {
      // Navigate to a todo first so history has multiple views (dropdown renders).
      navigate(entry, '001');
      navigate(entry, { kind: 'digest', scope: 'todos' });
      assert.strictEqual(entry.view.kind, 'digest');
      assert.strictEqual(entry.view.scope, 'todos');

      const res = await fetch(entry.url);
      const html = await res.text();
      assert.strictEqual(res.status, 200);
      assert.ok(html.includes('Task Digest'), 'Should render digest heading');
      assert.ok(html.includes('data-open-digest="todos"'), 'Should render digest nav button');
      assert.ok(html.includes('digest-content'), 'Should have content container');
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
    cleanTodoFiles();
  });

  it('/digest-snapshot returns digest content', async () => {
    createTodoFile('001-pending-p3-test', 'status: pending\npriority: p3\n', '# Test');
    const entry = createInstanceServer(testDir, {
      getDigest: async (scope) => ({ content: `# Digest for ${scope}\n\n- Active: **1**` }),
    });
    await listen(entry);
    try {
      navigate(entry, { kind: 'digest', scope: 'todos' });

      const res = await fetch(new URL('/digest-snapshot', entry.url));
      assert.strictEqual(res.status, 200);
      const digest = await res.json();
      assert.strictEqual(digest.content, `# Digest for todos\n\n- Active: **1**`);
      assert.ok(digest.content.includes('Active'), 'Should have overview');
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
    cleanTodoFiles();
  });

  it('/open navigates to digest view from a todo', async () => {
    createTodoFile('001-pending-p3-test', 'status: pending\npriority: p3\n', '# Test');
    const entry = createInstanceServer(testDir, {
      getDigest: async (scope) => ({ content: `# Digest for ${scope}` }),
    });
    await listen(entry);
    try {
      navigate(entry, '001');
      assert.strictEqual(entry.view.todoId, '001');

      const res = await fetch(new URL('/open', entry.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
        body: JSON.stringify({ view: { kind: 'digest', scope: 'todos' } }),
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.deepStrictEqual(entry.view, { kind: 'digest', scope: 'todos' });
      assert.strictEqual(entry.todoId, undefined);

      const html = await (await fetch(entry.url)).text();
      assert.ok(html.includes('Task Digest'), 'Should re-render as digest');
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
    cleanTodoFiles();
  });

  it('digest navigation via history pill works (data-open-digest click handler)', async () => {
    createTodoFile('001-pending-p3-test', 'status: pending\npriority: p3\n', '# Test');
    const entry = createInstanceServer(testDir, {
      getDigest: async (scope) => ({ content: `# Digest for ${scope}` }),
    });
    await listen(entry);
    try {
      navigate(entry, '001');
      navigate(entry, { kind: 'digest', scope: 'todos' });

      const html = await (await fetch(entry.url)).text();
      assert.ok(html.includes('data-open-digest="todos"'), 'Should have digest nav button');

      const res = await fetch(new URL('/open', entry.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
        body: JSON.stringify({ view: { kind: 'digest', scope: 'todos' } }),
      });
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(entry.view, { kind: 'digest', scope: 'todos' });
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
    cleanTodoFiles();
  });

  it('renderDigestCanvas includes navigation and bootstrap', () => {
    const nav = { recent: [], canBack: false, canForward: false, returnTo: undefined };
    const html = renderDigestCanvas('todos', nav, 'nonce123', 'csp');
    assert.ok(html.includes('Task Digest'), 'Should have digest heading');
    assert.ok(html.includes('digest-content'), 'Should have content container');
    assert.ok(html.includes('fetch(\'/digest-snapshot\')'), 'Should fetch digest snapshot');
    assert.ok(html.includes('data-open-digest'), 'Should have digest navigation buttons');
    assert.ok(html.includes('location.reload()'), 'Should reload on navigation');
  });

  it('renderDigestCanvas rejects invalid scope', () => {
    const nav = { recent: [], canBack: false, canForward: false, returnTo: undefined };
    assert.throws(() => renderDigestCanvas('invalid', nav, 'nonce', 'csp'), /Invalid digest scope/);
  });

  for (const scope of ['todos', 'code-scanning']) {
    it(`${scope} digest uses the shared toolbar without a status paragraph above it`, () => {
      const nav = { recent: [], canBack: false, canForward: false, returnTo: undefined };
      const html = renderDigestCanvas(scope, nav, 'nonce123', 'csp');
      assert.match(html, /<body>\s*<div class="canvas-toolbar">/);
      assert.ok(!html.includes('workspace-navigation'));
      assert.ok(html.includes('document.body.append(status)'));
      assert.ok(!html.includes('document.body.prepend(status)'));
      assert.ok(html.includes("status.className = 'error'"));
      assert.ok(html.includes("status.setAttribute('aria-live', 'polite')"));
    });
  }
});
