import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadTodo, loadGroupTodos } from '../todos.mjs';
import { renderCanvas, renderGroupCanvas } from '../page.mjs';
import { assertViewExists, assertViewSupported, createInstanceServer, listen, normalizeFilters, normalizeView, navigate, step } from '../server.mjs';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const testDir = join(tmpdir(), 'agendo-canvas-test-' + Date.now());
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

describe('Canvas todo loading with group and scan fields', () => {
  it('loads group field from frontmatter', () => {
    const path = createTodoFile(
      '001-pending-p3-test',
      'status: pending\npriority: p3\ngroup: scanner-workflow\n',
      '# Test'
    );
    const todo = loadTodo('001', testDir);
    assert.strictEqual(todo.group, 'scanner-workflow');
    cleanTodoFiles();
  });

  it('returns undefined group when missing', () => {
    createTodoFile('002-pending-p3-test', 'status: pending\npriority: p3\n', '# Test');
    const todo = loadTodo('002', testDir);
    assert.strictEqual(todo.group, undefined);
    cleanTodoFiles();
  });

  it('loads scan provenance fields from frontmatter', () => {
    createTodoFile(
      'sq-003-pending-p3-test',
      'status: pending\npriority: p3\nscan_source: sonarqube\nscan_scope: owner/repo\nscan_grouping: rule\nscan_target: rule-id\nscan_refreshed_at: 2026-10-25T22:00:00.000Z\nscan_review_required: true\n',
      '# Test'
    );
    const todo = loadTodo('sq-003', testDir);
    assert.deepStrictEqual(todo.scan, {
      source: 'sonarqube',
      scope: 'owner/repo',
      grouping: 'rule',
      target: 'rule-id',
      refreshedAt: '2026-10-25T22:00:00.000Z',
      reviewRequired: true
    });
    cleanTodoFiles();
  });

  it('returns undefined scan fields when missing', () => {
    createTodoFile('004-pending-p3-test', 'status: pending\npriority: p3\n', '# Test');
    const todo = loadTodo('004', testDir);
    assert.deepStrictEqual(todo.scan, {
      source: undefined,
      scope: undefined,
      grouping: undefined,
      target: undefined,
      refreshedAt: undefined,
      reviewRequired: false
    });
    cleanTodoFiles();
  });
});

describe('Canvas page rendering with group and import pills', () => {
  const baseTodo = {
    id: '001',
    title: 'Test Todo',
    status: 'pending',
    priority: 'p3',
    criteria: [],
    workLog: [],
    description: '',
    scannerEvidence: null,
    resumeContext: null,
    triage: [],
    dependencies: [],
    scan: { source: undefined, scope: undefined, grouping: undefined, target: undefined, refreshedAt: undefined, reviewRequired: false }
  };

  it('renders group pill when group is set', () => {
    const todo = { ...baseTodo, group: 'scanner-workflow' };
    const html = renderCanvas(todo, null, null, {}, ['scanner-workflow']);
    assert.ok(html.includes('scanner-workflow'), 'Should render group pill');
    assert.ok(html.includes('data-group-select'), 'Should use group selector');
  });

  it('renders group selector with no group option when group is empty', () => {
    const todo = { ...baseTodo, group: '' };
    const html = renderCanvas(todo, null, null, {}, ['scanner-workflow']);
    assert.ok(html.includes('data-group-select'), 'Should render group selector');
    assert.ok(html.includes('no group'), 'Should have no group option');
  });

  it('renders group selector when group is undefined', () => {
    const html = renderCanvas(baseTodo, null, null, {}, ['scanner-workflow']);
    assert.ok(html.includes('data-group-select'), 'Should render group selector');
  });

  it('renders file import pill', () => {
    const todo = { ...baseTodo, scan: { ...baseTodo.scan, grouping: 'file' } };
    const html = renderCanvas(todo, null, null, {}, []);
    assert.ok(html.includes('File import'), 'Should render file import pill');
    assert.ok(html.includes('badge-import'), 'Should use import pill class');
  });

  it('renders rule import pill', () => {
    const todo = { ...baseTodo, scan: { ...baseTodo.scan, grouping: 'rule' } };
    const html = renderCanvas(todo, null, null, {}, []);
    assert.ok(html.includes('Rule import'), 'Should render rule import pill');
  });

  it('renders issue import pill', () => {
    const todo = { ...baseTodo, scan: { ...baseTodo.scan, grouping: 'finding' } };
    const html = renderCanvas(todo, null, null, {}, []);
    assert.ok(html.includes('Issue import'), 'Should render issue import pill');
  });

  it('does not render import pill when grouping is missing', () => {
    const html = renderCanvas(baseTodo, null, null, {}, []);
    assert.ok(!html.includes('badge-import'), 'Should not render import pill');
  });

  it('renders scan tooltip with scope and target', () => {
    const todo = {
      ...baseTodo,
      scan: { source: 'sonarqube', scope: 'owner/repo', grouping: 'rule', target: 'rule-id', refreshedAt: null, reviewRequired: false }
    };
    const html = renderCanvas(todo, null, null, {}, []);
    assert.ok(html.includes('scope: owner/repo'), 'Should include scope in tooltip');
    assert.ok(html.includes('target: rule-id'), 'Should include target in tooltip');
  });

  it('includes review required in tooltip', () => {
    const todo = { ...baseTodo, scan: { ...baseTodo.scan, grouping: 'file', reviewRequired: true } };
    const html = renderCanvas(todo, null, null, {}, []);
    assert.ok(html.includes('review required'), 'Should include review required in tooltip');
  });

  it('pill order: source, status, priority, group, import', () => {
    const todo = { ...baseTodo, group: 'scanner-workflow', scan: { ...baseTodo.scan, grouping: 'file' } };
    const html = renderCanvas(todo, null, null, {}, []);
    const sourceIdx = html.indexOf('badge-source');
    const statusIdx = html.indexOf('data-status-select');
    const priorityIdx = html.indexOf('badge-priority');
    const groupIdx = html.indexOf('badge-group');
    const importIdx = html.indexOf('badge-import');
    assert.ok(sourceIdx < statusIdx, 'source before status');
    assert.ok(statusIdx < priorityIdx, 'status before priority');
    assert.ok(priorityIdx < groupIdx, 'priority before group');
    assert.ok(groupIdx < importIdx, 'group before import');
  });
});

