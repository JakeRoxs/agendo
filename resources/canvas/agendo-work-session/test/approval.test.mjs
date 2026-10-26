import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CanvasError } from '../errors.mjs';
import { createProposalStore } from '../proposals.mjs';

let createApprovalController;
try {
  ({ createApprovalController } = await import('../approval.mjs'));
} catch {
  createApprovalController = null;
}

function makeTestDir() {
  const dir = join(tmpdir(), `agendo-approval-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(join(dir, 'docs', 'todos'), { recursive: true });
  return dir;
}

function cleanupTestDir(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function writeTodo(dir, id, title, criteria, opts = {}) {
  const dirPath = join(dir, 'docs', 'todos');
  const status = opts.status ?? 'pending';
  const priority = opts.priority ?? 'p2';
  const lines = [
    '---',
    `title: ${title}`,
    `status: ${status}`,
    `priority: ${priority}`
  ];
  if (opts.group) lines.push(`group: ${opts.group}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${title}`);
  lines.push('');
  if (criteria.length) {
    lines.push('## Acceptance Criteria');
    lines.push('');
    for (const c of criteria) {
      const mark = c.met ? 'x' : ' ';
      lines.push(`- [${mark}] ${c.text}`);
    }
    lines.push('');
  }
  lines.push('## Notes');
  lines.push('');
  lines.push('Some unrelated notes that must be preserved.');
  lines.push('');
  const filename = `${id}-${status}-${priority}-test.md`;
  writeFileSync(join(dirPath, filename), lines.join('\n'), 'utf-8');
  return join(dirPath, filename);
}

function loadFileContent(path) {
  return readFileSync(path, 'utf-8');
}

function makeView(selectedTodoId) {
  return {
    kind: 'todo',
    todoId: selectedTodoId,
    workspaceRoot: null,
    isDirty: false,
    isStale: false,
    scannerRunning: false
  };
}

function okGuard() {
  return async () => {};
}

function failingGuard(message = 'Write failed') {
  return async () => { throw new CanvasError('write_failed', message); };
}

describe('createApprovalController', () => {
  it('is exported and callable', () => {
    assert.ok(typeof createApprovalController === 'function', 'createApprovalController must be exported');
  });

  describe('default policy', () => {
    it('defaults to manual mode', () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          const policy = ctrl.getPolicy();
          assert.equal(policy.mode, 'manual');
          assert.equal(policy.sessionOnly, true);
          assert.equal(policy.workspaceRoot, dir);
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('manual mode is read-only for create', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Manual Test', [{ met: false, text: 'C1' }]);
        const original = loadFileContent(filePath);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          const result = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
          });
          assert.equal(result.approval.mode, 'manual');
          assert.equal(result.approval.outcome, 'pending');
          assert.equal(loadFileContent(filePath), original, 'manual create must not write');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('auto todo scope', () => {
    it('applies immediately in auto todo scope when guard succeeds', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Auto Todo Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const result = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-001'
          });
          assert.equal(result.approval.mode, 'auto');
          assert.equal(result.approval.outcome, 'applied');
          assert.equal(result.approval.scope, 'todo');
          assert.ok(loadFileContent(filePath).includes('- [x] C1'), 'auto should write file');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('defers when no requestId in auto mode', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Auto No RequestId', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const result = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
          });
          assert.equal(result.approval.mode, 'auto');
          assert.equal(result.approval.outcome, 'deferred');
          assert.equal(result.approval.reason, 'missing_request_id');
          assert.ok(loadFileContent(filePath).includes('- [ ] C1'), 'should not write without requestId');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('rejects requestId longer than 128 chars', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const longId = 'r'.repeat(129);
          await assert.rejects(ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: longId
          }), /requestId|length/i);
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('only applies to currently selected todo', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Selected Todo', [{ met: false, text: 'C1' }]);
        const otherPath = writeTodo(dir, '048', 'Other Todo', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        let selectedId = '047';
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView(selectedId),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const result = await ctrl.create({
            todoId: '048',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-nav'
          });
          assert.equal(result.approval.outcome, 'deferred');
          assert.ok(loadFileContent(otherPath).includes('- [ ] C1'), 'unselected todo should not be written');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('auto workspace scope', () => {
    it('applies when target matches selection in workspace scope', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Target A', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'workspace' });
          const result = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-ws'
          });
          assert.equal(result.approval.outcome, 'applied');
          assert.equal(result.approval.scope, 'workspace');
          assert.ok(loadFileContent(join(dir, 'docs', 'todos', '047-pending-p2-test.md')).includes('- [x] C1'));
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('defers workspace scope when target does not match selection', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Target A', [{ met: false, text: 'C1' }]);
        writeTodo(dir, '048', 'Target B', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'workspace' });
          const result = await ctrl.create({
            todoId: '048',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-ws-diff'
          });
          assert.equal(result.approval.outcome, 'deferred');
          assert.equal(result.approval.reason, 'selection_mismatch');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('navigation and mode transitions', () => {
    it('navigation away from target defers with scope_mismatch', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Nav Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        let selectedId = '047';
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView(selectedId),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          selectedId = '099';
          const result = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-nav2'
          });
          assert.equal(result.approval.mode, 'auto');
          assert.equal(result.approval.outcome, 'deferred');
          assert.equal(result.approval.reason, 'scope_mismatch');
          assert.ok(loadFileContent(filePath).includes('- [ ] C1'));
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('mode change to manual makes new creates pending', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Mode Change Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const beforeGen = ctrl.getPolicy().generation;
          ctrl.setPolicy({ mode: 'manual' });
          assert.ok(ctrl.getPolicy().generation > beforeGen, 'generation must increment');
          const result = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-mode-change'
          });
          assert.equal(result.approval.mode, 'manual');
          assert.equal(result.approval.outcome, 'pending');
          assert.ok(loadFileContent(filePath).includes('- [ ] C1'));
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('setting auto policy does not apply existing pending proposals', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Future Only Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          const manualResult = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
          });
          assert.equal(manualResult.approval.outcome, 'pending');
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const listed = ctrl.list('047');
          assert.equal(listed.length, 1);
          assert.equal(listed[0].approval.outcome, 'pending');
          assert.ok(loadFileContent(filePath).includes('- [ ] C1'), 'policy change must not apply old proposals');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('guard behavior', () => {
    it('guard failure defers auto and leaves proposal pending', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Guard Fail Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: failingGuard('disk full')
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const result = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-guard-fail'
          });
          assert.equal(result.approval.mode, 'auto');
          assert.equal(result.approval.outcome, 'deferred');
          assert.equal(result.approval.reason, 'write_failed');
          assert.ok(loadFileContent(filePath).includes('- [ ] C1'), 'guard failure must not write');
          const listed = ctrl.list('047');
          assert.equal(listed.length, 1);
          assert.equal(listed[0].state, 'pending');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('no auto retry on guard failure', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'No Retry Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        let callCount = 0;
        const guard = async () => {
          callCount++;
          throw new CanvasError('write_failed', 'persistent failure');
        };
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: guard
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-no-retry'
          });
          assert.equal(callCount, 1, 'guard called exactly once, no retry');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('requestId idempotency', () => {
    it('reused requestId with same payload returns original proposal', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Idempotency Test', [
          { met: false, text: 'C1' },
          { met: false, text: 'C2' }
        ]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const changes = [{ criterionIndex: 0, met: true, rationale: 'r1', evidence: 'e1' }];
          const first = await ctrl.create({
            todoId: '047',
            changes,
            requestId: 'req-idem'
          });
          assert.equal(first.approval.outcome, 'applied');
          assert.ok(loadFileContent(filePath).includes('- [x] C1'));
          const second = await ctrl.create({
            todoId: '047',
            changes,
            requestId: 'req-idem'
          });
          assert.equal(second.id, first.id, 'same requestId returns same proposal');
          assert.equal(second.approval.outcome, 'applied');
          assert.equal(second.changes.length, 1, 'no new mutation applied');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('conflicting payload with same requestId is rejected', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Conflict Test', [
          { met: false, text: 'C1' },
          { met: false, text: 'C2' }
        ]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r1', evidence: 'e1' }],
            requestId: 'req-conflict'
          });
          await assert.rejects(ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 1, met: true, rationale: 'r2', evidence: 'e2' }],
            requestId: 'req-conflict'
          }), /conflict|different/i);
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('manual resolution', () => {
    it('noteManual records applied action metadata', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Manual Apply Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          const proposal = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
          });
          assert.equal(proposal.approval.outcome, 'pending');
          // Perform actual apply then record
          await store.apply(proposal.id, proposal.changes.map(c => c.id), { assertWritable: okGuard() });
          const resolved = ctrl.noteManual(proposal.id, 'applied');
          assert.equal(resolved.approval.manualAction, 'applied');
          assert.equal(resolved.approval.reason, 'manual_action');
          assert.ok(loadFileContent(filePath).includes('- [x] C1'));
          const listed = ctrl.list('047');
          assert.equal(listed[0].approval.manualAction, 'applied');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('noteManual records rejected action metadata', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Manual Reject Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          const proposal = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
          });
          // Perform actual reject then record
          store.reject(proposal.id, proposal.changes.map(c => c.id));
          const resolved = ctrl.noteManual(proposal.id, 'rejected');
          assert.equal(resolved.approval.manualAction, 'rejected');
          assert.equal(resolved.approval.reason, 'manual_action');
          assert.ok(loadFileContent(filePath).includes('- [ ] C1'));
          const listed = ctrl.list('047');
          assert.equal(listed[0].approval.manualAction, 'rejected');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('dispose', () => {
    it('dispose cancels in-flight auto create', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Dispose Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        let guardResolved = false;
        const guard = async () => {
          while (!guardResolved) {
            await new Promise(r => setTimeout(r, 10));
          }
        };
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: guard
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const createP = ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-dispose'
          });
          await new Promise(r => setTimeout(r, 50));
          ctrl.dispose();
          guardResolved = true;
          const result = await createP;
          assert.ok(['failed', 'deferred'].includes(result.approval.outcome), 'dispose should abort auto');
          assert.ok(loadFileContent(filePath).includes('- [ ] C1'));
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('dispose invalidates policy generation', () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        const genBefore = ctrl.getPolicy().generation;
        ctrl.dispose();
        const genAfter = ctrl.getPolicy().generation;
        assert.ok(genAfter > genBefore, 'dispose must bump generation');
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('unsupported host', () => {
    it('getPolicy reports supported as false when no guard', () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047')
        });
        try {
          const policy = ctrl.getPolicy();
          assert.equal(policy.supported, false);
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('no lifecycle/scanner writes', () => {
    it('does not write lifecycle or scanner metadata on apply', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const dirPath = join(dir, 'docs', 'todos');
        const content = [
          '---',
          'title: Lifecycle Test',
          'status: pending',
          'priority: p2',
          '---',
          '',
          '# Lifecycle Test',
          '',
          '## Acceptance Criteria',
          '',
          '- [ ] C1',
          '',
          '## Notes',
          '',
          'Original notes.',
          ''
        ].join('\n');
        const filePath = join(dirPath, '047-pending-p2-test.md');
        writeFileSync(filePath, content, 'utf-8');

        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-lifecycle'
          });
          const after = loadFileContent(filePath);
          assert.ok(after.includes('Original notes.'), 'notes preserved');
          assert.ok(!after.includes('agendo:lifecycle'), 'no lifecycle metadata');
          assert.ok(!after.includes('agendo:scan-evidence'), 'no scanner metadata');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('policy shape', () => {
    it('getPolicy returns all required fields', () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          const p = ctrl.getPolicy();
          assert.ok('mode' in p);
          assert.ok('sessionOnly' in p);
          assert.ok('workspaceRoot' in p);
          assert.ok('generation' in p);
          assert.ok('supported' in p);
          assert.ok('effectiveMode' in p);
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('setPolicy to auto throws when unsupported', () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047')
        });
        try {
          assert.throws(() => ctrl.setPolicy({ mode: 'auto', scope: 'todo' }), /unsupported|assertWritable/i);
          const p = ctrl.getPolicy();
          assert.equal(p.mode, 'manual');
          assert.equal(p.effectiveMode, 'manual');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('requestId state after manual resolution', () => {
    it('same requestId after manual reject returns current rejected state', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Reject Replay', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          const changes = [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }];
          const first = await ctrl.create({
            todoId: '047',
            changes,
            requestId: 'req-reject-replay'
          });
          assert.equal(first.approval.outcome, 'pending');
          // Perform actual rejection then record metadata
          store.reject(first.id, first.changes.map(c => c.id));
          ctrl.noteManual(first.id, 'rejected');
          // Replay with same requestId returns current state, not new mutation
          const replayed = await ctrl.create({
            todoId: '047',
            changes,
            requestId: 'req-reject-replay'
          });
          assert.equal(replayed.id, first.id, 'replay returns same proposal');
          const current = store.list('047').find(p => p.id === first.id);
          assert.equal(current.state, 'rejected');
          assert.ok(loadFileContent(filePath).includes('- [ ] C1'));
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('same requestId after manual apply returns current applied state', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Apply Replay', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          const changes = [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }];
          const first = await ctrl.create({
            todoId: '047',
            changes,
            requestId: 'req-apply-replay'
          });
          // Perform actual apply then record metadata
          await store.apply(first.id, first.changes.map(c => c.id), { assertWritable: okGuard() });
          ctrl.noteManual(first.id, 'applied');
          const replayed = await ctrl.create({
            todoId: '047',
            changes,
            requestId: 'req-apply-replay'
          });
          assert.equal(replayed.id, first.id);
          const current = store.list('047').find(p => p.id === first.id);
          assert.equal(current.state, 'applied');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('replay cache capacity', () => {
    it('rejects beyond 256 replay IDs before create', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        // Create a todo with 257 criteria so each iteration uses a fresh criterion
        const criteria = [];
        for (let i = 0; i < 257; i++) {
          criteria.push({ met: false, text: `Criterion ${i}` });
        }
        writeTodo(dir, '047', 'Capacity Test', criteria);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          // Create and resolve 256 proposals to fill the replay index
          for (let i = 0; i < 256; i++) {
            const changes = [{ criterionIndex: i, met: true, rationale: 'r', evidence: 'e' }];
            const p = await ctrl.create({ todoId: '047', changes, requestId: `cap-${i}` });
            await store.apply(p.id, p.changes.map(c => c.id), { assertWritable: okGuard() });
          }
          // 257th should be rejected for capacity before create
          const overflowChanges = [{ criterionIndex: 256, met: true, rationale: 'r', evidence: 'e' }];
          await assert.rejects(ctrl.create({
            todoId: '047',
            changes: overflowChanges,
            requestId: 'cap-overflow'
          }), /capacity|evict/i);
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('malformed requestId rejection', () => {
    const malformedValues = [
      { value: {}, label: 'object' },
      { value: 123, label: 'number' },
      { value: true, label: 'boolean' },
      { value: '   ', label: 'whitespace' },
      { value: '', label: 'empty string' }
    ];

    for (const { value, label } of malformedValues) {
      it(`rejects ${label} requestId`, async () => {
        if (!createApprovalController) throw new Error('approval.mjs not available');
        const dir = makeTestDir();
        try {
          writeTodo(dir, '047', 'Malformed ID', [{ met: false, text: 'C1' }]);
          const store = createProposalStore(dir);
          const ctrl = createApprovalController({
            proposals: store,
            workspaceRoot: dir,
            getView: () => makeView('047'),
            assertWritable: okGuard()
          });
          try {
            ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
            await assert.rejects(ctrl.create({
              todoId: '047',
              changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
              requestId: value
            }), /requestId/i);
          } finally {
            ctrl.dispose();
          }
        } finally {
          cleanupTestDir(dir);
        }
      });
    }

    it('undefined requestId manually defers in auto mode', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Undefined ID', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const result = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
          });
          assert.equal(result.approval.outcome, 'deferred');
          assert.equal(result.approval.reason, 'missing_request_id');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('duplicate requestId payload validation', () => {
    it('rejects duplicate requestId with extra change key', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Extra Key Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-extra-key'
          });
          // Extra key is rejected before idempotency lookup as invalid_input (stricter)
          try {
            await ctrl.create({
              todoId: '047',
              changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e', status: 'done' }],
              requestId: 'req-extra-key'
            });
            assert.fail('expected rejection');
          } catch (err) {
            assert.ok(
              err.code === 'invalid_input' || err.code === 'duplicate_request',
              `expected invalid_input or duplicate_request, got ${err.code}`
            );
          }
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('accepts duplicate requestId with reordered fields', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Reorder Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const first = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-reorder'
          });
          // Reordered object fields are semantically identical
          const second = await ctrl.create({
            todoId: '047',
            changes: [{ met: true, rationale: 'r', evidence: 'e', criterionIndex: 0 }],
            requestId: 'req-reorder'
          });
          assert.equal(second.id, first.id);
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('in-flight coalescing', () => {
    it('coalesces duplicate in-flight creates, guard called once', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Coalesce Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        let guardCalls = 0;
        const slowGuard = async () => {
          guardCalls++;
          await new Promise(r => setTimeout(r, 50));
        };
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: slowGuard
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const changes = [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }];
          const p1 = ctrl.create({ todoId: '047', changes, requestId: 'req-coalesce' });
          const p2 = ctrl.create({ todoId: '047', changes, requestId: 'req-coalesce' });
          const [r1, r2] = await Promise.all([p1, p2]);
          assert.equal(r1.id, r2.id, 'coalesced to same proposal');
          assert.equal(guardCalls, 1, 'guard called exactly once');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('noteManual resilience', () => {
    it('noteManual after dispose does not throw for existing proposal', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Post-Dispose Note', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        const proposal = await ctrl.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });
        ctrl.dispose();
        // Reporting metadata after dispose must not error
        const result = ctrl.noteManual(proposal.id, 'applied');
        assert.equal(result.approval.manualAction, 'applied');
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('outcome message requirement', () => {
    it('successful auto apply includes nonempty user-facing message', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Auto Message', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          ctrl.setPolicy({ mode: 'auto', scope: 'todo' });
          const result = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }],
            requestId: 'req-msg'
          });
          assert.equal(result.approval.outcome, 'applied');
          assert.ok(
            typeof result.approval.message === 'string' && result.approval.message.trim().length > 0,
            'applied outcome must include nonempty user-facing message'
          );
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('manual pending includes nonempty user-facing message', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Manual Message', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          const result = await ctrl.create({
            todoId: '047',
            changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
          });
          assert.equal(result.approval.outcome, 'pending');
          assert.ok(
            typeof result.approval.message === 'string' && result.approval.message.trim().length > 0,
            'pending outcome must include nonempty user-facing message'
          );
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('defensive copy', () => {
    it('mutating returned approval metadata does not alter list or replay', async () => {
      if (!createApprovalController) throw new Error('approval.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Defensive Copy', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const ctrl = createApprovalController({
          proposals: store,
          workspaceRoot: dir,
          getView: () => makeView('047'),
          assertWritable: okGuard()
        });
        try {
          const changes = [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }];
          const original = await ctrl.create({
            todoId: '047',
            changes,
            requestId: 'req-defensive'
          });
          // Mutate the returned object
          original.approval.outcome = 'mutated';
          original.approval.message = 'mutated';
          original.changes[0].rationale = 'mutated';
          // list() should show original values
          const listed = ctrl.list('047');
          assert.equal(listed[0].approval.outcome, 'pending');
          assert.equal(listed[0].changes[0].rationale, 'r');
          // Replay should also show original values
          const replayed = await ctrl.create({
            todoId: '047',
            changes,
            requestId: 'req-defensive'
          });
          assert.equal(replayed.approval.outcome, 'pending');
          assert.equal(replayed.changes[0].rationale, 'r');
        } finally {
          ctrl.dispose();
        }
      } finally {
        cleanupTestDir(dir);
      }
    });
  });
});
