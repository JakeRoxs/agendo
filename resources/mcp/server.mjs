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
import {
  discoverEndpoint,
  collectWorkspaceRegistrations,
  collectRegistrations,
  resolveRootForCall as resolveRootFromRegistrations,
  listLiveBridges,
  isListening,
} from './discovery.mjs';
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
// MCP tools are not broken by a misconfigured environment variable.
function parseKiloParentPid(value = process.env.KILO_PARENT_PID) {
  if (value === undefined || value === '') return undefined;
  if (!/^\d+$/.test(value)) return undefined;
  const pid = Number(value);
  if (!Number.isSafeInteger(pid) || pid <= 1) return undefined;
  return pid;
}

const hostPid = parseKiloParentPid();

/**
 * Resolve the todo root for one MCP invocation. Reads the workspace-folder
 * discovery records, applies the optional `workspaceFolder` binding, and falls
 * back to the standalone CWD root when no editor registration applies. Returns
 * the resolved root, its mode (`workspace` or `manual`), and the selector used.
 */
async function resolveRootForCall(args) {
  const { workspaceFolder } = args;
  const registrations = await collectWorkspaceRegistrations(registryRoot, hostPid);
  const resolved = resolveRootFromRegistrations(registrations, { workspaceFolder, cwd: process.cwd() });
  if (resolved === undefined) {
    return { workspaceRoot: resolveWorkspaceRoot(process.cwd()), rootMode: 'workspace', workspaceFolder: undefined };
  }
  return resolved;
}

async function diagnosticsEndpoint() {
  if (endpoint !== undefined) return endpoint;

  // Kilo supplies the launching window's identity through the inherited
  // KILO_PARENT_PID environment variable. Never require it in user config.
  const hostPid = resolveCallHostPid();

  // The server's CWD is the workspace root for Kilo (Instance.directory); for
  // generic clients it is wherever the MCP client launched the server.
  return discoverEndpoint(registryRoot, { hostPid, cwd: process.cwd() });
}

function resolveCallHostPid() {
  const kiloParentPid = process.env.KILO_PARENT_PID;
  if (kiloParentPid === undefined || kiloParentPid === '') return hostPid;
  const parsed = parseKiloParentPid(kiloParentPid);
  if (parsed === undefined) {
    throw new Error('invalid_input: KILO_PARENT_PID must be a VS Code extension-host PID.');
  }
  return parsed;
}

/**
 * Resolve the diagnostics endpoint for a `get_problems` call.
 *
 * Precedence:
 * 1. `--endpoint` (process-level CLI override) wins outright; `bridgeId` is
 *    rejected when both are present because the semantics would be ambiguous.
 * 2. Explicit `bridgeId`: validated against current registrations and the host
 *    PID (KILO_PARENT_PID). Stale or unknown IDs fail safely with
 *    `invalid_input`; a registration that is no longer listening fails with
 *    `editor_unavailable`. Raw socket paths and PIDs are never exposed.
 * 3. Automatic routing via `discoverEndpoint` (unchanged): sole-endpoint
 *    fallback, CWD identity match, Kilo host-PID filter, otherwise ambiguous.
 */
async function resolveProblemsEndpoint(args) {
  // --endpoint takes precedence; bridgeId is rejected when both are present.
  if (endpoint !== undefined) {
    if (args.bridgeId !== undefined) {
      throw new Error('invalid_input: bridgeId is not allowed when --endpoint is configured');
    }
    return endpoint;
  }

  // Validate KILO_PARENT_PID at call time so an invalid value is reported
  // as invalid_input rather than silently falling through to routing.
  const callHostPid = resolveCallHostPid();

  // Explicit bridge selection: validate ID against registrations and host PID.
  if (args.bridgeId !== undefined) {
    const records = await collectRegistrations(registryRoot);
    const candidates = callHostPid === undefined ? records : records.filter((record) => record.hostPid === callHostPid);
    const record = candidates.find((record) => record.id === args.bridgeId);
    if (!record) {
      throw new Error('invalid_input: bridgeId not found or stale');
    }
    if (!(await isListening(record.endpoint))) {
      throw new Error('editor_unavailable: bridge is not live');
    }
    return record.endpoint;
  }

  // Automatic routing (unchanged).
  return discoverEndpoint(registryRoot, { hostPid: callHostPid, cwd: process.cwd() });
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

/**
 * Register an MCP tool that resolves a todo root from the call arguments and
 * then delegates to a root-aware handler. The handler receives
 * `(args, workspaceRoot, rootMode)` and returns the tool result.
 */
function registerRootTool(server, name, options, handler) {
  server.registerTool(
    name,
    { description: options.description, inputSchema: options.inputSchema },
    async (args) => {
      const { workspaceRoot, rootMode } = await resolveRootForCall(args);
      const result = await handler(args, workspaceRoot, rootMode);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: Array.isArray(result) ? { result } : result,
      };
    }
  );
}

// Handler factories: each receives (args, workspaceRoot, rootMode) and returns
// the MCP tool result. Kept small and focused on a single concern.

function getTodoContextHandler(args, workspaceRoot, rootMode) {
  const todo = loadTodo(args.todoId, workspaceRoot, rootMode);
  const relations = getRelations(args.todoId, workspaceRoot, rootMode);
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

function listGroupsHandler(_args, workspaceRoot, rootMode) {
  const groups = listGroups(workspaceRoot, rootMode);
  return groups.map((g) => ({
    name: g,
    memberCount: loadGroupTodos(g, workspaceRoot, rootMode).length,
  }));
}

function listGroupMembersHandler(args, workspaceRoot, rootMode) {
  const members = loadGroupTodos(args.groupName, workspaceRoot, rootMode);
  return members.map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    priority: m.priority,
  }));
}

