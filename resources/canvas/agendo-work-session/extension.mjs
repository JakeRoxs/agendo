import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CanvasError as SdkCanvasError, createCanvas, joinSession } from '@github/copilot-sdk/extension';

import { CanvasError } from './errors.mjs';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertViewExists, assertViewSupported, createInstanceServer, listen, navigate, normalizeFilters, normalizeView } from './server.mjs';
import { assertTodoId, findTodoFile, getRelations, listGroups, loadGroupTodos, loadTodo, resolveWorkspaceRoot, setCriterionMet } from './todos.mjs';

const execFileAsync = promisify(execFile);

// Open a file in the default editor for the platform
async function openFile(filePath) {
  const platform = process.platform;
  if (platform === 'darwin') {
    await execFileAsync('open', [filePath]);
  } else if (platform === 'win32') {
    await execFileAsync('cmd', ['/c', 'start', '', filePath]);
  } else {
    await execFileAsync('xdg-open', [filePath]);
  }
}

// Works from a project install (.github/extensions/) or a user-level one (~/.copilot/extensions/).
const workspaceRoot = resolveWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));

const servers = new Map();
let copilotSession = null;

const todoIdSchema = { type: 'string', description: 'Todo ID, for example "033"' };

// Surface our SDK-free errors to the host with their stable codes.
function guard(handler) {
  return async args => {
    try {
      return await handler(args);
    } catch (e) {
      if (e instanceof CanvasError) throw new SdkCanvasError(e.code, e.message);
      throw e;
    }
  };
}

function summarize(todo) {
  return { title: todo ? todo.title : 'Agendo Work Session', status: todo?.status ?? 'No todo' };
}

