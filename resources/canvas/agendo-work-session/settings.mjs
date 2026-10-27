import { escapeHtml } from './markdown.mjs';

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

  const groupBy = info.viewOptions?.groupBy || 'status';
  const groupByOptions = ['status', 'priority', 'group', 'none'];
  const groupByLabels = { status: 'Status', priority: 'Priority', group: 'Group', none: 'None (flat)' };
  const groupByHtml = groupByOptions.map(mode => `<a href="#" data-action="set-group-by" data-scope="${mode}" class="settings-link${mode === groupBy ? ' active' : ''}">${groupByLabels[mode]}${mode === groupBy ? ' (current)' : ''}</a>`).join(' ');

  const ws = info.workspace || {};
  const workspaceSection = `
      <section class="settings-section">
        <h2>Workspace Settings</h2>
        <p class="settings-hint">Projected to <code>.agendo-config.json</code> for agent visibility</p>
        <dl>
          <dt>Root folder</dt><dd><code>${escapeHtml(ws.root || 'docs/todos')}</code></dd>
          <dt>Gitignored</dt><dd>${ws.gitignored ? 'Yes' : 'No'}</dd>
          <dt>Backlog folder</dt><dd><code>${escapeHtml(ws.backloggedFolder || 'backlog')}</code></dd>
          <dt>Cancelled folder</dt><dd><code>${escapeHtml(ws.cancelledFolder || 'cancelled')}</code></dd>
          <dt>Complete folder</dt><dd><code>${escapeHtml(ws.completedFolder || 'completed')}</code></dd>
          <dt>Code scanning</dt><dd>${ws.codeScanningEnabled ? 'Enabled' : 'Disabled'}</dd>
        </dl>
      </section>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Settings</title>
  <link rel="stylesheet" href="/page.css"></head>
  <body>
    <main>
      <div class="canvas-toolbar"><a href="/" class="edit-button" data-back title="Back" aria-label="Back">← Back</a></div>
      <h1>Settings and About</h1>

      ${workspaceSection}

      <section class="settings-section">
        <h2>Extension Settings</h2>
        <dl>
          <dt>Agendo version</dt><dd>${escapeHtml(extVersion)}</dd>
          <dt>Tree grouping</dt><dd>${groupBy}</dd>
          <dt>Sort by date</dt><dd>${info.viewOptions?.sortByDate ? 'Yes' : 'No'}</dd>
        </dl>
        <p>Tree grouping mode:</p>
        <div class="settings-actions">${groupByHtml}</div>
        <a href="#" data-action="open-extension-settings" class="settings-link">Open VS Code extension settings</a>
      </section>

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
