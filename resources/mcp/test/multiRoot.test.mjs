import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  resolveTodoRoot,
  resolveRootForCall,
  collectWorkspaceRegistrations,
} from '../discovery.mjs';
import { loadTodo, setTodoStatus } from '../../canvas/agendo-work-session/todos.mjs';

function registration(workspace, hostPid = undefined) {
  return { workspace, endpoint: 'socket', hostPid, identity: randomUUID() };
}

// A syntactically valid diagnostics endpoint (format-only; no server needed).
function validEndpoint() {
  return join(tmpdir(), `agendo-ipc-${randomUUID()}`, 'socket');
}

async function writeTodo(root, id, status = 'pending', priority = 'p2') {
  const todosDir = join(root, 'docs', 'todos');
  await mkdir(todosDir, { recursive: true });
  await writeFile(
    join(todosDir, `${id}-${status}-${priority}-sample.md`),
    `---\nstatus: ${status}\npriority: ${priority}\n---\n\n# ${id}\n\n## Problem Statement\n\n${id}\n\n## Acceptance Criteria\n\n- [ ] One\n`,
  );
}

describe('resolveTodoRoot multi-root selection', () => {
  it('selects root A or B by exact path and basename; same todo ID resolves to isolated files', async () => {
    const rootA = await mkdtemp(join(tmpdir(), 'agendo-multiroot-a-'));
    const rootB = await mkdtemp(join(tmpdir(), 'agendo-multiroot-b-'));
    try {
      await writeTodo(rootA, '001');
      await writeTodo(rootB, '001');

      const regA = registration(rootA);
      const regB = registration(rootB);

      // Exact path selection.
      assert.strictEqual(await resolveTodoRoot([regA, regB], { workspaceFolder: rootA }), rootA);
      assert.strictEqual(await resolveTodoRoot([regA, regB], { workspaceFolder: rootB }), rootB);

      // Basename selection.
      assert.strictEqual(await resolveTodoRoot([regA, regB], { workspaceFolder: basename(rootA) }), rootA);
      assert.strictEqual(await resolveTodoRoot([regA, regB], { workspaceFolder: basename(rootB) }), rootB);

      // Same todo ID loads from independent roots.
      const a = await loadTodo('001', rootA);
      const b = await loadTodo('001', rootB);
      assert.ok(a);
      assert.ok(b);
      assert.equal(a.id, '001');
      assert.equal(b.id, '001');
      assert.notEqual(a.filePath, b.filePath);
      assert.ok(a.filePath.startsWith(rootA));
      assert.ok(b.filePath.startsWith(rootB));

      // Isolated write: set status in A only; B unchanged.
      await setTodoStatus('001', 'in-progress', rootA);
      const aAfter = await loadTodo('001', rootA);
      const bAfter = await loadTodo('001', rootB);
      assert.equal(aAfter.status, 'in-progress');
      assert.equal(bAfter.status, 'pending');
    } finally {
      await rm(rootA, { recursive: true, force: true });
      await rm(rootB, { recursive: true, force: true });
    }
  });

  it('omitted selector with multiple folders throws ambiguous_root', async () => {
    const rootA = await mkdtemp(join(tmpdir(), 'agendo-multiroot-a-'));
    const rootB = await mkdtemp(join(tmpdir(), 'agendo-multiroot-b-'));
    try {
      const regA = registration(rootA);
      const regB = registration(rootB);

      await assert.rejects(async () => resolveTodoRoot([regA, regB], {}), (err) => {
        assert.ok(err.message.startsWith('ambiguous_root:'));
        return true;
      });

      // A CWD that matches neither registration is still ambiguous, not guessed.
      await assert.rejects(async () => resolveTodoRoot([regA, regB], { cwd: tmpdir() }), (err) => {
        assert.ok(err.message.startsWith('ambiguous_root:'));
        return true;
      });
    } finally {
      await rm(rootA, { recursive: true, force: true });
      await rm(rootB, { recursive: true, force: true });
    }
  });

  it('single registration defaults to its root; CWD identity selects a matching folder', async () => {
    const rootA = await mkdtemp(join(tmpdir(), 'agendo-multiroot-a-'));
    try {
      const regA = registration(rootA);

      // Sole folder: no selector required.
      assert.strictEqual(await resolveTodoRoot([regA], {}), rootA);

      // CWD identity: a registered folder equal to the passed cwd is selected.
      assert.strictEqual(await resolveTodoRoot([regA], { cwd: rootA }), rootA);

      // CWD matching no registration: sole root still returned, not ambiguous.
      assert.strictEqual(await resolveTodoRoot([regA], { cwd: tmpdir() }), rootA);
    } finally {
      await rm(rootA, { recursive: true, force: true });
    }
  });

  it('invalid folder name throws invalid_input; colliding basenames throw ambiguous_root', async () => {
    const rootA = await mkdtemp(join(tmpdir(), 'agendo-multiroot-a-'));
    const rootB = await mkdtemp(join(tmpdir(), 'agendo-multiroot-b-'));
    let parentA;
    let parentB;
    try {
      const regA = registration(rootA);
      const regB = registration(rootB);

      // Unknown selector.
      await assert.rejects(async () => resolveTodoRoot([regA, regB], { workspaceFolder: 'no-such-folder' }), (err) => {
        assert.ok(err.message.startsWith('invalid_input:'));
        return true;
      });

      // Two folders with the same basename: selecting by name is ambiguous.
      parentA = await mkdtemp(join(tmpdir(), 'agendo-collide-a-'));
      parentB = await mkdtemp(join(tmpdir(), 'agendo-collide-b-'));
      const collidingA = join(parentA, 'shared');
      const collidingB = join(parentB, 'shared');
      await mkdir(collidingA, { recursive: true });
      await mkdir(collidingB, { recursive: true });
      const regCA = registration(collidingA);
      const regCB = registration(collidingB);

      await assert.rejects(async () => resolveTodoRoot([regCA, regCB], { workspaceFolder: 'shared' }), (err) => {
        assert.ok(err.message.startsWith('ambiguous_root:'));
        return true;
      });

      // Exact path still disambiguates.
      assert.strictEqual(await resolveTodoRoot([regCA, regCB], { workspaceFolder: collidingA }), collidingA);
      assert.strictEqual(await resolveTodoRoot([regCA, regCB], { workspaceFolder: collidingB }), collidingB);
    } finally {
      await rm(rootA, { recursive: true, force: true });
      await rm(rootB, { recursive: true, force: true });
      await rm(parentA, { recursive: true, force: true });
      await rm(parentB, { recursive: true, force: true });
    }
  });

  it('workspace-file aliases are excluded; only real directories are roots', async () => {
    const rootA = await mkdtemp(join(tmpdir(), 'agendo-multiroot-a-'));
    try {
      const regA = registration(rootA);

      // A workspace-file alias is a file, not a directory.
      const aliasPath = join(rootA, '.code-workspace');
      await writeFile(aliasPath, JSON.stringify({ folders: [] }));
      const regAlias = registration(aliasPath);

      // Alias alone: no valid folder -> undefined (caller falls back to standalone).
      assert.strictEqual(await resolveTodoRoot([regAlias], {}), undefined);

      // Alias + real folder: alias excluded; selecting the alias name is invalid.
      await assert.rejects(async () => resolveTodoRoot([regA, regAlias], { workspaceFolder: basename(aliasPath) }), (err) => {
        assert.ok(err.message.startsWith('invalid_input:'));
        return true;
      });

      // The real folder remains selectable by path and by basename.
      assert.strictEqual(await resolveTodoRoot([regA, regAlias], { workspaceFolder: rootA }), rootA);
      assert.strictEqual(await resolveTodoRoot([regA, regAlias], { workspaceFolder: basename(rootA) }), rootA);
    } finally {
      await rm(rootA, { recursive: true, force: true });
    }
  });

  it('isolates the same todo ID across a workspace root and a manual root', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'agendo-workspace-'));
    const manualRoot = await mkdtemp(join(tmpdir(), 'agendo-manual-'));
    try {
      // Workspace root: todos under docs/todos.
      await writeTodo(workspaceRoot, '001');

      // Manual root: todos read directly from the root, honoring .agendo-config.json
      // with a custom backlogged folder.
      await writeFile(
        join(manualRoot, '.agendo-config.json'),
        JSON.stringify({ backloggedFolder: 'inbox' }),
      );
      const inboxDir = join(manualRoot, 'inbox');
      await mkdir(inboxDir, { recursive: true });
      await writeFile(
        join(inboxDir, '001-pending-p2-sample.md'),
        '---\nstatus: pending\npriority: p2\n---\n# Manual\n\n## Problem Statement\n\nManual.\n\n## Acceptance Criteria\n\n- [ ] One\n',
      );

      const regWorkspace = registration(workspaceRoot);
      const regManual = { ...registration(manualRoot), rootMode: 'manual', label: 'Manual Root' };

      // Workspace root selected by path: workspace mode.
      const ws = await resolveRootForCall(
        [regWorkspace, regManual],
        { workspaceFolder: workspaceRoot, cwd: tmpdir() },
      );
      assert.strictEqual(ws.workspaceRoot, workspaceRoot);
      assert.strictEqual(ws.rootMode, 'workspace');
      const wsTodo = await loadTodo('001', ws.workspaceRoot, ws.rootMode);
      assert.equal(wsTodo.status, 'pending');

      // Manual root selected by path: manual mode reads directly from the root.
      const manual = await resolveRootForCall(
        [regWorkspace, regManual],
        { workspaceFolder: manualRoot, cwd: tmpdir() },
      );
      assert.strictEqual(manual.workspaceRoot, manualRoot);
      assert.strictEqual(manual.rootMode, 'manual');
      const manualTodo = await loadTodo('001', manual.workspaceRoot, manual.rootMode);
      assert.equal(manualTodo.status, 'pending');
      assert.equal(manualTodo.filePath, join(inboxDir, '001-pending-p2-sample.md'));

      // Manual root selected by label.
      const byLabel = await resolveRootForCall(
        [regWorkspace, regManual],
        { workspaceFolder: 'Manual Root', cwd: tmpdir() },
      );
      assert.strictEqual(byLabel.workspaceRoot, manualRoot);
      assert.strictEqual(byLabel.rootMode, 'manual');

      // Isolated write: set status in the manual root only; the workspace root is unchanged.
      await setTodoStatus('001', 'in-progress', manual.workspaceRoot, manual.rootMode);
      const manualAfter = await loadTodo('001', manual.workspaceRoot, manual.rootMode);
      const wsAfter = await loadTodo('001', ws.workspaceRoot, ws.rootMode);
      assert.equal(manualAfter.status, 'in-progress');
      assert.equal(wsAfter.status, 'pending');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
      await rm(manualRoot, { recursive: true, force: true });
    }
  });

  it('no registration returns undefined so the caller falls back to standalone CWD root', async () => {
    // Empty registry.
    assert.strictEqual(await resolveTodoRoot([], {}), undefined);

    // A registration without a workspace path is ignored.
    assert.strictEqual(await resolveTodoRoot([registration(undefined)], {}), undefined);
  });

  it('deduplicates duplicate registrations for the same workspace path', async () => {
    const rootA = await mkdtemp(join(tmpdir(), 'agendo-multiroot-a-'));
    const rootB = await mkdtemp(join(tmpdir(), 'agendo-multiroot-b-'));
    try {
      // Two records for rootA, one for rootB.
      const regA1 = registration(rootA);
      const regA2 = registration(rootA);
      const regB = registration(rootB);

      // Selecting rootA by path is deduped: no ambiguous error despite two records.
      assert.strictEqual(await resolveTodoRoot([regA1, regA2, regB], { workspaceFolder: rootA }), rootA);

      // Without a selector, rootA and rootB are distinct roots -> ambiguous.
      await assert.rejects(async () => resolveTodoRoot([regA1, regA2, regB], {}), (err) => {
        assert.ok(err.message.startsWith('ambiguous_root:'));
        return true;
      });
    } finally {
      await rm(rootA, { recursive: true, force: true });
      await rm(rootB, { recursive: true, force: true });
    }
  });
});

