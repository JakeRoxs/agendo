import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CanvasError } from './errors.mjs';
import { buildAgentPrompt } from './agent-requests.mjs';
import { createProposalStore } from './proposals.mjs';
import { createApprovalController } from './approval.mjs';

import { renderCanvas, renderGroupCanvas } from './page.mjs';
import { renderBoardCanvas } from './board.mjs';
import { renderDigestCanvas } from './digest.mjs';
import { renderSettingsPage } from './settings.mjs';
import { assertTodoId, findTodoFile, getRelations, listGroups, listTodoSummaries, loadGroupTodos, loadTodo, PRIORITIES, setCriterionMet, setTodoGroup, setTodoPriority, setTodoStatus, STATUSES, todoFingerprint } from './todos.mjs';

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
  if (value?.kind === 'digest' && ['todos', 'code-scanning'].includes(value.scope)) return { kind: 'digest', scope: value.scope };
  throw new CanvasError('invalid_input', 'Expected a todo, group, board, or digest selection');
}

// Rejects stale targets so agent navigation reports them instead of showing a missing todo or empty group.
export function assertViewExists(view, workspaceRoot) {
  if (view.kind === 'todo' && !findTodoFile(view.todoId, workspaceRoot)) {
    throw new CanvasError('todo_not_found', `Todo ${view.todoId} not found`);
  }
  if (view.kind === 'group' && !listGroups(workspaceRoot).includes(view.groupName)) {
    throw new CanvasError('group_not_found', `Group "${view.groupName}" not found`);
  }
}

export function assertViewSupported(entry, view) {
  if (view.kind === 'board' && !entry.hasBoard) throw new CanvasError('unsupported', 'Board view is not available in this host');
  if (view.kind === 'digest' && !entry.hasDigest) throw new CanvasError('unsupported', 'Digest view is not available in this host');
}

