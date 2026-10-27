import * as vscode from "vscode";
import { Command } from "../commands";
import { Settings } from "../configuration";
import {
  type ConfigService,
  DEFAULT_TODOS_CONFIG,
  isViewMode,
  type ViewMode,
} from "./configService";
import { TODO_STATUSES, type TodoStatus } from "./todoModel";
import type { BoardViewProvider } from "./boardViewProvider";
import { validateSonarUrl } from "./codeScanningService";
import type { TodoRepository } from "./todoRepository";
import type { TodoTreeProvider } from "./todoTreeProvider";
import type { SkillStatusTreeProvider } from "./skillStatusTreeProvider";

const GROUP_BY_MODES = ["status", "priority", "group", "none"];
const DEFAULT_PRIORITIES = ["p1", "p2", "p3"];

/** Lifecycle statuses used to validate board visibility actions. */
const TODO_STATUS_SET = new Set<TodoStatus>(TODO_STATUSES);

/** A todo status is a known lifecycle token. */
function isTodoStatus(value: unknown): value is TodoStatus {
  return typeof value === "string" && TODO_STATUS_SET.has(value as TodoStatus);
}

/** A configured update source is an HTTPS base URL without embedded credentials. */
function isValidSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/**
 * Validated settings actions for the consolidated settings canvas.
 *
 * Workspace-scoped actions write through the injected setter. Project-data
 * actions also refresh the config projection and gitignore; display, connection,
 * and update preferences are not projected to the agent config. User-default
 * actions write through the global setter so they are unaffected by workspace
 * overrides. Board column visibility
 * is persisted per scope in the board view provider's memento. Navigation and
 * component actions execute their underlying VS Code commands.
 */
export class SettingsService {
  private readonly get: <T>(key: Settings) => T;
  private readonly set: (key: Settings, value: unknown) => PromiseLike<void>;
  private readonly setDefault: (key: Settings, value: unknown) => PromiseLike<void>;
  private readonly executeCommand: (command: string, ...args: unknown[]) => Promise<unknown>;
  private readonly config: ConfigService;
  private readonly boardViewProvider: BoardViewProvider;
  private readonly scanningBoardViewProvider: BoardViewProvider;
  private readonly repository: TodoRepository;
  private readonly treeProvider: TodoTreeProvider;
  private readonly scanningTreeProvider: TodoTreeProvider;
  private readonly skillStatusTreeProvider: SkillStatusTreeProvider;
  private readonly extensionVersion: string;
  private readonly getSkillStatus: () => Promise<unknown>;
  private readonly getCanvasStatus: () => Promise<unknown>;

  constructor(context: {
    get: <T>(key: Settings) => T;
    set: (key: Settings, value: unknown) => PromiseLike<void>;
    setDefault: (key: Settings, value: unknown) => PromiseLike<void>;
    executeCommand: (command: string, ...args: unknown[]) => Promise<unknown>;
    config: ConfigService;
    boardViewProvider: BoardViewProvider;
    scanningBoardViewProvider: BoardViewProvider;
    repository: TodoRepository;
    treeProvider: TodoTreeProvider;
    scanningTreeProvider: TodoTreeProvider;
    skillStatusTreeProvider: SkillStatusTreeProvider;
    extensionVersion: string;
    getSkillStatus: () => Promise<unknown>;
    getCanvasStatus: () => Promise<unknown>;
  }) {
    this.get = context.get;
    this.set = context.set;
    this.setDefault = context.setDefault;
    this.executeCommand = context.executeCommand;
    this.config = context.config;
    this.boardViewProvider = context.boardViewProvider;
    this.scanningBoardViewProvider = context.scanningBoardViewProvider;
    this.repository = context.repository;
    this.treeProvider = context.treeProvider;
    this.scanningTreeProvider = context.scanningTreeProvider;
    this.skillStatusTreeProvider = context.skillStatusTreeProvider;
    this.extensionVersion = context.extensionVersion;
    this.getSkillStatus = context.getSkillStatus;
    this.getCanvasStatus = context.getCanvasStatus;
  }