const canvas = createCanvas({
  id: 'agendo-work-session',
  displayName: 'Agendo',
  description: 'Interactive work session dashboard for agendo todos with acceptance criteria tracking',
  inputSchema: {
    type: 'object',
    properties: {
      todoId: { type: 'string', description: 'The todo ID to focus on (e.g., "033")' }
    },
    required: ['todoId']
  },
  actions: [
    {
      name: 'mark_criterion_met',
      description: 'Mark an acceptance criterion as met or unmet',
      inputSchema: {
        type: 'object',
        properties: {
          todoId: todoIdSchema,
          criterionIndex: { type: 'integer', minimum: 0, description: 'Index of the criterion (0-based)' },
          met: { type: 'boolean', description: 'Whether the criterion is met' }
        },
        required: ['todoId', 'criterionIndex', 'met']
      },
      handler: guard(async ({ input }) => setCriterionMet(input?.todoId, input?.criterionIndex, input?.met, workspaceRoot))
    },
    {
      name: 'get_todo_context',
      description: 'Get full context for a todo including criteria, dependencies, and work log',
      inputSchema: {
        type: 'object',
        properties: { todoId: todoIdSchema },
        required: ['todoId']
      },
      handler: guard(async ({ input }) => {
        const todo = loadTodo(input?.todoId, workspaceRoot);
        return {
          id: todo.id,
          title: todo.title,
          status: todo.status,
          priority: todo.priority,
          group: todo.group,
          criteria: todo.criteria,
          dependencies: todo.dependencies,
          workLog: todo.workLog.slice(0, 5),
          resumeContext: todo.resumeContext,
          scannerEvidence: todo.scannerEvidence,
          triage: todo.triage,
          scan: todo.scan,
          description: todo.description,
          validation: todo.validation
        };
      })
    },
    {
      name: 'get_dependencies',
      description: 'List what blocks a todo, with each blocker\'s title, status, priority, and whether it is satisfied',
      inputSchema: { type: 'object', properties: { todoId: todoIdSchema }, required: ['todoId'] },
      handler: guard(async ({ input }) => {
        const { blocked, dependencies } = getRelations(input?.todoId, workspaceRoot);
        return { blocked, dependencies };
      })
    },
    {
      name: 'get_dependents',
      description: 'List the todos that depend on this todo (what it blocks), with their status',
      inputSchema: { type: 'object', properties: { todoId: todoIdSchema }, required: ['todoId'] },
      handler: guard(async ({ input }) => ({ dependents: getRelations(input?.todoId, workspaceRoot).dependents }))
    },
    {
      name: 'get_view_context',
      description: 'Get the current view context including active todo, filters, and selection state',
      inputSchema: { type: 'object', properties: {} },
      handler: guard(async ({ instanceId }) => {
        const entry = servers.get(instanceId);
        if (!entry || !entry.view) {
          return { view: null, message: 'No active canvas view' };
        }
        return {
          view: entry.view,
          todoId: entry.todoId,
          groupName: entry.groupName,
          returnTo: entry.returnTo,
          filters: entry.filters,
          historyLength: entry.history.length,
          position: entry.pos
        };
      })
    },
    {
      name: 'navigate',
      description: 'Navigate the canvas to a todo, group, or board view',
      inputSchema: {
        type: 'object',
        properties: {
          view: {
            oneOf: [
              { type: 'string', description: 'Todo ID' },
              { type: 'object', properties: { kind: { const: 'todo' }, todoId: todoIdSchema }, required: ['kind', 'todoId'] },
              { type: 'object', properties: { kind: { const: 'group' }, groupName: { type: 'string' } }, required: ['kind', 'groupName'] },
              { type: 'object', properties: { kind: { const: 'board' }, scope: { enum: ['todos', 'code-scanning'] } }, required: ['kind', 'scope'] }
            ]
          }
        },
        required: ['view']
      },
      handler: guard(async ({ input, instanceId }) => {
        const entry = servers.get(instanceId);
        if (!entry) {
          throw new CanvasError('no_active_canvas', 'No active canvas instance');
        }
        const view = normalizeView(input?.view);
        assertViewSupported(entry, view);
        assertViewExists(view, workspaceRoot);
        navigate(entry, view);
        return { success: true, view: entry.view, todoId: entry.todoId, groupName: entry.groupName };
      })
    },
    {
      name: 'list_groups',
      description: 'List all todo groups with member counts',
      inputSchema: { type: 'object', properties: {} },
      handler: guard(async () => {
        const groups = listGroups(workspaceRoot);
        return { groups: groups.map(g => ({ name: g, memberCount: loadGroupTodos(g, workspaceRoot).length })) };
      })
    },
    {
      name: 'filter',
      description: 'Apply filters to the current canvas view (status, priority, group, or combination)',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'in-progress', 'ready', 'backlogged', 'complete', 'cancelled'], description: 'Filter by status' },
          priority: { type: 'string', enum: ['p1', 'p2', 'p3'], description: 'Filter by priority' },
          group: { type: 'string', description: 'Filter by group name' }
        }
      },
      handler: guard(async ({ input, instanceId }) => {
        const entry = servers.get(instanceId);
        if (!entry) {
          throw new CanvasError('no_active_canvas', 'No active canvas instance');
        }
        entry.filters = normalizeFilters(input, workspaceRoot);
        return { success: true, filters: entry.filters, view: entry.view };
      })
    },
    {
      name: 'clear_filters',
      description: 'Clear all filters from the current canvas view',
      inputSchema: { type: 'object', properties: {} },
      handler: guard(async ({ instanceId }) => {
        const entry = servers.get(instanceId);
        if (!entry) {
          throw new CanvasError('no_active_canvas', 'No active canvas instance');
        }
        entry.filters = {};
        return { success: true, filters: {}, view: entry.view };
      })
    },
    {
      name: 'get_filters',
      description: 'Get the currently active filters',
      inputSchema: { type: 'object', properties: {} },
      handler: guard(async ({ instanceId }) => {
        const entry = servers.get(instanceId);
        if (!entry) {
          throw new CanvasError('no_active_canvas', 'No active canvas instance');
        }
        return { filters: entry.filters, view: entry.view };
      })
    },
    {
      name: 'explain_finding',
      description: 'Send a contextual explanation request about a todo/finding to the Copilot agent session',
      inputSchema: {
        type: 'object',
        properties: {
          todoId: todoIdSchema,
          intent: {
            type: 'string',
            enum: ['explain', 'investigate', 'suggest-fix', 'verify'],
            description: 'The intent of the request: explain (what is this), investigate (root cause analysis), suggest-fix (proposed fix plan), verify (validate solution)'
          }
        },
        required: ['todoId', 'intent']
      },
      handler: guard(async ({ input }) => {
        const todoId = assertTodoId(input?.todoId);
        const intent = input?.intent;

        // Load todo context
        const todo = loadTodo(todoId, workspaceRoot);
        const relations = getRelations(todoId, workspaceRoot);

        // Build bounded context packet
        const context = {
          id: todo.id,
          title: todo.title,
          status: todo.status,
          priority: todo.priority,
          group: todo.group,
          description: todo.description,
          scannerEvidence: todo.scannerEvidence,
          dependencies: relations.dependencies,
          blockedBy: relations.blocked
        };

        // Build intent-specific prompt
        const prompts = {
          explain: `Explain this Agendo finding:\n\nTodo: #${context.id} - ${context.title}\nStatus: ${context.status}\nPriority: ${context.priority}\n${context.scannerEvidence ? '\nScanner Evidence:\n' + context.scannerEvidence.slice(0, 2000) : ''}\n${context.description ? '\nDescription:\n' + context.description.slice(0, 1000) : ''}`,
          investigate: `Investigate the root cause of this Agendo finding:\n\nTodo: #${context.id} - ${context.title}\nStatus: ${context.status}\nPriority: ${context.priority}\n${context.scannerEvidence ? '\nScanner Evidence:\n' + context.scannerEvidence.slice(0, 2000) : ''}\n${context.dependencies && context.dependencies.length ? '\nDependencies:\n' + context.dependencies.join(', ') : ''}`,
          'suggest-fix': `Suggest a fix plan for this Agendo finding:\n\nTodo: #${context.id} - ${context.title}\nStatus: ${context.status}\nPriority: ${context.priority}\n${context.scannerEvidence ? '\nScanner Evidence:\n' + context.scannerEvidence.slice(0, 2000) : ''}\n${context.description ? '\nDescription:\n' + context.description.slice(0, 1000) : ''}`,
          verify: `Help verify the solution for this Agendo finding:\n\nTodo: #${context.id} - ${context.title}\nStatus: ${context.status}\nPriority: ${context.priority}\n${todo.criteria && todo.criteria.length ? '\nAcceptance Criteria:\n' + todo.criteria.map(c => (c.met ? '[x]' : '[ ]') + ' ' + c.text).join('\n') : ''}`
        };

        const prompt = prompts[intent];
        if (!prompt) {
          throw new CanvasError('invalid_input', `Unknown intent: ${intent}`);
        }

        // Check if Copilot session is available
        if (!copilotSession) {
          return {
            success: false,
            reason: 'copilot_session_unavailable',
            message: 'Copilot session is not available. Use the Copy Context button to copy context manually.',
            prompt
          };
        }

        // Send to Copilot session
        try {
          await copilotSession.send(prompt);
          return {
            success: true,
            reason: 'sent',
            message: 'Request sent to Copilot session',
            intent,
            todoId
          };
        } catch (e) {
          return {
            success: false,
            reason: 'send_failed',
            message: `Failed to send to Copilot session: ${e.message}`,
            prompt
          };
        }
      })
    },
    {
      name: 'refresh',
      description: 'Refresh the canvas to show latest todo state',
      inputSchema: {
        type: 'object',
        properties: { todoId: todoIdSchema },
        required: ['todoId']
      },
      handler: guard(async ({ input }) => {
        loadTodo(input?.todoId, workspaceRoot);
        return { success: true, message: 'Canvas refreshed' };
      })
    }
  ],
  open: guard(async ({ input, instanceId }) => {
    const todoId = assertTodoId(input?.todoId);
    let todo = null;
    try {
      todo = loadTodo(todoId, workspaceRoot);
    } catch (e) {
      if (!(e instanceof CanvasError) || e.code !== 'todo_not_found') throw e;
    }

    // Idempotent: reopening an instance reuses its server and re-reads state from the todo file.
    let entry = servers.get(instanceId);
    if (!entry) {
      entry = createInstanceServer(workspaceRoot, {
        edit: async (filePath) => {
          await openFile(filePath);
        },
      });
      await listen(entry);
      servers.set(instanceId, entry);
    }
    navigate(entry, todoId);

    return { ...summarize(todo), url: entry.url };
  }),
  onClose: async ({ instanceId }) => {
    const entry = servers.get(instanceId);
    if (!entry) return;
    servers.delete(instanceId);
    await new Promise(resolve => entry.server.close(() => resolve()));
  }
});

copilotSession = await joinSession({ canvases: [canvas] });