export function normalizeFilters(input, workspaceRoot) {
  const filters = {};
  if (input?.status !== undefined) {
    if (!STATUSES.includes(input.status)) throw new CanvasError('invalid_input', `status must be one of: ${STATUSES.join(', ')}`);
    filters.status = input.status;
  }
  if (input?.priority !== undefined) {
    if (!PRIORITIES.includes(input.priority)) throw new CanvasError('invalid_input', `priority must be one of: ${PRIORITIES.join(', ')}`);
    filters.priority = input.priority;
  }
  if (input?.group !== undefined) {
    if (typeof input.group !== 'string' || !listGroups(workspaceRoot).includes(input.group)) {
      throw new CanvasError('group_not_found', `Group "${input.group}" not found`);
    }
    filters.group = input.group;
  }
  return filters;
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

export function step(entry, direction) {
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
      priority: summaries.get(id)?.priority ?? 'p3',
      current
    };
  });
  return { canBack: entry.pos > 0, canForward: entry.pos < entry.history.length - 1, recent, returnTo: entry.view?.kind === 'board' ? undefined : entry.returnTo };
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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
  const entry = { todoId: undefined, view: undefined, groupName: undefined, returnTo: undefined, history: [], pos: -1, url: '', server: null, filters: {} };
  const hasBoard = typeof actions.getBoardSnapshot === 'function' && typeof actions.handleBoardMessage === 'function';
  entry.hasBoard = hasBoard;
  const hasDigest = typeof actions.getDigest === 'function';
  entry.hasDigest = hasDigest;
  entry.proposals = createProposalStore(workspaceRoot);
  entry.approval = createApprovalController({
    proposals: entry.proposals, workspaceRoot, getView: () => entry.view,
    assertWritable: actions.assertWritable
  });
  entry.resetApproval = () => entry.approval.setPolicy({ mode: 'manual' });
  entry.disposeProposals = () => entry.approval.dispose();
  const proposalVersion = () => JSON.stringify({
    policy: entry.approval.getPolicy(),
    proposals: entry.todoId ? entry.approval.list(entry.todoId).map(proposal =>
      [proposal.id, proposal.state, proposal.changes.map(change => change.state), proposal.approval]) : []
  });
  let agentPreview;
  const agentState = () => actions.getAgentState?.() ?? { supported: false, status: 'unavailable' };
  const agentSelection = () => ({ view: entry.view, filters: entry.filters });
  const agentPrompt = intent => {
    let todos;
    if (entry.view?.kind === 'todo') todos = [loadTodo(entry.todoId, workspaceRoot)];
    else if (entry.view?.kind === 'group') {
      todos = loadGroupTodos(entry.groupName, workspaceRoot).filter(todo =>
        (!entry.filters.status || todo.status === entry.filters.status) &&
        (!entry.filters.priority || todo.priority === entry.filters.priority) &&
        (!entry.filters.group || todo.group === entry.filters.group));
    } else throw new CanvasError('unsupported', 'Select a todo or group before requesting agent help');
    return buildAgentPrompt({ intent, todos, selection: agentSelection() });
  };
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
        send(res, 200, 'text/plain', `${viewKey(entry.view)}|${JSON.stringify(entry.filters)}|${todoFingerprint(workspaceRoot)}|${proposalVersion()}`);
      } else if (req.method === 'GET' && path === '/board-snapshot') {
        const snapshot = await actions.getBoardSnapshot(boardScope());
        send(res, 200, 'application/json', JSON.stringify(snapshot));
      } else if (req.method === 'GET' && path === '/digest-snapshot') {
        if (!hasDigest || entry.view?.kind !== 'digest') throw new CanvasError('unsupported', 'Digest view is not available in this host');
        const digest = await actions.getDigest(entry.view.scope);
        send(res, 200, 'application/json', JSON.stringify(digest));
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
      } else if (req.method === 'POST' && ['/toggle', '/open', '/nav', '/status', '/priority', '/group', '/edit', '/return-board', '/board-message', '/context', '/agent/preview', '/agent/send', '/agent/state', '/report/preview', '/report/generate', '/proposals/create', '/proposals/list', '/proposals/apply', '/proposals/reject', '/proposals/policy'].includes(path)) {
        // The custom header forces a CORS preflight, so other web pages cannot trigger writes.
        if (req.headers['x-agendo-canvas'] !== '1') {
          send(res, 403, 'text/plain', 'Forbidden');
          return;
        }
        const payload = JSON.parse(await readBody(req));
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new CanvasError('invalid_input', 'Expected an object');
        if (path.startsWith('/proposals/')) {
          // Revoking automation must remain available even if navigation made the visible page stale.
          if (path === '/proposals/policy' && payload.policy?.mode === 'manual') {
            entry.approval.setPolicy(payload.policy);
            return send(res, 200, 'application/json', JSON.stringify(entry.approval.getPolicy()));
          }
          const todoId = assertTodoId(entry.todoId);
          if (viewKey(normalizeView(payload.view)) !== viewKey(entry.view)) throw new CanvasError('stale_selection', 'Select the proposal target again before reviewing changes');
          let result;
          if (path === '/proposals/policy') {
            entry.approval.setPolicy(payload.policy);
            result = entry.approval.getPolicy();
          } else if (path === '/proposals/create') {
            result = await entry.approval.create({ todoId, changes: payload.changes, requestId: payload.requestId });
          } else if (path === '/proposals/list') {
            result = { proposals: entry.approval.list(todoId), canApply: typeof actions.assertWritable === 'function', policy: entry.approval.getPolicy() };
          } else {
            if (!entry.proposals.list(todoId).some(proposal => proposal.id === payload.proposalId)) throw new CanvasError('invalid_input', 'No proposal for this selection');
            if (path === '/proposals/reject') result = entry.proposals.reject(payload.proposalId, payload.changeIds);
            else result = await entry.proposals.apply(payload.proposalId, payload.changeIds, {
              assertWritable: typeof actions.assertWritable === 'function' ? async id => {
                await actions.assertWritable(id);
                if (entry.todoId !== todoId) throw new CanvasError('stale_selection', 'The selected todo changed before application');
              } : undefined
            });
            entry.approval.noteManual(payload.proposalId, path === '/proposals/reject' ? 'rejected' : 'applied');
          }
          return send(res, 200, 'application/json', JSON.stringify(result));
        } else if (path === '/agent/state') {
          return send(res, 200, 'application/json', JSON.stringify(agentState()));
        } else if (path === '/agent/preview') {
          if (agentPreview?.status === 'sending') throw new CanvasError('busy', 'A request is already being submitted');
          if (viewKey(normalizeView(payload.view)) !== viewKey(entry.view)) throw new CanvasError('stale_selection', 'The selection changed. Reload and preview again');
          const prompt = agentPrompt(payload.intent);
          agentPreview = {
            requestId: randomBytes(24).toString('hex'), intent: payload.intent, prompt,
            selection: JSON.stringify(agentSelection()), createdAt: Date.now(), status: 'preview'
          };
          return send(res, 200, 'application/json', JSON.stringify({
            requestId: agentPreview.requestId, prompt, state: agentState()
          }));
        } else if (path === '/agent/send') {
          const preview = agentPreview;
          if (!preview || payload.requestId !== preview.requestId) throw new CanvasError('invalid_input', 'Preview this request before sending');
          if (preview.result) return send(res, 200, 'application/json', JSON.stringify(preview.result));
          if (preview.status === 'sending') throw new CanvasError('busy', 'This request is already being submitted');
          if (Date.now() - preview.createdAt > 300_000 || preview.selection !== JSON.stringify(agentSelection()) || preview.prompt !== agentPrompt(preview.intent)) {
            throw new CanvasError('stale_selection', 'The selection or evidence changed. Preview again before sending');
          }
          if (typeof actions.sendAgentRequest !== 'function') return send(res, 200, 'application/json', JSON.stringify({
            success: false, reason: 'unsupported', message: 'Direct sending is unavailable in this host. Use Copy Request.'
          }));
          preview.status = 'sending';
          try {
            const result = await actions.sendAgentRequest({ prompt: preview.prompt });
            // Only a confirmed admission consumes the token; busy/failed sends can be retried explicitly.
            if (result.success) preview.result = result;
            return send(res, 200, 'application/json', JSON.stringify(result));
          } finally {
            preview.status = 'preview';
          }
        } else if (path === '/report/preview') {
          // Build a report packet for the current selection (group/filter or period)
          const view = normalizeView(payload?.view ?? entry.view);
          let reportTodos = [];
          if (view.kind === 'group' && view.groupName) {
            const members = loadGroupTodos(view.groupName, workspaceRoot, entry.filters);
            reportTodos = members.filter(t => t.status === 'completed');
          } else if (view.kind === 'board' && view.scope) {
            const summaries = listTodoSummaries(workspaceRoot);
            reportTodos = summaries.filter(t => t.status === 'completed' && t.group === view.scope);
          } else if (view.kind === 'todo' && view.todoId) {
            const todo = loadTodo(view.todoId, workspaceRoot);
            reportTodos = todo.status === 'completed' ? [todo] : [];
          }
          const matched = reportTodos.length;
          const included = reportTodos.slice(0, 25);
          const omitted = matched - included.length;
          const prompt = buildAgentPrompt({
            intent: 'report',
            todos: included,
            selection: {
              view: { kind: view.kind, todoId: view.todoId, groupName: view.groupName },
              filters: entry.filters
            }
          });
          return send(res, 200, 'application/json', JSON.stringify({
            matched, included: included.length, omitted, prompt, state: agentState()
          }));
        } else if (path === '/report/generate') {
          const preview = payload;
          if (!preview?.prompt || typeof preview.prompt !== 'string') {
            throw new CanvasError('invalid_input', 'Report preview required before generation');
          }
          if (typeof actions.sendAgentRequest !== 'function') return send(res, 200, 'application/json', JSON.stringify({
            success: false, reason: 'unsupported', message: 'Direct sending is unavailable in this host. Use Copy Request.'
          }));
          const result = await actions.sendAgentRequest({ prompt: preview.prompt });
          return send(res, 200, 'application/json', JSON.stringify(result));
        } else if (path === '/board-message') {
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
        } else if (path === '/context') {
          const todo = loadTodo(assertTodoId(entry.todoId), workspaceRoot);
          const relations = getRelations(entry.todoId, workspaceRoot);
          return send(res, 200, 'application/json', JSON.stringify({
            id: todo.id,
            title: todo.title,
            status: todo.status,
            priority: todo.priority,
            group: todo.group,
            description: todo.description,
            criteria: todo.criteria,
            dependencies: relations.dependencies,
            blockedBy: relations.blocked,
            scannerEvidence: todo.scannerEvidence,
            resumeContext: todo.resumeContext,
            validation: todo.validation
          }));
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
          assertViewSupported(entry, view);
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
        } else if (entry.view?.kind === 'digest') {
          if (!hasDigest) throw new CanvasError('unsupported', 'Digest view is not available in this host');
          const nonce = randomBytes(16).toString('hex');
          const digestCsp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors *;`;
          html = renderDigestCanvas(entry.view.scope, buildNav(entry, workspaceRoot), nonce, digestCsp);
          send(res, 200, 'text/html; charset=utf-8', html, { 'Content-Security-Policy': digestCsp });
          return;
        } else if (entry.groupName !== undefined) {
          // Group overview view
          let members = loadGroupTodos(entry.groupName, workspaceRoot);
          if (entry.filters?.status) members = members.filter(m => m.status === entry.filters.status);
          if (entry.filters?.priority) members = members.filter(m => m.priority === entry.filters.priority);
          if (entry.filters?.group && entry.filters.group !== entry.groupName) members = members.filter(m => m.group === entry.filters.group);
          const nav = buildNav(entry, workspaceRoot);
          if (!actions.returnToBoard && !hasBoard) nav.returnTo = undefined;
          html = renderGroupCanvas(entry.groupName, members, nav, actions, entry.filters);
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
          html = renderCanvas(todo, relations, nav, actions, groups, todo ? entry.approval.list(todo.id) : [], entry.approval.getPolicy());
        }
        send(res, 200, 'text/html; charset=utf-8', html, { 'Content-Security-Policy': CSP });
      } else {
        send(res, 404, 'text/plain', 'Not found');
      }
    } catch (e) {
      const status = e instanceof CanvasError || e instanceof SyntaxError ? 400 : 500;
      const text = e instanceof Error ? e.message : 'Server error';
      if (req.method === 'GET' && path === '/') {
        // page.js polls /version, so this page recovers once the view changes.
        send(res, status, 'text/html; charset=utf-8', `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/page.css"></head><body><main class="empty"><h1>Agendo Work Session</h1><p class="error" role="alert">${escapeHtml(text)}</p><p id="status-message" role="status" aria-live="polite"></p></main><script src="/page.js"></script></body></html>`, { 'Content-Security-Policy': CSP });
      } else {
        send(res, status, 'text/plain', text);
      }
    }
  });

  entry.server.once('close', entry.disposeProposals);
  return entry;
}

export async function listen(entry) {
  await new Promise((resolve, reject) => {
    entry.server.once('error', reject);
    entry.server.listen(0, '127.0.0.1', resolve);
  });
  entry.url = `http://127.0.0.1:${entry.server.address().port}/`;
}
