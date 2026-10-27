import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderSettingsPage } from '../settings.mjs';
import { createInstanceServer, listen } from '../server.mjs';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const VIEW_MODES = [
  ['default', 'VS Code default'], ['editor', 'Source editor'], ['preview', 'Markdown preview'],
  ['previewEditor', 'Markdown editor preview'], ['canvas', 'Work-session canvas'],
];

describe('renderSettingsPage', () => {
  it('renders workspace settings with current values including false/empty', () => {
    const html = renderSettingsPage({
      extensionVersion: '0.3.0',
      workspace: {
        root: 'docs/todos',
        gitignored: true,
        backloggedFolder: 'backlog',
        cancelledFolder: 'cancelled',
        completedFolder: 'completed',
        codeScanningEnabled: true,
        sonarQubeUrl: 'https://sonar.example.com',
        sonarQubeProjectKey: 'proj:key',
      },
      viewOptions: { viewMode: 'default', groupBy: 'status', sortByDate: true },
      defaults: { root: 'docs/todos', priority: 'p3', viewMode: 'default' },
      boards: [],
    });
    assert.ok(html.includes('Workspace Settings'));
    assert.ok(html.includes('docs/todos'));
    assert.ok(html.includes('Gitignore todo files'));
    assert.ok(html.includes('backlog'));
    assert.ok(html.includes('cancelled'));
    assert.ok(html.includes('completed'));
    const sonarQubeUrlInput = html.match(/<input id="set-sonarqube-url"[^>]*>/)?.[0];
    assert.ok(sonarQubeUrlInput, 'SonarQube URL input should be rendered');
    assert.strictEqual(sonarQubeUrlInput.match(/\bvalue="([^"]*)"/)?.[1], 'https://sonar.example.com');
    assert.ok(html.includes('proj:key'));
    assert.ok(html.includes('Extension Settings'));
    assert.ok(html.includes('Tree grouping'));
  });

  it('shows not-checked placeholders for missing skill/canvas source', () => {
    const html = renderSettingsPage({ extensionVersion: '0.3.0' });
    assert.ok(html.includes('not configured'));
    assert.ok(html.includes('not checked'));
  });

  it('renders extension version and skill/canvas info', () => {
    const html = renderSettingsPage({
      extensionVersion: '0.3.0',
      skill: {
        installed: true,
        installedVersion: '1.5.1',
        bundledVersion: '1.5.1',
        sourceUrl: 'https://github.com/example/agendo',
        sourceVersion: '1.6.0',
      },
      canvas: {
        installed: true,
        installedVersion: '0.1.6',
        bundledVersion: '0.1.6',
        sourceUrl: 'https://github.com/example/agendo',
        sourceVersion: '0.2.0',
      },
    });
    assert.ok(html.includes('0.3.0'));
    assert.ok(html.includes('1.5.1'));
    assert.ok(html.includes('0.1.6'));
    assert.ok(html.includes('1.6.0'));
    assert.ok(html.includes('0.2.0'));
    assert.ok(html.includes('data-action="check-source"'));
    assert.ok(html.includes('data-action="install"'));
    assert.ok(html.includes('data-action="open-extension-settings"'));
  });

  it('escapes workspace/user-provided strings to prevent HTML injection', () => {
    const html = renderSettingsPage({
      extensionVersion: '0.3.0',
      workspace: {
        root: '<script>alert("xss")</script>',
        sonarQubeUrl: 'https://example.com',
        sonarQubeProjectKey: 'key" onclick="alert(1)"',
      },
      viewOptions: {},
      defaults: { root: 'docs/todos', priority: 'p3', viewMode: 'default' },
      boards: [],
    });
    assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
    assert.ok(html.includes('key&quot; onclick=&quot;alert(1)&quot;'));
    // No raw unescaped executable tag or attribute may appear.
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('onclick="alert(1)"'));
    // The injected value is escaped so it cannot break out of the attribute or execute.
    assert.ok(html.includes('onclick=&quot;alert(1)&quot;'));
  });

  it('separates workspace settings from user defaults', () => {
    const html = renderSettingsPage({
      extensionVersion: '0.3.0',
      workspace: { root: 'docs/todos', gitignored: true },
      viewOptions: {},
      defaults: { root: 'global/todos', priority: 'p1', viewMode: 'preview' },
      boards: [],
    });
    assert.ok(html.includes('Workspace Settings'));
    assert.ok(html.includes('User Defaults'));
    assert.ok(html.includes('Default root folder'));
    assert.ok(html.includes('Default priority'));
    assert.ok(html.includes('Default todo view'));
    assert.ok(html.includes('global/todos'));
    assert.ok(html.includes('P1 — Critical'));
    assert.ok(html.includes('Markdown preview'));
  });

  it('renders view modes and grouping selectors with current values', () => {
    const html = renderSettingsPage({
      extensionVersion: '0.3.0',
      viewOptions: { viewMode: 'canvas', groupBy: 'priority' },
      defaults: { root: 'docs/todos', priority: 'p3', viewMode: 'default' },
      boards: [],
    });
    for (const [key, title] of VIEW_MODES) {
      assert.ok(html.includes(`value="${key}"`), `Should have view mode option ${key}`);
      assert.ok(html.includes(title), `Should show view mode label ${title}`);
    }
    assert.ok(html.includes('Tree grouping'));
    assert.ok(html.includes('Priority'));
    assert.ok(html.includes('set-view-mode'));
    assert.ok(html.includes('set-group-by'));
    assert.match(html, /data-setting="set-view-mode"[^>]*>[\s\S]*?<option value="canvas" selected>/);
    assert.match(html, /data-setting="set-group-by"[^>]*>[\s\S]*?<option value="priority" selected>/);
  });

  it('renders all checkbox settings with current boolean values', () => {
    const html = renderSettingsPage({
      extensionVersion: '0.3.0',
      viewOptions: {
        sortByDate: true,
        codeScanningSortByDate: false,
        showDependencyNodes: true,
        criteriaChangesEnabled: false,
        skillUpdateCheck: true,
      },
      defaults: { root: 'docs/todos', priority: 'p3', viewMode: 'default' },
      boards: [],
    });
    assert.ok(html.includes('set-sort-by-date'));
    assert.ok(html.includes('set-code-scanning-sort-by-date'));
    assert.ok(html.includes('set-show-dependency-nodes'));
    assert.ok(html.includes('set-criteria-changes-enabled'));
    assert.ok(html.includes('set-skill-update-check'));
    assert.ok(html.includes('set-skill-update-source'));
    assert.ok(html.includes('set-canvas-update-source'));
    assert.ok(html.includes('checked'));
    assert.match(html, /data-setting="set-sort-by-date" checked/);
    assert.match(html, /data-setting="set-code-scanning-sort-by-date">/);
    assert.match(html, /data-setting="set-criteria-changes-enabled">/);
  });

  it('renders board column visibility per scope with isolation labels/checked statuses', () => {
    const html = renderSettingsPage({
      extensionVersion: '0.3.0',
      viewOptions: {},
      defaults: { root: 'docs/todos', priority: 'p3', viewMode: 'default' },
      boards: [
        { scope: 'todos', hiddenStatuses: ['completed', 'cancelled'] },
        { scope: 'code-scanning', hiddenStatuses: ['backlogged'] },
      ],
    });
    assert.ok(html.includes('Board Column Visibility'));
    assert.ok(html.includes('Todos board'));
    assert.ok(html.includes('Code-scanning board'));
    assert.ok(html.includes('Backlog'));
    assert.ok(html.includes('Pending'));
    assert.ok(html.includes('Ready'));
    assert.ok(html.includes('In progress'));
    assert.ok(html.includes('Completed'));
    assert.ok(html.includes('Cancelled'));
    assert.ok(html.includes('data-scope="todos"'));
    assert.ok(html.includes('data-scope="code-scanning"'));
    assert.ok(html.includes('data-status="completed"'));
    assert.ok(html.includes('data-status="backlogged"'));
    const column = (scope, status) => html.match(new RegExp(`<input[^>]*data-scope="${scope}"[^>]*data-status="${status}"[^>]*>`))?.[0];
    assert.ok(!column('todos', 'completed').includes(' checked'));
    assert.ok(column('code-scanning', 'completed').includes(' checked'));
    assert.ok(column('todos', 'backlogged').includes(' checked'));
    assert.ok(!column('code-scanning', 'backlogged').includes(' checked'));
  });

  it('omits board section when boards are absent or empty', () => {
    const empty = renderSettingsPage({
      extensionVersion: '0.3.0',
      viewOptions: {},
      defaults: { root: 'docs/todos', priority: 'p3', viewMode: 'default' },
    });
    assert.ok(!empty.includes('Board Column Visibility'));
    assert.ok(!empty.includes('settings-board-columns'));
    const absent = renderSettingsPage({ extensionVersion: '0.3.0' });
    assert.ok(!absent.includes('Board Column Visibility'));
    assert.ok(!absent.includes('settings-board-columns'));
  });

  it('renders preserved skill and canvas update action sections', () => {
    const html = renderSettingsPage({
      extensionVersion: '0.3.0',
      skill: { installed: true, installedVersion: '1.5.1', bundledVersion: '1.5.1', sourceUrl: 'https://github.com/example/agendo', sourceVersion: '1.6.0' },
      canvas: { installed: true, installedVersion: '0.1.6', bundledVersion: '0.1.6', sourceUrl: 'https://github.com/example/agendo', sourceVersion: '0.2.0' },
      viewOptions: {},
      defaults: { root: 'docs/todos', priority: 'p3', viewMode: 'default' },
      boards: [],
    });
    assert.ok(html.includes('Skill'));
    assert.ok(html.includes('Canvas'));
    assert.ok(html.includes('data-component="skill"'));
    assert.ok(html.includes('data-component="canvas"'));
    assert.ok(html.includes('Check source'));
    assert.ok(html.includes('Install from source'));
  });

  it('renders existing navigation links', () => {
    const html = renderSettingsPage({ extensionVersion: '0.3.0' });
    assert.ok(html.includes('href="/"'));
    assert.ok(html.includes('Open Todos board'));
    assert.ok(html.includes('Open Code-scanning board'));
    assert.ok(html.includes('Open Todos tree view'));
    assert.ok(html.includes('Open VS Code extension settings'));
  });

  it('does not disclose tokens and omits hidden/show toolbar buttons', () => {
    const html = renderSettingsPage({
      extensionVersion: '0.3.0',
      workspace: { sonarQubeUrl: 'https://sonar.example.com' },
      viewOptions: {},
      defaults: { root: 'docs/todos', priority: 'p3', viewMode: 'default' },
      boards: [],
    });
    assert.ok(html.includes('Tokens remain in VS Code SecretStorage and are never shown here'));
    assert.ok(!html.includes('data-setting="set-hidden"'));
    assert.ok(!html.includes('data-setting="set-show"'));
    assert.ok(!html.includes('hidden-toggle'));
    assert.ok(!html.includes('show-toggle'));
  });
});