  /** Read-only snapshot of the effective settings for the settings canvas. */
  async getSettingsInfo(): Promise<SettingsInfo> {
    const skillStatus = await this.getSkillStatus();
    const canvasStatus = await this.getCanvasStatus();
    return {
      extensionVersion: this.extensionVersion,
      skill: skillStatus,
      canvas: canvasStatus,
      workspace: {
        root: this.config.root,
        gitignored: this.config.gitignored,
        backloggedFolder: this.config.backloggedFolder,
        cancelledFolder: this.config.cancelledFolder,
        completedFolder: this.config.completedFolder,
        codeScanningEnabled: this.get<boolean>(Settings.CodeScanningEnabled),
        sonarQubeUrl: this.get<string>(Settings.SonarQubeUrl),
        sonarQubeProjectKey: this.get<string>(Settings.SonarQubeProjectKey),
      },
      viewOptions: {
        groupBy: this.get<string>(Settings.GroupBy),
        sortByDate: this.get<boolean>(Settings.SortByDate),
        viewMode: this.config.viewMode,
        showDependencyNodes: this.get<boolean>(Settings.ShowDependencyNodes),
        codeScanningSortByDate: this.get<boolean>(Settings.CodeScanningSortByDate),
        criteriaChangesEnabled: this.get<boolean>(Settings.CriteriaChangesEnabled),
        skillUpdateCheck: this.get<boolean>(Settings.SkillUpdateCheck),
        skillUpdateSource: this.get<string>(Settings.SkillUpdateSource),
        canvasUpdateSource: this.get<string>(Settings.CanvasUpdateSource),
      },
      defaults: {
        root: this.globalValue(Settings.Root) ?? DEFAULT_TODOS_CONFIG.root,
        priority: this.globalValue<"p1" | "p2" | "p3">(Settings.DefaultPriority) ?? "p3",
        viewMode: this.globalValue<ViewMode>(Settings.ViewMode) ?? "default",
      },
      boards: [
        {
          scope: "todos",
          hiddenStatuses: this.boardViewProvider.getHiddenStatuses(),
        },
        {
          scope: "code-scanning",
          hiddenStatuses: this.scanningBoardViewProvider.getHiddenStatuses(),
        },
      ],
    };
  }

