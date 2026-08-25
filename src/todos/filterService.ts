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

function matchesText(todo: Todo, text: string): boolean {
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
  return haystack.includes(text.toLowerCase());
}

function matchesBlocked(todo: Todo, blocked: boolean, dependencyGraph?: DependencyGraph): boolean {
  const isBlocked = Boolean(dependencyGraph?.blockedBy.get(todo.id)?.length);
  return isBlocked === blocked;
}

function matchesBlocking(todo: Todo, blocking: string, dependencyGraph?: DependencyGraph): boolean {
  return todo.id === blocking && Boolean(dependencyGraph?.blocking.get(todo.id)?.length);
}

function matchesStatuses(todo: Todo, statuses?: TodoStatus[]): boolean {
  return !statuses?.length || statuses.includes(todo.status);
}

function matchesPriorities(todo: Todo, priorities?: TodoPriority[]): boolean {
  return !priorities?.length || priorities.includes(todo.priority);
}

function matchesTag(todo: Todo, tag?: string): boolean {
  return !tag?.length || todo.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
}

function matchesDependsOn(todo: Todo, dependsOn?: string): boolean {
  return !dependsOn?.length || todo.dependencies.includes(dependsOn);
}

function matchesGroup(todo: Todo, group?: string): boolean {
  return !group?.length || todo.group === group;
}

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

    const checks = [
      () => matchesStatuses(todo, statuses),
      () => matchesPriorities(todo, priorities),
      () => matchesTag(todo, tag),
      () => !text?.length || matchesText(todo, text),
      () => blocked === undefined || matchesBlocked(todo, blocked, dependencyGraph),
      () => matchesDependsOn(todo, dependsOn),
      () => !blocking?.length || matchesBlocking(todo, blocking, dependencyGraph),
      () => matchesGroup(todo, group),
    ];
    return checks.every((check) => check());
  }

  async set(filter: TodoFilter): Promise<void> {
    this.filter = filter;
    await this.state.update(STATE_KEY, filter);
  }

  async clear(): Promise<void> {
    await this.set({});
  }
}
