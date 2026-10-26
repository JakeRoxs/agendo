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

const workspaceRoot = resolveWorkspaceRoot(process.cwd());

const server = new McpServer({
  name: 'agendo',
  version: '0.3.0',
});

server.tool(
  'get_todo_context',
  'Get full context for a todo including criteria, dependencies, work log, and scanner evidence',
  { todoId: z.string().describe('Todo ID, e.g. "001" or "sq-123"') },
  async ({ todoId }) => {
    const todo = loadTodo(todoId, workspaceRoot);
    const relations = getRelations(todoId, workspaceRoot);
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

server.tool(
  'list_groups',
  'List all todo groups with member counts',
  {},
  async () => {
    const groups = listGroups(workspaceRoot);
    return groups.map(g => ({
      name: g,
      memberCount: loadGroupTodos(g, workspaceRoot).length,
    }));
  }
);

server.tool(
  'list_group_members',
  'List all todos in a group',
  { groupName: z.string().describe('Group name') },
  async ({ groupName }) => {
    const members = loadGroupTodos(groupName, workspaceRoot);
    return members.map(m => ({
      id: m.id,
      title: m.title,
      status: m.status,
      priority: m.priority,
    }));
  }
);

server.tool(
  'get_dependencies',
  'Get what blocks a todo and what it blocks',
  { todoId: z.string().describe('Todo ID') },
  async ({ todoId }) => {
    return getRelations(todoId, workspaceRoot);
  }
);

server.tool(
  'set_status',
  'Set the status of a todo',
  {
    todoId: z.string().describe('Todo ID'),
    status: z.enum(['pending', 'in-progress', 'ready', 'backlogged', 'complete', 'cancelled']).describe('New status'),
  },
  async ({ todoId, status }) => {
    return setTodoStatus(todoId, status, workspaceRoot);
  }
);

server.tool(
  'set_priority',
  'Set the priority of a todo',
  {
    todoId: z.string().describe('Todo ID'),
    priority: z.enum(['p1', 'p2', 'p3']).describe('New priority'),
  },
  async ({ todoId, priority }) => {
    return setTodoPriority(todoId, priority, workspaceRoot);
  }
);

server.tool(
  'set_group',
  'Set or clear the group of a todo',
  {
    todoId: z.string().describe('Todo ID'),
    group: z.string().describe('Group name (empty string to clear)'),
  },
  async ({ todoId, group }) => {
    return setTodoGroup(todoId, group, workspaceRoot);
  }
);

server.tool(
  'toggle_criterion',
  'Mark an acceptance criterion as met or unmet',
  {
    todoId: z.string().describe('Todo ID'),
    criterionIndex: z.number().int().min(0).describe('Criterion index (0-based)'),
    met: z.boolean().describe('Whether the criterion is met'),
  },
  async ({ todoId, criterionIndex, met }) => {
    return setCriterionMet(todoId, criterionIndex, met, workspaceRoot);
  }
);

server.tool(
  'get_todo_file',
  'Get the filesystem path of a todo file',
  { todoId: z.string().describe('Todo ID') },
  async ({ todoId }) => {
    const filePath = findTodoFile(todoId, workspaceRoot);
    return filePath ? { path: filePath } : { error: 'Todo not found' };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Agendo MCP server running');
