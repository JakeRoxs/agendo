import * as vscode from "vscode";
import type { LinkService } from "./linkService";
import type { StatusService } from "./statusService";
import {
  TODO_PRIORITIES,
  TODO_STATUSES,
  type Todo,
  type TodoPriority,
  type TodoStatus,
} from "./todoModel";
import type { TodoRepository } from "./todoRepository";

const GROUP_MAX_LENGTH = 200;

interface CanvasHostActionsOptions {
  repository: TodoRepository;
  status: StatusService;
  links?: LinkService;
}

export interface CanvasHostActions {
  assertWritable(todoId: string): Promise<void>;
  setStatus(todoId: string, newStatus: unknown): Promise<void>;
  setPriority(todoId: string, newPriority: unknown): Promise<void>;
  setGroup(todoId: string, newGroup: unknown): Promise<void>;
}

export function createCanvasHostActions(options: CanvasHostActionsOptions): CanvasHostActions {
  const { repository, status, links } = options;

  function assertTrusted(): void {
    if (!vscode.workspace.isTrusted) {
      throw new Error("Workspace must be trusted to modify todos");
    }
  }

  function findTodo(id: string): Todo | undefined {
    const all = repository.getTodos();
    const matches = all.filter((todo) => todo.id === id);
    if (matches.length === 0) {
      return undefined;
    }
    if (matches.length > 1) {
      throw new Error(`Ambiguous todo ID: ${id} matches ${matches.length} todos`);
    }
    return matches[0];
  }

  function assertIdValid(id: string): void {
    const idRe = /^(?:(?:cql|sq)-)?\d{3,}$/;
    if (!idRe.test(id)) {
      throw new Error(`Invalid todo ID: ${id}`);
    }
  }

  function validateStatus(raw: unknown): TodoStatus {
    if (typeof raw !== "string" || !TODO_STATUSES.includes(raw as TodoStatus)) {
      throw new Error(`Invalid status: ${String(raw)}`);
    }
    return raw as TodoStatus;
  }

  function validatePriority(raw: unknown): TodoPriority {
    if (typeof raw !== "string" || !TODO_PRIORITIES.includes(raw as TodoPriority)) {
      throw new Error(`Invalid priority: ${String(raw)}`);
    }
    return raw as TodoPriority;
  }

  function validateGroup(raw: unknown): string | undefined {
    if (typeof raw !== "string") {
      throw new Error("Group must be a string");
    }
    if (raw.length > GROUP_MAX_LENGTH) {
      throw new Error(`Group must be at most ${GROUP_MAX_LENGTH} characters`);
    }
    if (/[\r\n\0]/.test(raw)) {
      throw new Error("Group must be a single line");
    }
    const trimmed = raw.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }

  function assertWritable(todo: Todo): void {
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.toString() === todo.uri.toString() && doc.isDirty) {
        throw new Error(`Todo file has unsaved changes: ${todo.fileName}`);
      }
    }
  }

  async function refreshAfter(): Promise<void> {
    try {
      await repository.refresh();
    } catch {
      // Best-effort refresh; do not fail the operation on refresh errors.
    }
  }

  async function execute<T>(
    id: string,
    raw: unknown,
    validate: (raw: unknown) => T,
    write: (todo: Todo, value: T) => Promise<vscode.Uri | undefined>,
  ): Promise<void> {
    assertTrusted();
    assertIdValid(id);

    await repository.refresh();
    const todo = findTodo(id);
    if (!todo) {
      throw new Error(`Todo not found: ${id}`);
    }

    const value = validate(raw);
    const oldFileName = todo.fileName;

    try {
      assertWritable(todo);
      const resultUri = await write(todo, value);
      if (resultUri && links) {
        await links.warnOnBrokenReferences(oldFileName, resultUri);
      }
    } finally {
      await refreshAfter();
    }
  }

  return {
    async assertWritable(todoId: string): Promise<void> {
      assertTrusted();
      assertIdValid(todoId);
      await repository.refresh();
      const todo = findTodo(todoId);
      if (!todo) {
        throw new Error(`Todo not found: ${todoId}`);
      }
      assertWritable(todo);
    },

    setStatus: (todoId: string, newStatus: unknown) =>
      execute(todoId, newStatus, validateStatus, (todo, s) => status.setStatus(todo, s)),

    setPriority: (todoId: string, newPriority: unknown) =>
      execute(todoId, newPriority, validatePriority, (todo, p) => status.setPriority(todo, p)),

    setGroup: (todoId: string, newGroup: unknown) =>
      execute(todoId, newGroup, validateGroup, (todo, g) => status.setGroup(todo, g)),
  };
}
