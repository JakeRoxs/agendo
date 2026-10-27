import { basename } from "node:path";
import * as vscode from "vscode";
import { BusyIndicator } from "./busyIndicator";
import { registerCommands, updateFilterContexts } from "./commandRegistration";
import { Command } from "./commands";
import { get, Settings, set } from "./configuration";
import { out, outputChannel } from "./output";
import { BoardViewProvider } from "./todos/boardViewProvider";
import { createCanvasHostActions } from "./todos/canvasHostActions";
import { CanvasManager } from "./todos/canvasManager";
import { CanvasViewer } from "./todos/canvasViewer";
import { ConfigService } from "./todos/configService";
import { FilterService } from "./todos/filterService";
import { LinkService } from "./todos/linkService";
import { SkillManager } from "./todos/skillManager";
import { SkillStatusTreeProvider } from "./todos/skillStatusTreeProvider";
import { StatusService } from "./todos/statusService";
import { findTodoCollisions } from "./todos/todoCollisions";
import { TodoRepository } from "./todos/todoRepository";
import { getTreeNodeKey, TodoTreeProvider, type TreeNode } from "./todos/todoTreeProvider";
import { TreeStateService } from "./todos/treeStateService";

export async function activate(context: vscode.ExtensionContext) {
  out`${Settings.Identifier} activated`;

  const config = new ConfigService();
  const repository = new TodoRepository(config);
  const filter = new FilterService(context.workspaceState);
  const treeState = new TreeStateService(context.workspaceState);
  const scanningFilter = new FilterService(context.workspaceState, "agendo.codeScanning.filter");
  const scanningTreeState = new TreeStateService(
    context.workspaceState,
    "agendo.codeScanning.tree.collapsed",
  );
  const status = new StatusService(config, repository);
  const links = new LinkService(config);
  const skill = new SkillManager(context.extensionUri);
  const canvas = new CanvasManager(context.extensionUri);
  const taskActions = createCanvasHostActions({ repository, status, links });
  const canvasViewer = new CanvasViewer(context.extensionUri, {
    ...taskActions,
    getBoardSnapshot: async (scope) => {
      return (
        scope === "code-scanning" ? scanningBoardViewProvider : boardViewProvider
      ).getSnapshot();
    },
    handleBoardMessage: async (scope, message) => {
      await (scope === "code-scanning"
        ? scanningBoardViewProvider
        : boardViewProvider
      ).handleCanvasMessage(message);
    },
    getDigest: async (scope) => {
      const { buildTodoDigest } = await import("./todos/digestService");
      const { matchesTodoScope } = await import("./todos/todoModel");
      const todos = repository.getTodos().filter((todo) => matchesTodoScope(todo, scope));
      const content = buildTodoDigest(todos, repository.getDependencyGraph());
      return { content };
    },
    getSettingsInfo: async () => {
      let skillStatus: unknown;
      try {
        skillStatus = await skill.getStatus();
      } catch {
        /* ignore */
      }
      let canvasStatus: unknown;
      try {
        canvasStatus = await canvas.getStatus();
      } catch {
        /* ignore */
      }
      return {
        extensionVersion: context.extension.packageJSON.version,
        skill: skillStatus,
        canvas: canvasStatus,
        workspace: {
          root: config.root,
          gitignored: config.gitignored,
          backloggedFolder: config.backloggedFolder,
          cancelledFolder: config.cancelledFolder,
          completedFolder: config.completedFolder,
          codeScanningEnabled: get<boolean>(Settings.CodeScanningEnabled),
        },
        viewOptions: {
          groupBy: get<string>(Settings.GroupBy),
          sortByDate: get<boolean>(Settings.SortByDate),
        },
      };
    },
    handleSettingsAction: async (payload) => {
      const { action, component, scope } = payload as {
        action: string;
        component?: string;
        scope?: string;
      };
      switch (action) {
        case "open-extension-settings":
          await vscode.commands.executeCommand(
            "workbench.action.openSettings",
            `@ext:agendo.agendo`,
          );
          return { success: true, reload: false };
        case "open-board":
          if (scope === "code-scanning") {
            await vscode.commands.executeCommand(Command.CodeScanningOpenBoard);
          } else {
            await vscode.commands.executeCommand(Command.OpenBoard);
          }
          return { success: true, reload: false };
        case "open-tree":
          await vscode.commands.executeCommand("workbench.view.extension.agendo");
          return { success: true, reload: false };
        case "check-source":
        case "install":
          if (component === "skill") {
            await vscode.commands.executeCommand(Command.ManageSkill);
          } else {
            await vscode.commands.executeCommand(Command.ManageCanvas);
          }
          return { success: true };
        case "set-group-by": {
          const validModes = ["status", "priority", "group", "none"];
          const mode = scope ?? "";
          if (!validModes.includes(mode)) {
            throw new Error(`Invalid groupBy mode: ${mode}`);
          }
          await set(Settings.GroupBy, mode);
          return { success: true, reload: false };
        }
        default:
          throw new Error(`Unknown settings action: ${action}`);
      }
    },
  });
  context.subscriptions.push(canvasViewer);
  config.setCanvasOpener(async (uri, returnTo) => {
    const todoId = /^((?:(?:cql|sq)-)?\d{3,})-/.exec(basename(uri.fsPath))?.[1];
    const root = config.getWorkspaceFolder()?.uri.fsPath;
    if (!todoId || !root) {
      return false;
    }
    if (repository.getTodos().filter((todo) => todo.id === todoId).length > 1) {
      vscode.window.showWarningMessage(
        `Duplicate todo ID ${todoId}: opening the selected source file instead of an ambiguous canvas session.`,
      );
      return false;
    }
    try {
      await canvasViewer.open(root, todoId, returnTo);
      return true;
    } catch (error) {
      out`Could not open the work-session canvas: ${error}`;
      return false;
    }
  });
  const busy = new BusyIndicator();
  const treeProvider = new TodoTreeProvider(repository, filter, treeState, busy);
  const scanningTreeProvider = new TodoTreeProvider(
    repository,
    scanningFilter,
    scanningTreeState,
    busy,
    "code-scanning",
  );
  const skillStatusTreeProvider = new SkillStatusTreeProvider(skill, config, canvas);
  const boardViewProvider = new BoardViewProvider(
    repository,
    filter,
    status,
    context.workspaceState,
    "todos",
    taskActions,
  );
  const scanningBoardViewProvider = new BoardViewProvider(
    repository,
    scanningFilter,
    status,
    context.workspaceState,
    "code-scanning",
    taskActions,
  );

  const treeView = vscode.window.createTreeView("agendo.todos", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  const scanningTreeView = vscode.window.createTreeView("agendo.codeScanning", {
    treeDataProvider: scanningTreeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(
    repository.onDidChange(() => {
      const collisions = findTodoCollisions(repository.getTodos());
      for (const [view, scanning] of [
        [treeView, false],
        [scanningTreeView, true],
      ] as const) {
        const scoped = collisions.filter((collision) => (collision.source !== "todo") === scanning);
        const descriptions = scoped
          .map((collision) => `${collision.id} (${collision.todos.length} files)`)
          .join(", ");
        view.badge = scoped.length
          ? {
              value: scoped.length,
              tooltip: `Duplicate IDs requiring reconciliation: ${descriptions}`,
            }
          : undefined;
      }
    }),
  );
  const skillStatusTreeView = vscode.window.createTreeView("agendo.skillStatus", {
    treeDataProvider: skillStatusTreeProvider,
  });
  context.subscriptions.push(
    treeView.onDidCollapseElement(async (event) => {
      const nodeKey = getTreeNodeKey(event.element as TreeNode | undefined);
      if (nodeKey) {
        await treeState.collapse(nodeKey);
      }
    }),
    treeView.onDidExpandElement(async (event) => {
      const nodeKey = getTreeNodeKey(event.element as TreeNode | undefined);
      if (nodeKey) {
        await treeState.expand(nodeKey);
      }
    }),
    outputChannel,
    repository,
    treeView,
    skillStatusTreeView,
    boardViewProvider,
    scanningTreeView,
    scanningBoardViewProvider,
    scanningTreeView.onDidCollapseElement(async (event) => {
      const key = getTreeNodeKey(event.element as TreeNode | undefined);
      if (key) {
        await scanningTreeState.collapse(key);
      }
    }),
    scanningTreeView.onDidExpandElement(async (event) => {
      const key = getTreeNodeKey(event.element as TreeNode | undefined);
      if (key) {
        await scanningTreeState.expand(key);
      }
    }),
  );

  // Keep the on-disk config projection and gitignore in sync on activation and
  // whenever relevant settings change. Rapid config changes (e.g. quickly
  // toggling a setting) coalesce into a single debounced repository refresh.
  await config.writeConfigFile();
  await config.applyGitignore();
  let refreshTimer: NodeJS.Timeout | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration(Settings.Identifier)) {
        await config.writeConfigFile();
        await config.applyGitignore();
        if (event.affectsConfiguration(`${Settings.Identifier}.${Settings.ViewMode}`)) {
          skillStatusTreeProvider.refresh();
        }
        repository.startWatching();
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }
        refreshTimer = setTimeout(() => {
          void repository.refresh();
        }, 150);
      }
    }),
  );

  registerCommands(context, {
    config,
    repository,
    filter,
    treeState,
    status,
    links,
    skill,
    canvas,
    canvasViewer,
    busy,
    treeProvider,
    boardViewProvider,
    refreshSkillStatus: () => skillStatusTreeProvider.refresh(),
    scanning: {
      filter: scanningFilter,
      treeState: scanningTreeState,
      treeProvider: scanningTreeProvider,
      boardViewProvider: scanningBoardViewProvider,
    },
  });

  await updateFilterContexts(filter);
  await updateFilterContexts(scanningFilter, "agendo.codeScanning");
  repository.startWatching();

  // Show loading state during initial repository scan
  treeProvider.setLoading(true);
  scanningTreeProvider.setLoading(true);
  await vscode.commands.executeCommand("setContext", "agendo.loading", true);
  await vscode.commands.executeCommand("setContext", "agendo.codeScanning.loading", true);
  await repository.refresh();
  treeProvider.markLoaded();
  scanningTreeProvider.markLoaded();
  await vscode.commands.executeCommand("setContext", "agendo.loading", false);
  await vscode.commands.executeCommand("setContext", "agendo.codeScanning.loading", false);

  // Auto-check for skill and canvas updates. Not awaited: the prompt only resolves when the
  // user dismisses it, and activation must finish first or the views never load.
  if (get(Settings.SkillUpdateCheck)) {
    void promptForSkillUpdate(skill);
    void promptForCanvasUpdate(canvas);
  }
}