  /** Validate and apply a settings action from the canvas. */
  async handleSettingsAction(payload: unknown): Promise<SettingsActionResult> {
    const action = this.requireString(payload, "action");
    const component = this.requireOptionalString(payload, "component");
    const scope = this.requireOptionalString(payload, "scope");
    switch (action) {
      case "open-extension-settings":
        await this.executeCommand("workbench.action.openSettings", "@ext:agendo.agendo");
        return { success: true, reload: false };
      case "open-board":
        if (scope !== undefined && scope !== "todos" && scope !== "code-scanning") {
          throw new Error(`Invalid board scope: ${scope}`);
        }
        if (scope === "code-scanning") {
          await this.executeCommand(Command.CodeScanningOpenBoard);
        } else {
          await this.executeCommand(Command.OpenBoard);
        }
        return { success: true, reload: false };
      case "open-tree":
        await this.executeCommand("workbench.view.extension.agendo");
        return { success: true, reload: false };
      case "check-source":
      case "install": {
        if (component !== "skill" && component !== "canvas") {
          throw new Error(`Invalid component: ${component}`);
        }
        await this.executeCommand(
          component === "skill" ? Command.ManageSkill : Command.ManageCanvas,
        );
        return { success: true };
      }
      case "set-group-by": {
        const obj = this.requireObject(payload);
        const value = obj.value;
        const mode = value !== undefined ? value : obj.scope;
        if (typeof mode !== "string" || !GROUP_BY_MODES.includes(mode)) {
          throw new Error(`Invalid groupBy mode: ${mode}`);
        }
        await this.set(Settings.GroupBy, mode);
        await this.treeProvider.refresh();
        await this.scanningTreeProvider.refresh();
        return { success: true };
      }
      case "toggle-criteria-changes": {
        const enabled = this.get<boolean>(Settings.CriteriaChangesEnabled);
        await this.set(Settings.CriteriaChangesEnabled, !enabled);
        await this.treeProvider.refresh();
        await this.scanningTreeProvider.refresh();
        return { success: true };
      }
      case "set-criteria-changes-enabled": {
        const enabled = this.requireBoolean(payload, "value");
        await this.set(Settings.CriteriaChangesEnabled, enabled);
        await this.treeProvider.refresh();
        await this.scanningTreeProvider.refresh();
        return { success: true };
      }
      case "set-view-mode": {
        const mode = this.requireString(payload, "value");
        if (!isViewMode(mode)) {
          throw new Error(`Invalid view mode: ${mode}`);
        }
        await this.set(Settings.ViewMode, mode);
        this.skillStatusTreeProvider.refresh();
        return { success: true };
      }
      case "set-sort-by-date": {
        const enabled = this.requireBoolean(payload, "value");
        await this.set(Settings.SortByDate, enabled);
        await this.treeProvider.refresh();
        await this.scanningTreeProvider.refresh();
        return { success: true };
      }
      case "set-code-scanning-sort-by-date": {
        const enabled = this.requireBoolean(payload, "value");
        await this.set(Settings.CodeScanningSortByDate, enabled);
        await this.scanningTreeProvider.refresh();
        return { success: true };
      }
      case "set-root": {
        const value = this.requireRelativePath(payload, "value");
        await this.set(Settings.Root, value);
        await this.refreshConfigProjection();
        await this.repository.refresh();
        return { success: true };
      }
      case "set-gitignored": {
        const enabled = this.requireBoolean(payload, "value");
        await this.set(Settings.GitignoreTodos, enabled);
        await this.refreshConfigProjection();
        await this.repository.refresh();
        return { success: true };
      }
      case "set-backlogged-folder": {
        const value = this.requireFolderName(payload, "value");
        await this.set(Settings.BackloggedFolder, value);
        await this.refreshConfigProjection();
        await this.repository.refresh();
        return { success: true };
      }
      case "set-cancelled-folder": {
        const value = this.requireFolderName(payload, "value");
        await this.set(Settings.CancelledFolder, value);
        await this.refreshConfigProjection();
        await this.repository.refresh();
        return { success: true };
      }
      case "set-completed-folder": {
        const value = this.requireFolderName(payload, "value");
        await this.set(Settings.CompletedFolder, value);
        await this.refreshConfigProjection();
        await this.repository.refresh();
        return { success: true };
      }
      case "set-code-scanning-enabled": {
        const enabled = this.requireBoolean(payload, "value");
        await this.set(Settings.CodeScanningEnabled, enabled);
        await this.refreshConfigProjection();
        await this.repository.refresh();
        return { success: true };
      }
      case "set-sonarqube-url": {
        const value = this.requireString(payload, "value");
        const trimmed = value.trim();
        if (trimmed) {
          validateSonarUrl(trimmed);
        }
        await this.set(Settings.SonarQubeUrl, trimmed);
        return { success: true };
      }
      case "set-sonarqube-project-key": {
        const value = this.requireString(payload, "value");
        await this.set(Settings.SonarQubeProjectKey, value.trim());
        return { success: true };
      }
      case "set-default-root": {
        const value = this.requireRelativePath(payload, "value");
        await this.setDefault(Settings.Root, value);
        return { success: true };
      }
      case "set-default-priority": {
        const value = this.requireString(payload, "value");
        if (!DEFAULT_PRIORITIES.includes(value)) {
          throw new Error(`Invalid default priority: ${value}`);
        }
        await this.setDefault(Settings.DefaultPriority, value);
        return { success: true };
      }
      case "set-default-preview": {
        const mode = this.requireString(payload, "value");
        if (!isViewMode(mode)) {
          throw new Error(`Invalid default preview mode: ${mode}`);
        }
        await this.setDefault(Settings.ViewMode, mode);
        return { success: true };
      }
      case "set-show-dependency-nodes": {
        const enabled = this.requireBoolean(payload, "value");
        await this.set(Settings.ShowDependencyNodes, enabled);
        await this.treeProvider.refresh();
        await this.scanningTreeProvider.refresh();
        return { success: true };
      }
      case "set-skill-update-check": {
        const enabled = this.requireBoolean(payload, "value");
        await this.set(Settings.SkillUpdateCheck, enabled);
        return { success: true };
      }
      case "set-skill-update-source": {
        const value = this.requireString(payload, "value");
        const trimmed = value.trim();
        if (trimmed && !isValidSourceUrl(trimmed)) {
          throw new Error("Use an HTTPS skill update source URL without credentials, query, or fragment.");
        }
        await this.set(Settings.SkillUpdateSource, trimmed);
        return { success: true };
      }
      case "set-canvas-update-source": {
        const value = this.requireString(payload, "value");
        const trimmed = value.trim();
        if (trimmed && !isValidSourceUrl(trimmed)) {
          throw new Error("Use an HTTPS canvas update source URL without credentials, query, or fragment.");
        }
        await this.set(Settings.CanvasUpdateSource, trimmed);
        return { success: true };
      }
      case "set-board-status-visibility": {
        const visible = this.requireBoolean(payload, "value");
        const boardScope = this.requireBoardScope(payload, "scope");
        const status = this.requireTodoStatus(payload, "status");
        const provider =
          boardScope === "code-scanning" ? this.scanningBoardViewProvider : this.boardViewProvider;
        await provider.setStatusVisibility(status, visible);
        provider.refresh();
        return { success: true };
      }
      default:
        throw new Error(`Unknown settings action: ${action}`);
    }
  }

