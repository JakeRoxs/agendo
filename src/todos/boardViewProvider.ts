import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { Command } from "../commands";
import { type CanvasHostActions, createCanvasHostActions } from "./canvasHostActions";
import type { FilterService } from "./filterService";
import type { StatusService } from "./statusService";
import { collisionDetails, findTodoCollisions } from "./todoCollisions";
import {
  getTodoSource,
  matchesTodoScope,
  TERMINAL_STATUSES,
  TODO_PRIORITIES,
  TODO_STATUSES,
  type Todo,
  type TodoStatus,
  type TodoViewScope,
} from "./todoModel";
import type { DependencyGraph, TodoRepository } from "./todoRepository";

const STATUS_LABEL: Record<TodoStatus, string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  ready: "Ready",
  backlogged: "Backlog",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_ICON: Record<TodoStatus, string> = {
  pending: "circle-outline",
  "in-progress": "pulse",
  ready: "play-circle",
  backlogged: "archive",
  completed: "pass-filled",
  cancelled: "circle-slash",
};

export interface BoardTodo {
  collision?: string;
  collisionSource?: string;
  id: string;
  key?: string;
  title: string;
  summary?: string;
  status: TodoStatus;
  priority: Todo["priority"];
  group?: string;
  epic: boolean;
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
  totalCount: number;
  wipLimit?: number;
}

export interface BoardSourceSection {
  source: "codeql" | "sonarqube";
  label: string;
  columns: BoardColumn[];
}

export const BOARD_CARD_FIELDS = [
  "id",
  "key",
  "priority",
  "group",
  "blocked",
  "tags",
  "createdAt",
  "updatedAt",
] as const;
export type BoardCardField = (typeof BOARD_CARD_FIELDS)[number];

const CARD_FIELD_LABEL: Record<BoardCardField, string> = {
  id: "Agendo ID",
  key: "External key",
  priority: "Priority",
  group: "Group",
  blocked: "Blocked state",
  tags: "Tags",
  createdAt: "Created time",
  updatedAt: "Modified time",
};

export interface BoardCardFieldPreference {
  field: BoardCardField;
  label: string;
  visible: boolean;
}

export const BOARD_CARD_DENSITIES = ["compact", "comfortable", "spacious"] as const;
export type BoardCardDensity = (typeof BOARD_CARD_DENSITIES)[number];
export const BOARD_SORTS = [
  "default",
  "priority",
  "id",
  "title",
  "createdAt",
  "updatedAt",
] as const;
export type BoardSort = (typeof BOARD_SORTS)[number];
export const BOARD_DESCRIPTION_PREVIEWS = ["hidden", "oneLine", "twoLines"] as const;
export type BoardDescriptionPreview = (typeof BOARD_DESCRIPTION_PREVIEWS)[number];
export const BOARD_DATE_FORMATS = ["relative", "short", "full"] as const;
export type BoardDateFormat = (typeof BOARD_DATE_FORMATS)[number];
export const BOARD_TAG_LIMITS = ["all", "1", "2", "3", "5"] as const;
export type BoardTagLimit = (typeof BOARD_TAG_LIMITS)[number];
export const BOARD_TITLE_WRAPPINGS = ["oneLine", "twoLines", "unlimited"] as const;
export type BoardTitleWrapping = (typeof BOARD_TITLE_WRAPPINGS)[number];
export const BOARD_MISSING_VALUE_BEHAVIORS = ["omit", "placeholder"] as const;
export type BoardMissingValueBehavior = (typeof BOARD_MISSING_VALUE_BEHAVIORS)[number];
export const BOARD_CARD_ACCENTS = ["priority", "status", "blocked", "none"] as const;
export type BoardCardAccent = (typeof BOARD_CARD_ACCENTS)[number];
export const BOARD_COLUMN_WIDTHS = ["narrow", "standard", "wide"] as const;
export type BoardColumnWidth = (typeof BOARD_COLUMN_WIDTHS)[number];
export const BOARD_TERMINAL_CARD_LIMITS = ["all", "10", "25", "50", "100"] as const;
export type BoardTerminalCardLimit = (typeof BOARD_TERMINAL_CARD_LIMITS)[number];
export const BOARD_GROUPINGS = ["none", "priority", "group", "epic"] as const;
export type BoardGrouping = (typeof BOARD_GROUPINGS)[number];
export const BOARD_PRESETS = ["default", "compact", "focus", "review"] as const;
export type BoardPreset = (typeof BOARD_PRESETS)[number];

const BOARD_CARD_FIELD_SET = new Set<BoardCardField>(BOARD_CARD_FIELDS);
const BOARD_CARD_DENSITY_SET = new Set<BoardCardDensity>(BOARD_CARD_DENSITIES);
const BOARD_SORT_SET = new Set<BoardSort>(BOARD_SORTS);
const BOARD_DESCRIPTION_PREVIEW_SET = new Set<BoardDescriptionPreview>(BOARD_DESCRIPTION_PREVIEWS);
const BOARD_DATE_FORMAT_SET = new Set<BoardDateFormat>(BOARD_DATE_FORMATS);
const BOARD_TAG_LIMIT_SET = new Set<BoardTagLimit>(BOARD_TAG_LIMITS);
const BOARD_TITLE_WRAPPING_SET = new Set<BoardTitleWrapping>(BOARD_TITLE_WRAPPINGS);
const BOARD_MISSING_VALUE_BEHAVIOR_SET = new Set<BoardMissingValueBehavior>(
  BOARD_MISSING_VALUE_BEHAVIORS,
);
const BOARD_CARD_ACCENT_SET = new Set<BoardCardAccent>(BOARD_CARD_ACCENTS);
const BOARD_COLUMN_WIDTH_SET = new Set<BoardColumnWidth>(BOARD_COLUMN_WIDTHS);
const BOARD_TERMINAL_CARD_LIMIT_SET = new Set<BoardTerminalCardLimit>(BOARD_TERMINAL_CARD_LIMITS);
const BOARD_GROUPING_SET = new Set<BoardGrouping>(BOARD_GROUPINGS);
const BOARD_PRESET_SET = new Set<BoardPreset>(BOARD_PRESETS);
const TODO_STATUS_SET = new Set<TodoStatus>(TODO_STATUSES);
const TERMINAL_STATUS_SET = new Set<TodoStatus>(TERMINAL_STATUSES);
const WIP_STATUS_SET = new Set<TodoStatus>(["pending", "in-progress", "ready"]);
const TODO_PRIORITY_SET = new Set<Todo["priority"]>(TODO_PRIORITIES);

