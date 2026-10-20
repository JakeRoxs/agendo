import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CanvasError as SdkCanvasError, createCanvas, joinSession } from '@github/copilot-sdk/extension';

import { CanvasError } from './errors.mjs';

import { createInstanceServer, listen, navigate } from './server.mjs';
import { assertTodoId, getRelations, loadTodo, resolveWorkspaceRoot, setCriterionMet } from './todos.mjs';

// Works from a project install (.github/extensions/) or a user-level one (~/.copilot/extensions/).
const workspaceRoot = resolveWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));

const servers = new Map();

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
  displayName: 'Agendo Work Session',
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
          criteria: todo.criteria,
          dependencies: todo.dependencies,
          workLog: todo.workLog.slice(0, 5),
          resumeContext: todo.resumeContext
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
      entry = createInstanceServer(workspaceRoot);
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

await joinSession({ canvases: [canvas] });