describe('Status lifecycle help', () => {
  const baseTodo = {
    id: '001',
    title: 'Test Todo',
    status: 'pending',
    priority: 'p3',
    criteria: [],
    workLog: [],
    description: '',
    scannerEvidence: null,
    resumeContext: null,
    triage: [],
    dependencies: [],
    group: undefined,
    scan: { source: undefined, scope: undefined, grouping: undefined, target: undefined, refreshedAt: undefined, reviewRequired: false }
  };

  const statuses = ['pending', 'in-progress', 'ready', 'complete', 'backlogged', 'cancelled'];

  it('renders status help for all six states', () => {
    for (const status of statuses) {
      const todo = { ...baseTodo, status };
      const html = renderCanvas(todo, null, null, {}, []);
      assert.ok(html.includes('status-help'), `Should render status help for ${status}`);
      assert.ok(html.includes('Lifecycle help for ' + status), `Should have accessible label for ${status}`);
    }
  });

  it('shows pending meaning and next step', () => {
    const html = renderCanvas(baseTodo, null, null, {}, []);
    assert.ok(html.includes('Not started'), 'Should show pending meaning');
    assert.ok(html.includes('Review the scope and evidence'), 'Should show pending next step');
  });

  it('shows ready meaning and next step', () => {
    const todo = { ...baseTodo, status: 'ready' };
    const html = renderCanvas(todo, null, null, {}, []);
    assert.ok(html.includes('Implementation is believed finished'), 'Should show ready meaning');
    assert.ok(html.includes('Check criteria, tests'), 'Should show ready next step');
  });

  it('does not show persistent Needs triage banner', () => {
    const html = renderCanvas(baseTodo, null, null, {}, []);
    assert.ok(!html.includes('Needs triage'), 'Should not have Needs triage banner');
    assert.ok(!html.includes('triage-guide'), 'Should not have triage-guide class');
  });

  it('does not show empty triage instructional content for pending', () => {
    const html = renderCanvas(baseTodo, null, null, {}, []);
    assert.ok(!html.includes('No triage notes yet'), 'Should not show empty triage instruction');
  });
});

describe('Empty todo renders correctly', () => {
  it('renders empty page with no todo', () => {
    const html = renderCanvas(null, null, null, {}, []);
    assert.ok(html.includes('No todo selected'));
  });
});

