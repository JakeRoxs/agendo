import * as vscode from "vscode";
import type { BusyIndicator } from "../busyIndicator";
import { Command } from "../commands";
import { get, Settings } from "../configuration";
import type { FilterService } from "./filterService";
import { collisionDetails, findTodoCollisions, type TodoCollision } from "./todoCollisions";
import {
  getTodoSource,
  matchesTodoScope,
  type ScanningSource,
  TODO_PRIORITIES,
  type Todo,
  type TodoPriority,
  type TodoStatus,
  type TodoViewScope,
} from "./todoModel";
import type { TodoRepository } from "./todoRepository";
import type { TreeStateService } from "./treeStateService";

/** Display order and labels for status groups. */
const STATUS_ORDER: TodoStatus[] = [
  "ready",
  "in-progress",
  "pending",
  "backlogged",
  "completed",
  "cancelled",
];

const STATUS_LABEL: Record<TodoStatus, string> = {
  ready: "Ready",
  "in-progress": "In Progress",
  pending: "Pending",
  backlogged: "Backlogged",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_ICON: Record<TodoStatus, string> = {
  ready: "play-circle",
  "in-progress": "pulse",
  pending: "circle-outline",
  backlogged: "archive",
  completed: "pass-filled",
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

/** Sort todos by the active sort setting (date or ID). */
function sortTodos(todos: Todo[], scope: TodoViewScope): Todo[] {
  if (
    get<boolean>(scope === "code-scanning" ? Settings.CodeScanningSortByDate : Settings.SortByDate)
  ) {
    return [...todos].sort((a, b) => {
      const aTime = a.updatedAt ?? 0;
      const bTime = b.updatedAt ?? 0;
      if (bTime !== aTime) {
        return bTime - aTime; // Most recent first
      }
      return a.id.localeCompare(b.id); // Stable tie-break by ID
    });
  }
  return [...todos].sort((a, b) => a.id.localeCompare(b.id));
}

interface DependencyNode {
  kind: "dependency";
  todo: Todo;
  dependents: Todo[];
}

interface StatusNode {
  kind: "status";
  status: TodoStatus;
  count: number;
  source?: ScanningSource;
}

interface PriorityNode {
  kind: "priority";
  status: TodoStatus;
  priority: TodoPriority;
  todos: Todo[];
  source?: ScanningSource;
}

interface GroupNode {
  kind: "group";
  status: TodoStatus;
  group: string;
  todos: Todo[];
  source?: ScanningSource;
}

interface SourceNode {
  kind: "source";
  source: ScanningSource;
  count: number;
}

interface TodoNode {
  kind: "todo";
  todo: Todo;
}

type TreeNode = SourceNode | DependencyNode | StatusNode | PriorityNode | GroupNode | TodoNode;

export function getTreeNodeKey(node: TreeNode | { id?: string } | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  const maybeId =
    typeof (node as { id?: string }).id === "string" ? (node as { id: string }).id : undefined;
  if (
    maybeId &&
    (maybeId.startsWith("source:") ||
      maybeId.startsWith("status:") ||
      maybeId.startsWith("priority:") ||
      maybeId.startsWith("group:") ||
      maybeId.startsWith("dependency:"))
  ) {
    return maybeId;
  }

  if ("kind" in node) {
    const prefix = "source" in node && node.source ? `source:${node.source}:` : "";
    switch (node.kind) {
      case "source":
        return `source:${node.source}`;
      case "dependency":
        return `dependency:${node.todo.id}`;
      case "status":
        return `${prefix}status:${node.status}`;
      case "priority":
        return `${prefix}priority:${node.status}:${node.priority}`;
      case "group":
        return `${prefix}group:${node.status}:${node.group}`;
      default:
        return undefined;
    }
  }

  return undefined;
}

/** Groups todos by status, then priority, then leaf todo items. */
export class TodoTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private collisionSnapshot?: readonly Todo[];
  private readonly collisionsByUri = new Map<string, TodoCollision>();

  private collisionFor(todo: Todo): TodoCollision | undefined {
    const snapshot = this.repository.getTodos();
    if (snapshot !== this.collisionSnapshot) {
      this.collisionSnapshot = snapshot;
      this.collisionsByUri.clear();
      for (const collision of findTodoCollisions(snapshot)) {
        for (const candidate of collision.todos) {
          this.collisionsByUri.set(candidate.uri.toString(), collision);
        }
      }
    }
    return this.collisionsByUri.get(todo.uri.toString());
  }
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private loading = false;
  private hasLoaded = false;

  constructor(
    private readonly repository: TodoRepository,
    private readonly filter: FilterService,
    private readonly treeState: TreeStateService,
    private readonly busy?: BusyIndicator,
    private readonly scope: TodoViewScope = "todos",
  ) {
    this.repository.onDidChange(() => this.refresh());
    this.busy?.onChange(() => this.refresh());
  }

  setLoading(loading: boolean): void {
    this.loading = loading;
    this.refresh();
  }

  isInitialLoading(): boolean {
    return this.loading && !this.hasLoaded;
  }

  markLoaded(): void {
    this.hasLoaded = true;
    this.loading = false;
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  private visibleTodos(): Todo[] {
    const dependencyGraph = this.repository.getDependencyGraph();
    return this.repository
      .getTodos()
      .filter(
        (todo) => matchesTodoScope(todo, this.scope) && this.filter.matches(todo, dependencyGraph),
      );
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    switch (node.kind) {
      case "source": {
        const key = getTreeNodeKey(node);
        const item = new vscode.TreeItem(
          `${node.source === "codeql" ? "CodeQL" : "SonarQube"} (${node.count})`,
          key && this.treeState.isCollapsed(key)
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.Expanded,
        );
        item.id = key;
        item.iconPath = new vscode.ThemeIcon("shield");
        item.contextValue = "sourceGroup";
        return item;
      }
      case "dependency":
        return this.dependencyItem(node);
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

  private statusNodes(todos: Todo[], source?: ScanningSource): TreeNode[] {
    return STATUS_ORDER.filter((status) => todos.some((t) => t.status === status)).map(
      (status) => ({
        kind: "status",
        status,
        count: todos.filter((t) => t.status === status).length,
        ...(source ? { source } : {}),
      }),
    );
  }

  private groupNodes(
    status: string,
    grouped: Todo[],
    ungrouped: Todo[],
    source?: ScanningSource,
  ): TreeNode[] {
    const groups = [
      ...new Set(grouped.map((t) => t.group).filter((group): group is string => Boolean(group))),
    ].sort((a, b) => a.localeCompare(b));
    const groupResults: GroupNode[] = groups.map((group) => ({
      kind: "group",
      status: status as TodoStatus,
      group,
      todos: sortTodos(
        grouped.filter((t) => t.group === group),
        this.scope,
      ),
      ...(source ? { source } : {}),
    }));
    const priorityResults: PriorityNode[] = TODO_PRIORITIES.filter((priority) =>
      ungrouped.some((t) => t.priority === priority),
    ).map((priority) => ({
      kind: "priority",
      status: status as TodoStatus,
      priority,
      todos: sortTodos(
        ungrouped.filter((t) => t.priority === priority),
        this.scope,
      ),
      ...(source ? { source } : {}),
    }));
    return [...groupResults, ...priorityResults];
  }

  private priorityNodes(status: string, todos: Todo[], source?: ScanningSource): TreeNode[] {
    return TODO_PRIORITIES.filter((priority) => todos.some((t) => t.priority === priority)).map(
      (priority) => ({
        kind: "priority",
        status: status as TodoStatus,
        priority,
        todos: sortTodos(
          todos.filter((t) => t.priority === priority),
          this.scope,
        ),
        ...(source ? { source } : {}),
      }),
    );
  }

  private priorityNodesRoot(todos: Todo[]): TreeNode[] {
    return TODO_PRIORITIES.filter((priority) => todos.some((t) => t.priority === priority)).map(
      (priority) => ({
        kind: "priority",
        status: "ready",
        priority,
        todos: sortTodos(
          todos.filter((t) => t.priority === priority),
          this.scope,
        ),
      }),
    );
  }

  private groupNodesRoot(todos: Todo[]): TreeNode[] {
    const groups = new Map<string, Todo[]>();
    for (const todo of todos) {
      const group = todo.group || "Ungrouped";
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)?.push(todo);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, groupTodos]) => ({
        kind: "group" as const,
        status: "ready",
        group: name,
        todos: sortTodos(groupTodos, this.scope),
      }));
  }

  private dependencyNodes(todos: Todo[]): TreeNode[] {
    const dependencyGroups = this.buildDependencyGroups(todos);
    const processedIds = new Set<string>();
    const result: TreeNode[] = [];
    for (const [blockerId, dependents] of dependencyGroups) {
      this.addDependencyNode(result, todos, blockerId, dependents, processedIds);
    }
    for (const todo of todos) {
      if (!processedIds.has(todo.id)) {
        result.push({ kind: "todo", todo });
      }
    }
    return result;
  }

  private buildDependencyGroups(todos: Todo[]): Map<string, Todo[]> {
    const dependencyGroups = new Map<string, Todo[]>();
    for (const todo of todos) {
      if (this.collisionFor(todo)) {
        continue;
      }
      const blockedBy = this.repository.getDependencyGraph().blockedBy.get(todo.id) ?? [];
      if (blockedBy.length === 0) {
        continue;
      }
      const blockerId = blockedBy[0];
      if (!dependencyGroups.has(blockerId)) {
        dependencyGroups.set(blockerId, []);
      }
      dependencyGroups.get(blockerId)?.push(todo);
    }
    return dependencyGroups;
  }

  private addDependencyNode(
    result: TreeNode[],
    todos: Todo[],
    blockerId: string,
    dependents: Todo[],
    processedIds: Set<string>,
  ): void {
    const blocker = todos.find((t) => t.id === blockerId && !this.collisionFor(t));
    const remainingDependents = dependents.filter((todo) => !processedIds.has(todo.id));
    if (!blocker || processedIds.has(blocker.id) || remainingDependents.length === 0) {
      return;
    }
    result.push({
      kind: "dependency",
      todo: blocker,
      dependents: sortTodos(remainingDependents, this.scope),
    });
    processedIds.add(blocker.id);
    for (const dependent of remainingDependents) {
      processedIds.add(dependent.id);
    }
  }

  getChildren(node?: TreeNode): TreeNode[] {
    const todos = this.visibleTodos();
    const groupBy = get<string>(Settings.GroupBy);

    if (!node) {
      return this.getRootChildren(todos, groupBy);
    }

    switch (node.kind) {
      case "source":
        return this.getSourceChildren(todos, node);
      case "status":
        return this.getStatusChildren(todos, node);
      case "dependency":
        return node.dependents.map((todo) => ({ kind: "todo", todo }));
      case "group":
        return node.todos.map((todo) => ({ kind: "todo", todo }));
      case "priority":
        return this.getPriorityChildren(node);
      default:
        return [];
    }
  }

  private getRootChildren(todos: Todo[], groupBy: string): TreeNode[] {
    if (this.scope === "code-scanning" && groupBy === "status") {
      return (["codeql", "sonarqube"] as const).flatMap((source) => {
        const count = todos.filter((todo) => getTodoSource(todo) === source).length;
        return count ? [{ kind: "source" as const, source, count }] : [];
      });
    }
    switch (groupBy) {
      case "priority":
        return this.priorityNodesRoot(todos);
      case "group":
        return this.groupNodesRoot(todos);
      case "none":
        return todos.map((todo) => ({ kind: "todo", todo }));
      default:
        return this.statusNodes(todos);
    }
  }

  private getSourceChildren(todos: Todo[], node: SourceNode): TreeNode[] {
    return this.statusNodes(
      todos.filter((todo) => getTodoSource(todo) === node.source),
      node.source,
    );
  }

  private getStatusChildren(todos: Todo[], node: StatusNode): TreeNode[] {
    const inStatus = todos.filter(
      (t) => t.status === node.status && (!node.source || getTodoSource(t) === node.source),
    );
    const sourceGroup = node.source === "codeql" ? "CodeQL" : "SonarQube";
    const grouped = inStatus.filter((t) => t.group && (!node.source || t.group !== sourceGroup));
    const ungrouped = inStatus.filter(
      (t) => !t.group || (node.source && t.group === sourceGroup),
    );

    if (grouped.length > 0) {
      return this.groupNodes(node.status, grouped, ungrouped, node.source);
    }
    return this.priorityNodes(node.status, inStatus, node.source);
  }

  private getPriorityChildren(node: PriorityNode): TreeNode[] {
    if (get<boolean>(Settings.ShowDependencyNodes)) {
      return this.dependencyNodes(node.todos);
    }
    return node.todos.map((todo) => ({ kind: "todo", todo }));
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

  private dependencyItem(node: DependencyNode): vscode.TreeItem {
    const nodeKey = getTreeNodeKey(node);
    const isCollapsed = nodeKey ? this.treeState.isCollapsed(nodeKey) : false;
    const item = new vscode.TreeItem(
      `${node.todo.id} · ${node.todo.title}  ${node.dependents.length} blocked`,
      isCollapsed
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded,
    );
    item.iconPath = new vscode.ThemeIcon("circle-slash", new vscode.ThemeColor("charts.red"));
    item.contextValue = "dependencyNode";
    item.id = nodeKey ?? undefined;
    item.resourceUri = node.todo.uri;
    return item;
  }

  private todoItem(node: TodoNode): vscode.TreeItem {
    const { todo } = node;
    const collision = this.collisionFor(todo);
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
    item.id = `todo:${todo.uri.toString()}`;
    item.contextValue = isBlockedFlag ? "todoItemBlocked" : "todoItem";
    if (this.busy?.isTodoBusy(todo.id)) {
      item.iconPath = new vscode.ThemeIcon(
        "sync~spin",
        new vscode.ThemeColor("descriptionForeground"),
      );
    } else {
      let icon = "note";
      if (isBlockedFlag) {
        icon = "circle-slash";
      }
      if (todo.epic) {
        icon = "type-hierarchy";
      }
      item.iconPath = new vscode.ThemeIcon(
        icon,
        new vscode.ThemeColor(PRIORITY_COLOR[todo.priority]),
      );
    }

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
    if (todo.createdAt) {
      tooltip.appendMarkdown(`- Created: ${new Date(todo.createdAt).toLocaleString()}\n`);
    }
    if (todo.updatedAt) {
      tooltip.appendMarkdown(`- Modified: ${new Date(todo.updatedAt).toLocaleString()}\n`);
    }
    if (incompleteDependencies.length) {
      tooltip.appendMarkdown(`\n> **Blocked by:** ${incompleteDependencies.join(", ")}\n`);
    }
    item.tooltip = tooltip;
    this.addCollisionWarning(item, tooltip, collision);

    item.command = {
      command: Command.OpenPreview,
      title: "Open Todo",
      arguments: [node],
    };
    return item;
  }

  private addCollisionWarning(
    item: vscode.TreeItem,
    tooltip: vscode.MarkdownString,
    collision?: TodoCollision,
  ): void {
    if (!collision) {
      return;
    }
    item.description = ["duplicate ID", item.description].filter(Boolean).join(" · ");
    item.contextValue += "Collision";
    const warning = new vscode.MarkdownString();
    warning.appendMarkdown("**Duplicate todo ID: reconciliation needed**\n\n");
    warning.appendText(collisionDetails(collision));
    warning.appendMarkdown(
      "\n\nClick the inline warning action to show only the conflicting files, or right-click and choose **Copy ID Collision Reconciliation Context**.\n\n",
    );
    warning.appendMarkdown(tooltip.value);
    item.tooltip = warning;
  }
}

export type { TodoNode, TreeNode };
