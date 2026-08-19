import type * as vscode from "vscode";
import type { Todo, TodoPriority, TodoStatus } from "./todoModel";
import type { DependencyGraph } from "./todoRepository";

/** Active filter/search criteria applied to the tree. */
export interface TodoFilter {
  statuses?: TodoStatus[];
  priorities?: TodoPriority[];
  tag?: string;
  text?: string;
  /** When set, only show todos that have unmet dependencies. */
  blocked?: boolean;
  /** When set, only show todos that depend on the given ID. */
  dependsOn?: string;
  /** When set, only show todos that are blocked by the given ID. */
  blocking?: string;
  /** When set, only show todos belonging to the given group. */
  group?: string;
}

const STATE_KEY = "agendo.filter";

/** Holds the current filter state and persists it in workspace state. */
export class FilterService {
  private filter: TodoFilter = {};

  constructor(private readonly state: vscode.Memento) {
    this.filter = state.get<TodoFilter>(STATE_KEY) ?? {};
  }

  get current(): TodoFilter {
    return this.filter;
  }

  get isActive(): boolean {
    const { statuses, priorities, tag, text, blocked, dependsOn, blocking, group } = this.filter;
    return Boolean(
      statuses?.length ||
        priorities?.length ||
        tag?.length ||
        text?.length ||
        blocked !== undefined ||
        dependsOn?.length ||
        blocking?.length ||
        group?.length,
    );
  }

  /** True when the given todo passes the current filter. */
  matches(todo: Todo, dependencyGraph?: DependencyGraph): boolean {
    const { statuses, priorities, tag, text, blocked, dependsOn, blocking, group } = this.filter;

    if (statuses?.length && !statuses.includes(todo.status)) {
      return false;
    }
    if (priorities?.length && !priorities.includes(todo.priority)) {
      return false;
    }
    if (tag?.length && !todo.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      return false;
    }
    if (text?.length) {
      const haystack = [
        todo.id,
        todo.title,
        todo.description,
        todo.key ?? "",
        todo.jira ?? "",
        todo.tags.join(" "),
        todo.dependencies.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(text.toLowerCase())) {
        return false;
      }
    }
    if (blocked !== undefined) {
      const isBlocked = Boolean(dependencyGraph?.blockedBy.get(todo.id)?.length);
      if (isBlocked !== blocked) {
        return false;
      }
    }
    if (dependsOn?.length) {
      if (!todo.dependencies.includes(dependsOn)) {
        return false;
      }
    }
    if (blocking?.length) {
      if (todo.id !== blocking || !dependencyGraph?.blocking.get(todo.id)?.length) {
        return false;
      }
    }
    if (group?.length) {
      if (todo.group !== group) {
        return false;
      }
    }
    return true;
  }

  async set(filter: TodoFilter): Promise<void> {
    this.filter = filter;
    await this.state.update(STATE_KEY, filter);
  }

  async clear(): Promise<void> {
    await this.set({});
  }
}
