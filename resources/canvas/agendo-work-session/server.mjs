import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CanvasError } from './errors.mjs';

import { renderCanvas, renderGroupCanvas } from './page.mjs';
import { renderBoardCanvas } from './board.mjs';
import { renderSettingsPage } from './settings.mjs';
import { assertTodoId, findTodoFile, getRelations, listGroups, listTodoSummaries, loadGroupTodos, loadTodo, setCriterionMet, setTodoGroup, setTodoPriority, setTodoStatus, todoFingerprint } from './todos.mjs';

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), 'assets');
const ASSETS = {
  '/page.css': { file: 'page.css', type: 'text/css; charset=utf-8' },
  '/page.js': { file: 'page.js', type: 'text/javascript; charset=utf-8' },
  '/settings.js': { file: 'settings.js', type: 'text/javascript; charset=utf-8' }
};

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors * vscode-webview: vscode-file:"
].join('; ');

const MAX_BODY_BYTES = 10_000;
const MAX_HISTORY = 30;
const MAX_RECENT = 15;

export function normalizeView(value) {
  if (typeof value === 'string') return { kind: 'todo', todoId: assertTodoId(value) };
  if (value?.kind === 'todo') return { kind: 'todo', todoId: assertTodoId(value.todoId) };
  if (value?.kind === 'group' && typeof value.groupName === 'string' && value.groupName.trim() && value.groupName.length <= 200 && !/[\r\n\0]/.test(value.groupName)) {
    return { kind: 'group', groupName: value.groupName };
  }
  if (value?.kind === 'board' && ['todos', 'code-scanning'].includes(value.scope)) return { kind: 'board', scope: value.scope };
  throw new CanvasError('invalid_input', 'Expected a todo, group, or board selection');
}

const viewKey = view => JSON.stringify(view);

function selectView(entry, view) {
  entry.view = view;
  entry.todoId = view.kind === 'todo' ? view.todoId : undefined;
  entry.groupName = view.kind === 'group' ? view.groupName : undefined;
  if (view.kind === 'board') entry.returnTo = { kind: 'board', scope: view.scope };
}

// History stores typed selections, never fabricated todo IDs for groups or boards.
export function navigate(entry, target, returnTo) {
  const view = normalizeView(target);
  if (returnTo !== undefined) {
    if (returnTo !== null && (returnTo.kind !== 'board' || !['todos', 'code-scanning'].includes(returnTo.scope))) {
      throw new CanvasError('invalid_input', 'Invalid board return target');
    }
    entry.returnTo = returnTo ? { kind: 'board', scope: returnTo.scope } : undefined;
  }
  if (viewKey(entry.history[entry.pos]) !== viewKey(view)) {
    entry.history = [...entry.history.slice(0, entry.pos + 1), view].slice(-MAX_HISTORY);
    entry.pos = entry.history.length - 1;
  }
  selectView(entry, view);
}

function step(entry, direction) {
  const next = entry.pos + (direction === 'back' ? -1 : 1);
  if (next < 0 || next >= entry.history.length) {
    throw new CanvasError('invalid_input', `Cannot go ${direction}`);
  }
  entry.pos = next;
  selectView(entry, entry.history[next]);
}

