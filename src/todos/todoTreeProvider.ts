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

interface GroupNode {
  kind: "group";
  status: TodoStatus;
  group: string;
  todos: Todo[];
}

interface TodoNode {
  kind: "todo";
  todo: Todo;
}

type TreeNode = StatusNode | PriorityNode | GroupNode | TodoNode;

export function getTreeNodeKey(node: TreeNode | { id?: string } | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  const maybeId =
    typeof (node as { id?: string }).id === "string" ? (node as { id: string }).id : undefined;
  if (
    maybeId &&
    (maybeId.startsWith("status:") ||
      maybeId.startsWith("priority:") ||
      maybeId.startsWith("group:"))
  ) {
    return maybeId;
  }

  if ("kind" in node) {
    switch (node.kind) {
      case "status":
        return `status:${node.status}`;
      case "priority":
        return `priority:${node.status}:${node.priority}`;
      case "group":
        return `group:${node.status}:${node.group}`;
      default:
        return undefined;
    }
  }

  return undefined;
}

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
    const dependencyGraph = this.repository.getDependencyGraph();
    return this.repository.getTodos().filter((todo) => this.filter.matches(todo, dependencyGraph));
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    switch (node.kind) {
      case "status":
        return this.statusItem(node);
      case "priority":
        return this.priorityItem(node);
      case "group":
        return this.groupItem(node);
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
      const grouped = inStatus.filter((t) => t.group);
      const ungrouped = inStatus.filter((t) => !t.group);

      if (grouped.length > 0) {
        const groups = [
          ...new Set(
            grouped.map((t) => t.group).filter((group): group is string => Boolean(group)),
          ),
        ].sort((left, right) => left.localeCompare(right));
        const groupNodes: GroupNode[] = groups.map((group) => ({
          kind: "group",
          status: node.status,
          group,
          todos: grouped.filter((t) => t.group === group).sort((a, b) => a.id.localeCompare(b.id)),
        }));
        const priorityNodes: PriorityNode[] = TODO_PRIORITIES.filter((priority) =>
          ungrouped.some((t) => t.priority === priority),
        ).map((priority) => ({
          kind: "priority",
          status: node.status,
          priority,
          todos: ungrouped
            .filter((t) => t.priority === priority)
            .sort((a, b) => a.id.localeCompare(b.id)),
        }));
        return [...groupNodes, ...priorityNodes];
      }

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

    if (node.kind === "group") {
      return node.todos.map((todo) => ({ kind: "todo", todo }));
    }

    if (node.kind === "priority") {
      return node.todos.map((todo) => ({ kind: "todo", todo }));
    }

    return [];
  }

  private statusItem(node: StatusNode): vscode.TreeItem {
    const nodeKey = getTreeNodeKey(node);
    const isCollapsed = nodeKey ? this.treeState.isCollapsed(nodeKey) : false;
    const item = new vscode.TreeItem(
      `${STATUS_LABEL[node.status]} (${node.count})`,
      isCollapsed
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded,
    );
    item.iconPath = new vscode.ThemeIcon(STATUS_ICON[node.status]);
    item.contextValue = "statusGroup";
    item.id = nodeKey ?? undefined;
    return item;
  }

  private priorityItem(node: PriorityNode): vscode.TreeItem {
    const nodeKey = getTreeNodeKey(node);
    const isCollapsed = nodeKey ? this.treeState.isCollapsed(nodeKey) : false;
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
    item.id = nodeKey ?? undefined;
    return item;
  }

  private groupItem(node: GroupNode): vscode.TreeItem {
    const nodeKey = getTreeNodeKey(node);
    const isCollapsed = nodeKey ? this.treeState.isCollapsed(nodeKey) : false;
    const item = new vscode.TreeItem(
      `Group: ${node.group} (${node.todos.length})`,
      isCollapsed
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded,
    );
    item.iconPath = new vscode.ThemeIcon("symbol-class");
    item.contextValue = "groupGroup";
    item.id = nodeKey ?? undefined;
    return item;
  }

  private todoItem(node: TodoNode): vscode.TreeItem {
    const { todo } = node;
    const incompleteDependencies =
      this.repository.getDependencyGraph().blockedBy.get(todo.id) ?? [];
    const isBlockedFlag = incompleteDependencies.length > 0;
    const item = new vscode.TreeItem(
      `${todo.id} · ${todo.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    const description = [
      todo.key,
      todo.epic ? "epic" : todo.tags.join(", "),
      isBlockedFlag ? "blocked" : undefined,
    ].filter((value): value is string => Boolean(value));
    item.description = description.join(" · ");
    item.resourceUri = todo.uri;
    item.contextValue = isBlockedFlag ? "todoItemBlocked" : "todoItem";
    const icon = todo.epic ? "type-hierarchy" : isBlockedFlag ? "circle-slash" : "note";
    item.iconPath = new vscode.ThemeIcon(
      icon,
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
    if (incompleteDependencies.length) {
      tooltip.appendMarkdown(`\n> **Blocked by:** ${incompleteDependencies.join(", ")}\n`);
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
