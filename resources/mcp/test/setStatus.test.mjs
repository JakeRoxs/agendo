import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { setStatusInputSchema, setStatusHandler } from '../server.mjs';
import { loadTodo, setTodoPriority, setTodoGroup } from '../../canvas/agendo-work-session/todos.mjs';
import { isReadyBlocked, TERMINAL_STATUSES } from '../../canvas/agendo-work-session/statusLifecycle.js';

const setStatusSchema = z.object(setStatusInputSchema);

const STATUSES = ['pending', 'in-progress', 'ready', 'backlogged', 'completed', 'cancelled'];

function expectedFolder(status) {
  switch (status) {
    case 'backlogged': return 'backlogged';
    case 'completed': return 'completed';
    case 'cancelled': return 'cancelled';
    default: return '';
  }
}

async function writePendingTodo(root) {
  const todosDir = join(root, 'docs', 'todos');
  await mkdir(todosDir, { recursive: true });
  await writeFile(
    join(todosDir, '001-pending-p2-sample.md'),
    '---\nstatus: pending\npriority: p2\n---\n\n# Sample\n\n## Problem Statement\n\nBroken.\n\n## Acceptance Criteria\n\n- [ ] One\n',
  );
}

function targetPath(root, status) {
  const folder = expectedFolder(status);
  return join(root, 'docs', 'todos', folder, `001-${status}-p2-sample.md`);
}