export interface BoardSnapshot {
  columns: BoardColumn[];
  sections?: BoardSourceSection[];
  scope: TodoViewScope;
  hiddenStatuses: TodoStatus[];
  cardFields: BoardCardFieldPreference[];
  cardDensity: BoardCardDensity;
  sort: BoardSort;
  descriptionPreview: BoardDescriptionPreview;
  hideEmptyColumns: boolean;
  showMetadataLabels: boolean;
  dateFormat: BoardDateFormat;
  tagLimit: BoardTagLimit;
  titleWrapping: BoardTitleWrapping;
  missingValueBehavior: BoardMissingValueBehavior;
  cardAccent: BoardCardAccent;
  columnWidth: BoardColumnWidth;
  terminalCardLimit: BoardTerminalCardLimit;
  columnSorts: Partial<Record<TodoStatus, BoardSort>>;
  grouping: BoardGrouping;
  wipLimits: Partial<Record<TodoStatus, number>>;
}

const BOARD_HIDDEN_STATUSES_KEY = "agendo.board.hiddenStatuses";
const BOARD_STATUS_ORDER_KEY = "agendo.board.statusOrder";
const BOARD_CARD_FIELD_ORDER_KEY = "agendo.board.cardFieldOrder";
const BOARD_HIDDEN_CARD_FIELDS_KEY = "agendo.board.hiddenCardFields";
const BOARD_CARD_DENSITY_KEY = "agendo.board.cardDensity";
const BOARD_SORT_KEY = "agendo.board.sort";
const BOARD_DESCRIPTION_PREVIEW_KEY = "agendo.board.descriptionPreview";
const BOARD_HIDE_EMPTY_COLUMNS_KEY = "agendo.board.hideEmptyColumns";
const BOARD_SHOW_METADATA_LABELS_KEY = "agendo.board.showMetadataLabels";
const BOARD_DATE_FORMAT_KEY = "agendo.board.dateFormat";
const BOARD_TAG_LIMIT_KEY = "agendo.board.tagLimit";
const BOARD_TITLE_WRAPPING_KEY = "agendo.board.titleWrapping";
const BOARD_MISSING_VALUE_BEHAVIOR_KEY = "agendo.board.missingValueBehavior";
const BOARD_CARD_ACCENT_KEY = "agendo.board.cardAccent";
const BOARD_COLUMN_WIDTH_KEY = "agendo.board.columnWidth";
const BOARD_TERMINAL_CARD_LIMIT_KEY = "agendo.board.terminalCardLimit";
const BOARD_COLUMN_SORTS_KEY = "agendo.board.columnSorts";
const BOARD_GROUPING_KEY = "agendo.board.grouping";
const BOARD_WIP_LIMITS_KEY = "agendo.board.wipLimits";
const SCANNING_BOARD_PREFIX = "agendo.codeScanning.board.";
const DEFAULT_HIDDEN_CARD_FIELDS = new Set<BoardCardField>(["createdAt", "updatedAt"]);
const DEFAULT_CARD_DENSITY: BoardCardDensity = "comfortable";
const DEFAULT_BOARD_SORT: BoardSort = "default";
const DEFAULT_DESCRIPTION_PREVIEW: BoardDescriptionPreview = "hidden";
const DEFAULT_DATE_FORMAT: BoardDateFormat = "full";
const DEFAULT_TAG_LIMIT: BoardTagLimit = "all";
const DEFAULT_TITLE_WRAPPING: BoardTitleWrapping = "twoLines";
const DEFAULT_MISSING_VALUE_BEHAVIOR: BoardMissingValueBehavior = "omit";
const DEFAULT_CARD_ACCENT: BoardCardAccent = "priority";
const DEFAULT_COLUMN_WIDTH: BoardColumnWidth = "standard";
const DEFAULT_TERMINAL_CARD_LIMIT: BoardTerminalCardLimit = "all";
const DEFAULT_GROUPING: BoardGrouping = "none";

export function normalizeBoardStatusOrder(order: readonly TodoStatus[]): TodoStatus[] {
  return [...new Set([...order, ...TODO_STATUSES])].filter((status) => TODO_STATUS_SET.has(status));
}

export function normalizeBoardCardFieldOrder(order: readonly BoardCardField[]): BoardCardField[] {
  return [...new Set([...order, ...BOARD_CARD_FIELDS])].filter((field) =>
    BOARD_CARD_FIELD_SET.has(field),
  );
}

function isBoardCardField(value: unknown): value is BoardCardField {
  return typeof value === "string" && BOARD_CARD_FIELD_SET.has(value as BoardCardField);
}

function isBoardCardDensity(value: unknown): value is BoardCardDensity {
  return typeof value === "string" && BOARD_CARD_DENSITY_SET.has(value as BoardCardDensity);
}

function isBoardSort(value: unknown): value is BoardSort {
  return typeof value === "string" && BOARD_SORT_SET.has(value as BoardSort);
}

function isBoardDescriptionPreview(value: unknown): value is BoardDescriptionPreview {
  return (
    typeof value === "string" && BOARD_DESCRIPTION_PREVIEW_SET.has(value as BoardDescriptionPreview)
  );
}

function isBoardDateFormat(value: unknown): value is BoardDateFormat {
  return typeof value === "string" && BOARD_DATE_FORMAT_SET.has(value as BoardDateFormat);
}

function isBoardTagLimit(value: unknown): value is BoardTagLimit {
  return typeof value === "string" && BOARD_TAG_LIMIT_SET.has(value as BoardTagLimit);
}

