import { readFileSync } from 'node:fs';
import { renderNavigation } from './page.mjs';

// Only transport and navigation are host-specific. The board document is also used by VS Code.
export function renderBoardCanvas(scope, nav, nonce, csp) {
  if (!['todos', 'code-scanning'].includes(scope)) throw new Error('Invalid board scope');
  const bootstrap = String.raw`
    (() => {
      const scope = ${JSON.stringify(scope)};
      const listeners = new Set();
      let queue = Promise.resolve();
      let pending = 0;
      let revision = 0;
      let lastSnapshot;
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      document.body.prepend(status);
      const emit = message => { for (const listener of listeners) listener(message); };
      const post = async (path, payload) => {
        const response = await fetch(path, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      };
      const refresh = async (force = false) => {
        const requested = revision;
        const response = await fetch('/board-snapshot');
        if (response.status === 400) { location.reload(); return; }
        if (!response.ok) throw new Error(await response.text());
        const snapshot = await response.json();
        if (requested !== revision) return;
        const serialized = JSON.stringify(snapshot);
        if (force || serialized !== lastSnapshot) emit({ type: 'snapshot', snapshot });
        lastSnapshot = serialized;
      };
      globalThis.agendoBoardHost = {
        getState: () => { try { return JSON.parse(sessionStorage.getItem('agendo-board-' + scope) || '{}'); } catch { return {}; } },
        setState: state => { try { sessionStorage.setItem('agendo-board-' + scope, JSON.stringify(state)); } catch { /* Storage is optional. */ } },
        onMessage: listener => listeners.add(listener),
        postMessage: message => {
          if (message.type === 'settings') {
            location.href = '/settings';
            return;
          }
          pending++;
          revision++;
          queue = queue.then(async () => {
            status.textContent = '';
            if (message.type !== 'ready') {
              if (['setStatus', 'setPriority', 'delete'].includes(message.type)) emit({ type: 'busy', todoId: message.todoId });
              const result = await post('/board-message', message);
              if (result.view?.kind !== 'board' || result.view.scope !== scope) { location.reload(); return; }
            }
            await refresh(true);
          }).catch(async error => {
            status.textContent = 'Could not update board: ' + error.message;
            try { await refresh(true); } catch { /* Keep the original failure visible. */ }
          }).finally(() => { pending--; });
        }
      };
      setInterval(() => {
        if (!pending) refresh().catch(error => { status.textContent = 'Could not refresh board: ' + error.message; });
      }, 1500);
      const open = async (path, payload) => {
        try { await post(path, payload); location.reload(); }
        catch (error) { status.textContent = 'Could not navigate: ' + error.message; }
      };
      for (const button of document.querySelectorAll('[data-nav]')) button.addEventListener('click', () => open('/nav', { direction: button.dataset.nav }));
      for (const button of document.querySelectorAll('[data-open]')) button.addEventListener('click', () => open('/open', { todoId: button.dataset.open }));
      for (const button of document.querySelectorAll('[data-open-group]')) button.addEventListener('click', () => open('/open', { view: { kind: 'group', groupName: button.dataset.openGroup } }));
      for (const button of document.querySelectorAll('[data-open-board]')) button.addEventListener('click', () => open('/open', { view: { kind: 'board', scope: button.dataset.openBoard } }));
      document.querySelector('[data-open-select]')?.addEventListener('change', event => {
        const option = event.target.selectedOptions[0];
        const view = option.dataset.boardScope ? { kind: 'board', scope: option.dataset.boardScope }
          : option.dataset.groupName !== undefined ? { kind: 'group', groupName: option.dataset.groupName }
          : { kind: 'todo', todoId: option.value };
        open('/open', { view });
      });
    })();
  `;
  const navigation = `<div class="workspace-navigation">${renderNavigation(nav)}</div>`;
  return readFileSync(new URL('./board.html', import.meta.url), 'utf8')
    .replaceAll('__AGENDO_BOARD_NONCE__', nonce)
    .replace('__AGENDO_BOARD_CSP__', csp)
    .replace('__AGENDO_BOARD_HOST__', () => bootstrap)
    .replace('__AGENDO_BOARD_NAV__', () => navigation);
}
