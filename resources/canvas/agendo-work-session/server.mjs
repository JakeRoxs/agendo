import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CanvasError } from './errors.mjs';

import { renderCanvas } from './page.mjs';
import { assertTodoId, findTodoFile, getRelations, listTodoSummaries, loadTodo, setCriterionMet, setTodoStatus, todoFingerprint } from './todos.mjs';

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), 'assets');
const ASSETS = {
  '/page.css': { file: 'page.css', type: 'text/css; charset=utf-8' },
  '/page.js': { file: 'page.js', type: 'text/javascript; charset=utf-8' }
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

// Visiting a todo drops any forward entries, like a browser; revisiting the current one is a no-op.
export function navigate(entry, todoId) {
  if (entry.history[entry.pos] !== todoId) {
    entry.history = [...entry.history.slice(0, entry.pos + 1), todoId].slice(-MAX_HISTORY);
    entry.pos = entry.history.length - 1;
  }
  entry.todoId = todoId;
}

function step(entry, direction) {
  const next = entry.pos + (direction === 'back' ? -1 : 1);
  if (next < 0 || next >= entry.history.length) {
    throw new CanvasError('invalid_input', `Cannot go ${direction}`);
  }
  entry.pos = next;
  entry.todoId = entry.history[next];
}

function buildNav(entry, workspaceRoot) {
  const summaries = listTodoSummaries(workspaceRoot);
  const recent = [...new Set([...entry.history].reverse())].slice(0, MAX_RECENT).map(id => ({
    id,
    title: summaries.get(id)?.title ?? `Todo ${id}`,
    status: summaries.get(id)?.status ?? 'missing',
    current: id === entry.todoId
  }));
  return { canBack: entry.pos > 0, canForward: entry.pos < entry.history.length - 1, recent };
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
  const entry = { todoId: undefined, history: [], pos: -1, url: '', server: null };

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
        send(res, 200, 'text/plain', `${entry.todoId}|${todoFingerprint(workspaceRoot)}`);
      } else if (req.method === 'POST' && (path === '/toggle' || path === '/open' || path === '/nav' || path === '/status' || path === '/edit')) {
        // The custom header forces a CORS preflight, so other web pages cannot trigger writes.
        if (req.headers['x-agendo-canvas'] !== '1') {
          send(res, 403, 'text/plain', 'Forbidden');
          return;
        }
        const payload = JSON.parse(await readBody(req));
        if (path === '/toggle') {
          setCriterionMet(entry.todoId, payload.index, payload.met, workspaceRoot);
        } else if (path === '/status') {
          setTodoStatus(entry.todoId, payload.status, workspaceRoot);
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
          if (!findTodoFile(assertTodoId(payload.todoId), workspaceRoot)) {
            throw new CanvasError('todo_not_found', `Todo ${payload.todoId} not found`);
          }
          navigate(entry, payload.todoId);
        }
        send(res, 200, 'application/json', '{"success":true}');
      } else if (req.method === 'GET' && path === '/') {
        let todo = null;
        let relations = null;
        try {
          todo = loadTodo(entry.todoId, workspaceRoot);
          relations = getRelations(entry.todoId, workspaceRoot);
        } catch (e) {
          if (!(e instanceof CanvasError)) throw e;
        }
        send(res, 200, 'text/html; charset=utf-8', renderCanvas(todo, relations, buildNav(entry, workspaceRoot), actions), { 'Content-Security-Policy': CSP });
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
