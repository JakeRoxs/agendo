#!/usr/bin/env node
/**
 * Agendo MCP Server
 *
 * Exposes Agendo todo operations as MCP tools for any MCP client
 * (Kilo, Claude, Codex, etc.).
 *
 * Usage: node resources/mcp/server.mjs
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverEndpoint, collectWorkspaceRegistrations, resolveTodoRoot } from './discovery.mjs';
import { STATUSES } from '../canvas/agendo-work-session/statusLifecycle.js';
import {
  getProblemsHandler,
  getProblemsInputSchema,
} from './ipc.mjs';
import {
  loadTodo,
  getRelations,
  listGroups,
  loadGroupTodos,
  setTodoStatus,
  setTodoPriority,
  setTodoGroup,
  setCriterionMet,
  findTodoFile,
  resolveWorkspaceRoot,
} from '../canvas/agendo-work-session/todos.mjs';

const serverPath = fileURLToPath(import.meta.url);
const serverDir = dirname(serverPath);
// Registration root is the `workspaces/` sibling of the executing stable
// server bundle. A `--workspace-discovery` override preserves one-time
// backwards compatibility.
const registrationRoot = join(serverDir, 'workspaces');

const endpoint = option('--endpoint');
const discoveryDirectory = option('--workspace-discovery');

const registryRoot = discoveryDirectory ?? registrationRoot;

// Parse KILO_PARENT_PID once; the server inherits it from the launching
// window. Invalid values are treated as no host PID (generic client mode) so
// todo operations are not broken by a misconfigured environment variable.
function parseKiloParentPid() {
  const kiloParentPid = process.env.KILO_PARENT_PID;
  if (kiloParentPid === undefined || kiloParentPid === '') return undefined;
  if (!/^\d+$/.test(kiloParentPid)) return undefined;
  const pid = Number(kiloParentPid);
  if (!Number.isSafeInteger(pid) || pid <= 1) return undefined;
  return pid;
}

const hostPid = parseKiloParentPid();

/**
 * Resolve the todo root for one MCP invocation. Reads the workspace-folder
 * discovery records, applies the optional `workspaceFolder` binding, and falls
 * back to the standalone CWD root when no editor registration applies.
 */
async function resolveRootForCall(args) {
  const { workspaceFolder } = args;
  const registrations = await collectWorkspaceRegistrations(registryRoot, hostPid);
  const root = resolveTodoRoot(registrations, { workspaceFolder, cwd: process.cwd() });
  if (root === undefined) {
    return resolveWorkspaceRoot(process.cwd());
  }
  return root;
}

async function diagnosticsEndpoint() {
  if (endpoint !== undefined) return endpoint;

  // Kilo supplies the launching window's identity through the inherited
  // KILO_PARENT_PID environment variable. Never require it in user config.
  const kiloParentPid = process.env.KILO_PARENT_PID;
  let hostPid;
  if (kiloParentPid !== undefined && kiloParentPid !== '') {
    if (!/^\d+$/.test(kiloParentPid)) {
      throw new Error('invalid_input: KILO_PARENT_PID must be a VS Code extension-host PID.');
    }
    const pid = Number(kiloParentPid);
    if (!Number.isSafeInteger(pid) || pid <= 1) {
      throw new Error('invalid_input: KILO_PARENT_PID must be a VS Code extension-host PID.');
    }
    hostPid = pid;
  }

  // The server's CWD is the workspace root for Kilo (Instance.directory); for
  // generic clients it is wherever the MCP client launched the server.
  return discoverEndpoint(registryRoot, { hostPid, cwd: process.cwd() });
}

function option(name) {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === name) {
      return argv[i + 1] ?? undefined;
    }
    if (arg.startsWith(`${name}=`)) {
      return arg.slice(name.length + 1);
    }
  }
  return undefined;
}

const server = new McpServer({
  name: 'agendo',
  version: '0.3.0',
});

server.registerTool(
  'get_todo_context',
  {
    description: 'Get full context for a todo including criteria, dependencies, work log, and scanner evidence',
    inputSchema: {
      todoId: z.string().describe('Todo ID, e.g. "001" or "sq-123"'),
      workspaceFolder: z.string().optional().describe('Workspace folder name or path'),
    },
  },
  async ({ todoId, workspaceFolder }) => {
    const root = await resolveRootForCall({ workspaceFolder });
    const todo = loadTodo(todoId, root);
    const relations = getRelations(todoId, root);
    return {
      id: todo.id,
      title: todo.title,
      status: todo.status,
      priority: todo.priority,
      group: todo.group,
      description: todo.description,
      criteria: todo.criteria,
      dependencies: relations.dependencies,
      blockedBy: relations.blocked,
      dependents: relations.dependents,
      workLog: todo.workLog.slice(0, 5),
      resumeContext: todo.resumeContext,
      scannerEvidence: todo.scannerEvidence,
      triage: todo.triage,
      scan: todo.scan,
      validation: todo.validation,
    };
  }
);