async function promptForSkillUpdate(skill: SkillManager): Promise<void> {
  try {
    const skillStatus = await skill.getStatus();
    if (!skillStatus.updateAvailable) {
      return;
    }
    const updateButton = "Review Versions";
    const result = await vscode.window.showInformationMessage(
      `Agendo skill: installed v${skillStatus.installedVersion}; bundled v${skillStatus.bundledVersion} (included in this extension) is newer. GitHub/source has not been checked.`,
      updateButton,
    );
    if (result === updateButton) {
      await vscode.commands.executeCommand(Command.ManageSkill);
    }
  } catch {
    // Non-critical: don't surface update check failures
  }
}

async function promptForCanvasUpdate(canvas: CanvasManager): Promise<void> {
  try {
    const canvasStatus = await canvas.getStatus();
    if (!canvasStatus.updateAvailable) {
      return;
    }
    const updateButton = "Review Versions";
    const result = await vscode.window.showInformationMessage(
      `Agendo canvas: installed v${canvasStatus.installedVersion}; bundled v${canvasStatus.bundledVersion} (included in this extension) is newer. GitHub/source has not been checked.`,
      updateButton,
    );
    if (result === updateButton) {
      await vscode.commands.executeCommand(Command.ManageCanvas);
    }
  } catch {
    // Non-critical: don't surface update check failures
  }
}

export function deactivate() {
  out`${Settings.Identifier} deactivated`;
}