function buildNav(entry, workspaceRoot) {
  const summaries = listTodoSummaries(workspaceRoot);
  const unique = new Map();
  for (const view of [...entry.history].reverse()) if (!unique.has(viewKey(view))) unique.set(viewKey(view), view);
  const recent = [...unique.values()].slice(0, MAX_RECENT).map(view => {
    const current = viewKey(view) === viewKey(entry.view);
    if (view.kind === 'board') return { ...view, title: view.scope === 'code-scanning' ? 'Code Scanning Board' : 'Todos Board', status: 'board', current };
    if (view.kind === 'group') {
      return { kind: 'group', groupName: view.groupName, title: `Group: ${view.groupName}`, status: 'group', current };
    }
    const id = view.todoId;
    return {
      id,
      title: summaries.get(id)?.title ?? `Todo ${id}`,
      status: summaries.get(id)?.status ?? 'missing',
      current
    };
  });
  return { canBack: entry.pos > 0, canForward: entry.pos < entry.history.length - 1, recent, returnTo: entry.view?.kind === 'board' ? undefined : entry.returnTo };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > MAX_BODY_BYTES) {
        reject(new CanvasError('request_too_large', 'Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function send(res, status, type, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  res.end(body);
}

/**
 * One local HTTP server per canvas instance. The page is rendered from the
 * todo file on every request, so reopening an instance always shows live state.
 */
export function createInstanceServer(workspaceRoot, actions = {}) {
  const entry = { todoId: undefined, view: undefined, groupName: undefined, returnTo: undefined, history: [], pos: -1, url: '', server: null };
  const hasBoard = typeof actions.getBoardSnapshot === 'function' && typeof actions.handleBoardMessage === 'function';
  const boardScope = () => {
    if (!hasBoard || entry.view?.kind !== 'board') throw new CanvasError('unsupported', 'Board view is not available in this host');
    return entry.view.scope;
  };

  entry.server = createServer(async (req, res) => {
    // Reject requests whose Host is not a loopback name (DNS rebinding guard). The port is not
    // checked because a forwarded port (remote workspaces) differs from the one we listen on.
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? '')) {
      send(res, 403, 'text/plain', 'Forbidden');
      return;
    }

    const path = (req.url || '/').split('?')[0];
    try {
      if (req.method === 'GET' && ASSETS[path]) {
        send(res, 200, ASSETS[path].type, readFileSync(join(assetsDir, ASSETS[path].file)));
      } else if (req.method === 'GET' && path === '/version') {
        send(res, 200, 'text/plain', `${viewKey(entry.view)}|${todoFingerprint(workspaceRoot)}`);
      } else if (req.method === 'GET' && path === '/board-snapshot') {
        const snapshot = await actions.getBoardSnapshot(boardScope());
        send(res, 200, 'application/json', JSON.stringify(snapshot));
      } else if (req.method === 'GET' && path === '/settings') {
        let info = {};
        try { info = await actions.getSettingsInfo?.() ?? {}; } catch { /* ignore */ }
        send(res, 200, 'text/html; charset=utf-8', renderSettingsPage(info), { 'Content-Security-Policy': CSP });
      } else if (req.method === 'POST' && path === '/settings/action') {
        if (req.headers['x-agendo-canvas'] !== '1') {
          send(res, 403, 'text/plain', 'Forbidden');
          return;
        }
        const payload = JSON.parse(await readBody(req));
        if (!payload || typeof payload !== 'object') throw new CanvasError('invalid_input', 'Expected an object');
        if (!actions.handleSettingsAction) throw new CanvasError('unsupported', 'Settings actions are not available in this host');
        const result = await actions.handleSettingsAction(payload);
        send(res, 200, 'application/json', JSON.stringify(result ?? { success: true }));
      } else if (req.method === 'POST' && ['/toggle', '/open', '/nav', '/status', '/priority', '/group', '/edit', '/return-board', '/board-message'].includes(path)) {
        // The custom header forces a CORS preflight, so other web pages cannot trigger writes.
        if (req.headers['x-agendo-canvas'] !== '1') {
          send(res, 403, 'text/plain', 'Forbidden');
          return;
        }
        const payload = JSON.parse(await readBody(req));
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new CanvasError('invalid_input', 'Expected an object');
        if (path === '/board-message') {
          const scope = boardScope();
          if (typeof payload.type !== 'string') throw new CanvasError('invalid_input', 'Expected a typed board message');
          await actions.handleBoardMessage(scope, payload);
          send(res, 200, 'application/json', JSON.stringify({ success: true, view: entry.view }));
          return;
        } else if (path === '/toggle') {
          const todoId = assertTodoId(entry.todoId);
          if (actions.assertWritable) await actions.assertWritable(todoId);
          setCriterionMet(todoId, payload.index, payload.met, workspaceRoot);
        } else if (path === '/status') {
          if (actions.setStatus) await actions.setStatus(assertTodoId(entry.todoId), payload.status);
          else setTodoStatus(entry.todoId, payload.status, workspaceRoot);
        } else if (path === '/priority') {
          if (actions.setPriority) await actions.setPriority(assertTodoId(entry.todoId), payload.priority);
          else setTodoPriority(entry.todoId, payload.priority, workspaceRoot);
        } else if (path === '/group') {
          if (actions.setGroup) await actions.setGroup(assertTodoId(entry.todoId), payload.group);
          else setTodoGroup(entry.todoId, payload.group, workspaceRoot);
        } else if (path === '/return-board') {
          if (!entry.returnTo || (!actions.returnToBoard && !hasBoard)) throw new CanvasError('unsupported', 'No board return action is available in this host');
          if (hasBoard) {
            navigate(entry, entry.returnTo);
            send(res, 200, 'application/json', JSON.stringify({ success: true, view: entry.view }));
            return;
          }
          await actions.returnToBoard(entry.returnTo.scope);
        } else if (path === '/edit') {
          const filePath = findTodoFile(entry.todoId, workspaceRoot);
          if (!actions.edit || !filePath) throw new CanvasError('unsupported', 'Editing is not available here');
          await actions.edit(filePath);
        } else if (path === '/nav') {
          if (payload.direction !== 'back' && payload.direction !== 'forward') {
            throw new CanvasError('invalid_input', 'direction must be "back" or "forward"');
          }
          step(entry, payload.direction);
        } else {
          const view = normalizeView(payload.view ?? payload.todoId);
          if (view.kind === 'board' && !hasBoard) throw new CanvasError('unsupported', 'Board view is not available in this host');
          if (view.kind === 'todo' && !findTodoFile(view.todoId, workspaceRoot)) {
            throw new CanvasError('todo_not_found', `Todo ${view.todoId} not found`);
          }
          navigate(entry, view);
        }
        send(res, 200, 'application/json', '{"success":true}');
      } else if (req.method === 'GET' && path === '/') {
        let html;
        if (entry.view?.kind === 'board') {
          boardScope();
          const nonce = randomBytes(16).toString('hex');
          const boardCsp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors *;`;
          html = renderBoardCanvas(entry.view.scope, buildNav(entry, workspaceRoot), nonce, boardCsp);
          send(res, 200, 'text/html; charset=utf-8', html, { 'Content-Security-Policy': boardCsp });
          return;
        } else if (entry.groupName !== undefined) {
          // Group overview view
          const members = loadGroupTodos(entry.groupName, workspaceRoot);
          const nav = buildNav(entry, workspaceRoot);
          if (!actions.returnToBoard && !hasBoard) nav.returnTo = undefined;
          html = renderGroupCanvas(entry.groupName, members, nav, actions);
        } else {
          let todo = null;
          let relations = null;
          let groups = [];
          try {
            todo = loadTodo(entry.todoId, workspaceRoot);
            relations = getRelations(entry.todoId, workspaceRoot);
            groups = listGroups(workspaceRoot);
          } catch (e) {
            if (!(e instanceof CanvasError)) throw e;
          }
          const nav = buildNav(entry, workspaceRoot);
          if (!actions.returnToBoard && !hasBoard) nav.returnTo = undefined;
          html = renderCanvas(todo, relations, nav, actions, groups);
        }
        send(res, 200, 'text/html; charset=utf-8', html, { 'Content-Security-Policy': CSP });
      } else {
        send(res, 404, 'text/plain', 'Not found');
      }
    } catch (e) {
      const status = e instanceof CanvasError || e instanceof SyntaxError ? 400 : 500;
      send(res, status, 'text/plain', e instanceof Error ? e.message : 'Server error');
    }
  });

  return entry;
}

export async function listen(entry) {
  await new Promise((resolve, reject) => {
    entry.server.once('error', reject);
    entry.server.listen(0, '127.0.0.1', resolve);
  });
  entry.url = `http://127.0.0.1:${entry.server.address().port}/`;
}