function isBoardTitleWrapping(value: unknown): value is BoardTitleWrapping {
  return typeof value === "string" && BOARD_TITLE_WRAPPING_SET.has(value as BoardTitleWrapping);
}

function isBoardMissingValueBehavior(value: unknown): value is BoardMissingValueBehavior {
  return (
    typeof value === "string" &&
    BOARD_MISSING_VALUE_BEHAVIOR_SET.has(value as BoardMissingValueBehavior)
  );
}

function isBoardCardAccent(value: unknown): value is BoardCardAccent {
  return typeof value === "string" && BOARD_CARD_ACCENT_SET.has(value as BoardCardAccent);
}

function isBoardColumnWidth(value: unknown): value is BoardColumnWidth {
  return typeof value === "string" && BOARD_COLUMN_WIDTH_SET.has(value as BoardColumnWidth);
}

function isBoardTerminalCardLimit(value: unknown): value is BoardTerminalCardLimit {
  return (
    typeof value === "string" && BOARD_TERMINAL_CARD_LIMIT_SET.has(value as BoardTerminalCardLimit)
  );
}

function isBoardGrouping(value: unknown): value is BoardGrouping {
  return typeof value === "string" && BOARD_GROUPING_SET.has(value as BoardGrouping);
}

function isBoardPreset(value: unknown): value is BoardPreset {
  return typeof value === "string" && BOARD_PRESET_SET.has(value as BoardPreset);
}

function isTodoStatus(value: unknown): value is TodoStatus {
  return typeof value === "string" && TODO_STATUS_SET.has(value as TodoStatus);
}

function isTodoPriority(value: unknown): value is Todo["priority"] {
  return typeof value === "string" && TODO_PRIORITY_SET.has(value as Todo["priority"]);
}

export function sortBoardTodos(todos: readonly BoardTodo[], sort: BoardSort): BoardTodo[] {
  const result = [...todos];
  const byId = (left: BoardTodo, right: BoardTodo) => left.id.localeCompare(right.id);
  const byNewest = (field: "createdAt" | "updatedAt") => (left: BoardTodo, right: BoardTodo) =>
    (right[field] ?? Number.NEGATIVE_INFINITY) - (left[field] ?? Number.NEGATIVE_INFINITY) ||
    byId(left, right);

  switch (sort) {
    case "priority": {
      const rank = { p1: 0, p2: 1, p3: 2 } as const;
      return result.sort(
        (left, right) => rank[left.priority] - rank[right.priority] || byId(left, right),
      );
    }
    case "title":
      return result.sort(
        (left, right) => left.title.localeCompare(right.title) || byId(left, right),
      );
    case "createdAt":
    case "updatedAt":
      return result.sort(byNewest(sort));
    default:
      return result.sort(byId);
  }
}

export function limitTerminalBoardColumns(
  columns: readonly BoardColumn[],
  limit: BoardTerminalCardLimit,
): BoardColumn[] {
  if (limit === "all") {
    return [...columns];
  }
  const maximum = Number(limit);
  return columns.map((column) =>
    TERMINAL_STATUS_SET.has(column.status)
      ? { ...column, todos: column.todos.slice(0, maximum) }
      : column,
  );
}

export function applyBoardColumnRules(
  columns: readonly BoardColumn[],
  globalSort: BoardSort,
  columnSorts: Partial<Record<TodoStatus, BoardSort>>,
  wipLimits: Partial<Record<TodoStatus, number>>,
): BoardColumn[] {
  return columns.map((column) => ({
    ...column,
    todos: sortBoardTodos(column.todos, columnSorts[column.status] ?? globalSort),
    wipLimit: wipLimits[column.status],
  }));
}

export function buildBoardSnapshot(
  todos: readonly Todo[],
  dependencyGraph: DependencyGraph,
  filter: FilterService,
  scope: TodoViewScope = "todos",
): BoardSnapshot {
  const collisionByUri = new Map(
    findTodoCollisions(todos).flatMap((collision) => {
      const data = { source: collision.source, details: collisionDetails(collision) };
      return collision.todos.map((todo) => [todo.uri.toString(), data] as const);
    }),
  );
  const visibleTodos = todos.filter((todo) => {
    if (!matchesTodoScope(todo, scope)) {
      return false;
    }
    return filter.matches(todo, dependencyGraph);
  });

  const buildColumns = (scopedTodos: readonly Todo[]) =>
    TODO_STATUSES.map((status) => {
      const columnTodos = scopedTodos
        .filter((todo) => todo.status === status)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((todo) => ({
          id: todo.id,
          collision: collisionByUri.get(todo.uri.toString())?.details,
          collisionSource: collisionByUri.get(todo.uri.toString())?.source,
          key: todo.key,
          title: todo.title,
          summary: todo.summary,
          status: todo.status,
          priority: todo.priority,
          group: todo.group,
          epic: todo.epic,
          tags: todo.tags,
          blocked: Boolean(dependencyGraph.blockedBy.get(todo.id)?.length),
          createdAt: todo.createdAt,
          updatedAt: todo.updatedAt,
        }));
      return {
        status,
        label: STATUS_LABEL[status],
        icon: STATUS_ICON[status],
        todos: columnTodos,
        totalCount: columnTodos.length,
      };
    });

  let columns = buildColumns(visibleTodos);
  let sections: BoardSourceSection[] | undefined;

  if (scope === "code-scanning") {
    const sources: Array<"codeql" | "sonarqube"> = ["codeql", "sonarqube"];
    sections = sources
      .filter(
        (source) => !filter.current.sources?.length || filter.current.sources.includes(source),
      )
      .map((source) => ({
        source,
        label: source === "codeql" ? "CodeQL" : "SonarQube",
        columns: buildColumns(visibleTodos.filter((todo) => getTodoSource(todo) === source)),
      }));
    columns = [];
  }

  return {
    columns,
    sections,
    scope,
    hiddenStatuses: [],
    cardFields: BOARD_CARD_FIELDS.map((field) => ({
      field,
      label: CARD_FIELD_LABEL[field],
      visible: !DEFAULT_HIDDEN_CARD_FIELDS.has(field),
    })),
    cardDensity: DEFAULT_CARD_DENSITY,
    sort: DEFAULT_BOARD_SORT,
    descriptionPreview: DEFAULT_DESCRIPTION_PREVIEW,
    hideEmptyColumns: false,
    showMetadataLabels: false,
    dateFormat: DEFAULT_DATE_FORMAT,
    tagLimit: DEFAULT_TAG_LIMIT,
    titleWrapping: DEFAULT_TITLE_WRAPPING,
    missingValueBehavior: DEFAULT_MISSING_VALUE_BEHAVIOR,
    cardAccent: DEFAULT_CARD_ACCENT,
    columnWidth: DEFAULT_COLUMN_WIDTH,
    terminalCardLimit: DEFAULT_TERMINAL_CARD_LIMIT,
    columnSorts: {},
    grouping: DEFAULT_GROUPING,
    wipLimits: {},
  };
}

