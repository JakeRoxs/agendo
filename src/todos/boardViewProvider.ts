import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { Command } from "../commands";
import type { FilterService } from "./filterService";
import type { StatusService } from "./statusService";
import {
  TERMINAL_STATUSES,
  TODO_PRIORITIES,
  TODO_STATUSES,
  type Todo,
  type TodoStatus,
} from "./todoModel";
import type { DependencyGraph, TodoRepository } from "./todoRepository";

const STATUS_LABEL: Record<TodoStatus, string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  ready: "Ready",
  backlogged: "Backlog",
  complete: "Complete",
  cancelled: "Cancelled",
};

const STATUS_ICON: Record<TodoStatus, string> = {
  pending: "circle-outline",
  "in-progress": "pulse",
  ready: "play-circle",
  backlogged: "archive",
  complete: "pass-filled",
  cancelled: "circle-slash",
};

export interface BoardTodo {
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
): BoardSnapshot {
  const visibleTodos = todos.filter((todo) => filter.matches(todo, dependencyGraph));
  const columns = TODO_STATUSES.map((status) => {
    const columnTodos = visibleTodos
      .filter((todo) => todo.status === status)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((todo) => ({
        id: todo.id,
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

  return {
    columns,
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

interface BoardMessage {
  type:
    | "ready"
    | "open"
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
    | "resetBoardSettings";
  todoId?: string;
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
}

/** Renders the file-backed todo board in a reusable editor webview panel. */
export class BoardViewProvider implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly repositorySubscription: vscode.Disposable;

  constructor(
    private readonly repository: TodoRepository,
    private readonly filter: FilterService,
    private readonly status: StatusService,
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

    await this.handleTodoMessage(message);
  }

  private async handleTodoMessage(message: BoardMessage): Promise<void> {
    const todo = message.todoId
      ? this.repository.getTodos().find((candidate) => candidate.id === message.todoId)
      : undefined;
    if (!todo) {
      return;
    }

    switch (message.type) {
      case "open":
        await this.openTodo(todo);
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
      await this.status.deleteTodo(todo);
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
      await this.status.setStatus(todo, status);
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
      await this.status.setPriority(todo, priority);
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
          BOARD_CARD_DENSITY_KEY,
          message.density,
          isBoardCardDensity,
        );
      case "setBoardSort":
        return this.setValidatedPreference(BOARD_SORT_KEY, message.sort, isBoardSort);
      case "setDescriptionPreview":
        return this.setValidatedPreference(
          BOARD_DESCRIPTION_PREVIEW_KEY,
          message.descriptionPreview,
          isBoardDescriptionPreview,
        );
      case "setHideEmptyColumns":
        return this.setBooleanPreference(BOARD_HIDE_EMPTY_COLUMNS_KEY, message.enabled);
      case "setMetadataLabels":
        return this.setBooleanPreference(BOARD_SHOW_METADATA_LABELS_KEY, message.enabled);
      case "setDateFormat":
        return this.setValidatedPreference(
          BOARD_DATE_FORMAT_KEY,
          message.dateFormat,
          isBoardDateFormat,
        );
      case "setTagLimit":
        return this.setValidatedPreference(BOARD_TAG_LIMIT_KEY, message.tagLimit, isBoardTagLimit);
      case "setTitleWrapping":
        return this.setValidatedPreference(
          BOARD_TITLE_WRAPPING_KEY,
          message.titleWrapping,
          isBoardTitleWrapping,
        );
      case "setMissingValueBehavior":
        return this.setValidatedPreference(
          BOARD_MISSING_VALUE_BEHAVIOR_KEY,
          message.missingValueBehavior,
          isBoardMissingValueBehavior,
        );
      case "setCardAccent":
        return this.setValidatedPreference(
          BOARD_CARD_ACCENT_KEY,
          message.cardAccent,
          isBoardCardAccent,
        );
      case "setColumnWidth":
        return this.setValidatedPreference(
          BOARD_COLUMN_WIDTH_KEY,
          message.columnWidth,
          isBoardColumnWidth,
        );
      case "setTerminalCardLimit":
        return this.setValidatedPreference(
          BOARD_TERMINAL_CARD_LIMIT_KEY,
          message.terminalCardLimit,
          isBoardTerminalCardLimit,
        );
      case "setColumnSort":
        return this.setColumnSort(message.status, message.columnSort);
      case "setGrouping":
        return this.setValidatedPreference(BOARD_GROUPING_KEY, message.grouping, isBoardGrouping);
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
    await this.state.update(BOARD_HIDDEN_STATUSES_KEY, [...hiddenStatuses]);
    return true;
  }

  private async setStatusOrder(statuses: unknown): Promise<boolean> {
    if (!Array.isArray(statuses) || !statuses.every(isTodoStatus)) {
      return false;
    }
    await this.state.update(BOARD_STATUS_ORDER_KEY, normalizeBoardStatusOrder(statuses));
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
    await this.state.update(BOARD_HIDDEN_CARD_FIELDS_KEY, [...hiddenFields]);
    return true;
  }

  private async setCardFieldOrder(fields: unknown): Promise<boolean> {
    if (!Array.isArray(fields) || !fields.every(isBoardCardField)) {
      return false;
    }
    await this.state.update(BOARD_CARD_FIELD_ORDER_KEY, normalizeBoardCardFieldOrder(fields));
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
    await this.state.update(BOARD_COLUMN_SORTS_KEY, columnSorts);
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
    await this.state.update(BOARD_WIP_LIMITS_KEY, limits);
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
        [BOARD_CARD_DENSITY_KEY]: "compact",
        [BOARD_TITLE_WRAPPING_KEY]: "oneLine",
        [BOARD_DESCRIPTION_PREVIEW_KEY]: "hidden",
        [BOARD_TAG_LIMIT_KEY]: "2",
        [BOARD_HIDE_EMPTY_COLUMNS_KEY]: true,
        [BOARD_COLUMN_WIDTH_KEY]: "narrow",
        [BOARD_TERMINAL_CARD_LIMIT_KEY]: "25",
      },
      focus: {
        [BOARD_HIDDEN_STATUSES_KEY]: ["backlogged", "complete", "cancelled"],
        [BOARD_SORT_KEY]: "priority",
        [BOARD_HIDE_EMPTY_COLUMNS_KEY]: true,
        [BOARD_COLUMN_WIDTH_KEY]: "wide",
      },
      review: {
        [BOARD_CARD_DENSITY_KEY]: "comfortable",
        [BOARD_DESCRIPTION_PREVIEW_KEY]: "twoLines",
        [BOARD_SORT_KEY]: "updatedAt",
        [BOARD_DATE_FORMAT_KEY]: "relative",
        [BOARD_TERMINAL_CARD_LIMIT_KEY]: "50",
      },
    };
    await Promise.all(
      Object.entries(preferences[preset]).map(([key, value]) => this.state.update(key, value)),
    );
    return true;
  }

  private async resetBoardSettings(): Promise<boolean> {
    await Promise.all(
      [
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
      ].map((key) => this.state.update(key, undefined)),
    );
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
    snapshot.hideEmptyColumns = this.getBooleanPreference(BOARD_HIDE_EMPTY_COLUMNS_KEY, false);
    snapshot.columns = normalizeBoardStatusOrder(this.getStatusOrder()).flatMap((status) => {
      const column = snapshot.columns.find((candidate) => candidate.status === status);
      const visible = column && !hidden.has(column.status);
      return visible && !(snapshot.hideEmptyColumns && column.todos.length === 0) ? [column] : [];
    });
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
    snapshot.terminalCardLimit = this.getTerminalCardLimit();
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

    void this.panel.webview.postMessage({
      type: "snapshot",
      snapshot,
    });
  }

  private getHiddenStatuses(): TodoStatus[] {
    const hiddenStatuses = this.state.get<unknown[]>(BOARD_HIDDEN_STATUSES_KEY, []);
    return hiddenStatuses.filter(isTodoStatus);
  }

  private getStatusOrder(): TodoStatus[] {
    const order = this.state.get<unknown[]>(BOARD_STATUS_ORDER_KEY, []);
    return normalizeBoardStatusOrder(order.filter(isTodoStatus));
  }

  private getHiddenCardFields(): BoardCardField[] {
    const fields = this.state.get<unknown[]>(BOARD_HIDDEN_CARD_FIELDS_KEY, [
      ...DEFAULT_HIDDEN_CARD_FIELDS,
    ]);
    return fields.filter(isBoardCardField);
  }

  private getCardFieldOrder(): BoardCardField[] {
    const fields = this.state.get<unknown[]>(BOARD_CARD_FIELD_ORDER_KEY, []);
    return normalizeBoardCardFieldOrder(fields.filter(isBoardCardField));
  }

  private getCardDensity(): BoardCardDensity {
    const density = this.state.get<unknown>(BOARD_CARD_DENSITY_KEY, DEFAULT_CARD_DENSITY);
    return isBoardCardDensity(density) ? density : DEFAULT_CARD_DENSITY;
  }

  private getBoardSort(): BoardSort {
    const sort = this.state.get<unknown>(BOARD_SORT_KEY, DEFAULT_BOARD_SORT);
    return isBoardSort(sort) ? sort : DEFAULT_BOARD_SORT;
  }

  private getDescriptionPreview(): BoardDescriptionPreview {
    const preview = this.state.get<unknown>(
      BOARD_DESCRIPTION_PREVIEW_KEY,
      DEFAULT_DESCRIPTION_PREVIEW,
    );
    return isBoardDescriptionPreview(preview) ? preview : DEFAULT_DESCRIPTION_PREVIEW;
  }

  private getDateFormat(): BoardDateFormat {
    const format = this.state.get<unknown>(BOARD_DATE_FORMAT_KEY, DEFAULT_DATE_FORMAT);
    return isBoardDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  }

  private getTagLimit(): BoardTagLimit {
    const limit = this.state.get<unknown>(BOARD_TAG_LIMIT_KEY, DEFAULT_TAG_LIMIT);
    return isBoardTagLimit(limit) ? limit : DEFAULT_TAG_LIMIT;
  }

  private getTitleWrapping(): BoardTitleWrapping {
    const wrapping = this.state.get<unknown>(BOARD_TITLE_WRAPPING_KEY, DEFAULT_TITLE_WRAPPING);
    return isBoardTitleWrapping(wrapping) ? wrapping : DEFAULT_TITLE_WRAPPING;
  }

  private getMissingValueBehavior(): BoardMissingValueBehavior {
    const behavior = this.state.get<unknown>(
      BOARD_MISSING_VALUE_BEHAVIOR_KEY,
      DEFAULT_MISSING_VALUE_BEHAVIOR,
    );
    return isBoardMissingValueBehavior(behavior) ? behavior : DEFAULT_MISSING_VALUE_BEHAVIOR;
  }

  private getCardAccent(): BoardCardAccent {
    const accent = this.state.get<unknown>(BOARD_CARD_ACCENT_KEY, DEFAULT_CARD_ACCENT);
    return isBoardCardAccent(accent) ? accent : DEFAULT_CARD_ACCENT;
  }

  private getColumnWidth(): BoardColumnWidth {
    const width = this.state.get<unknown>(BOARD_COLUMN_WIDTH_KEY, DEFAULT_COLUMN_WIDTH);
    return isBoardColumnWidth(width) ? width : DEFAULT_COLUMN_WIDTH;
  }

  private getTerminalCardLimit(): BoardTerminalCardLimit {
    const limit = this.state.get<unknown>(
      BOARD_TERMINAL_CARD_LIMIT_KEY,
      DEFAULT_TERMINAL_CARD_LIMIT,
    );
    return isBoardTerminalCardLimit(limit) ? limit : DEFAULT_TERMINAL_CARD_LIMIT;
  }

  private getColumnSorts(): Partial<Record<TodoStatus, BoardSort>> {
    const stored = this.state.get<unknown>(BOARD_COLUMN_SORTS_KEY, {});
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(stored).filter(([status, sort]) => isTodoStatus(status) && isBoardSort(sort)),
    );
  }

  private getGrouping(): BoardGrouping {
    const grouping = this.state.get<unknown>(BOARD_GROUPING_KEY, DEFAULT_GROUPING);
    return isBoardGrouping(grouping) ? grouping : DEFAULT_GROUPING;
  }

  private getWipLimits(): Partial<Record<TodoStatus, number>> {
    const stored = this.state.get<unknown>(BOARD_WIP_LIMITS_KEY, {});
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
    const value = this.state.get<unknown>(key, fallback);
    return typeof value === "boolean" ? value : fallback;
  }

  private getHtml(): string {
    const nonce = randomBytes(16).toString("hex");
    const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
    return String.raw`<!DOCTYPE html>
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
    .settings-toggle { margin-left: auto; }
    button { background: var(--vscode-button-secondaryBackground); border: 0; color: var(--vscode-button-secondaryForeground); cursor: pointer; padding: 4px 8px; }
    button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .settings-panel { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin: 0 0 10px auto; max-width: 400px; padding: 10px; }
    .settings-panel[hidden] { display: none; }
    .settings-title { font-size: 0.95em; font-weight: 600; margin-bottom: 2px; }
    .settings-hint { color: var(--vscode-descriptionForeground); font-size: 0.8em; margin-bottom: 8px; }
    .settings-section-title { font-size: 0.85em; font-weight: 600; margin: 12px 0 4px; }
    .setting-control { align-items: center; display: grid; gap: 10px; grid-template-columns: 1fr minmax(130px, auto); margin: 6px 0; }
    select { background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border); color: var(--vscode-dropdown-foreground); padding: 3px 5px; }
    .reset-settings { margin-top: 10px; width: 100%; }
    .setting-row { align-items: center; border: 1px solid transparent; cursor: grab; display: flex; gap: 8px; padding: 5px; user-select: none; }
    .setting-row:hover { background: var(--vscode-list-hoverBackground); }
    .setting-row.drop-target { border-color: var(--vscode-focusBorder); }
    .setting-row:active { cursor: grabbing; }
    .board { display: grid; gap: 10px; grid-template-columns: repeat(var(--column-count, 1), minmax(150px, 1fr)); min-width: 780px; }
    .board[data-column-width="narrow"] { grid-template-columns: repeat(var(--column-count, 1), minmax(120px, 1fr)); min-width: 650px; }
    .board[data-column-width="wide"] { grid-template-columns: repeat(var(--column-count, 1), minmax(220px, 1fr)); min-width: 1100px; }
    .column { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; min-height: 180px; padding: 8px; }
    .column.over-wip { border-color: var(--vscode-charts-red); }
    .column.drop-target { border-color: var(--vscode-focusBorder); background: var(--vscode-list-hoverBackground); }
    .column-header { align-items: center; cursor: grab; display: flex; font-weight: 600; gap: 6px; justify-content: space-between; margin-bottom: 8px; user-select: none; }
    .column-header:active { cursor: grabbing; }
    .column-actions { align-items: center; display: flex; gap: 6px; }
    .hide-column { font-size: 0.8em; }
    .count { color: var(--vscode-descriptionForeground); font-size: 0.9em; font-weight: 400; }
    .count.over-wip { color: var(--vscode-charts-red); font-weight: 600; }
    .group-header { color: var(--vscode-descriptionForeground); font-size: 0.78em; font-weight: 600; margin: 10px 2px 3px; text-transform: uppercase; }
    .card { background: var(--vscode-sideBarSectionHeader-background); border: 1px solid var(--vscode-panel-border); border-left: 3px solid var(--vscode-panel-border); border-radius: 4px; cursor: grab; margin: 6px 0; padding: 8px; }
    .board[data-density="compact"] .card { margin: 3px 0; padding: 5px; }
    .board[data-density="compact"] .card-meta { margin-top: 2px; }
    .board[data-density="spacious"] .card { margin: 9px 0; padding: 12px; }
    .board[data-density="spacious"] .card-meta { margin-top: 7px; }
    .card:active { cursor: grabbing; }
    .card { position: relative; }
    .card-busy { align-items: center; background: color-mix(in srgb, var(--vscode-sideBar-background) 72%, transparent); border-radius: 4px; display: none; inset: 0; justify-content: center; position: absolute; }
    .card-busy::before { animation: agendo-spin 0.7s linear infinite; border: 2px solid var(--vscode-descriptionForeground); border-radius: 50%; border-top-color: transparent; height: 18px; width: 18px; }
    .card.busy .card-busy { display: flex; }
    @keyframes agendo-spin { to { transform: rotate(360deg); } }
    .card.accent-priority-p1, .card.accent-status-cancelled, .card.accent-blocked { border-left-color: var(--vscode-charts-red); }
    .card.accent-priority-p2 { border-left-color: var(--vscode-charts-yellow); }
    .card.accent-priority-p3, .card.accent-status-ready { border-left-color: var(--vscode-charts-blue); }
    .card.accent-status-pending { border-left-color: var(--vscode-descriptionForeground); }
    .card.accent-status-in-progress { border-left-color: var(--vscode-charts-orange); }
    .card.accent-status-backlogged { border-left-color: var(--vscode-charts-purple); }
    .card.accent-status-complete { border-left-color: var(--vscode-charts-green); }
    .card.blocked { box-shadow: inset 0 0 0 1px var(--vscode-charts-red); }
    .card-title { display: -webkit-box; font-weight: 600; overflow: hidden; -webkit-box-orient: vertical; }
    .card-title.oneLine { -webkit-line-clamp: 1; }
    .card-title.twoLines { -webkit-line-clamp: 2; }
    .card-title.unlimited { display: block; overflow: visible; }
    .card-description { color: var(--vscode-descriptionForeground); display: -webkit-box; font-size: 0.9em; margin-top: 5px; overflow: hidden; -webkit-box-orient: vertical; }
    .card-description.oneLine { -webkit-line-clamp: 1; }
    .card-description.twoLines { -webkit-line-clamp: 2; }
    .card-meta { color: var(--vscode-descriptionForeground); font-size: 0.85em; margin-top: 5px; }
    .card-actions { display: none; gap: 4px; margin-top: 7px; }
    .card:hover .card-actions, .card:focus-within .card-actions { display: flex; }
    .card-actions select, .card-actions button { font-size: 0.78em; min-width: 0; padding: 2px 4px; }
    .empty { color: var(--vscode-descriptionForeground); font-size: 0.9em; padding: 12px 4px; }
    @media (max-width: 900px) { .board { grid-template-columns: repeat(5, minmax(130px, 1fr)); } }
  </style>
</head>
<body>
  <div id="toolbar" class="toolbar" aria-label="Board controls"></div>
  <section id="settings" class="settings-panel" aria-label="Board card settings" hidden></section>
  <main id="board" class="board" aria-label="Agendo task board"></main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const toolbar = document.getElementById("toolbar");
    const settings = document.getElementById("settings");
    const board = document.getElementById("board");
    let draggedTodoId;
    let draggedStatus;
    let draggedCardField;
    let settingsOpen = false;

    function renderToolbar(snapshot) {
      toolbar.replaceChildren();
      if (snapshot.hiddenStatuses.length) {
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
      const settingsToggle = document.createElement("button");
      settingsToggle.className = "settings-toggle";
      settingsToggle.type = "button";
      settingsToggle.textContent = settingsOpen ? "Close card settings" : "Card settings";
      settingsToggle.setAttribute("aria-expanded", String(settingsOpen));
      settingsToggle.addEventListener("click", () => {
        settingsOpen = !settingsOpen;
        renderToolbar(snapshot);
        renderSettings(snapshot);
      });
      toolbar.append(settingsToggle);
    }

    function renderSettings(snapshot) {
      settings.hidden = !settingsOpen;
      settings.replaceChildren();
      if (!settingsOpen) return;

      const title = document.createElement("div");
      title.className = "settings-title";
      title.textContent = "Board settings";
      const hint = document.createElement("div");
      hint.className = "settings-hint";
      hint.textContent = "Appearance preferences are stored for this workspace.";
      settings.append(title, hint);

      settings.append(
        createSelectSetting("Apply preset", "", [
          ["", "Choose preset…"],
          ["default", "Default"],
          ["compact", "Compact"],
          ["focus", "Focus"],
          ["review", "Review"],
        ], "applyPreset", "preset"),
        createSelectSetting("Card density", snapshot.cardDensity, [
          ["compact", "Compact"],
          ["comfortable", "Comfortable"],
          ["spacious", "Spacious"],
        ], "setCardDensity", "density"),
        createSelectSetting("Sort cards", snapshot.sort, [
          ["default", "Default"],
          ["priority", "Priority"],
          ["id", "Agendo ID"],
          ["title", "Title"],
          ["createdAt", "Recently created"],
          ["updatedAt", "Recently modified"],
        ], "setBoardSort", "sort"),
        createSelectSetting("Description", snapshot.descriptionPreview, [
          ["hidden", "Hidden"],
          ["oneLine", "One line"],
          ["twoLines", "Two lines"],
        ], "setDescriptionPreview", "descriptionPreview"),
        createCheckboxSetting(
          "Hide empty columns",
          snapshot.hideEmptyColumns,
          "setHideEmptyColumns",
        ),
        createCheckboxSetting(
          "Show metadata labels",
          snapshot.showMetadataLabels,
          "setMetadataLabels",
        ),
        createSelectSetting("Date format", snapshot.dateFormat, [
          ["relative", "Relative"],
          ["short", "Short"],
          ["full", "Full"],
        ], "setDateFormat", "dateFormat"),
        createSelectSetting("Tag limit", snapshot.tagLimit, [
          ["all", "All"],
          ["1", "1 tag"],
          ["2", "2 tags"],
          ["3", "3 tags"],
          ["5", "5 tags"],
        ], "setTagLimit", "tagLimit"),
        createSelectSetting("Title wrapping", snapshot.titleWrapping, [
          ["oneLine", "One line"],
          ["twoLines", "Two lines"],
          ["unlimited", "Unlimited"],
        ], "setTitleWrapping", "titleWrapping"),
        createSelectSetting("Missing values", snapshot.missingValueBehavior, [
          ["omit", "Omit"],
          ["placeholder", "Show placeholder"],
        ], "setMissingValueBehavior", "missingValueBehavior"),
        createSelectSetting("Card accent", snapshot.cardAccent, [
          ["priority", "Priority"],
          ["status", "Status"],
          ["blocked", "Blocked state"],
          ["none", "None"],
        ], "setCardAccent", "cardAccent"),
        createSelectSetting("Column width", snapshot.columnWidth, [
          ["narrow", "Narrow"],
          ["standard", "Standard"],
          ["wide", "Wide"],
        ], "setColumnWidth", "columnWidth"),
        createSelectSetting("Complete/cancelled limit", snapshot.terminalCardLimit, [
          ["all", "Show all"],
          ["10", "10 per column"],
          ["25", "25 per column"],
          ["50", "50 per column"],
          ["100", "100 per column"],
        ], "setTerminalCardLimit", "terminalCardLimit"),
        createSelectSetting("Group cards", snapshot.grouping, [
          ["none", "None"],
          ["priority", "Priority"],
          ["group", "Group"],
          ["epic", "Epic"],
        ], "setGrouping", "grouping"),
      );

      const columnRulesTitle = document.createElement("div");
      columnRulesTitle.className = "settings-section-title";
      columnRulesTitle.textContent = "Column rules";
      settings.append(columnRulesTitle);
      for (const status of ["pending", "in-progress", "ready", "backlogged", "complete", "cancelled"]) {
        settings.append(createSelectSetting(
          status + " sort",
          snapshot.columnSorts[status] || "global",
          [
            ["global", "Use global sort"],
            ["default", "Default"],
            ["priority", "Priority"],
            ["id", "Agendo ID"],
            ["title", "Title"],
            ["createdAt", "Recently created"],
            ["updatedAt", "Recently modified"],
          ],
          "setColumnSort",
          "columnSort",
          { status },
        ));
      }
      settings.append(
        createNumberSetting("Pending WIP limit", snapshot.wipLimits.pending || 0, "pending"),
        createNumberSetting("In Progress WIP limit", snapshot.wipLimits["in-progress"] || 0, "in-progress"),
        createNumberSetting("Ready WIP limit", snapshot.wipLimits.ready || 0, "ready"),
      );

      const metadataTitle = document.createElement("div");
      metadataTitle.className = "settings-section-title";
      metadataTitle.textContent = "Card metadata";
      const metadataHint = document.createElement("div");
      metadataHint.className = "settings-hint";
      metadataHint.textContent = "Choose visible fields and drag rows to reorder them.";
      settings.append(metadataTitle, metadataHint);

      for (const preference of snapshot.cardFields) {
        const row = document.createElement("div");
        row.className = "setting-row";
        row.dataset.field = preference.field;
        row.draggable = true;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = preference.visible;
        checkbox.setAttribute("aria-label", "Show " + preference.label);
        checkbox.addEventListener("change", () => vscode.postMessage({
          type: "setCardFieldVisibility",
          field: preference.field,
          visible: checkbox.checked,
        }));
        const label = document.createElement("span");
        label.textContent = preference.label;
        row.append(checkbox, label);
        row.addEventListener("dragstart", (event) => {
          if (event.target === checkbox) {
            event.preventDefault();
            return;
          }
          draggedCardField = preference.field;
        });
        row.addEventListener("dragover", (event) => {
          event.preventDefault();
          row.classList.add("drop-target");
        });
        row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
        row.addEventListener("dragend", () => { draggedCardField = undefined; });
        row.addEventListener("drop", (event) => {
          event.preventDefault();
          row.classList.remove("drop-target");
          if (!draggedCardField || draggedCardField === preference.field) return;
          const fields = Array.from(settings.querySelectorAll(".setting-row"))
            .map((element) => element.dataset.field);
          const fromIndex = fields.indexOf(draggedCardField);
          const toIndex = fields.indexOf(preference.field);
          fields.splice(fromIndex, 1);
          fields.splice(toIndex, 0, draggedCardField);
          draggedCardField = undefined;
          vscode.postMessage({ type: "reorderCardFields", fields });
        });
        settings.append(row);
      }

      const reset = document.createElement("button");
      reset.className = "reset-settings";
      reset.type = "button";
      reset.textContent = "Reset board settings";
      reset.addEventListener("click", () => vscode.postMessage({ type: "resetBoardSettings" }));
      settings.append(reset);
    }

    function createSelectSetting(labelText, value, options, messageType, property, extra = {}) {
      const control = document.createElement("label");
      control.className = "setting-control";
      const label = document.createElement("span");
      label.textContent = labelText;
      const select = document.createElement("select");
      for (const [optionValue, optionLabel] of options) {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionLabel;
        option.selected = optionValue === value;
        select.append(option);
      }
      select.addEventListener("change", () => vscode.postMessage({
        type: messageType,
        [property]: select.value,
        ...extra,
      }));
      control.append(label, select);
      return control;
    }

    function createNumberSetting(labelText, value, status) {
      const control = document.createElement("label");
      control.className = "setting-control";
      const label = document.createElement("span");
      label.textContent = labelText;
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "999";
      input.value = String(value);
      input.title = "Use 0 to disable";
      input.addEventListener("change", () => vscode.postMessage({
        type: "setWipLimit",
        status,
        limit: Number(input.value),
      }));
      control.append(label, input);
      return control;
    }

    function createCheckboxSetting(labelText, enabled, messageType) {
      const control = document.createElement("label");
      control.className = "setting-control";
      const label = document.createElement("span");
      label.textContent = labelText;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = enabled;
      checkbox.addEventListener("change", () => vscode.postMessage({
        type: messageType,
        enabled: checkbox.checked,
      }));
      control.append(label, checkbox);
      return control;
    }

    function formatDate(timestamp, format) {
      const date = new Date(timestamp);
      if (format === "short") {
        return date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
      }
      if (format === "relative") {
        const seconds = Math.round((timestamp - Date.now()) / 1000);
        const absoluteSeconds = Math.abs(seconds);
        const [value, unit] = absoluteSeconds < 60
          ? [seconds, "second"]
          : absoluteSeconds < 3600
            ? [Math.round(seconds / 60), "minute"]
            : absoluteSeconds < 86400
              ? [Math.round(seconds / 3600), "hour"]
              : [Math.round(seconds / 86400), "day"];
        return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(value, unit);
      }
      return date.toLocaleString();
    }

    function labelMetadata(label, value, snapshot) {
      return value && snapshot.showMetadataLabels ? label + ": " + value : value;
    }

    function optionalMetadata(label, value, snapshot) {
      if (value) return labelMetadata(label, value, snapshot);
      return snapshot.missingValueBehavior === "placeholder"
        ? labelMetadata(label, "—", snapshot)
        : undefined;
    }

    function tagValues(todo, snapshot) {
      const limit = snapshot.tagLimit === "all" ? todo.tags.length : Number(snapshot.tagLimit);
      const tags = todo.tags.slice(0, limit);
      const hiddenCount = todo.tags.length - tags.length;
      if (hiddenCount > 0) tags.push("+" + hiddenCount);
      if (!tags.length) return [optionalMetadata("Tags", undefined, snapshot)];
      return snapshot.showMetadataLabels
        ? [labelMetadata("Tags", tags.join(", "), snapshot)]
        : tags;
    }

    function cardAccentClass(todo, accent) {
      switch (accent) {
        case "priority": return "accent-priority-" + todo.priority;
        case "status": return "accent-status-" + todo.status;
        case "blocked": return todo.blocked ? "accent-blocked" : "";
        default: return "";
      }
    }

    function cardFieldValues(todo, field, snapshot) {
      switch (field) {
        case "id": return [labelMetadata("ID", todo.id, snapshot)];
        case "key": return [optionalMetadata("Key", todo.key, snapshot)];
        case "priority": return [labelMetadata("Priority", todo.priority.toUpperCase(), snapshot)];
        case "group": return [optionalMetadata("Group", todo.group, snapshot)];
        case "blocked": return [todo.blocked
          ? labelMetadata("State", "Blocked", snapshot)
          : optionalMetadata("State", undefined, snapshot)];
        case "tags": return tagValues(todo, snapshot);
        case "createdAt": return [todo.createdAt
          ? labelMetadata("Created", formatDate(todo.createdAt, snapshot.dateFormat), snapshot)
          : optionalMetadata("Created", undefined, snapshot)];
        case "updatedAt": return [todo.updatedAt
          ? labelMetadata("Modified", formatDate(todo.updatedAt, snapshot.dateFormat), snapshot)
          : optionalMetadata("Modified", undefined, snapshot)];
        default: return [];
      }
    }

    function groupTodos(todos, grouping) {
      if (grouping === "none") return [{ label: "", todos }];
      const groups = new Map();
      for (const todo of todos) {
        const label = grouping === "priority"
          ? todo.priority.toUpperCase()
          : grouping === "group"
            ? todo.group || "Ungrouped"
            : todo.epic
              ? "Epic"
              : "Standard";
        const group = groups.get(label) || [];
        group.push(todo);
        groups.set(label, group);
      }
      return Array.from(groups, ([label, groupedTodos]) => ({ label, todos: groupedTodos }));
    }

    function createQuickSelect(todo, value, options, type, property, label) {
      const select = document.createElement("select");
      select.setAttribute("aria-label", label);
      for (const [optionValue, optionLabel] of options) {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionLabel;
        option.selected = optionValue === value;
        select.append(option);
      }
      select.addEventListener("click", (event) => event.stopPropagation());
      select.addEventListener("change", (event) => {
        event.stopPropagation();
        vscode.postMessage({ type, todoId: todo.id, [property]: select.value });
      });
      return select;
    }

    function createCard(todo, snapshot) {
      const card = document.createElement("article");
      card.className = ["card", cardAccentClass(todo, snapshot.cardAccent), todo.blocked ? "blocked" : ""]
        .filter(Boolean)
        .join(" ");
      card.dataset.todoId = todo.id;
      card.title = [
        todo.createdAt ? "Created " + new Date(todo.createdAt).toLocaleString() : undefined,
        todo.updatedAt ? "Modified " + new Date(todo.updatedAt).toLocaleString() : undefined,
      ]
        .filter(Boolean)
        .join("\n") || "File timestamps unavailable";
      card.draggable = true;
      card.addEventListener("dragstart", (event) => {
        event.stopPropagation();
        draggedTodoId = todo.id;
      });
      card.addEventListener("dragend", () => { draggedTodoId = undefined; });
      card.addEventListener("click", () => vscode.postMessage({ type: "open", todoId: todo.id }));

      const title = document.createElement("div");
      title.className = "card-title " + snapshot.titleWrapping;
      title.textContent = todo.title;
      const description = document.createElement("div");
      description.className = "card-description " + snapshot.descriptionPreview;
      description.textContent = todo.summary || "";
      const meta = document.createElement("div");
      meta.className = "card-meta";
      meta.textContent = snapshot.cardFields
        .filter((preference) => preference.visible)
        .flatMap((preference) => cardFieldValues(todo, preference.field, snapshot))
        .filter(Boolean)
        .join(" · ");
      card.append(title);
      if (description.textContent && snapshot.descriptionPreview !== "hidden") card.append(description);
      if (meta.textContent) card.append(meta);

      const actions = document.createElement("div");
      actions.className = "card-actions";
      actions.addEventListener("click", (event) => event.stopPropagation());
      actions.append(
        createQuickSelect(todo, todo.status, [
          ["pending", "Pending"],
          ["in-progress", "In Progress"],
          ["ready", "Ready"],
          ["backlogged", "Backlog"],
          ["complete", "Complete"],
          ["cancelled", "Cancelled"],
        ], "setStatus", "status", "Change status"),
        createQuickSelect(todo, todo.priority, [
          ["p1", "P1"],
          ["p2", "P2"],
          ["p3", "P3"],
        ], "setPriority", "priority", "Change priority"),
      );
       if (todo.key) {
         const ticket = document.createElement("button");
         ticket.type = "button";
         ticket.textContent = "Ticket";
         ticket.title = "Open URL or copy external key";
         ticket.addEventListener("click", (event) => {
           event.stopPropagation();
           vscode.postMessage({ type: "openExternalKey", todoId: todo.id });
         });
         actions.append(ticket);
       }
       const deleteBtn = document.createElement("button");
       deleteBtn.type = "button";
        deleteBtn.textContent = "Delete";
        deleteBtn.title = "Delete this todo (cannot be undone)";
        deleteBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          if (confirm("Delete todo " + todo.id + " (" + todo.title + ")? This cannot be undone.")) {
            vscode.postMessage({ type: "delete", todoId: todo.id });
          }
        });
        actions.append(deleteBtn);
      card.append(actions);
      const busy = document.createElement("div");
      busy.className = "card-busy";
      busy.setAttribute("aria-label", "Processing");
      busy.addEventListener("click", (event) => event.stopPropagation());
      busy.addEventListener("dragstart", (event) => event.stopPropagation());
      card.append(busy);
      return card;
    }

    function render(snapshot) {
      renderToolbar(snapshot);
      renderSettings(snapshot);
      board.style.setProperty("--column-count", String(Math.max(snapshot.columns.length, 1)));
      board.dataset.density = snapshot.cardDensity;
      board.dataset.columnWidth = snapshot.columnWidth;
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
        const overWip = column.wipLimit && column.totalCount > column.wipLimit;
        count.className = "count" + (overWip ? " over-wip" : "");
        const visibleCount = column.todos.length === column.totalCount
          ? String(column.totalCount)
          : column.todos.length + " / " + column.totalCount;
        count.textContent = column.wipLimit ? visibleCount + " · WIP " + column.wipLimit : visibleCount;
        if (overWip) columnElement.classList.add("over-wip");
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

        for (const group of groupTodos(column.todos, snapshot.grouping)) {
          if (group.label) {
            const groupHeader = document.createElement("div");
            groupHeader.className = "group-header";
            groupHeader.textContent = group.label + " · " + group.todos.length;
            columnElement.append(groupHeader);
          }
          for (const todo of group.todos) {
            columnElement.append(createCard(todo, snapshot));
          }
        }
        board.append(columnElement);
      }
    }

    window.addEventListener("message", (event) => {
      if (event.data.type === "busy") {
        const card = board.querySelector('[data-todo-id="' + event.data.todoId + '"]');
        if (card) card.classList.add("busy");
        return;
      }
      if (event.data.type === "snapshot") render(event.data.snapshot);
    });
    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
  }
}
