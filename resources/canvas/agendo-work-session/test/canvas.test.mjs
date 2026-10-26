import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadTodo, loadGroupTodos } from '../todos.mjs';
import { renderCanvas, renderGroupCanvas } from '../page.mjs';
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