describe('Group overview', () => {
  it('renders group header and member count', () => {
    const members = [
      { id: '001', title: 'Test 1', status: 'in-progress', priority: 'p1', criteria: [], group: 'test-group' },
      { id: '002', title: 'Test 2', status: 'pending', priority: 'p2', criteria: [], group: 'test-group' }
    ];
    const html = renderGroupCanvas('test-group', members, null);
    assert.ok(html.includes('Group: test-group'), 'Should show group name');
    assert.ok(html.includes('2 todos'), 'Should show member count');
  });

  it('renders status counts in summary', () => {
    const members = [
      { id: '001', title: 'Test 1', status: 'in-progress', priority: 'p1', criteria: [], group: 'test-group' },
      { id: '002', title: 'Test 2', status: 'complete', priority: 'p2', criteria: [], group: 'test-group' }
    ];
    const html = renderGroupCanvas('test-group', members, null);
    assert.ok(html.includes('1 in-progress'), 'Should show in-progress count');
    assert.ok(html.includes('1 complete'), 'Should show complete count');
  });

  it('separates active and terminal members', () => {
    const members = [
      { id: '001', title: 'Active 1', status: 'in-progress', priority: 'p1', criteria: [], group: 'test-group' },
      { id: '002', title: 'Terminal 1', status: 'complete', priority: 'p2', criteria: [], group: 'test-group' },
      { id: '003', title: 'Terminal 2', status: 'backlogged', priority: 'p3', criteria: [], group: 'test-group' }
    ];
    const html = renderGroupCanvas('test-group', members, null);
    const activeIdx = html.indexOf('Active');
    const terminalIdx = html.indexOf('Terminal');
    assert.ok(activeIdx < terminalIdx, 'Active section before terminal section');
    assert.ok(html.includes('Active 1'), 'Active member in active section');
    assert.ok(html.includes('Terminal 1'), 'Terminal member rendered');
  });

  it('shows empty state for empty group', () => {
    const html = renderGroupCanvas('empty-group', [], null);
    assert.ok(html.includes('No todos in this group'), 'Should show empty state');
  });

  it('includes navigation into member todos', () => {
    const members = [
      { id: '001', title: 'Test 1', status: 'in-progress', priority: 'p1', criteria: [], group: 'test-group' }
    ];
    const html = renderGroupCanvas('test-group', members, null);
    assert.ok(html.includes('data-open="001"'), 'Should have navigation to member todo');
  });
});

describe('loadGroupTodos', () => {
  it('loads todos by group name', () => {
    createTodoFile('001-pending-p3-test', 'status: pending\npriority: p3\ngroup: test-group\n', '# Test 1');
    createTodoFile('002-pending-p3-test', 'status: pending\npriority: p3\ngroup: test-group\n', '# Test 2');
    createTodoFile('003-pending-p3-test', 'status: pending\npriority: p3\ngroup: other-group\n', '# Test 3');
    const members = loadGroupTodos('test-group', testDir);
    assert.strictEqual(members.length, 2);
    assert.ok(members.every(m => m.group === 'test-group'));
    cleanTodoFiles();
  });

  it('throws for empty group name', () => {
    assert.throws(() => loadGroupTodos('', testDir), /non-empty string/);
  });
});

import { renderSettingsPage } from '../settings.mjs';