function getDependenciesHandler(args, workspaceRoot, rootMode) {
  return getRelations(args.todoId, workspaceRoot, rootMode);
}

function setPriorityHandler(args, workspaceRoot, rootMode) {
  return setTodoPriority(args.todoId, args.priority, workspaceRoot, rootMode);
}

function setGroupHandler(args, workspaceRoot, rootMode) {
  return setTodoGroup(args.todoId, args.group, workspaceRoot, rootMode);
}

function toggleCriterionHandler(args, workspaceRoot, rootMode) {
  return setCriterionMet(args.todoId, args.criterionIndex, args.met, workspaceRoot, rootMode);
}

function getTodoFileHandler(args, workspaceRoot, rootMode) {
  const filePath = findTodoFile(args.todoId, workspaceRoot, rootMode);
  return filePath ? { path: filePath } : { error: 'Todo not found' };
}

const server = new McpServer({
  name: 'agendo',
  version: '0.3.5',
});

registerRootTool(server, 'get_todo_context',
  {
    description: 'Get full context for a todo including criteria, dependencies, work log, and scanner evidence. `workspaceFolder` selects a registered todo root (a workspace folder or a manually added root) by name or path.',
    inputSchema: {
      todoId: z.string().describe('Todo ID, e.g. "001" or "sq-123"'),
      workspaceFolder: z.string().optional().describe('Registered todo root name or path'),
    },
  },
  getTodoContextHandler
);

registerRootTool(server, 'list_groups',
  {
    description: 'List all todo groups with member counts. `workspaceFolder` selects a registered todo root by name or path.',
    inputSchema: {
      workspaceFolder: z.string().optional().describe('Registered todo root name or path'),
    },
  },
  listGroupsHandler
);

registerRootTool(server, 'list_group_members',
  {
    description: 'List all todos in a group. `workspaceFolder` selects a registered todo root by name or path.',
    inputSchema: {
      groupName: z.string().describe('Group name'),
      workspaceFolder: z.string().optional().describe('Registered todo root name or path'),
    },
  },
  listGroupMembersHandler
);

registerRootTool(server, 'get_dependencies',
  {
    description: 'Get what blocks a todo and what it blocks. `workspaceFolder` selects a registered todo root by name or path.',
    inputSchema: {
      todoId: z.string().describe('Todo ID'),
      workspaceFolder: z.string().optional().describe('Registered todo root name or path'),
    },
  },
  getDependenciesHandler
);

export const setStatusInputSchema = {
  todoId: z.string().describe('Todo ID'),
  status: z.enum(STATUSES).describe('New status'),
  workspaceFolder: z.string().optional().describe('Workspace folder name or path'),
};

export async function setStatusHandler(args, workspaceRoot, rootMode = "workspace") {
  return setTodoStatus(args.todoId, args.status, workspaceRoot, rootMode);
}

registerRootTool(server, 'set_status',
  {
    description: 'Set the status of a todo. `workspaceFolder` selects a registered todo root by name or path.',
    inputSchema: setStatusInputSchema,
  },
  (args, workspaceRoot, rootMode) => setStatusHandler(args, workspaceRoot, rootMode)
);

registerRootTool(server, 'set_priority',
  {
    description: 'Set the priority of a todo. `workspaceFolder` selects a registered todo root by name or path.',
    inputSchema: {
      todoId: z.string().describe('Todo ID'),
      priority: z.enum(['p1', 'p2', 'p3']).describe('New priority'),
      workspaceFolder: z.string().optional().describe('Registered todo root name or path'),
    },
  },
  setPriorityHandler
);

registerRootTool(server, 'set_group',
  {
    description: 'Set or clear the group of a todo. `workspaceFolder` selects a registered todo root by name or path.',
    inputSchema: {
      todoId: z.string().describe('Todo ID'),
      group: z.string().describe('Group name (empty string to clear)'),
      workspaceFolder: z.string().optional().describe('Registered todo root name or path'),
    },
  },
  setGroupHandler
);

registerRootTool(server, 'toggle_criterion',
  {
    description: 'Mark an acceptance criterion as met or unmet. `workspaceFolder` selects a registered todo root by name or path.',
    inputSchema: {
      todoId: z.string().describe('Todo ID'),
      criterionIndex: z.number().int().min(0).describe('Criterion index (0-based)'),
      met: z.boolean().describe('Whether the criterion is met'),
      workspaceFolder: z.string().optional().describe('Registered todo root name or path'),
    },
  },
  toggleCriterionHandler
);

registerRootTool(server, 'get_todo_file',
  {
    description: 'Get the filesystem path of a todo. `workspaceFolder` selects a registered todo root by name or path.',
    inputSchema: {
      todoId: z.string().describe('Todo ID'),
      workspaceFolder: z.string().optional().describe('Registered todo root name or path'),
    },
  },
  getTodoFileHandler
);

server.registerTool(
  'get_problems',
  {
    description: 'Get diagnostic problems for a path or workspace folder (read-only)',
    inputSchema: getProblemsInputSchema(),
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const endpoint = await resolveProblemsEndpoint(args);
    const result = await getProblemsHandler(endpoint, args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

server.registerTool(
  'list_diagnostic_bridges',
  {
    description: 'List live VS Code diagnostics bridges selectable for get_problems. Each entry has an opaque registration-scoped ID plus workspace and label details. Raw endpoint paths and PIDs are not exposed. IDs may change after restart.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const bridges = await listLiveBridges(registryRoot, { hostPid: resolveCallHostPid() });
    return {
      content: [{ type: 'text', text: JSON.stringify(bridges, null, 2) }],
      structuredContent: { bridges },
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
