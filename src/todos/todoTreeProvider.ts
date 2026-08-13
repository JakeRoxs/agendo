import * as vscode from "vscode";
import { Command } from "../commands";
import type { ConfigService } from "./configService";
import type { FilterService } from "./filterService";
import { TODO_PRIORITIES, type Todo, type TodoPriority, type TodoStatus } from "./todoModel";
import type { TodoRepository } from "./todoRepository";
import type { TreeStateService } from "./treeStateService";

/** Display order and labels for status groups. */
const STATUS_ORDER: TodoStatus[] = ["ready", "pending", "backlogged", "complete", "cancelled"];

const STATUS_LABEL: Record<TodoStatus, string> = {
  ready: "Ready",
  pending: "Pending",
  backlogged: "Backlogged",
  complete: "Complete",
  cancelled: "Cancelled",
};

const STATUS_ICON: Record<TodoStatus, string> = {
  ready: "play-circle",
  pending: "circle-outline",
  backlogged: "archive",
  complete: "pass-filled",
  cancelled: "circle-slash",
};

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  p1: "P1 - High",
  p2: "P2 - Medium",
  p3: "P3 - Low",
};

const PRIORITY_COLOR: Record<TodoPriority, string> = {
  p1: "charts.red",
  p2: "charts.yellow",
  p3: "charts.blue",
};

interface StatusNode {
  kind: "status";
  status: TodoStatus;
  count: number;
}

interface PriorityNode {
  kind: "priority";
  status: TodoStatus;
  priority: TodoPriority;
  todos: Todo[];
}

interface TodoNode {
  kind: "todo";
  todo: Todo;
}

type TreeNode = StatusNode | PriorityNode | TodoNode;

/** Groups todos by status, then priority, then leaf todo items. */
export class TodoTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(
    private readonly repository: TodoRepository,
    private readonly filter: FilterService,
    private readonly config: ConfigService,
    private readonly treeState: TreeStateService,
  ) {
    this.repository.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  private visibleTodos(): Todo[] {
    return this.repository.getTodos().filter((todo) => this.filter.matches(todo));
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    switch (node.kind) {
      case "status":
        return this.statusItem(node);
      case "priority":
        return this.priorityItem(node);
      case "todo":
        return this.todoItem(node);
    }
  }

  getChildren(node?: TreeNode): TreeNode[] {
    const todos = this.visibleTodos();

    if (!node) {
      return STATUS_ORDER.filter((status) => todos.some((t) => t.status === status)).map(
        (status) => ({
          kind: "status",
          status,
          count: todos.filter((t) => t.status === status).length,
        }),
      );
    }

    if (node.kind === "status") {
      const inStatus = todos.filter((t) => t.status === node.status);
      return TODO_PRIORITIES.filter((priority) =>
        inStatus.some((t) => t.priority === priority),
      ).map((priority) => ({
        kind: "priority",
        status: node.status,
        priority,
        todos: inStatus
          .filter((t) => t.priority === priority)
          .sort((a, b) => a.id.localeCompare(b.id)),
      }));
    }

    if (node.kind === "priority") {
      return node.todos.map((todo) => ({ kind: "todo", todo }));
    }

    return [];
  }

  private statusItem(node: StatusNode): vscode.TreeItem {
    const nodeKey = `status:${node.status}`;
    const isCollapsed = this.treeState.isCollapsed(nodeKey);
    const item = new vscode.TreeItem(
      `${STATUS_LABEL[node.status]} (${node.count})`,
      isCollapsed
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded,
    );
    item.iconPath = new vscode.ThemeIcon(STATUS_ICON[node.status]);
    item.contextValue = "statusGroup";
    item.id = nodeKey;
    return item;
  }

  private priorityItem(node: PriorityNode): vscode.TreeItem {
    const nodeKey = `priority:${node.status}:${node.priority}`;
    const isCollapsed = this.treeState.isCollapsed(nodeKey);
    const item = new vscode.TreeItem(
      `${PRIORITY_LABEL[node.priority]} (${node.todos.length})`,
      isCollapsed
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded,
    );
    item.iconPath = new vscode.ThemeIcon(
      "circle-filled",
      new vscode.ThemeColor(PRIORITY_COLOR[node.priority]),
    );
    item.contextValue = "priorityGroup";
    item.id = nodeKey;
    return item;
  }

  private todoItem(node: TodoNode): vscode.TreeItem {
    const { todo } = node;
    const item = new vscode.TreeItem(
      `${todo.id} · ${todo.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    const description = [todo.key, todo.epic ? "epic" : todo.tags.join(", ")].filter(
      (value): value is string => Boolean(value),
    );
    item.description = description.join(" · ");
    item.resourceUri = todo.uri;
    item.contextValue = "todoItem";
    item.iconPath = new vscode.ThemeIcon(
      todo.epic ? "type-hierarchy" : "note",
      new vscode.ThemeColor(PRIORITY_COLOR[todo.priority]),
    );

    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${todo.id} · ${todo.title}**\n\n`);
    tooltip.appendMarkdown(`- Status: \`${todo.status}\`\n`);
    tooltip.appendMarkdown(`- Priority: \`${todo.priority}\`\n`);
    if (todo.tags.length) {
      tooltip.appendMarkdown(`- Tags: ${todo.tags.join(", ")}\n`);
    }
    if (todo.key) {
      tooltip.appendMarkdown(`- Key: \`${todo.key}\`\n`);
    }
    if (todo.dependencies.length) {
      tooltip.appendMarkdown(`- Depends on: ${todo.dependencies.join(", ")}\n`);
    }
    item.tooltip = tooltip;

    item.command = {
      command: this.config.openInPreview ? Command.OpenPreview : "vscode.open",
      title: "Open Todo",
      arguments: this.config.openInPreview ? [node] : [todo.uri],
    };
    return item;
  }
}

export type { TodoNode, TreeNode };
