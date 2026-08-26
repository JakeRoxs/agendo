import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { Command } from "../commands";
import type { ConfigService } from "./configService";
import type { FilterService } from "./filterService";
import type { StatusService } from "./statusService";
import { TODO_STATUSES, type Todo, type TodoStatus } from "./todoModel";
import type { DependencyGraph, TodoRepository } from "./todoRepository";

const STATUS_LABEL: Record<TodoStatus, string> = {
  pending: "Pending",
  ready: "Ready",
  backlogged: "Backlog",
  complete: "Complete",
  cancelled: "Cancelled",
};

const STATUS_ICON: Record<TodoStatus, string> = {
  pending: "circle-outline",
  ready: "play-circle",
  backlogged: "archive",
  complete: "pass-filled",
  cancelled: "circle-slash",
};

export interface BoardTodo {
  id: string;
  title: string;
  status: TodoStatus;
  priority: Todo["priority"];
  group?: string;
  tags: string[];
  blocked: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface BoardColumn {
  status: TodoStatus;
  label: string;
  icon: string;
  todos: BoardTodo[];
}

export interface BoardSnapshot {
  columns: BoardColumn[];
  hiddenStatuses: TodoStatus[];
}

const BOARD_HIDDEN_STATUSES_KEY = "agendo.board.hiddenStatuses";
const BOARD_STATUS_ORDER_KEY = "agendo.board.statusOrder";

export function normalizeBoardStatusOrder(order: readonly TodoStatus[]): TodoStatus[] {
  return [...new Set([...order, ...TODO_STATUSES])].filter((status) =>
    TODO_STATUSES.includes(status),
  );
}

export function buildBoardSnapshot(
  todos: readonly Todo[],
  dependencyGraph: DependencyGraph,
  filter: FilterService,
): BoardSnapshot {
  const visibleTodos = todos.filter((todo) => filter.matches(todo, dependencyGraph));
  const columns = TODO_STATUSES.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    icon: STATUS_ICON[status],
    todos: visibleTodos
      .filter((todo) => todo.status === status)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((todo) => ({
        id: todo.id,
        title: todo.title,
        status: todo.status,
        priority: todo.priority,
        group: todo.group,
        tags: todo.tags,
        blocked: Boolean(dependencyGraph.blockedBy.get(todo.id)?.length),
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
      })),
  }));

  return { columns, hiddenStatuses: [] };
}

interface BoardMessage {
  type: "ready" | "open" | "setStatus" | "hideStatus" | "showStatus" | "reorderStatuses";
  todoId?: string;
  status?: TodoStatus;
  statuses?: TodoStatus[];
}

