import * as vscode from "vscode";
import { Todo, TodoPriority, TodoStatus } from "./todoModel";

/** Active filter/search criteria applied to the tree. */
export interface TodoFilter {
    statuses?: TodoStatus[];
    priorities?: TodoPriority[];
    tag?: string;
    text?: string;
}

const STATE_KEY = "file-todos.filter";

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
        const { statuses, priorities, tag, text } = this.filter;
        return Boolean(
            (statuses && statuses.length) ||
                (priorities && priorities.length) ||
                (tag && tag.length) ||
                (text && text.length)
        );
    }

    async set(filter: TodoFilter): Promise<void> {
        this.filter = filter;
        await this.state.update(STATE_KEY, filter);
    }

    async clear(): Promise<void> {
        await this.set({});
    }

    /** True when the given todo passes the current filter. */
    matches(todo: Todo): boolean {
        const { statuses, priorities, tag, text } = this.filter;

        if (statuses && statuses.length && !statuses.includes(todo.status)) {
            return false;
        }
        if (priorities && priorities.length && !priorities.includes(todo.priority)) {
            return false;
        }
        if (tag && tag.length && !todo.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
            return false;
        }
        if (text && text.length) {
            const haystack = [
                todo.id,
                todo.title,
                todo.description,
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
        return true;
    }
}
