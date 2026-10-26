import { readFileSync } from 'node:fs';
import { renderNavigation } from './page.mjs';

export function renderDigestCanvas(scope, nav, nonce, csp) {
  if (!['todos', 'code-scanning'].includes(scope)) throw new Error('Invalid digest scope');
  const bootstrap = String.raw`
    (() => {
      const scope = ${JSON.stringify(scope)};
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      document.body.prepend(status);
      const refresh = async () => {
        try {
          const response = await fetch('/digest-snapshot');
          if (!response.ok) throw new Error(await response.text());
          const digest = await response.json();
          const container = document.getElementById('digest-content');
          if (container) {
            container.innerHTML = '';
            const pre = document.createElement('pre');
            pre.className = 'digest-markdown';
            pre.textContent = digest.content;
            container.appendChild(pre);
          }
        } catch (error) {
          status.textContent = 'Could not load digest: ' + error.message;
        }
      };
      setInterval(refresh, 5000);
      refresh();
      const open = async (path, payload) => {
        try {
          const response = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error(await response.text());
          location.reload();
        } catch (error) {
          status.textContent = 'Could not navigate: ' + error.message;
        }
      };
      for (const button of document.querySelectorAll('[data-nav]')) {
        button.addEventListener('click', () => open('/nav', { direction: button.dataset.nav }));
      }
      for (const button of document.querySelectorAll('[data-open]')) {
        button.addEventListener('click', () => open('/open', { todoId: button.dataset.open }));
      }
      for (const button of document.querySelectorAll('[data-open-board]')) {
        button.addEventListener('click', () => open('/open', { view: { kind: 'board', scope: button.dataset.openBoard } }));
      }
    })();
  `;
  const navigation = `<div class="workspace-navigation">${renderNavigation(nav)}</div>`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agendo Task Digest</title>
  <link rel="stylesheet" href="/page.css">
  <style>
    .digest-markdown {
      white-space: pre-wrap;
      font-family: inherit;
      font-size: 0.95rem;
      line-height: 1.6;
      margin: 0;
      padding: 1rem;
      background: var(--bg-secondary, #f5f5f5);
      border-radius: 6px;
      border: 1px solid var(--border, #ddd);
    }
  </style>
</head>
<body>
  ${navigation}
  <main class="digest-view">
    <h1>Task Digest</h1>
    <div id="digest-content"></div>
  </main>
  <script nonce="${nonce}">${bootstrap}</script>
</body>
</html>`;
  return html;
}