export interface BoardMessage {
  type:
    | "focusCollision"
    | "ready"
    | "open"
    | "openCanvas"
    | "delete"
    | "setStatus"
    | "hideStatus"
    | "showStatus"
    | "reorderStatuses"
    | "setCardFieldVisibility"
    | "reorderCardFields"
    | "setCardDensity"
    | "setBoardSort"
    | "setDescriptionPreview"
    | "setHideEmptyColumns"
    | "setMetadataLabels"
    | "setDateFormat"
    | "setTagLimit"
    | "setTitleWrapping"
    | "setMissingValueBehavior"
    | "setCardAccent"
    | "setColumnWidth"
    | "setTerminalCardLimit"
    | "setColumnSort"
    | "setGrouping"
    | "setWipLimit"
    | "applyPreset"
    | "setPriority"
    | "openExternalKey"
    | "resetBoardSettings"
    | "scopedCommand"
    | "settings";
  todoId?: string;
  collisionSource?: string;
  status?: TodoStatus;
  statuses?: TodoStatus[];
  field?: BoardCardField;
  fields?: BoardCardField[];
  visible?: boolean;
  enabled?: boolean;
  density?: BoardCardDensity;
  sort?: BoardSort;
  columnSort?: BoardSort | "global";
  descriptionPreview?: BoardDescriptionPreview;
  dateFormat?: BoardDateFormat;
  tagLimit?: BoardTagLimit;
  titleWrapping?: BoardTitleWrapping;
  missingValueBehavior?: BoardMissingValueBehavior;
  cardAccent?: BoardCardAccent;
  columnWidth?: BoardColumnWidth;
  terminalCardLimit?: BoardTerminalCardLimit;
  grouping?: BoardGrouping;
  preset?: BoardPreset;
  priority?: Todo["priority"];
  limit?: number;
  command?: string;
}

/** Renders the file-backed todo board in a reusable editor webview panel. */
export class BoardViewProvider implements vscode.Disposable {
  private readonly taskActions: CanvasHostActions;
  private panel: vscode.WebviewPanel | undefined;
  private readonly repositorySubscription: vscode.Disposable;
  private readonly scope: TodoViewScope;

  constructor(
    private readonly repository: TodoRepository,
    private readonly filter: FilterService,
    private readonly status: StatusService,
    private readonly state: vscode.Memento,
    scope: TodoViewScope = "todos",
    taskActions?: CanvasHostActions,
  ) {
    this.taskActions = taskActions ?? createCanvasHostActions({ repository, status });
    this.scope = scope;
    this.repositorySubscription = repository.onDidChange(() => this.sendSnapshot());
  }

  /** Public refresh that re-sends the current snapshot. */
  refresh(): void {
    this.sendSnapshot();
  }

