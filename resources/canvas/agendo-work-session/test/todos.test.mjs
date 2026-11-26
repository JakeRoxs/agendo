import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import {
  assertTodoId,
  findTodoFile,
  loadTodo,
  resolveWorkspaceRoot,
  todoFingerprint,
} from '../todos.mjs';
import { writeFileSync, rmSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('todo id validation', () => {
  it('accepts plain, cql-, and sq- prefixed ids', () => {
    assert.strictEqual(assertTodoId('033'), '033');
    assert.strictEqual(assertTodoId('cql-001'), 'cql-001');
    assert.strictEqual(assertTodoId('sq-007'), 'sq-007');
  });

  it('rejects malformed ids', () => {
    assert.throws(() => assertTodoId('abc'), /Agendo ID/);
    assert.throws(() => assertTodoId('12'), /Agendo ID/);
    assert.throws(() => assertTodoId(''), /Agendo ID/);
  });
});

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'agendo-todo-'));
  const todosDir = join(root, 'docs', 'todos');
  mkdirSync(todosDir, { recursive: true });
  return { root, todosDir };
}

function writeTodo(todosDir, id, status, priority, frontmatter, body) {
  const path = join(todosDir, `${id}-${status}-${priority}-test.md`);
  writeFileSync(path, `---\n${frontmatter}---\n\n${body}`, 'utf-8');
  return path;
}

describe('criterion parsing', () => {
  const { root, todosDir } = makeRoot();
  after(() => rmSync(root, { recursive: true, force: true }));

  it('parses met and unmet criteria with text', () => {
    writeTodo(todosDir, '001', 'pending', 'p3', 'status: pending\npriority: p3\n', '# Test\n\n## Acceptance Criteria\n- [x] first criterion\n- [ ] second criterion\n');
    const todo = loadTodo('001', root);
    assert.strictEqual(todo.criteria.length, 2);
    assert.strictEqual(todo.criteria[0].met, true);
    assert.strictEqual(todo.criteria[0].text, 'first criterion');
    assert.strictEqual(todo.criteria[1].met, false);
    assert.strictEqual(todo.criteria[1].text, 'second criterion');
  });

  it('does not match a longer heading as the requested section', () => {
    writeTodo(
      todosDir,
      '002',
      'pending',
      'p3',
      'status: pending\npriority: p3\n',
      '# Test\n\n## Acceptance Criteria (Previous)\n- [x] old criterion\n',
    );
    const todo = loadTodo('002', root);
    assert.strictEqual(todo.criteria.length, 0);
  });

  it('ends the accepted section at the next level-2 heading', () => {
    writeTodo(
      todosDir,
      '003',
      'pending',
      'p3',
      'status: pending\npriority: p3\n',
      '# Test\n\n## Acceptance Criteria\n- [x] first criterion\n\n## Work Log\n',
    );
    const todo = loadTodo('003', root);
    assert.strictEqual(todo.criteria.length, 1);
    assert.strictEqual(todo.criteria[0].met, true);
    assert.strictEqual(todo.criteria[0].text, 'first criterion');
  });

  it('extracts title from the heading', () => {
    writeTodo(todosDir, '002', 'pending', 'p3', 'status: pending\npriority: p3\n', '# My Todo\n\nBody text');
    const todo = loadTodo('002', root);
    assert.strictEqual(todo.title, 'My Todo');
  });
});

describe('work log ordering', () => {
  const { root, todosDir } = makeRoot();
  after(() => rmSync(root, { recursive: true, force: true }));

  it('sorts timestamped entries newest-first and treats legacy dates as day-start UTC', () => {
    writeTodo(todosDir, '001', 'pending', 'p3', 'status: pending\npriority: p3\n', [
      '# Test',
      '',
      '## Work Log',
      '',
      '### 2026-02-02',
      'legacy newer day',
      '',
      '### 2026-02-01T22:30:00-05:00',
      'late timestamp',
      '',
      '### 2026-02-02T01:00:00Z',
      'early timestamp',
      '',
      '### 2026-02-01',
      'legacy older day',
      '',
    ].join('\n'));
    const todo = loadTodo('001', root);
    assert.deepStrictEqual(todo.workLog.map(entry => entry.content), [
      'late timestamp',
      'early timestamp',
      'legacy newer day',
      'legacy older day',
    ]);
    assert.deepStrictEqual(todo.workLog.map(entry => entry.date), [
      '2026-02-01T22:30:00-05:00',
      '2026-02-02T01:00:00Z',
      '2026-02-02',
      '2026-02-01',
    ]);
  });

  it('sorts same-day timestamp headings by instant and keeps ties in source order', () => {
    writeTodo(todosDir, '002', 'pending', 'p3', 'status: pending\npriority: p3\n', [
      '# Test',
      '',
      '## Work Log',
      '',
      '### 2026-02-02T10:00:00Z',
      'first',
      '',
      '### 2026-02-02T12:00:00+02:00',
      'same instant',
      '',
      '### 2026-02-02T11:00:00Z',
      'latest',
      '',
    ].join('\n'));
    assert.deepStrictEqual(loadTodo('002', root).workLog.map(entry => entry.content), [
      'latest',
      'first',
      'same instant',
    ]);
  });
});

describe('dependency parsing', () => {
  const { root, todosDir } = makeRoot();
  after(() => rmSync(root, { recursive: true, force: true }));

  it('parses array and string dependencies', () => {
    writeTodo(todosDir, '001', 'pending', 'p3', 'status: pending\npriority: p3\ndependencies:\n  - 002\n  - cql-003\n', '# Test\n');
    writeTodo(todosDir, '002', 'completed', 'p1', 'status: completed\npriority: p1\n', '# Dep\n');
    const todo = loadTodo('001', root);
    assert.deepStrictEqual(todo.dependencies, ['002', 'cql-003']);
  });

  it('parses a single string dependency', () => {
    writeTodo(todosDir, '001', 'pending', 'p3', 'status: pending\npriority: p3\ndependencies: 002\n', '# Test\n');
    const todo = loadTodo('001', root);
    assert.deepStrictEqual(todo.dependencies, ['002']);
  });
});

describe('workspace root resolution', () => {
  it('resolves the repo root from an extensions install dir', () => {
    const root = mkdtempSync(join(tmpdir(), 'agendo-root-'));
    const extDir = join(root, '.github', 'extensions');
    mkdirSync(extDir, { recursive: true });
    const installDir = join(extDir, 'server.mjs');
    writeFileSync(installDir, '', 'utf-8');
    assert.strictEqual(resolveWorkspaceRoot(installDir), root);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('todo fingerprint and lookup', () => {
  const { root, todosDir } = makeRoot();
  after(() => rmSync(root, { recursive: true, force: true }));

  it('produces a deterministic fingerprint', () => {
    writeTodo(todosDir, '001', 'pending', 'p3', '', '# A');
    writeTodo(todosDir, '002', 'pending', 'p3', '', '# B');
    const fp1 = todoFingerprint(root);
    const fp2 = todoFingerprint(root);
    assert.strictEqual(fp1, fp2);
    assert.ok(fp1.includes('001'));
    assert.ok(fp1.includes('002'));
  });

  it('throws on ambiguous todo ids', () => {
    writeTodo(todosDir, '001', 'pending', 'p3', '', '# A');
    writeFileSync(
      join(todosDir, '001-pending-p3-other.md'),
      '---\nstatus: pending\npriority: p3\n---\n\n# B',
      'utf-8'
    );
    assert.throws(() => findTodoFile('001', root), /Ambiguous todo ID/);
  });
});