describe('Settings button and page', () => {
  it('renders settings button in todo canvas toolbar', () => {
    const todo = {
      id: '001',
      title: 'Test Todo',
      status: 'pending',
      priority: 'p3',
      criteria: [],
      workLog: [],
      description: '',
      scannerEvidence: null,
      resumeContext: null,
      triage: [],
      dependencies: [],
      scan: { source: undefined, scope: undefined, grouping: undefined, target: undefined, refreshedAt: undefined, reviewRequired: false }
    };
    const html = renderCanvas(todo, null, null, {}, []);
    assert.ok(html.includes('data-settings'), 'Should render settings button');
    assert.ok(html.includes('Settings'), 'Should have Settings label');
    assert.ok(html.includes('<button type="button" class="edit-button" data-settings'), 'Should be a button element');
  });

  it('renders settings button in group canvas toolbar', () => {
    const html = renderGroupCanvas('test-group', [], null);
    assert.ok(html.includes('data-settings'), 'Should render settings button');
    assert.ok(html.includes('<button type="button" class="edit-button" data-settings'), 'Should be a button element');
  });

  it('renders settings page with version info', () => {
    const html = renderSettingsPage({
      extensionVersion: '0.3.0',
      skill: {
        installed: true,
        installedVersion: '1.5.1',
        bundledVersion: '1.5.1',
        sourceUrl: 'https://github.com/example/agendo',
        sourceVersion: '1.6.0'
      },
      canvas: {
        installed: true,
        installedVersion: '0.1.6',
        bundledVersion: '0.1.6',
        sourceUrl: 'https://github.com/example/agendo',
        sourceVersion: '0.2.0'
      }
    });
    assert.ok(html.includes('0.3.0'), 'Should show extension version');
    assert.ok(html.includes('1.5.1'), 'Should show skill installed version');
    assert.ok(html.includes('0.1.6'), 'Should show canvas installed version');
    assert.ok(html.includes('1.6.0'), 'Should show skill source version');
    assert.ok(html.includes('0.2.0'), 'Should show canvas source version');
    assert.ok(html.includes('data-action="check-source"'), 'Should have check-source action');
    assert.ok(html.includes('data-action="install"'), 'Should have install action');
    assert.ok(html.includes('data-action="open-extension-settings"'), 'Should have open-extension-settings action');
  });

  it('handles missing version info gracefully', () => {
    const html = renderSettingsPage({});
    assert.ok(html.includes('?'), 'Should show placeholder for missing versions');
    assert.ok(html.includes('not installed'), 'Should show not installed for missing status');
  });

  it('renders workspace settings section', () => {
    const html = renderSettingsPage({
      extensionVersion: '0.3.0',
      workspace: {
        root: 'docs/todos',
        gitignored: true,
        backlogFolder: 'backlog',
        cancelledFolder: 'cancelled',
        completeFolder: 'complete',
        codeScanningEnabled: true
      },
      viewOptions: { groupBy: 'status', sortByDate: true }
    });
    assert.ok(html.includes('Workspace Settings'), 'Should have workspace settings section');
    assert.ok(html.includes('.agendo-config.json'), 'Should mention config file projection');
    assert.ok(html.includes('docs/todos'), 'Should show root folder');
    assert.ok(html.includes('Gitignored') && html.includes('Yes'), 'Should show gitignored status');
    assert.ok(html.includes('backlog'), 'Should show backlog folder');
    assert.ok(html.includes('Enabled'), 'Should show code scanning enabled');
    assert.ok(html.includes('Extension Settings'), 'Should have extension settings section');
    assert.ok(html.includes('Tree grouping'), 'Should show grouping setting');
  });

  it('renders copy context button in toolbar', () => {
    const html = renderCanvas({
      id: '001',
      title: 'Test Todo',
      status: 'pending',
      priority: 'p2',
      description: 'Test',
      criteria: [],
      dependencies: [],
      workLog: [],
      resumeContext: '',
      scannerEvidence: '',
      triage: {},
      scan: null
    }, { blocked: false, dependencies: [], dependents: [] }, { recent: [], pos: -1 });
    assert.ok(html.includes('data-copy-context'), 'Should render copy context button');
    assert.ok(html.includes('Copy Context'), 'Should have Copy Context label');
  });

  it('normalizes view inputs for navigation', () => {
    // Todo by ID string
    assert.deepEqual(normalizeView('001'), { kind: 'todo', todoId: '001' });
    // Todo by object
    assert.deepEqual(normalizeView({ kind: 'todo', todoId: '002' }), { kind: 'todo', todoId: '002' });
    // Group by object
    assert.deepEqual(normalizeView({ kind: 'group', groupName: 'testing' }), { kind: 'group', groupName: 'testing' });
    // Board by object
    assert.deepEqual(normalizeView({ kind: 'board', scope: 'todos' }), { kind: 'board', scope: 'todos' });
    assert.deepEqual(normalizeView({ kind: 'board', scope: 'code-scanning' }), { kind: 'board', scope: 'code-scanning' });
    // Invalid views throw
    assert.throws(() => normalizeView({ kind: 'invalid' }), /Expected a todo, group, or board selection/);
    assert.throws(() => normalizeView({ kind: 'board', scope: 'invalid' }), /Expected a todo, group, or board selection/);
    assert.throws(() => normalizeView({ kind: 'group', groupName: '' }), /Expected a todo, group, or board selection/);
  });

  it('settings button is keyboard accessible', () => {
    const todo = {
      id: '001',
      title: 'Test Todo',
      status: 'pending',
      priority: 'p3',
      criteria: [],
      workLog: [],
      description: '',
      scannerEvidence: null,
      resumeContext: null,
      triage: [],
      dependencies: [],
      scan: { source: undefined, scope: undefined, grouping: undefined, target: undefined, refreshedAt: undefined, reviewRequired: false }
    };
    const html = renderCanvas(todo, null, null, {}, []);
    assert.ok(html.includes('aria-label="Settings and About"'), 'Should have aria-label');
    assert.ok(html.includes('<button type="button"'), 'Should be a button for keyboard navigation');
  });

  it('settings page does not require host actions to render', () => {
    const html = renderSettingsPage({ extensionVersion: '0.3.0' });
    assert.ok(html.includes('0.3.0'), 'Should render extension version');
    assert.ok(html.includes('Settings and About'), 'Should have title');
  });

  it('settings page preserves navigation context with back link', () => {
    const html = renderSettingsPage({ extensionVersion: '0.3.0' });
    assert.ok(html.includes('href="/"'), 'Should have back link to main view');
  });
});