  /** The same validated host operations serve the native webview and HTTP canvas. */
  async handleCanvasMessage(value: unknown): Promise<void> {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      typeof (value as Record<string, unknown>).type !== "string"
    ) {
      throw new Error("Expected a board message object");
    }
    const message = value as BoardMessage;
    const supported = new Set<BoardMessage["type"]>([
      "ready",
      "open",
      "openCanvas",
      "openExternalKey",
      "delete",
      "setStatus",
      "setPriority",
      "hideStatus",
      "showStatus",
      "reorderStatuses",
      "setCardFieldVisibility",
      "reorderCardFields",
      "setCardDensity",
      "setBoardSort",
      "setDescriptionPreview",
      "setHideEmptyColumns",
      "setMetadataLabels",
      "setDateFormat",
      "setTagLimit",
      "setTitleWrapping",
      "setMissingValueBehavior",
      "setCardAccent",
      "setColumnWidth",
      "setTerminalCardLimit",
      "setColumnSort",
      "setGrouping",
      "setWipLimit",
      "applyPreset",
      "resetBoardSettings",
      "scopedCommand",
      "focusCollision",
      "settings",
    ]);
    if (!supported.has(message.type)) throw new Error("Unsupported board action");
    await this.handleMessage(message);
  }

  open(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    const isScanning = this.scope === "code-scanning";
    const panel = vscode.window.createWebviewPanel(
      isScanning ? "agendo.codeScanning.board" : "agendo.board",
      isScanning ? "Code Scanning Board" : "Agendo Board",
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
    if (message.type === "focusCollision") {
      if (
        this.repository
          .getTodos()
          .some(
            (todo) =>
              todo.id === message.todoId &&
              matchesTodoScope(todo, this.scope) &&
              (getTodoSource(todo) ?? "todo") === message.collisionSource,
          )
      ) {
        await vscode.commands.executeCommand(Command.FocusCollision, {
          todoId: message.todoId,
          collisionSource: message.collisionSource,
        });
      }
      return;
    }
    if (message.type === "ready") {
      this.sendSnapshot();
      return;
    }

    if (message.type === "settings") {
      await vscode.commands.executeCommand("workbench.action.openSettings", `@ext:agendo.agendo`);
      return;
    }

    if (message.type === "scopedCommand" && message.command) {
      const prefix = this.scope === "code-scanning" ? "agendo.codeScanning" : "agendo";
      const allowed = ["refresh", "filter", "search", "clearFilters", "clearSearch"].map(
        (action) => `${prefix}.${action}`,
      );
      if (allowed.includes(message.command)) {
        await vscode.commands.executeCommand(message.command);
      }
      return;
    }

    if (await this.handleLayoutMessage(message)) {
      return;
    }

    await this.handleTodoMessage(message);
  }

  private async handleTodoMessage(message: BoardMessage): Promise<void> {
    const matches = message.todoId
      ? this.repository
          .getTodos()
          .filter(
            (candidate) =>
              candidate.id === message.todoId && matchesTodoScope(candidate, this.scope),
          )
      : [];
    if (matches.length > 1) {
      vscode.window.showWarningMessage(
        `Duplicate todo ID ${message.todoId}: reconcile the conflicting files before using ID-based board actions.`,
      );
      this.sendSnapshot();
      return;
    }
    const todo = matches[0];
    if (!todo) {
      return;
    }

    switch (message.type) {
      case "open":
        await this.openTodo(todo);
        break;
      case "openCanvas":
        await vscode.commands.executeCommand(Command.OpenCanvas, {
          todoId: todo.id,
          returnTo: { kind: "board", scope: this.scope },
        });
        break;
      case "setStatus":
        await this.setTodoStatus(todo, message.status);
        break;
      case "setPriority":
        await this.setTodoPriority(todo, message.priority);
        break;
      case "openExternalKey":
        await this.openExternalKey(todo);
        break;
      case "delete":
        await this.deleteTodo(todo);
        break;
    }
  }

  private async openTodo(todo: Todo): Promise<void> {
    await vscode.commands.executeCommand(Command.OpenPreview, { kind: "todo", todo });
  }

  private async deleteTodo(todo: Todo): Promise<void> {
    this.postBusy(todo.id);
    try {
      await this.taskActions.assertWritable(todo.id);
      const choice = await vscode.window.showWarningMessage(
        `Delete todo ${todo.id} (${todo.title})? This cannot be undone.`,
        { modal: true },
        "Delete",
      );
      if (choice !== "Delete") return;
      await this.taskActions.assertWritable(todo.id);
      const current = this.repository.getTodos().find((candidate) => candidate.id === todo.id);
      if (!current) throw new Error("Todo no longer exists");
      await this.status.deleteTodo(current);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete todo: ${error}`);
    } finally {
      await this.repository.refresh();
    }
  }

  private async setTodoStatus(todo: Todo, status: unknown): Promise<void> {
    if (!isTodoStatus(status)) {
      return;
    }
    this.postBusy(todo.id);
    try {
      await this.taskActions.setStatus(todo.id, status);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to move todo: ${error}`);
    } finally {
      await this.repository.refresh();
    }
  }

  private async setTodoPriority(todo: Todo, priority: unknown): Promise<void> {
    if (!isTodoPriority(priority)) {
      return;
    }
    this.postBusy(todo.id);
    try {
      await this.taskActions.setPriority(todo.id, priority);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update priority: ${error}`);
    } finally {
      await this.repository.refresh();
    }
  }

  /** Tell the webview a card is being processed so it can show a busy overlay. */
  private postBusy(todoId: string): void {
    if (!this.panel) {
      return;
    }
    void this.panel.webview.postMessage({ type: "busy", todoId });
  }

  private async openExternalKey(todo: Todo): Promise<void> {
    if (!todo.key) {
      return;
    }
    const uri = vscode.Uri.parse(todo.key);
    if (uri.scheme === "http" || uri.scheme === "https") {
      await vscode.env.openExternal(uri);
      return;
    }
    await vscode.env.clipboard.writeText(todo.key);
    vscode.window.showInformationMessage(`Copied external key ${todo.key}`);
  }

  private async handleLayoutMessage(message: BoardMessage): Promise<boolean> {
    const handled = await this.applyLayoutMessage(message);
    if (handled) {
      this.sendSnapshot();
    }
    return handled;
  }

  private async applyLayoutMessage(message: BoardMessage): Promise<boolean> {
    switch (message.type) {
      case "hideStatus":
        return this.setStatusHidden(message.status, true);
      case "showStatus":
        return this.setStatusHidden(message.status, false);
      case "reorderStatuses":
        return this.setStatusOrder(message.statuses);
      case "setCardFieldVisibility":
        return this.setCardFieldVisibility(message.field, message.visible);
      case "reorderCardFields":
        return this.setCardFieldOrder(message.fields);
      case "setCardDensity":
        return this.setValidatedPreference(
          this.keyFor(BOARD_CARD_DENSITY_KEY),
          message.density,
          isBoardCardDensity,
        );
      case "setBoardSort":
        return this.setValidatedPreference(this.keyFor(BOARD_SORT_KEY), message.sort, isBoardSort);
      case "setDescriptionPreview":
        return this.setValidatedPreference(
          this.keyFor(BOARD_DESCRIPTION_PREVIEW_KEY),
          message.descriptionPreview,
          isBoardDescriptionPreview,
        );
      case "setHideEmptyColumns":
        return this.setBooleanPreference(
          this.keyFor(BOARD_HIDE_EMPTY_COLUMNS_KEY),
          message.enabled,
        );
      case "setMetadataLabels":
        return this.setBooleanPreference(
          this.keyFor(BOARD_SHOW_METADATA_LABELS_KEY),
          message.enabled,
        );
      case "setDateFormat":
        return this.setValidatedPreference(
          this.keyFor(BOARD_DATE_FORMAT_KEY),
          message.dateFormat,
          isBoardDateFormat,
        );
      case "setTagLimit":
        return this.setValidatedPreference(
          this.keyFor(BOARD_TAG_LIMIT_KEY),
          message.tagLimit,
          isBoardTagLimit,
        );
      case "setTitleWrapping":
        return this.setValidatedPreference(
          this.keyFor(BOARD_TITLE_WRAPPING_KEY),
          message.titleWrapping,
          isBoardTitleWrapping,
        );
      case "setMissingValueBehavior":
        return this.setValidatedPreference(
          this.keyFor(BOARD_MISSING_VALUE_BEHAVIOR_KEY),
          message.missingValueBehavior,
          isBoardMissingValueBehavior,
        );
      case "setCardAccent":
        return this.setValidatedPreference(
          this.keyFor(BOARD_CARD_ACCENT_KEY),
          message.cardAccent,
          isBoardCardAccent,
        );
      case "setColumnWidth":
        return this.setValidatedPreference(
          this.keyFor(BOARD_COLUMN_WIDTH_KEY),
          message.columnWidth,
          isBoardColumnWidth,
        );
      case "setTerminalCardLimit":
        return this.setValidatedPreference(
          this.keyFor(BOARD_TERMINAL_CARD_LIMIT_KEY),
          message.terminalCardLimit,
          isBoardTerminalCardLimit,
        );
      case "setColumnSort":
        return this.setColumnSort(message.status, message.columnSort);
      case "setGrouping":
        return this.setValidatedPreference(
          this.keyFor(BOARD_GROUPING_KEY),
          message.grouping,
          isBoardGrouping,
        );
      case "setWipLimit":
        return this.setWipLimit(message.status, message.limit);
      case "applyPreset":
        return this.applyPreset(message.preset);
      case "resetBoardSettings":
        return this.resetBoardSettings();
      default:
        return false;
    }
  }

  private async setStatusHidden(status: unknown, hidden: boolean): Promise<boolean> {
    if (!isTodoStatus(status)) {
      return false;
    }
    const hiddenStatuses = new Set(this.getHiddenStatuses());
    if (hidden) {
      hiddenStatuses.add(status);
    } else {
      hiddenStatuses.delete(status);
    }
    await this.state.update(this.keyFor(BOARD_HIDDEN_STATUSES_KEY), [...hiddenStatuses]);
    return true;
  }

  private async setStatusOrder(statuses: unknown): Promise<boolean> {
    if (!Array.isArray(statuses) || !statuses.every(isTodoStatus)) {
      return false;
    }
    await this.state.update(
      this.keyFor(BOARD_STATUS_ORDER_KEY),
      normalizeBoardStatusOrder(statuses),
    );
    return true;
  }

  private async setCardFieldVisibility(field: unknown, visible: unknown): Promise<boolean> {
    if (!isBoardCardField(field) || typeof visible !== "boolean") {
      return false;
    }
    const hiddenFields = new Set(this.getHiddenCardFields());
    if (visible) {
      hiddenFields.delete(field);
    } else {
      hiddenFields.add(field);
    }
    await this.state.update(this.keyFor(BOARD_HIDDEN_CARD_FIELDS_KEY), [...hiddenFields]);
    return true;
  }

  private async setCardFieldOrder(fields: unknown): Promise<boolean> {
    if (!Array.isArray(fields) || !fields.every(isBoardCardField)) {
      return false;
    }
    await this.state.update(
      this.keyFor(BOARD_CARD_FIELD_ORDER_KEY),
      normalizeBoardCardFieldOrder(fields),
    );
    return true;
  }

  private async setValidatedPreference<T>(
    key: string,
    value: unknown,
    validate: (candidate: unknown) => candidate is T,
  ): Promise<boolean> {
    if (!validate(value)) {
      return false;
    }
    await this.state.update(key, value);
    return true;
  }

  private async setBooleanPreference(key: string, value: unknown): Promise<boolean> {
    if (typeof value !== "boolean") {
      return false;
    }
    await this.state.update(key, value);
    return true;
  }

  private async setColumnSort(status: unknown, sort: unknown): Promise<boolean> {
    if (!isTodoStatus(status) || (sort !== "global" && !isBoardSort(sort))) {
      return false;
    }
    const columnSorts = this.getColumnSorts();
    if (sort === "global") {
      delete columnSorts[status];
    } else {
      columnSorts[status] = sort;
    }
    await this.state.update(this.keyFor(BOARD_COLUMN_SORTS_KEY), columnSorts);
    return true;
  }

  private async setWipLimit(status: unknown, limit: unknown): Promise<boolean> {
    if (!isTodoStatus(status) || !WIP_STATUS_SET.has(status)) {
      return false;
    }
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 0 || limit > 999) {
      return false;
    }
    const limits = this.getWipLimits();
    if (limit === 0) {
      delete limits[status];
    } else {
      limits[status] = limit;
    }
    await this.state.update(this.keyFor(BOARD_WIP_LIMITS_KEY), limits);
    return true;
  }

  private async applyPreset(preset: unknown): Promise<boolean> {
    if (!isBoardPreset(preset)) {
      return false;
    }
    if (preset === "default") {
      return this.resetBoardSettings();
    }
    const preferences: Record<Exclude<BoardPreset, "default">, Record<string, unknown>> = {
      compact: {
        [this.keyFor(BOARD_CARD_DENSITY_KEY)]: "compact",
        [this.keyFor(BOARD_TITLE_WRAPPING_KEY)]: "oneLine",
        [this.keyFor(BOARD_DESCRIPTION_PREVIEW_KEY)]: "hidden",
        [this.keyFor(BOARD_TAG_LIMIT_KEY)]: "2",
        [this.keyFor(BOARD_HIDE_EMPTY_COLUMNS_KEY)]: true,
        [this.keyFor(BOARD_COLUMN_WIDTH_KEY)]: "narrow",
        [this.keyFor(BOARD_TERMINAL_CARD_LIMIT_KEY)]: "25",
      },
      focus: {
        [this.keyFor(BOARD_HIDDEN_STATUSES_KEY)]: ["backlogged", "completed", "cancelled"],
        [this.keyFor(BOARD_SORT_KEY)]: "priority",
        [this.keyFor(BOARD_HIDE_EMPTY_COLUMNS_KEY)]: true,
        [this.keyFor(BOARD_COLUMN_WIDTH_KEY)]: "wide",
      },
      review: {
        [this.keyFor(BOARD_CARD_DENSITY_KEY)]: "comfortable",
        [this.keyFor(BOARD_DESCRIPTION_PREVIEW_KEY)]: "twoLines",
        [this.keyFor(BOARD_SORT_KEY)]: "updatedAt",
        [this.keyFor(BOARD_DATE_FORMAT_KEY)]: "relative",
        [this.keyFor(BOARD_TERMINAL_CARD_LIMIT_KEY)]: "50",
      },
    };
    await Promise.all(
      Object.entries(preferences[preset]).map(([key, value]) => this.state.update(key, value)),
    );
    return true;
  }

  private async resetBoardSettings(): Promise<boolean> {
    const keys = [
      BOARD_HIDDEN_STATUSES_KEY,
      BOARD_STATUS_ORDER_KEY,
      BOARD_CARD_FIELD_ORDER_KEY,
      BOARD_HIDDEN_CARD_FIELDS_KEY,
      BOARD_CARD_DENSITY_KEY,
      BOARD_SORT_KEY,
      BOARD_DESCRIPTION_PREVIEW_KEY,
      BOARD_HIDE_EMPTY_COLUMNS_KEY,
      BOARD_SHOW_METADATA_LABELS_KEY,
      BOARD_DATE_FORMAT_KEY,
      BOARD_TAG_LIMIT_KEY,
      BOARD_TITLE_WRAPPING_KEY,
      BOARD_MISSING_VALUE_BEHAVIOR_KEY,
      BOARD_CARD_ACCENT_KEY,
      BOARD_COLUMN_WIDTH_KEY,
      BOARD_TERMINAL_CARD_LIMIT_KEY,
      BOARD_COLUMN_SORTS_KEY,
      BOARD_GROUPING_KEY,
      BOARD_WIP_LIMITS_KEY,
    ].map((key) => this.keyFor(key));
    await Promise.all(keys.map((key) => this.state.update(key, undefined)));
    return true;
  }

  private sendSnapshot(): void {
    if (!this.panel) {
      return;
    }
    void this.panel.webview.postMessage({ type: "snapshot", snapshot: this.getSnapshot() });
  }

  /** Host-prepared snapshot; UI renderers never duplicate filtering or preference rules. */
  getSnapshot(): BoardSnapshot {
    const snapshot = buildBoardSnapshot(
      this.repository.getTodos(),
      this.repository.getDependencyGraph(),
      this.filter,
      this.scope,
    );
    const hiddenStatuses = this.filter.current.collision ? [] : this.getHiddenStatuses();
    const hidden = new Set(hiddenStatuses);
    snapshot.hideEmptyColumns = this.getBooleanPreference(BOARD_HIDE_EMPTY_COLUMNS_KEY, false);
    snapshot.columns = normalizeBoardStatusOrder(this.getStatusOrder()).flatMap((status) => {
      const column = snapshot.columns.find((candidate) => candidate.status === status);
      const visible = column && !hidden.has(column.status);
      return visible && !(snapshot.hideEmptyColumns && column.todos.length === 0) ? [column] : [];
    });
    if (snapshot.sections) {
      snapshot.sections = snapshot.sections.map((section) => ({
        ...section,
        columns: normalizeBoardStatusOrder(this.getStatusOrder()).flatMap((status) => {
          const column = section.columns.find((candidate) => candidate.status === status);
          const visible = column && !hidden.has(column.status);
          return visible && !(snapshot.hideEmptyColumns && column.todos.length === 0)
            ? [column]
            : [];
        }),
      }));
    }
    snapshot.hiddenStatuses = hiddenStatuses;
    const hiddenCardFields = new Set(this.getHiddenCardFields());
    snapshot.cardFields = this.getCardFieldOrder().map((field) => ({
      field,
      label: CARD_FIELD_LABEL[field],
      visible: !hiddenCardFields.has(field),
    }));
    snapshot.cardDensity = this.getCardDensity();
    snapshot.sort = this.getBoardSort();
    snapshot.descriptionPreview = this.getDescriptionPreview();
    snapshot.showMetadataLabels = this.getBooleanPreference(BOARD_SHOW_METADATA_LABELS_KEY, false);
    snapshot.dateFormat = this.getDateFormat();
    snapshot.tagLimit = this.getTagLimit();
    snapshot.titleWrapping = this.getTitleWrapping();
    snapshot.missingValueBehavior = this.getMissingValueBehavior();
    snapshot.cardAccent = this.getCardAccent();
    snapshot.columnWidth = this.getColumnWidth();
    snapshot.terminalCardLimit = this.filter.current.collision
      ? "all"
      : this.getTerminalCardLimit();
    snapshot.columnSorts = this.getColumnSorts();
    snapshot.grouping = this.getGrouping();
    snapshot.wipLimits = this.getWipLimits();
    snapshot.columns = applyBoardColumnRules(
      snapshot.columns,
      snapshot.sort,
      snapshot.columnSorts,
      snapshot.wipLimits,
    );
    snapshot.columns = limitTerminalBoardColumns(snapshot.columns, snapshot.terminalCardLimit);
    if (snapshot.sections) {
      snapshot.sections = snapshot.sections.map((section) => ({
        ...section,
        columns: limitTerminalBoardColumns(
          applyBoardColumnRules(
            section.columns,
            snapshot.sort,
            snapshot.columnSorts,
            snapshot.wipLimits,
          ),
          snapshot.terminalCardLimit,
        ),
      }));
    }

    return snapshot;
  }

  private keyFor(regularKey: string): string {
    if (this.scope !== "code-scanning") {
      return regularKey;
    }
    const base = regularKey.replace("agendo.board.", "");
    return `${SCANNING_BOARD_PREFIX}${base}`;
  }

  private getHiddenStatuses(): TodoStatus[] {
    const hiddenStatuses = this.state.get<unknown[]>(this.keyFor(BOARD_HIDDEN_STATUSES_KEY), []);
    return hiddenStatuses.filter(isTodoStatus);
  }

  private getStatusOrder(): TodoStatus[] {
    const order = this.state.get<unknown[]>(this.keyFor(BOARD_STATUS_ORDER_KEY), []);
    return normalizeBoardStatusOrder(order.filter(isTodoStatus));
  }

  private getHiddenCardFields(): BoardCardField[] {
    const fields = this.state.get<unknown[]>(this.keyFor(BOARD_HIDDEN_CARD_FIELDS_KEY), [
      ...DEFAULT_HIDDEN_CARD_FIELDS,
    ]);
    return fields.filter(isBoardCardField);
  }

  private getCardFieldOrder(): BoardCardField[] {
    const fields = this.state.get<unknown[]>(this.keyFor(BOARD_CARD_FIELD_ORDER_KEY), []);
    return normalizeBoardCardFieldOrder(fields.filter(isBoardCardField));
  }

  private getCardDensity(): BoardCardDensity {
    const density = this.state.get<unknown>(
      this.keyFor(BOARD_CARD_DENSITY_KEY),
      DEFAULT_CARD_DENSITY,
    );
    return isBoardCardDensity(density) ? density : DEFAULT_CARD_DENSITY;
  }

  private getBoardSort(): BoardSort {
    const sort = this.state.get<unknown>(this.keyFor(BOARD_SORT_KEY), DEFAULT_BOARD_SORT);
    return isBoardSort(sort) ? sort : DEFAULT_BOARD_SORT;
  }

  private getDescriptionPreview(): BoardDescriptionPreview {
    const preview = this.state.get<unknown>(
      this.keyFor(BOARD_DESCRIPTION_PREVIEW_KEY),
      DEFAULT_DESCRIPTION_PREVIEW,
    );
    return isBoardDescriptionPreview(preview) ? preview : DEFAULT_DESCRIPTION_PREVIEW;
  }

  private getDateFormat(): BoardDateFormat {
    const format = this.state.get<unknown>(this.keyFor(BOARD_DATE_FORMAT_KEY), DEFAULT_DATE_FORMAT);
    return isBoardDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  }

  private getTagLimit(): BoardTagLimit {
    const limit = this.state.get<unknown>(this.keyFor(BOARD_TAG_LIMIT_KEY), DEFAULT_TAG_LIMIT);
    return isBoardTagLimit(limit) ? limit : DEFAULT_TAG_LIMIT;
  }

  private getTitleWrapping(): BoardTitleWrapping {
    const wrapping = this.state.get<unknown>(
      this.keyFor(BOARD_TITLE_WRAPPING_KEY),
      DEFAULT_TITLE_WRAPPING,
    );
    return isBoardTitleWrapping(wrapping) ? wrapping : DEFAULT_TITLE_WRAPPING;
  }

  private getMissingValueBehavior(): BoardMissingValueBehavior {
    const behavior = this.state.get<unknown>(
      this.keyFor(BOARD_MISSING_VALUE_BEHAVIOR_KEY),
      DEFAULT_MISSING_VALUE_BEHAVIOR,
    );
    return isBoardMissingValueBehavior(behavior) ? behavior : DEFAULT_MISSING_VALUE_BEHAVIOR;
  }

  private getCardAccent(): BoardCardAccent {
    const accent = this.state.get<unknown>(this.keyFor(BOARD_CARD_ACCENT_KEY), DEFAULT_CARD_ACCENT);
    return isBoardCardAccent(accent) ? accent : DEFAULT_CARD_ACCENT;
  }

  private getColumnWidth(): BoardColumnWidth {
    const width = this.state.get<unknown>(
      this.keyFor(BOARD_COLUMN_WIDTH_KEY),
      DEFAULT_COLUMN_WIDTH,
    );
    return isBoardColumnWidth(width) ? width : DEFAULT_COLUMN_WIDTH;
  }

  private getTerminalCardLimit(): BoardTerminalCardLimit {
    const limit = this.state.get<unknown>(
      this.keyFor(BOARD_TERMINAL_CARD_LIMIT_KEY),
      DEFAULT_TERMINAL_CARD_LIMIT,
    );
    return isBoardTerminalCardLimit(limit) ? limit : DEFAULT_TERMINAL_CARD_LIMIT;
  }

  private getColumnSorts(): Partial<Record<TodoStatus, BoardSort>> {
    const stored = this.state.get<unknown>(this.keyFor(BOARD_COLUMN_SORTS_KEY), {});
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(stored).filter(([status, sort]) => isTodoStatus(status) && isBoardSort(sort)),
    );
  }

  private getGrouping(): BoardGrouping {
    const grouping = this.state.get<unknown>(this.keyFor(BOARD_GROUPING_KEY), DEFAULT_GROUPING);
    return isBoardGrouping(grouping) ? grouping : DEFAULT_GROUPING;
  }

  private getWipLimits(): Partial<Record<TodoStatus, number>> {
    const stored = this.state.get<unknown>(this.keyFor(BOARD_WIP_LIMITS_KEY), {});
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(stored).filter(
        ([status, limit]) =>
          isTodoStatus(status) &&
          WIP_STATUS_SET.has(status) &&
          typeof limit === "number" &&
          Number.isInteger(limit) &&
          limit > 0 &&
          limit <= 999,
      ),
    );
  }

  private getBooleanPreference(key: string, fallback: boolean): boolean {
    const value = this.state.get<unknown>(this.keyFor(key), fallback);
    return typeof value === "boolean" ? value : fallback;
  }

  private getHtml(): string {
    const nonce = randomBytes(16).toString("hex");
    const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
    const template = readFileSync(
      path.join(__dirname, "../../resources/canvas/agendo-work-session/board.html"),
      "utf8",
    );
    const hostBootstrap =
      "((api) => { globalThis.agendoBoardHost = { postMessage: message => api.postMessage(message), onMessage: listener => window.addEventListener('message', event => listener(event.data)), getState: () => api.getState(), setState: state => api.setState(state) }; })(acquireVsCodeApi());";
    return template
      .replace("__AGENDO_BOARD_CSP__", csp)
      .replace("__AGENDO_BOARD_NONCE__", nonce)
      .replace("__AGENDO_BOARD_HOST__", hostBootstrap)
      .replace("__AGENDO_BOARD_NAV__", "");
  }
}