/** Renders the file-backed todo board in a reusable editor webview panel. */
export class BoardViewProvider implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly repositorySubscription: vscode.Disposable;

  constructor(
    private readonly repository: TodoRepository,
    private readonly filter: FilterService,
    private readonly status: StatusService,
    private readonly config: ConfigService,
    private readonly state: vscode.Memento,
  ) {
    this.repositorySubscription = repository.onDidChange(() => this.sendSnapshot());
  }

  open(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "agendo.board",
      "Agendo Board",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel = panel;
    panel.webview.html = this.getHtml();
    panel.webview.onDidReceiveMessage((message: BoardMessage) => this.handleMessage(message));
    panel.onDidDispose(() => {
      if (this.panel === panel) {
        this.panel = undefined;
      }
    });
    this.sendSnapshot();
  }

  dispose(): void {
    this.repositorySubscription.dispose();
  }

  private async handleMessage(message: BoardMessage): Promise<void> {
    if (message.type === "ready") {
      this.sendSnapshot();
      return;
    }

    if (await this.handleLayoutMessage(message)) {
      return;
    }

    const todo = message.todoId
      ? this.repository.getTodos().find((candidate) => candidate.id === message.todoId)
      : undefined;
    if (!todo) {
      return;
    }

    if (message.type === "open") {
      await vscode.commands.executeCommand(
        this.config.openInPreview ? Command.OpenPreview : "vscode.open",
        this.config.openInPreview ? { kind: "todo", todo } : todo.uri,
      );
      return;
    }

    if (message.type === "setStatus" && message.status) {
      try {
        await this.status.setStatus(todo, message.status);
        await this.repository.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to move todo: ${error}`);
      }
    }
  }

  private async handleLayoutMessage(message: BoardMessage): Promise<boolean> {
    if (message.type === "hideStatus" && message.status) {
      const hiddenStatuses = new Set(this.getHiddenStatuses());
      hiddenStatuses.add(message.status);
      await this.state.update(BOARD_HIDDEN_STATUSES_KEY, [...hiddenStatuses]);
    } else if (message.type === "showStatus" && message.status) {
      const hiddenStatuses = this.getHiddenStatuses().filter((status) => status !== message.status);
      await this.state.update(BOARD_HIDDEN_STATUSES_KEY, hiddenStatuses);
    } else if (message.type === "reorderStatuses" && message.statuses) {
      await this.state.update(BOARD_STATUS_ORDER_KEY, normalizeBoardStatusOrder(message.statuses));
    } else {
      return false;
    }

    this.sendSnapshot();
    return true;
  }

  private sendSnapshot(): void {
    if (!this.panel) {
      return;
    }
    const snapshot = buildBoardSnapshot(
      this.repository.getTodos(),
      this.repository.getDependencyGraph(),
      this.filter,
    );
    const hiddenStatuses = this.getHiddenStatuses();
    const hidden = new Set(hiddenStatuses);
    snapshot.columns = normalizeBoardStatusOrder(this.getStatusOrder()).flatMap((status) => {
      const column = snapshot.columns.find((candidate) => candidate.status === status);
      return column && !hidden.has(column.status) ? [column] : [];
    });
    snapshot.hiddenStatuses = hiddenStatuses;

    void this.panel.webview.postMessage({
      type: "snapshot",
      snapshot,
    });
  }

  private getHiddenStatuses(): TodoStatus[] {
    const hiddenStatuses = this.state.get<unknown[]>(BOARD_HIDDEN_STATUSES_KEY, []);
    return hiddenStatuses.filter(
      (status): status is TodoStatus =>
        typeof status === "string" && TODO_STATUSES.includes(status as TodoStatus),
    );
  }

  private getStatusOrder(): TodoStatus[] {
    const order = this.state.get<unknown[]>(BOARD_STATUS_ORDER_KEY, []);
    return normalizeBoardStatusOrder(
      order.filter(
        (status): status is TodoStatus =>
          typeof status === "string" && TODO_STATUSES.includes(status as TodoStatus),
      ),
    );
  }

  private getHtml(): string {
    const nonce = randomBytes(16).toString("hex");
    const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { color-scheme: light dark; }
    body { color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); margin: 0; padding: 12px; }
    .toolbar { align-items: center; display: flex; gap: 6px; min-height: 28px; padding-bottom: 8px; }
    .toolbar-label { color: var(--vscode-descriptionForeground); font-size: 0.85em; }
    button { background: var(--vscode-button-secondaryBackground); border: 0; color: var(--vscode-button-secondaryForeground); cursor: pointer; padding: 4px 8px; }
    button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .board { display: grid; gap: 10px; grid-template-columns: repeat(var(--column-count, 1), minmax(150px, 1fr)); min-width: 780px; }
    .column { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; min-height: 180px; padding: 8px; }
    .column.drop-target { border-color: var(--vscode-focusBorder); background: var(--vscode-list-hoverBackground); }
    .column-header { align-items: center; cursor: grab; display: flex; font-weight: 600; gap: 6px; justify-content: space-between; margin-bottom: 8px; user-select: none; }
    .column-header:active { cursor: grabbing; }
    .column-actions { align-items: center; display: flex; gap: 6px; }
    .hide-column { font-size: 0.8em; }
    .count { color: var(--vscode-descriptionForeground); font-size: 0.9em; font-weight: 400; }
    .card { background: var(--vscode-sideBarSectionHeader-background); border: 1px solid var(--vscode-panel-border); border-left: 3px solid var(--vscode-panel-border); border-radius: 4px; cursor: grab; margin: 6px 0; padding: 8px; }
    .card:active { cursor: grabbing; }
    .card.priority-p1 { border-left-color: var(--vscode-charts-red); }
    .card.priority-p2 { border-left-color: var(--vscode-charts-yellow); }
    .card.priority-p3 { border-left-color: var(--vscode-charts-blue); }
    .card.blocked { box-shadow: inset 0 0 0 1px var(--vscode-charts-red); }
    .card-title { font-weight: 600; }
    .card-meta { color: var(--vscode-descriptionForeground); font-size: 0.85em; margin-top: 5px; }
    .empty { color: var(--vscode-descriptionForeground); font-size: 0.9em; padding: 12px 4px; }
    @media (max-width: 900px) { .board { grid-template-columns: repeat(5, minmax(130px, 1fr)); } }
  </style>
</head>
<body>
  <div id="toolbar" class="toolbar" aria-label="Board controls"></div>
  <main id="board" class="board" aria-label="Agendo task board"></main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const toolbar = document.getElementById("toolbar");
    const board = document.getElementById("board");
    let draggedTodoId;
    let draggedStatus;

    function renderToolbar(snapshot) {
      toolbar.replaceChildren();
      if (!snapshot.hiddenStatuses.length) return;
      const label = document.createElement("span");
      label.className = "toolbar-label";
      label.textContent = "Hidden:";
      toolbar.append(label);
      for (const status of snapshot.hiddenStatuses) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Show " + status;
        button.addEventListener("click", () => vscode.postMessage({ type: "showStatus", status }));
        toolbar.append(button);
      }
    }

    function render(snapshot) {
      renderToolbar(snapshot);
      board.style.setProperty("--column-count", String(Math.max(snapshot.columns.length, 1)));
      board.replaceChildren();
      for (const column of snapshot.columns) {
        const columnElement = document.createElement("section");
        columnElement.className = "column";
        columnElement.dataset.status = column.status;
        columnElement.addEventListener("dragover", (event) => {
          event.preventDefault();
          columnElement.classList.add("drop-target");
        });
        columnElement.addEventListener("dragleave", () => columnElement.classList.remove("drop-target"));
        columnElement.addEventListener("drop", (event) => {
          event.preventDefault();
          columnElement.classList.remove("drop-target");
          if (draggedTodoId) {
            vscode.postMessage({ type: "setStatus", todoId: draggedTodoId, status: column.status });
          } else if (draggedStatus && draggedStatus !== column.status) {
            const statuses = Array.from(board.children).map((element) => element.dataset.status);
            const fromIndex = statuses.indexOf(draggedStatus);
            const toIndex = statuses.indexOf(column.status);
            statuses.splice(fromIndex, 1);
            statuses.splice(toIndex, 0, draggedStatus);
            vscode.postMessage({ type: "reorderStatuses", statuses });
          }
          draggedStatus = undefined;
        });

        const header = document.createElement("div");
        header.className = "column-header";
        header.draggable = true;
        header.addEventListener("dragstart", () => { draggedStatus = column.status; });
        header.addEventListener("dragend", () => { draggedStatus = undefined; });
        const label = document.createElement("span");
        label.textContent = column.label;
        const actions = document.createElement("span");
        actions.className = "column-actions";
        const count = document.createElement("span");
        count.className = "count";
        count.textContent = String(column.todos.length);
        const hide = document.createElement("button");
        hide.className = "hide-column";
        hide.type = "button";
        hide.textContent = "Hide";
        hide.addEventListener("click", (event) => {
          event.stopPropagation();
          vscode.postMessage({ type: "hideStatus", status: column.status });
        });
        actions.append(count, hide);
        header.append(label, actions);
        columnElement.append(header);

        if (!column.todos.length) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = "No tasks";
          columnElement.append(empty);
        }

        for (const todo of column.todos) {
          const card = document.createElement("article");
          card.className = ["card", "priority-" + todo.priority, todo.blocked ? "blocked" : ""]
            .filter(Boolean)
            .join(" ");
          card.title = [
            todo.createdAt ? "Created " + new Date(todo.createdAt).toLocaleString() : undefined,
            todo.updatedAt ? "Modified " + new Date(todo.updatedAt).toLocaleString() : undefined,
          ]
            .filter(Boolean)
            .join("\\n") || "File timestamps unavailable";
          card.draggable = true;
          card.addEventListener("dragstart", (event) => {
            event.stopPropagation();
            draggedTodoId = todo.id;
          });
          card.addEventListener("dragend", () => { draggedTodoId = undefined; });
          card.addEventListener("click", () => vscode.postMessage({ type: "open", todoId: todo.id }));
          const title = document.createElement("div");
          title.className = "card-title";
          title.textContent = todo.title;
          const meta = document.createElement("div");
          meta.className = "card-meta";
          meta.textContent = [todo.id, todo.priority.toUpperCase(), todo.group, todo.blocked ? "Blocked" : undefined, ...todo.tags].filter(Boolean).join(" · ");
          card.append(title, meta);
          columnElement.append(card);
        }
        board.append(columnElement);
      }
    }

    window.addEventListener("message", (event) => {
      if (event.data.type === "snapshot") render(event.data.snapshot);
    });
    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
  }
}