  private requireString(payload: unknown, key: string): string {
    const obj = this.requireObject(payload);
    const value = obj[key];
    if (typeof value !== "string") {
      throw new Error(`Missing or invalid string setting: ${key}`);
    }
    return value;
  }

  private requireOptionalString(payload: unknown, key: string): string | undefined {
    const obj = this.requireObject(payload);
    const value = obj[key];
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw new Error(`Missing or invalid string setting: ${key}`);
    }
    return value;
  }

  private requireBoolean(payload: unknown, key: string): boolean {
    const obj = this.requireObject(payload);
    const value = obj[key];
    if (typeof value !== "boolean") {
      throw new Error(`Missing or invalid boolean setting: ${key}`);
    }
    return value;
  }

  private requireObject(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Expected a settings action object");
    }
    return payload as Record<string, unknown>;
  }

  private requireRelativePath(payload: unknown, key: string): string {
    const value = this.requireString(payload, key);
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(`Invalid relative path: ${value}`);
    }
    // Reject null/control characters.
    if (trimmed.split("").some((ch) => ch.charCodeAt(0) < 0x20)) {
      throw new Error(`Invalid relative path: ${value}`);
    }
    const normalized = trimmed.replace(/\\/g, "/");
    // Reject Windows drive paths (C:\...) and absolute paths.
    if (/^[A-Za-z]:/.test(normalized)) {
      throw new Error(`Invalid relative path: ${value}`);
    }
    if (normalized.startsWith("/")) {
      throw new Error(`Invalid relative path: ${value}`);
    }
    // Reject . and .. path segments (allow nested relative folders like a/b).
    for (const segment of normalized.split("/")) {
      if (segment === "." || segment === "..") {
        throw new Error(`Invalid relative path: ${value}`);
      }
    }
    return normalized;
  }

  private requireBoardScope(payload: unknown, key: string): "todos" | "code-scanning" {
    const value = this.requireString(payload, key);
    if (value !== "todos" && value !== "code-scanning") {
      throw new Error(`Invalid board scope: ${value}`);
    }
    return value;
  }

  private requireFolderName(payload: unknown, key: string): string {
    const value = this.requireRelativePath(payload, key);
    // The shared canvas loader reads lifecycle folders as a single subfolder name.
    if (!/^[\w.-]+$/.test(value)) {
      throw new Error("Use a single folder name containing letters, numbers, underscores, dots, or hyphens.");
    }
    return value;
  }

  private requireTodoStatus(payload: unknown, key: string): TodoStatus {
    const value = this.requireString(payload, key);
    if (!isTodoStatus(value)) {
      throw new Error(`Invalid status: ${value}`);
    }
    return value;
  }

  private globalValue<T>(key: Settings): T | undefined {
    const config = vscode.workspace.getConfiguration(Settings.Identifier);
    const inspect = config.inspect<T>(key);
    return inspect?.globalValue;
  }

  private async refreshConfigProjection(): Promise<void> {
    await this.config.writeConfigFile();
    await this.config.applyGitignore();
  }
}

export interface SettingsInfo {
  extensionVersion: string;
  skill: unknown;
  canvas: unknown;
  workspace: {
    root: string;
    gitignored: boolean;
    backloggedFolder: string;
    cancelledFolder: string;
    completedFolder: string;
    codeScanningEnabled: boolean;
    sonarQubeUrl: string;
    sonarQubeProjectKey: string;
  };
  viewOptions: {
    groupBy: string;
    sortByDate: boolean;
    viewMode: ViewMode;
    showDependencyNodes: boolean;
    codeScanningSortByDate: boolean;
    criteriaChangesEnabled: boolean;
    skillUpdateCheck: boolean;
    skillUpdateSource: string;
    canvasUpdateSource: string;
  };
  defaults: {
    root: string;
    priority: string;
    viewMode: string;
  };
  boards: Array<{
    scope: "todos" | "code-scanning";
    hiddenStatuses: TodoStatus[];
  }>;
}

export type SettingsActionResult = { success: true; reload?: boolean };