describe('collectWorkspaceRegistrations hostPid filtering', () => {
  it('filters records by host PID and excludes records without a workspace', async () => {
    const registry = await mkdtemp(join(tmpdir(), 'agendo-registry-'));
    try {
      const writeReg = async (hostPid, workspace) => {
        await writeFile(
          join(registry, `${randomUUID()}.json`),
          JSON.stringify({ endpoint: validEndpoint(), hostPid, workspace }),
        );
      };
      await writeReg(100, '/path/A');
      await writeReg(200, '/path/B');
      await writeReg(100, '/path/C');
      await writeReg(999, undefined);

      // No hostPid filter: every record carrying a workspace is returned.
      const all = await collectWorkspaceRegistrations(registry);
      assert.equal(all.length, 3);
      assert.ok(all.every((r) => r.workspace !== undefined));

      // Host PID 100: reg-one and reg-three only.
      const byPid100 = await collectWorkspaceRegistrations(registry, 100);
      assert.equal(byPid100.length, 2);
      assert.ok(byPid100.every((r) => r.hostPid === 100));

      // Host PID 200: reg-two only.
      const byPid200 = await collectWorkspaceRegistrations(registry, 200);
      assert.equal(byPid200.length, 1);
      assert.equal(byPid200[0].workspace, '/path/B');

      // Host PID with no match: empty (the caller reports editor_unavailable).
      const byPid999 = await collectWorkspaceRegistrations(registry, 999);
      assert.equal(byPid999.length, 0);
    } finally {
      await rm(registry, { recursive: true, force: true });
    }
  });

  describe('readEndpoint preserves rootMode and label', () => {
    it('round-trips a manual registration with rootMode and label through collectWorkspaceRegistrations', async () => {
      const registry = await mkdtemp(join(tmpdir(), 'agendo-registry-'));
      const root = await mkdtemp(join(tmpdir(), 'agendo-manual-root-'));
      try {
        await writeFile(
          join(registry, `${randomUUID()}.json`),
          JSON.stringify({
            endpoint: validEndpoint(),
            hostPid: undefined,
            workspace: root,
            rootMode: 'manual',
            label: 'Personal Todos',
          }),
        );

        const records = await collectWorkspaceRegistrations(registry);
        assert.equal(records.length, 1);
        assert.equal(records[0].workspace, root);
        assert.equal(records[0].rootMode, 'manual');
        assert.equal(records[0].label, 'Personal Todos');

        // Selecting by label returns the manual root with manual mode.
        const resolved = await resolveTodoRoot([records[0]], { workspaceFolder: 'Personal Todos' });
        assert.strictEqual(resolved, root);

        // Selecting by path also works.
        const resolvedByPath = await resolveTodoRoot([records[0]], { workspaceFolder: root });
        assert.strictEqual(resolvedByPath, root);
      } finally {
        await rm(registry, { recursive: true, force: true });
        await rm(root, { recursive: true, force: true });
      }
    });

    it('workspace records without rootMode default to workspace mode', async () => {
      const registry = await mkdtemp(join(tmpdir(), 'agendo-registry-'));
      const root = await mkdtemp(join(tmpdir(), 'agendo-workspace-root-'));
      try {
        await writeFile(
          join(registry, `${randomUUID()}.json`),
          JSON.stringify({
            endpoint: validEndpoint(),
            hostPid: undefined,
            workspace: root,
            // No rootMode or label.
          }),
        );

        const records = await collectWorkspaceRegistrations(registry);
        assert.equal(records.length, 1);
        assert.equal(records[0].workspace, root);
        assert.equal(records[0].rootMode, undefined);
        assert.equal(records[0].label, undefined);

        // resolveRootForCall applies the safe default.
        const resolved = await resolveRootForCall([records[0]], { workspaceFolder: root });
        assert.strictEqual(resolved.workspaceRoot, root);
        assert.strictEqual(resolved.rootMode, 'workspace');
      } finally {
        await rm(registry, { recursive: true, force: true });
        await rm(root, { recursive: true, force: true });
      }
    });

    it('invalid rootMode values are safely defaulted to workspace', async () => {
      const registry = await mkdtemp(join(tmpdir(), 'agendo-registry-'));
      const root = await mkdtemp(join(tmpdir(), 'agendo-invalid-root-'));
      try {
        await writeFile(
          join(registry, `${randomUUID()}.json`),
          JSON.stringify({
            endpoint: validEndpoint(),
            hostPid: undefined,
            workspace: root,
            rootMode: 'bogus',
          }),
        );

        const records = await collectWorkspaceRegistrations(registry);
        assert.equal(records.length, 1);
        assert.equal(records[0].rootMode, 'bogus');

        // buildCandidates applies the safe default.
        const resolved = await resolveRootForCall([records[0]], {});
        assert.strictEqual(resolved.workspaceRoot, root);
        assert.strictEqual(resolved.rootMode, 'workspace');
      } finally {
        await rm(registry, { recursive: true, force: true });
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