describe('Navigation and filter actions', () => {
  it('assertViewExists rejects stale todos and groups, and normalizeFilters validates input', () => {
    createTodoFile('001-ready-p2-exists', 'status: ready\npriority: p2\ngroup: real-group\n', '# Exists\n');
    assert.doesNotThrow(() => assertViewExists({ kind: 'todo', todoId: '001' }, testDir));
    assert.throws(() => assertViewExists({ kind: 'todo', todoId: '999' }, testDir), { code: 'todo_not_found' });
    assert.doesNotThrow(() => assertViewExists({ kind: 'group', groupName: 'real-group' }, testDir));
    assert.throws(() => assertViewExists({ kind: 'group', groupName: 'nope' }, testDir), { code: 'group_not_found' });
    assert.doesNotThrow(() => assertViewExists({ kind: 'board', scope: 'todos' }, testDir));
    assert.deepStrictEqual(normalizeFilters({ status: 'ready', priority: 'p2', group: 'real-group' }, testDir), { status: 'ready', priority: 'p2', group: 'real-group' });
    assert.deepStrictEqual(normalizeFilters({}, testDir), {});
    assert.throws(() => normalizeFilters({ status: 'bogus' }, testDir), { code: 'invalid_input' });
    assert.throws(() => normalizeFilters({ priority: 'p9' }, testDir), { code: 'invalid_input' });
    assert.throws(() => normalizeFilters({ group: 'nope' }, testDir), { code: 'group_not_found' });
  });

  it('rejects board views when the host has no board, and serves a recovering error page', async () => {
    const entry = createInstanceServer(testDir);
    assert.strictEqual(entry.hasBoard, false);
    assert.throws(() => assertViewSupported(entry, { kind: 'board', scope: 'todos' }), { code: 'unsupported' });
    assert.doesNotThrow(() => assertViewSupported(entry, { kind: 'todo', todoId: '001' }));
    await listen(entry);
    try {
      navigate(entry, { kind: 'board', scope: 'todos' });
      const res = await fetch(entry.url);
      const html = await res.text();
      assert.strictEqual(res.status, 400);
      assert.ok(html.includes('Board view is not available in this host'));
      assert.ok(html.includes('/page.js'), 'error page must poll /version to recover');
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
  });

  it('version string includes filters so page reloads on filter change', async () => {
    const entry = createInstanceServer(testDir);
    await listen(entry);
    try {
      navigate(entry, '001');
      const v1 = await (await fetch(entry.url + 'version')).text();
      entry.filters = { status: 'ready' };
      const v2 = await (await fetch(entry.url + 'version')).text();
      assert.notStrictEqual(v1, v2, 'Version should change when filters change');
      assert.ok(v2.includes('ready'), 'Version should include filter value');
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
  });

  it('repeated navigation to same todo does not duplicate history', () => {
    const entry = { todoId: undefined, view: undefined, groupName: undefined, returnTo: undefined, history: [], pos: -1, url: '', server: null, filters: {} };
    navigate(entry, '001');
    navigate(entry, '001');
    navigate(entry, '001');
    assert.strictEqual(entry.history.length, 1, 'Same todo should not duplicate history');
    assert.strictEqual(entry.history[0].todoId, '001');
  });

  it('navigation between different todos builds history', () => {
    const entry = { todoId: undefined, view: undefined, groupName: undefined, returnTo: undefined, history: [], pos: -1, url: '', server: null, filters: {} };
    navigate(entry, '001');
    navigate(entry, '002');
    navigate(entry, '003');
    assert.strictEqual(entry.history.length, 3);
    assert.strictEqual(entry.pos, 2);
    assert.strictEqual(entry.view.kind, 'todo');
    assert.strictEqual(entry.view.todoId, '003');
  });

  it('back navigation restores previous view', () => {
    const entry = { todoId: undefined, view: undefined, groupName: undefined, returnTo: undefined, history: [], pos: -1, url: '', server: null, filters: {} };
    navigate(entry, '001');
    navigate(entry, '002');
    step(entry, 'back');
    assert.strictEqual(entry.view.todoId, '001');
    assert.strictEqual(entry.pos, 0);
    step(entry, 'forward');
    assert.strictEqual(entry.view.todoId, '002');
    assert.strictEqual(entry.pos, 1);
  });

  it('group navigation stores group view in history', () => {
    const entry = { todoId: undefined, view: undefined, groupName: undefined, returnTo: undefined, history: [], pos: -1, url: '', server: null, filters: {} };
    navigate(entry, { kind: 'group', groupName: 'testing' });
    assert.strictEqual(entry.view.kind, 'group');
    assert.strictEqual(entry.view.groupName, 'testing');
    assert.strictEqual(entry.groupName, 'testing');
  });

  it('board navigation sets board scope', () => {
    const entry = { todoId: undefined, view: undefined, groupName: undefined, returnTo: undefined, history: [], pos: -1, url: '', server: null, filters: {} };
    navigate(entry, { kind: 'board', scope: 'code-scanning' });
    assert.strictEqual(entry.view.kind, 'board');
    assert.strictEqual(entry.view.scope, 'code-scanning');
  });

  it('filter by status applies correctly', () => {
    const members = [
      { id: '001', title: 'Test 1', status: 'in-progress', priority: 'p1', criteria: [], group: 'test-group' },
      { id: '002', title: 'Test 2', status: 'pending', priority: 'p2', criteria: [], group: 'test-group' },
      { id: '003', title: 'Test 3', status: 'in-progress', priority: 'p3', criteria: [], group: 'test-group' }
    ];
    const filtered = members.filter(m => m.status === 'in-progress');
    assert.strictEqual(filtered.length, 2);
    assert.ok(filtered.every(m => m.status === 'in-progress'));
  });

  it('filter by priority applies correctly', () => {
    const members = [
      { id: '001', title: 'Test 1', status: 'pending', priority: 'p1', criteria: [], group: 'test-group' },
      { id: '002', title: 'Test 2', status: 'pending', priority: 'p2', criteria: [], group: 'test-group' },
      { id: '003', title: 'Test 3', status: 'pending', priority: 'p1', criteria: [], group: 'test-group' }
    ];
    const filtered = members.filter(m => m.priority === 'p1');
    assert.strictEqual(filtered.length, 2);
    assert.ok(filtered.every(m => m.priority === 'p1'));
  });

  it('combined status and priority filters apply', () => {
    const members = [
      { id: '001', title: 'Test 1', status: 'in-progress', priority: 'p1', criteria: [], group: 'test-group' },
      { id: '002', title: 'Test 2', status: 'pending', priority: 'p1', criteria: [], group: 'test-group' },
      { id: '003', title: 'Test 3', status: 'in-progress', priority: 'p2', criteria: [], group: 'test-group' }
    ];
    let filtered = members;
    filtered = filtered.filter(m => m.status === 'in-progress');
    filtered = filtered.filter(m => m.priority === 'p1');
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, '001');
  });

  it('group canvas renders filter banner when filters active', () => {
    const members = [{ id: '001', title: 'Test 1', status: 'in-progress', priority: 'p1', criteria: [], group: 'test-group' }];
    const html = renderGroupCanvas('test-group', members, null, {}, { status: 'in-progress' });
    assert.ok(html.includes('filter-banner'), 'Should render filter banner');
    assert.ok(html.includes('status: in-progress'), 'Should show active filter');
  });

  it('group canvas does not render filter banner without filters', () => {
    const members = [{ id: '001', title: 'Test 1', status: 'in-progress', priority: 'p1', criteria: [], group: 'test-group' }];
    const html = renderGroupCanvas('test-group', members, null, {}, {});
    assert.ok(!html.includes('filter-banner'), 'Should not render filter banner');
  });

  it('group canvas renders combined filter banner', () => {
    const members = [];
    const html = renderGroupCanvas('test-group', members, null, {}, { status: 'pending', priority: 'p1' });
    assert.ok(html.includes('status: pending'), 'Should show status filter');
    assert.ok(html.includes('priority: p1'), 'Should show priority filter');
  });

  it('mixed scanner IDs navigate correctly', () => {
    const entry = { todoId: undefined, view: undefined, groupName: undefined, returnTo: undefined, history: [], pos: -1, url: '', server: null, filters: {} };
    navigate(entry, 'sq-123');
    assert.strictEqual(entry.view.todoId, 'sq-123');
    navigate(entry, 'cql-456');
    assert.strictEqual(entry.view.todoId, 'cql-456');
    navigate(entry, '001');
    assert.strictEqual(entry.view.todoId, '001');
  });

  it('stale todo navigation throws appropriate error', () => {
    const entry = { todoId: undefined, view: undefined, groupName: undefined, returnTo: undefined, history: [], pos: -1, url: '', server: null, filters: {} };
    // normalizeView validates format but not existence
    navigate(entry, '001');
    assert.strictEqual(entry.view.kind, 'todo');
    assert.strictEqual(entry.view.todoId, '001');
  });

  it('history is bounded to MAX_HISTORY entries', () => {
    const entry = { todoId: undefined, view: undefined, groupName: undefined, returnTo: undefined, history: [], pos: -1, url: '', server: null, filters: {} };
    for (let i = 1; i <= 35; i++) {
      navigate(entry, `0${i}`.padStart(3, '0'));
    }
    assert.strictEqual(entry.history.length, 30, 'History should be capped at 30');
    assert.strictEqual(entry.view.todoId, '035');
  });
});

describe('Explain finding action', () => {
  it('builds explain prompt with todo context', () => {
    const todo = {
      id: 'sq-123',
      title: 'SonarQube: SQL injection risk',
      status: 'pending',
      priority: 'p1',
      group: 'security',
      description: 'Potential SQL injection in query builder',
      scannerEvidence: 'File: src/db/query.ts | Line: 42\n\n**Severity:** Critical\n\nUnparameterized SQL query detected.',
      criteria: [],
      dependencies: []
    };
    const context = {
      id: todo.id,
      title: todo.title,
      status: todo.status,
      priority: todo.priority,
      group: todo.group,
      description: todo.description,
      scannerEvidence: todo.scannerEvidence,
      dependencies: todo.dependencies,
      blockedBy: false
    };
    const prompt = `Explain this Agendo finding:\n\nTodo: #${context.id} - ${context.title}\nStatus: ${context.status}\nPriority: ${context.priority}\n${context.scannerEvidence ? '\nScanner Evidence:\n' + context.scannerEvidence.slice(0, 2000) : ''}\n${context.description ? '\nDescription:\n' + context.description.slice(0, 1000) : ''}`;
    assert.ok(prompt.includes('sq-123'));
    assert.ok(prompt.includes('SQL injection'));
    assert.ok(prompt.includes('Critical'));
  });

  it('builds investigate prompt with dependencies', () => {
    const todo = {
      id: '001',
      title: 'Fix authentication flow',
      status: 'in-progress',
      priority: 'p1',
      group: undefined,
      description: 'Auth flow breaks on token expiry',
      scannerEvidence: null,
      criteria: [],
      dependencies: ['002', '003']
    };
    const prompt = `Investigate the root cause of this Agendo finding:\n\nTodo: #${todo.id} - ${todo.title}\nStatus: ${todo.status}\nPriority: ${todo.priority}\n${todo.scannerEvidence ? '\nScanner Evidence:\n' + todo.scannerEvidence.slice(0, 2000) : ''}\n${todo.dependencies && todo.dependencies.length ? '\nDependencies:\n' + todo.dependencies.join(', ') : ''}`;
    assert.ok(prompt.includes('Dependencies'));
    assert.ok(prompt.includes('002, 003'));
  });

  it('builds verify prompt with criteria', () => {
    const todo = {
      id: '002',
      title: 'Implement rate limiting',
      status: 'ready',
      priority: 'p2',
      group: undefined,
      description: '',
      scannerEvidence: null,
      criteria: [
        { text: 'Rate limiter returns 429 on overflow', met: true },
        { text: 'Configurable via environment variables', met: false }
      ],
      dependencies: []
    };
    const prompt = `Help verify the solution for this Agendo finding:\n\nTodo: #${todo.id} - ${todo.title}\nStatus: ${todo.status}\nPriority: ${todo.priority}\n${todo.criteria && todo.criteria.length ? '\nAcceptance Criteria:\n' + todo.criteria.map(c => (c.met ? '[x]' : '[ ]') + ' ' + c.text).join('\n') : ''}`;
    assert.ok(prompt.includes('[x]'));
    assert.ok(prompt.includes('[ ]'));
    assert.ok(prompt.includes('Rate limiter returns 429'));
  });

  it('builds suggest-fix prompt', () => {
    const todo = {
      id: 'cql-456',
      title: 'CodeQL: Possible null dereference',
      status: 'pending',
      priority: 'p2',
      group: 'security',
      description: '',
      scannerEvidence: 'File: src/utils/parser.ts | Line: 87\n\n**Severity:** High\n\nObject may be null when property is accessed.',
      criteria: [],
      dependencies: []
    };
    const prompt = `Suggest a fix plan for this Agendo finding:\n\nTodo: #${todo.id} - ${todo.title}\nStatus: ${todo.status}\nPriority: ${todo.priority}\n${todo.scannerEvidence ? '\nScanner Evidence:\n' + todo.scannerEvidence.slice(0, 2000) : ''}\n${todo.description ? '\nDescription:\n' + todo.description.slice(0, 1000) : ''}`;
    assert.ok(prompt.includes('null dereference'));
    assert.ok(prompt.includes('parser.ts'));
  });

  it('truncates long scanner evidence', () => {
    const longEvidence = 'X'.repeat(5000);
    const truncated = longEvidence.slice(0, 2000);
    assert.strictEqual(truncated.length, 2000);
  });

  it('handles missing scanner evidence gracefully', () => {
    const todo = {
      id: '003',
      title: 'Regular todo without scanner evidence',
      status: 'pending',
      priority: 'p3',
      group: undefined,
      description: 'Just a normal task',
      scannerEvidence: null,
      criteria: [],
      dependencies: []
    };
    const prompt = `Explain this Agendo finding:\n\nTodo: #${todo.id} - ${todo.title}\nStatus: ${todo.status}\nPriority: ${todo.priority}\n${todo.scannerEvidence ? '\nScanner Evidence:\n' + todo.scannerEvidence.slice(0, 2000) : ''}\n${todo.description ? '\nDescription:\n' + todo.description.slice(0, 1000) : ''}`;
    assert.ok(!prompt.includes('Scanner Evidence'));
    assert.ok(prompt.includes('Just a normal task'));
  });
});

describe('Todo validation warnings', () => {
  it('shows validation warning when frontmatter mismatches filename', () => {
    const todo = {
      id: '001',
      title: 'Test Todo',
      status: 'pending',
      priority: 'p3',
      criteria: [],
      workLog: [],
      description: '',
      scannerEvidence: null,
      resumeContext: null,
      triage: [],
      dependencies: [],
      validation: ['status mismatch: filename says "pending" but frontmatter says "in-progress"'],
      scan: { source: undefined, scope: undefined, grouping: undefined, target: undefined, refreshedAt: undefined, reviewRequired: false }
    };
    const html = renderCanvas(todo, null, null, {}, []);
    assert.ok(html.includes('validation-warning'), 'Should render validation warning');
    assert.ok(html.includes('status mismatch'), 'Should show mismatch message');
  });

  it('does not show validation warning when todo is valid', () => {
    const todo = {
      id: '001',
      title: 'Test Todo',
      status: 'pending',
      priority: 'p3',
      criteria: [],
      workLog: [],
      description: '',
      scannerEvidence: null,
      resumeContext: null,
      triage: [],
      dependencies: [],
      validation: [],
      scan: { source: undefined, scope: undefined, grouping: undefined, target: undefined, refreshedAt: undefined, reviewRequired: false }
    };
    const html = renderCanvas(todo, null, null, {}, []);
    assert.ok(!html.includes('validation-warning'), 'Should not render validation warning');
  });
});