server.registerTool(
  'list_groups',
  {
    description: 'List all todo groups with member counts',
    inputSchema: {
      workspaceFolder: z.string().optional().describe('Workspace folder name or path'),
    },
  },
  async ({ workspaceFolder }) => {
    const root = await resolveRootForCall({ workspaceFolder });
    const groups = listGroups(root);
    return groups.map(g => ({
      name: g,
      memberCount: loadGroupTodos(g, root).length,
    }));
  }
);

server.registerTool(
  'list_group_members',
  {
    description: 'List all todos in a group',
    inputSchema: {
      groupName: z.string().describe('Group name'),
      workspaceFolder: z.string().optional().describe('Workspace folder name or path'),
    },
  },
  async ({ groupName, workspaceFolder }) => {
    const root = await resolveRootForCall({ workspaceFolder });
    const members = loadGroupTodos(groupName, root);
    return members.map(m => ({
      id: m.id,
      title: m.title,
      status: m.status,
      priority: m.priority,
    }));
  }
);

server.registerTool(
  'get_dependencies',
  {
    description: 'Get what blocks a todo and what it blocks',
    inputSchema: {
      todoId: z.string().describe('Todo ID'),
      workspaceFolder: z.string().optional().describe('Workspace folder name or path'),
    },
  },
  async ({ todoId, workspaceFolder }) => {
    const root = await resolveRootForCall({ workspaceFolder });
    return getRelations(todoId, root);
  }
);

export const setStatusInputSchema = {
  todoId: z.string().describe('Todo ID'),
  status: z.enum(STATUSES).describe('New status'),
  workspaceFolder: z.string().optional().describe('Workspace folder name or path'),
};

export async function setStatusHandler(args, workspaceRoot) {
  return setTodoStatus(args.todoId, args.status, workspaceRoot);
}

server.registerTool(
  'set_status',
  { description: 'Set the status of a todo', inputSchema: setStatusInputSchema },
  async (args) => {
    const root = await resolveRootForCall(args);
    return setStatusHandler(args, root);
  }
);

server.registerTool(
  'set_priority',
  {
    description: 'Set the priority of a todo',
    inputSchema: {
      todoId: z.string().describe('Todo ID'),
      priority: z.enum(['p1', 'p2', 'p3']).describe('New priority'),
      workspaceFolder: z.string().optional().describe('Workspace folder name or path'),
    },
  },
  async ({ todoId, priority, workspaceFolder }) => {
    const root = await resolveRootForCall({ workspaceFolder });
    return setTodoPriority(todoId, priority, root);
  }
);

server.registerTool(
  'set_group',
  {
    description: 'Set or clear the group of a todo',
    inputSchema: {
      todoId: z.string().describe('Todo ID'),
      group: z.string().describe('Group name (empty string to clear)'),
      workspaceFolder: z.string().optional().describe('Workspace folder name or path'),
    },
  },
  async ({ todoId, group, workspaceFolder }) => {
    const root = await resolveRootForCall({ workspaceFolder });
    return setTodoGroup(todoId, group, root);
  }
);

server.registerTool(
  'toggle_criterion',
  {
    description: 'Mark an acceptance criterion as met or unmet',
    inputSchema: {
      todoId: z.string().describe('Todo ID'),
      criterionIndex: z.number().int().min(0).describe('Criterion index (0-based)'),
      met: z.boolean().describe('Whether the criterion is met'),
      workspaceFolder: z.string().optional().describe('Workspace folder name or path'),
    },
  },
  async ({ todoId, criterionIndex, met, workspaceFolder }) => {
    const root = await resolveRootForCall({ workspaceFolder });
    return setCriterionMet(todoId, criterionIndex, met, root);
  }
);

server.registerTool(
  'get_todo_file',
  {
    description: 'Get the filesystem path of a todo file',
    inputSchema: {
      todoId: z.string().describe('Todo ID'),
      workspaceFolder: z.string().optional().describe('Workspace folder name or path'),
    },
  },
  async ({ todoId, workspaceFolder }) => {
    const root = await resolveRootForCall({ workspaceFolder });
    const filePath = findTodoFile(todoId, root);
    return filePath ? { path: filePath } : { error: 'Todo not found' };
  }
);

server.registerTool(
  'get_problems',
  {
    description: 'Get diagnostic problems for a path or workspace folder (read-only)',
    inputSchema: getProblemsInputSchema(),
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const result = await getProblemsHandler(await diagnosticsEndpoint(), args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

// Only serve over stdio when run directly; tests import the handlers without
// opening a transport.
if (import.meta.main) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agendo MCP server running');
}
