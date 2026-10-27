import { escapeHtml } from './markdown.mjs';

const VIEW_MODES = [
  ['default', 'VS Code default'], ['editor', 'Source editor'], ['preview', 'Markdown preview'],
  ['previewEditor', 'Markdown editor preview'], ['canvas', 'Work-session canvas'],
];
const STATUSES = [
  ['backlogged', 'Backlogged'], ['pending', 'Pending'], ['ready', 'Ready'],
  ['in-progress', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled'],
];

function selectSetting(label, action, value, options) {
  return `<label class="settings-control"><span>${escapeHtml(label)}</span>
    <select data-setting="${action}">${options.map(([key, title]) => `<option value="${escapeHtml(key)}"${key === value ? ' selected' : ''}>${escapeHtml(title)}</option>`).join('')}</select></label>`;
}

function checkboxSetting(label, action, value, attributes = '') {
  return `<label class="settings-checkbox"><input type="checkbox" data-setting="${action}"${value ? ' checked' : ''}${attributes}> <span>${escapeHtml(label)}</span></label>`;
}

function textSetting(label, action, value, hint = '') {
  return `<form class="settings-input-form" data-setting="${action}">
    <label for="${action}">${escapeHtml(label)}</label>
    <div class="settings-input-row"><input id="${action}" name="value" type="text" value="${escapeHtml(value ?? '')}"${hint ? ` aria-describedby="${action}-hint"` : ''}><button type="submit" aria-label="Save ${escapeHtml(label)}">Save</button></div>
    ${hint ? `<p class="settings-hint" id="${action}-hint">${escapeHtml(hint)}</p>` : ''}
  </form>`;
}

function boardSettings(boards) {
  if (!Array.isArray(boards) || !boards.length) return '';
  return `<section class="settings-section" aria-labelledby="board-columns-heading">
    <h2 id="board-columns-heading">Board Column Visibility</h2>
    <p class="settings-hint">Checked columns are visible. These preferences are saved separately for each board in this workspace. Other filters and “hide empty columns” still apply.</p>
    <div class="settings-board-columns">${boards.filter(board => ['todos', 'code-scanning'].includes(board.scope)).map(board => {
      const hidden = new Set(board.hiddenStatuses ?? []);
      return `<fieldset><legend>${board.scope === 'todos' ? 'Todos board' : 'Code-scanning board'}</legend>
        ${STATUSES.map(([status, label]) => checkboxSetting(label, 'set-board-status-visibility', !hidden.has(status), ` data-scope="${board.scope}" data-status="${status}"`)).join('')}
      </fieldset>`;
    }).join('')}</div>
  </section>`;
}

export function renderSettingsPage(info) {
  const extVersion = info.extensionVersion || '?';
  const skillInstalled = info.skill?.installed ? `v${info.skill.installedVersion || '?'}` : 'not installed';
  const skillBundled = info.skill?.bundledVersion ? `v${info.skill.bundledVersion}` : '?';
  const skillSource = info.skill?.sourceVersion ? `v${info.skill.sourceVersion}` : 'not checked';
  const skillSourceUrl = info.skill?.sourceUrl || 'not configured';
  const skillSourceError = info.skill?.sourceError || '';

  const canvasInstalled = info.canvas?.installed ? `v${info.canvas.installedVersion || '?'}` : 'not installed';
  const canvasBundled = info.canvas?.bundledVersion ? `v${info.canvas.bundledVersion}` : '?';
  const canvasSource = info.canvas?.sourceVersion ? `v${info.canvas.sourceVersion}` : 'not checked';
  const canvasSourceUrl = info.canvas?.sourceUrl || 'not configured';
  const canvasSourceError = info.canvas?.sourceError || '';

  const preferences = info.viewOptions ?? {};
  const defaults = info.defaults ?? {};
  const ws = info.workspace || {};
  const workspaceSection = `
      <section class="settings-section" id="workspace-settings">
        <h2>Workspace Settings</h2>
        <p class="settings-hint">Project configuration is projected to <code>.agendo-config.json</code> for agent visibility. Changing folder paths selects a location; it does not move existing todo files.</p>
        ${textSetting('Root folder', 'set-root', ws.root ?? 'docs/todos', 'Path relative to the workspace, for example docs/todos')}
        ${checkboxSetting('Gitignore todo files', 'set-gitignored', ws.gitignored ?? true)}
        ${textSetting('Backlogged folder', 'set-backlogged-folder', ws.backloggedFolder ?? 'backlogged', 'Single subfolder name under the todos root')}
        ${textSetting('Cancelled folder', 'set-cancelled-folder', ws.cancelledFolder ?? 'cancelled', 'Single subfolder name under the todos root')}
        ${textSetting('Completed folder', 'set-completed-folder', ws.completedFolder ?? 'completed', 'Single subfolder name under the todos root')}
        ${checkboxSetting('Enable code-scanning imports', 'set-code-scanning-enabled', ws.codeScanningEnabled)}
        <h3>Code-scanning connection</h3>
        <p class="settings-hint">Stored in VS Code workspace settings, not the agent config projection. Tokens remain in VS Code SecretStorage and are never shown here.</p>
        ${textSetting('SonarQube URL', 'set-sonarqube-url', ws.sonarQubeUrl, 'HTTPS server URL; leave empty when not configured')}
        ${textSetting('SonarQube project key', 'set-sonarqube-project-key', ws.sonarQubeProjectKey)}
      </section>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Settings</title>
  <link rel="stylesheet" href="/page.css"></head>
  <body>
    <main>
      <div class="canvas-toolbar"><a href="/" class="edit-button" data-back title="Back" aria-label="Back">← Back</a></div>
      <h1>Settings and About</h1>
      <nav class="settings-jump-links" aria-label="Settings sections">
        <a href="#workspace-settings">Workspace</a>
        <a href="#extension-preferences">Extension preferences</a>
        <a href="#user-defaults">User defaults</a>
        ${Array.isArray(info.boards) && info.boards.length ? '<a href="#board-columns-heading">Board columns</a>' : ''}
      </nav>

      ${workspaceSection}

      <section class="settings-section" id="extension-preferences">
        <h2>Extension Settings</h2>
        <p class="settings-hint">Personal display and workflow preferences, separate from the agent-visible project configuration. Values below apply to this workspace.</p>
        <dl>
          <dt>Agendo version</dt><dd>${escapeHtml(extVersion)}</dd>
        </dl>
        ${selectSetting('Open todos using', 'set-view-mode', preferences.viewMode ?? 'default', VIEW_MODES)}
        ${selectSetting('Tree grouping', 'set-group-by', preferences.groupBy ?? 'status', [['status', 'Status'], ['priority', 'Priority'], ['group', 'Group'], ['none', 'None (flat)']])}
        ${checkboxSetting('Sort Todos by last modified date', 'set-sort-by-date', preferences.sortByDate)}
        ${checkboxSetting('Sort Code Scanning by last modified date', 'set-code-scanning-sort-by-date', preferences.codeScanningSortByDate)}
        ${checkboxSetting('Show dependency nodes in the tree', 'set-show-dependency-nodes', preferences.showDependencyNodes)}
        ${checkboxSetting('Enable criteria-change settings', 'set-criteria-changes-enabled', preferences.criteriaChangesEnabled)}
        ${checkboxSetting('Notify about bundled skill and canvas updates', 'set-skill-update-check', preferences.skillUpdateCheck ?? true)}
        ${textSetting('Skill update source', 'set-skill-update-source', preferences.skillUpdateSource ?? info.skill?.sourceUrl ?? '', 'HTTPS base URL; changing it does not check or install updates')}
        ${textSetting('Canvas update source', 'set-canvas-update-source', preferences.canvasUpdateSource ?? info.canvas?.sourceUrl ?? '', 'HTTPS base URL; changing it does not check or install updates')}
        <a href="#" data-action="open-extension-settings" class="settings-link">Open VS Code extension settings</a>
      </section>

      <section class="settings-section" id="user-defaults">
        <h2>User Defaults</h2>
        <p class="settings-hint">Saved to your global VS Code user settings. Existing workspace overrides take precedence, so changing a default may not change the current workspace.</p>
        ${textSetting('Default root folder', 'set-default-root', defaults.root ?? 'docs/todos')}
        ${selectSetting('Default priority', 'set-default-priority', defaults.priority ?? 'p3', [['p1', 'P1 — Critical'], ['p2', 'P2 — Important'], ['p3', 'P3 — Nice-to-have']])}
        ${selectSetting('Default todo view', 'set-default-preview', defaults.viewMode ?? 'default', VIEW_MODES)}
      </section>

      ${boardSettings(info.boards)}

      <section class="settings-section">
        <h2>Workspaces</h2>
        <ul>
          <li><a href="#" data-action="open-board" data-scope="todos">Open Todos board</a></li>
          <li><a href="#" data-action="open-board" data-scope="code-scanning">Open Code-scanning board</a></li>
          <li><a href="#" data-action="open-tree">Open Todos tree view</a></li>
        </ul>
      </section>

      <section class="settings-section">
        <h2>Skill</h2>
        <dl>
          <dt>Installed</dt><dd>${escapeHtml(skillInstalled)}</dd>
          <dt>Bundled (in extension)</dt><dd>${escapeHtml(skillBundled)}</dd>
          <dt>Configured source</dt><dd>${escapeHtml(skillSourceUrl)}</dd>
          <dt>Source version</dt><dd>${escapeHtml(skillSource)}${skillSourceError ? ` — ${escapeHtml(skillSourceError)}` : ''}</dd>
        </dl>
        <div class="settings-actions">
          <a href="#" data-action="check-source" data-component="skill">Check source</a>
          <a href="#" data-action="install" data-component="skill">Install from source</a>
        </div>
      </section>

      <section class="settings-section">
        <h2>Canvas</h2>
        <dl>
          <dt>Installed</dt><dd>${escapeHtml(canvasInstalled)}</dd>
          <dt>Bundled (in extension)</dt><dd>${escapeHtml(canvasBundled)}</dd>
          <dt>Configured source</dt><dd>${escapeHtml(canvasSourceUrl)}</dd>
          <dt>Source version</dt><dd>${escapeHtml(canvasSource)}${canvasSourceError ? ` — ${escapeHtml(canvasSourceError)}` : ''}</dd>
        </dl>
        <div class="settings-actions">
          <a href="#" data-action="check-source" data-component="canvas">Check source</a>
          <a href="#" data-action="install" data-component="canvas">Install from source</a>
        </div>
      </section>

      <p class="error" id="status-message" role="status" aria-live="polite"></p>
    </main>
    <script src="/settings.js"></script>
  </body></html>`;
}