describe('set_status MCP tool', () => {
  it('schema accepts every canonical status and rejects complete plus invalid statuses', () => {
    for (const status of STATUSES) {
      assert.ok(setStatusSchema.safeParse({ todoId: '001', status }).success, `${status} must be accepted`);
    }
    // The previously accepted-but-unsupported value is now rejected.
    assert.ok(!setStatusSchema.safeParse({ todoId: '001', status: 'complete' }).success);
    assert.ok(!setStatusSchema.safeParse({ todoId: '001', status: 'bogus' }).success);
    assert.ok(!setStatusSchema.safeParse({ todoId: '001' }).success);
  });

  for (const status of STATUSES) {
    it(`transitions a todo to ${status}, moving file/frontmatter/folder consistently`, async () => {
      const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-set-status-'));
      try {
        await writePendingTodo(root);

        // Start from a non-pending status so the transition is real even when
        // the target is the fixture's initial 'pending' status.
        if (status === 'pending') {
          await setStatusHandler({ todoId: '001', status: 'in-progress' }, root);
        }

        const result = await setStatusHandler({ todoId: '001', status }, root);
        assert.ok(result.success);
        assert.equal(result.changed, true);
        assert.match(result.message, new RegExp(status));

        const target = targetPath(root, status);
        const text = await readFile(target, 'utf8');
        assert.match(text, new RegExp(`^status: ${status}$`, 'm'));
        assert.match(target, new RegExp(`001-${status}-p2-sample\\.md$`));
        assert.match(target, new RegExp(`${expectedFolder(status) || 'docs/todos'}/`));

        const loaded = loadTodo('001', root);
        assert.equal(loaded.status, status);
        assert.equal(loaded.filePath, target);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }

  it('round-trips completed back to pending without a cancelled banner', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-round-trip-'));
    try {
      await writePendingTodo(root);

      await setStatusHandler({ todoId: '001', status: 'completed' }, root);
      await setStatusHandler({ todoId: '001', status: 'pending' }, root);

      const back = targetPath(root, 'pending');
      const text = await readFile(back, 'utf8');
      assert.match(text, /^status: pending$/m);
      assert.doesNotMatch(text, /\*\*CANCELLED\*\*/);
      assert.equal(loadTodo('001', root).status, 'pending');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects ready when dependencies are unresolved and allows ready once they are terminal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-ready-blocked-'));
    try {
      const todosDir = join(root, 'docs', 'todos');
      await mkdir(todosDir, { recursive: true });

      // Dependency todo that starts pending (not terminal).
      await writeFile(
        join(todosDir, '002-pending-p2-dep.md'),
        '---\nstatus: pending\npriority: p2\n---\n# Dep\n\n## Problem Statement\n\nDep.\n\n## Acceptance Criteria\n\n- [ ] One\n\n## Work Log\n\n### 2026-01-01\nDone.\n',
      );
      // Todo depending on 002.
      await writeFile(
        join(todosDir, '001-pending-p2-sample.md'),
        '---\nstatus: pending\npriority: p2\ndependencies: ["002"]\n---\n# Sample\n\n## Problem Statement\n\nBroken.\n\n## Acceptance Criteria\n\n- [ ] One\n\n## Work Log\n\n### 2026-01-01\nDone.\n',
      );

      // Setting 001 to ready must be rejected because 002 is not terminal.
      await assert.rejects(
        setStatusHandler({ todoId: '001', status: 'ready' }, root),
        (err) => {
          assert.ok(err.code === 'invalid_input');
          assert.ok(/unresolved dependencies/.test(err.message));
          return true;
        }
      );

      // Resolve the dependency by completing it.
      const resolved = await setStatusHandler({ todoId: '002', status: 'completed' }, root);
      assert.ok(resolved.success);
      assert.equal(resolved.changed, true);

      // Now 001 can be set to ready.
      const result = await setStatusHandler({ todoId: '001', status: 'ready' }, root);
      assert.ok(result.success);
      assert.equal(result.changed, true);

      const loaded = loadTodo('001', root);
      assert.equal(loaded.status, 'ready');
      assert.equal(loaded.filePath, join(root, 'docs', 'todos', '001-ready-p2-sample.md'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects an invalid status with a single actionable invalid_input error', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-set-status-'));
    try {
      await writePendingTodo(root);

      // `complete` is accepted by the MCP schema historically but rejected by
      // the lifecycle implementation; the caller must see one clear error.
      await assert.rejects(setStatusHandler({ todoId: '001', status: 'complete' }, root), (err) => {
        assert.ok(err.code === 'invalid_input');
        assert.ok(/one of:/.test(err.message));
        return true;
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('is a no-op when already at the target status', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-noop-'));
    try {
      await writePendingTodo(root);

      const result = await setStatusHandler({ todoId: '001', status: 'pending' }, root);
      assert.ok(result.success);
      assert.equal(result.changed, false);
      assert.match(result.message, /Already pending/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('retains CRLF when adding frontmatter to a CRLF file without frontmatter', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-crlf-'));
    try {
      const todosDir = join(root, 'docs', 'todos');
      await mkdir(todosDir, { recursive: true });
      const filePath = join(todosDir, '002-pending-p3-crlf-sample.md');
      await writeFile(filePath, '# CRLF Todo\r\n\r\nBody with CRLF line endings.\r\n', 'utf8');

      const result = await setStatusHandler({ todoId: '002', status: 'in-progress' }, root);
      assert.ok(result.success);
      assert.equal(result.changed, true);

      const loaded = loadTodo('002', root);
      assert.ok(loaded);
      const text = await readFile(loaded.filePath, 'utf8');
      assert.ok(text.includes('\r\n'), 'CRLF must be retained');
      assert.match(text, /^status: in-progress$/m);
      assert.match(text, /---\r\n/, 'Frontmatter delimiters must use CRLF');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects malformed frontmatter without modifying the file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-malformed-'));
    try {
      const todosDir = join(root, 'docs', 'todos');
      await mkdir(todosDir, { recursive: true });
      const filePath = join(todosDir, '003-pending-p2-malformed.md');
      await writeFile(filePath, '---\nstatus: pending\npriority: p2\n# Malformed\n\nMissing closing delimiter', 'utf8');

      await assert.rejects(
        setStatusHandler({ todoId: '003', status: 'in-progress' }, root),
        (err) => {
          assert.ok(err.message.includes('Malformed frontmatter'));
          return true;
        }
      );

      // File must be unchanged
      const text = await readFile(filePath, 'utf8');
      assert.match(text, /^status: pending$/m);
      assert.doesNotMatch(text, /^status: in-progress$/m);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('adds cancelled tag to block-style tags list preserving existing tags', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-block-tags-'));
    try {
      const todosDir = join(root, 'docs', 'todos');
      await mkdir(todosDir, { recursive: true });
      const filePath = join(todosDir, '004-pending-p2-block-tags.md');
      await writeFile(
        filePath,
        '---\nstatus: pending\npriority: p2\ntags:\n  - existing\n---\n\n# Block Tags\n\nBody.\n',
        'utf8'
      );

      const result = await setStatusHandler({ todoId: '004', status: 'cancelled' }, root);
      assert.ok(result.success);
      assert.equal(result.changed, true);

      const loaded = loadTodo('004', root);
      assert.ok(loaded);
      const text = await readFile(loaded.filePath, 'utf8');
      assert.match(text, /tags: \[existing, cancelled\]/, 'tags must contain existing and cancelled');
      assert.match(text, /> \*\*CANCELLED\*\*/, 'cancelled banner must be present');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('setTodoPriority updates filename and frontmatter', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-priority-'));
    try {
      await writePendingTodo(root);
      const result = await setTodoPriority('001', 'p1', root);
      assert.ok(result.success);
      assert.equal(result.changed, true);
      assert.match(result.message, /Priority changed to p1/);

      const target = join(root, 'docs', 'todos', '001-pending-p1-sample.md');
      const text = await readFile(target, 'utf8');
      assert.match(text, /^priority: p1$/m);
      assert.match(text, /^status: pending$/m);

      const loaded = loadTodo('001', root);
      assert.equal(loaded.priority, 'p1');
      assert.equal(loaded.filePath, target);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('setTodoGroup sets and clears group in frontmatter', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-group-'));
    try {
      await writePendingTodo(root);

      // Set group
      const result = await setTodoGroup('001', 'auth', root);
      assert.ok(result.success);
      assert.equal(result.changed, true);

      const text = await readFile(join(root, 'docs', 'todos', '001-pending-p2-sample.md'), 'utf8');
      assert.match(text, /^group: auth$/m);

      // Clear group
      const cleared = await setTodoGroup('001', '', root);
      assert.ok(cleared.success);
      assert.equal(cleared.changed, true);

      const clearedText = await readFile(join(root, 'docs', 'todos', '001-pending-p2-sample.md'), 'utf8');
      assert.doesNotMatch(clearedText, /^group:/m);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('setTodoGroup is a no-op and does not rewrite when the group is already set', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-group-noop-'));
    try {
      await writePendingTodo(root);

      // Set group
      const result = await setTodoGroup('001', 'auth', root);
      assert.ok(result.success);
      assert.equal(result.changed, true);
      assert.match(result.message, /Group set to auth/);

      const before = await readFile(join(root, 'docs', 'todos', '001-pending-p2-sample.md'), 'utf8');

      // Same group again: no rewrite, unchanged result.
      const repeated = await setTodoGroup('001', 'auth', root);
      assert.ok(repeated.success);
      assert.equal(repeated.changed, false);
      assert.match(repeated.message, /Already auth/);
      assert.strictEqual(
        await readFile(join(root, 'docs', 'todos', '001-pending-p2-sample.md'), 'utf8'),
        before,
        'file must not be rewritten on a no-op',
      );

      // A different group still rewrites.
      const changed = await setTodoGroup('001', 'other', root);
      assert.ok(changed.success);
      assert.equal(changed.changed, true);

      // Clearing the group is a real change.
      const cleared = await setTodoGroup('001', '', root);
      assert.ok(cleared.success);
      assert.equal(cleared.changed, true);
      const clearedText = await readFile(join(root, 'docs', 'todos', '001-pending-p2-sample.md'), 'utf8');
      assert.doesNotMatch(clearedText, /^group:/m);

      // Clearing an already-cleared group is a no-op.
      const clearedAgain = await setTodoGroup('001', '', root);
      assert.ok(clearedAgain.success);
      assert.equal(clearedAgain.changed, false);
      assert.strictEqual(
        await readFile(join(root, 'docs', 'todos', '001-pending-p2-sample.md'), 'utf8'),
        clearedText,
        'file must not be rewritten when clearing an already-cleared group',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  describe('isReadyBlocked readiness gate', () => {
    it('blocks a missing dependency ID', () => {
      assert.strictEqual(isReadyBlocked(['001'], [{ id: '002', status: 'completed' }]), true);
    });

    it('does not block a single terminal dependency', () => {
      assert.strictEqual(isReadyBlocked(['002'], [{ id: '002', status: 'completed' }]), false);
      assert.strictEqual(isReadyBlocked(['002'], [{ id: '002', status: 'cancelled' }]), false);
    });

    it('blocks a single non-terminal dependency', () => {
      assert.strictEqual(isReadyBlocked(['002'], [{ id: '002', status: 'pending' }]), true);
      assert.strictEqual(isReadyBlocked(['002'], [{ id: '002', status: 'in-progress' }]), true);
    });

    it('blocks a duplicate dependency regardless of record order (terminal-first)', () => {
      const terminalFirst = [
        { id: '004', status: 'completed' },
        { id: '004', status: 'pending' },
      ];
      assert.strictEqual(isReadyBlocked(['004'], terminalFirst), true);
    });

    it('blocks a duplicate dependency regardless of record order (open-first)', () => {
      const openFirst = [
        { id: '004', status: 'pending' },
        { id: '004', status: 'completed' },
      ];
      assert.strictEqual(isReadyBlocked(['004'], openFirst), true);
    });
  });

  it('setTodoStatus rejects ready when a dependency has duplicate (ambiguous) records', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agendo-mcp-dup-dep-'));
    try {
      const todosDir = join(root, 'docs', 'todos');
      await mkdir(todosDir, { recursive: true });

      // Duplicate dependency ID: one terminal (completed) and one open (pending).
      await writeFile(
        join(todosDir, '014-completed-p2-blocker-done.md'),
        '---\nstatus: completed\npriority: p2\n---\n# Done\n',
        'utf8',
      );
      await writeFile(
        join(todosDir, '014-pending-p2-blocker-active.md'),
        '---\nstatus: pending\npriority: p2\n---\n# Active\n',
        'utf8',
      );
      await writeFile(
        join(todosDir, '015-pending-p2-dependent.md'),
        '---\ndependencies: [014]\n---\n# Dependent\n',
        'utf8',
      );

      await assert.rejects(
        () => setStatusHandler({ todoId: '015', status: 'ready' }, root),
        (e) => e.code === 'invalid_input' && /unresolved dependencies/i.test(e.message),
      );
      // File still pending.
      assert.ok(
        await stat(join(todosDir, '015-pending-p2-dependent.md')),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