describe('settings HTTP server', () => {
  async function setup(actions) {
    const entry = createInstanceServer(undefined, actions);
    await listen(entry);
    return entry;
  }

  it('serves settings page from GET /settings with CSP', async () => {
    const entry = await setup({
      getSettingsInfo: async () => ({
        extensionVersion: '0.3.0',
        workspace: { root: 'docs/todos', gitignored: true },
        viewOptions: { viewMode: 'default' },
        defaults: { root: 'docs/todos', priority: 'p3', viewMode: 'default' },
        boards: [],
      }),
    });
    try {
      const res = await fetch(entry.url + 'settings');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.get('content-security-policy'));
      const html = await res.text();
      assert.ok(html.includes('0.3.0'));
      assert.ok(html.includes('Workspace Settings'));
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
  });

  it('reports unsupported when handleSettingsAction is absent', async () => {
    const entry = await setup({});
    try {
      const res = await fetch(new URL('/settings/action', entry.url), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
        body: JSON.stringify({ action: 'set-root', value: 'docs/todos' }),
      });
      assert.strictEqual(res.status, 400);
      assert.ok(await res.text());
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
  });

  it('requires the canvas protection header for settings actions', async () => {
    const entry = await setup({
      getSettingsInfo: async () => ({ extensionVersion: '0.3.0' }),
      handleSettingsAction: async () => ({ success: true }),
    });
    try {
      const res = await fetch(new URL('/settings/action', entry.url), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-root', value: 'docs/todos' }),
      });
      assert.strictEqual(res.status, 403);
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
  });

  it('routes settings actions through handleSettingsAction and reloads by default', async () => {
    let received;
    const entry = await setup({
      getSettingsInfo: async () => ({ extensionVersion: '0.3.0' }),
      handleSettingsAction: async payload => { received = payload; return { success: true, reload: true }; },
    });
    try {
      const res = await fetch(new URL('/settings/action', entry.url), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
        body: JSON.stringify({ action: 'set-root', value: 'docs/todos' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.deepStrictEqual(received, { action: 'set-root', value: 'docs/todos' });
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
  });

  it('handles checkbox payloads with scope and status', async () => {
    let received;
    const entry = await setup({
      getSettingsInfo: async () => ({ extensionVersion: '0.3.0' }),
      handleSettingsAction: async payload => { received = payload; return { success: true }; },
    });
    try {
      const res = await fetch(new URL('/settings/action', entry.url), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
        body: JSON.stringify({ action: 'set-board-status-visibility', value: true, scope: 'todos', status: 'completed' }),
      });
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(received, { action: 'set-board-status-visibility', value: true, scope: 'todos', status: 'completed' });
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
  });

  it('suppresses reload when reload is false', async () => {
    const entry = await setup({
      getSettingsInfo: async () => ({ extensionVersion: '0.3.0' }),
      handleSettingsAction: async () => ({ success: true, reload: false }),
    });
    try {
      const res = await fetch(new URL('/settings/action', entry.url), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
        body: JSON.stringify({ action: 'set-root', value: 'docs/todos' }),
      });
      const data = await res.json();
      assert.strictEqual(data.reload, false);
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
  });

  it('returns error page on action failure without token disclosure', async () => {
    const entry = await setup({
      getSettingsInfo: async () => ({ extensionVersion: '0.3.0' }),
      handleSettingsAction: async () => { throw new Error('boom'); },
    });
    try {
      const res = await fetch(new URL('/settings/action', entry.url), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
        body: JSON.stringify({ action: 'set-root', value: 'docs/todos' }),
      });
      assert.strictEqual(res.status, 500);
      const text = await res.text();
      assert.ok(text.includes('boom'));
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
  });

  it('rejects non-object and invalid payloads', async () => {
    const entry = await setup({
      getSettingsInfo: async () => ({ extensionVersion: '0.3.0' }),
      handleSettingsAction: async () => ({ success: true }),
    });
    try {
      const bad = async body => fetch(new URL('/settings/action', entry.url), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' }, body,
      });
      assert.strictEqual((await bad('not json')).status, 400);
      // Non-object JSON values (null, numbers) are rejected.
      assert.strictEqual((await bad(JSON.stringify(null))).status, 400);
      assert.strictEqual((await bad(JSON.stringify(42))).status, 400);
      assert.strictEqual((await bad(JSON.stringify([1, 2]))).status, 400);
      // Setting/action allowlists belong to the native handler, not the HTTP transport.
      assert.strictEqual((await bad(JSON.stringify({}))).status, 200);
    } finally {
      await new Promise(resolve => entry.server.close(resolve));
    }
  });
});

describe('settings client JS behavior', () => {
  function control(dataset, fields = {}) {
    return {
      dataset, disabled: false, listeners: {},
      matches: () => false,
      addEventListener(event, listener) { this.listeners[event] = listener; },
      ...fields,
    };
  }
  function client(fetchResponse = async () => ({ok: true, json: async () => ({success: true})})) {
    const select = control({setting: 'set-view-mode'}, {type: 'select-one', value: 'canvas'});
    const checkbox = control({setting: 'set-board-status-visibility', scope: 'code-scanning', status: 'completed'}, {type: 'checkbox', checked: false});
    const input = {value: 'planning/todos', disabled: false};
    const button = {disabled: false};
    const form = control({setting: 'set-root'}, {matches: () => true, elements: {value: input}, querySelectorAll: () => [input, button]});
    const message = {textContent: ''};
    const requests = [];
    let reloads = 0;
    new Script(readFileSync(new URL('../assets/settings.js', import.meta.url), 'utf8')).runInNewContext({
      document: {
        getElementById: () => message,
        querySelectorAll: selector => selector === '[data-action]' ? [] : selector === 'form[data-setting]' ? [form] : [select, checkbox],
      },
      fetch: async (path, options) => {
        assert.strictEqual(path, '/settings/action');
        assert.strictEqual(options.headers['X-Agendo-Canvas'], '1');
        requests.push(JSON.parse(options.body));
        return fetchResponse();
      },
      location: {reload: () => { reloads++; }},
    });
    return {select, checkbox, form, input, button, message, requests, reloads: () => reloads};
  }

  it('executes actual client handlers for typed select, visibility checkbox, and Save form payloads', async () => {
    const state = client();
    await state.select.listeners.change();
    await state.checkbox.listeners.change();
    let prevented = false;
    state.form.listeners.submit({preventDefault: () => { prevented = true; }});
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(prevented);
    assert.deepStrictEqual(state.requests, [
      {action: 'set-view-mode', value: 'canvas'},
      {action: 'set-board-status-visibility', value: false, scope: 'code-scanning', status: 'completed'},
      {action: 'set-root', value: 'planning/todos'},
    ]);
    assert.strictEqual(state.reloads(), 3);
    assert.strictEqual(state.input.disabled, false);
    assert.strictEqual(state.button.disabled, false);
  });

  it('prevents duplicate submissions while saving and honors reload:false', async () => {
    let release;
    const response = new Promise(resolve => { release = resolve; });
    const state = client(() => response);
    const saving = state.checkbox.listeners.change();
    assert.strictEqual(state.checkbox.disabled, true);
    await state.checkbox.listeners.change();
    assert.strictEqual(state.requests.length, 1);
    release({ok: true, json: async () => ({success: true, reload: false})});
    await saving;
    assert.strictEqual(state.reloads(), 0);
    assert.strictEqual(state.checkbox.disabled, false);
    assert.strictEqual(state.message.textContent, 'Saved.');
  });

  it('reports server failures safely and re-enables the failed control', async () => {
    const state = client(async () => ({ok: false, text: async () => 'Invalid setting <value>'}));
    await state.select.listeners.change();
    assert.strictEqual(state.reloads(), 0);
    assert.strictEqual(state.select.disabled, false);
    assert.strictEqual(state.message.textContent, 'Could not save setting: Invalid setting <value>');
    assert.strictEqual(state.select.dataset.saving, undefined);
  });
});
