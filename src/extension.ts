import * as vscode from "vscode";
import * as path from "node:path";
import { BusyIndicator } from "./busyIndicator";
import type { CommandServices } from "./commandRegistration";
import { registerCommands, updateFilterContexts } from "./commandRegistration";
import { Command } from "./commands";
import { get, Settings, set, setDefault } from "./configuration";
import { DiagnosticsService } from "./mcp/diagnosticsService";
import { installMcpServer } from "./mcp/installServer";
import { IpcBridge } from "./mcp/ipcBridge";
import { workspaceDiscoveryDirectory } from "./mcp/workspaceDiscovery";
import { out, outputChannel } from "./output";
import { BoardViewProvider } from "./todos/boardViewProvider";
import { createCanvasHostActions } from "./todos/canvasHostActions";
import { CanvasManager } from "./todos/canvasManager";
import { CanvasViewer } from "./todos/canvasViewer";
import { ConfigService } from "./todos/configService";
import { FilterService } from "./todos/filterService";
import { LinkService } from "./todos/linkService";
import { SettingsService } from "./todos/settingsService";
import { SkillManager } from "./todos/skillManager";
import { SkillStatusTreeProvider } from "./todos/skillStatusTreeProvider";
import { StatusService } from "./todos/statusService";
import { findTodoCollisions } from "./todos/todoCollisions";
import { TodoRepository } from "./todos/todoRepository";
import { TreeStateService } from "./todos/treeStateService";
import { MultiRootTreeProvider } from "./todos/multiRootTreeProvider";
import { TodoRootRegistry, type TodoRootDescriptor } from "./todos/rootRegistry";
import type { BoardReturnTarget } from "./todos/workspaceNavigation";
import {
  CANVAS_NOTIFIED_VERSION_KEY,
  getNotifiedBundledVersion,
  recordNotifiedBundledVersion,
  SKILL_NOTIFIED_VERSION_KEY,
} from "./updateNotification";

/**
 * Compute the per-root MCP discovery directory entries for the current
 * workspace. Each entry pairs a discovery directory with its root's filesystem
 * path, root mode, and label so the endpoint registration record binds to the
 * owning todo root. Workspace-folder roots and manually added roots are both
 * published; the saved workspace file is registered as an alias only when it
 * yields a distinct directory, and it is never treated as a todo root.
 */
function computeDiscoveryDirectories(
  context: vscode.ExtensionContext,
  roots: TodoRootDescriptor[],
): Array<{ directory: string; workspace: string; rootMode: "workspace" | "manual"; label: string }> {
  const directories: Array<{ directory: string; workspace: string; rootMode: "workspace" | "manual"; label: string }> = [];

  // Every registered root (workspace folders and manually added roots) gets its
  // own discovery directory keyed by the root's absolute path, so roots are
  // never aggregated into a flat list and a client can bind to the owning root.
  for (const root of roots) {
    const directory = workspaceDiscoveryDirectory(context, root.uri);
    if (!directory) continue;
    directories.push({
      directory,
      workspace:
        root.source === "workspace"
          ? (root.folder?.uri.fsPath ?? root.uri.fsPath)
          : root.uri.fsPath,
      rootMode: root.source,
      label: root.label,
    });
  }

  // Preserve the saved workspace file as an alias for endpoint discovery. It is
  // a file, so it is never a todo root (resolveTodoRoot excludes
  // non-directories), but it still anchors the endpoint for CWD-based routing.
  const workspaceFile = vscode.workspace.workspaceFile;
  let workspaceAlias:
    | { directory: string; workspace: string; rootMode: "workspace"; label: string }
    | undefined;
  if (workspaceFile?.scheme === "file") {
    const fileDirectory = workspaceDiscoveryDirectory(context, workspaceFile);
    if (fileDirectory && !directories.some((entry) => entry.directory === fileDirectory)) {
      workspaceAlias = {
        directory: fileDirectory,
        workspace: workspaceFile.fsPath,
        rootMode: "workspace",
        label: path.basename(workspaceFile.fsPath),
      };
    }
  }

  return workspaceAlias ? [...directories, workspaceAlias] : directories;
}

export async function activate(context: vscode.ExtensionContext) {
  out`${Settings.Identifier} activated`;

  // Refresh existing client configurations without changing their server path.
  await installMcpServer(context).catch((error: unknown) => {
    out`Could not prepare the Agendo MCP server: ${String(error)}`;
  });

  const config = new ConfigService(context.workspaceState);
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
  // Provision the local bundle before registering canvas actions. Source updates
  // remain explicit, and a newer installed canvas is never downgraded.
  try {
    await canvas.ensureBundledInstalled();
  } catch (error) {
    out`Could not install the bundled work-session canvas automatically: ${error}`;
  }
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
      return settingsService.getSettingsInfo();
    },
    handleSettingsAction: async (payload) => {
      return settingsService.handleSettingsAction(payload);
    },
  }, context.workspaceState);
  context.subscriptions.push(canvasViewer);
  const busy = new BusyIndicator();
  // Single shared root registry: workspace/manual roots, active root, and tree
  // mode are persisted per workspace. Every root owns an isolated
  // ConfigService + TodoRepository context so IDs, dependencies, filters, and
  // tree state never collide across roots.
  const registry = new TodoRootRegistry(config, context.workspaceState);
  canvasViewer.setRootRegistry(registry);
  // Open a canvas for the owning root: make the root active, rebind the shared
  // repository so host actions target the right root, sync the on-disk
  // projection/gitignore, and open the canvas. Shared by the base (active)
  // config's opener and by every root context's config opener.
  const openCanvasForRoot = async (
    todoId: string,
    returnTo: BoardReturnTarget | undefined,
    workspaceRoot: string,
    rootMode: "workspace" | "manual",
  ): Promise<boolean> => {
    // Resolve the root descriptor that owns this workspace root.
    const descriptor = registry.getRoots().find(
      (root) =>
        (root.source === "workspace" ? root.folder?.uri.fsPath : root.uri.fsPath) === workspaceRoot,
    );
    if (!descriptor) {
      vscode.window.showWarningMessage(`No todo root configured for ${workspaceRoot}.`);
      return false;
    }
    if (!descriptor.available) {
      vscode.window.showWarningMessage(`Root ${descriptor.label} is not available on disk.`);
      return false;
    }
    // Make this root the active root so the tree and board track it.
    registry.setActiveRoot(descriptor.id);
    // Rebind the shared repository so host actions and the tree/board target this root.
    await repository.rebindRoot();
    // Keep the on-disk config projection and gitignore in sync for the selected root.
    await config.writeConfigFile();
    await config.applyGitignore();
    try {
      await canvasViewer.open(workspaceRoot, todoId, returnTo, rootMode);
      return true;
    } catch (error) {
      out`Could not open the work-session canvas: ${error}`;
      return false;
    }
  };
  // Bind the root-aware opener to every root context so Canvas/Settings/Board
  // actions open against the owning root (workspace folder for workspace roots,
  // the registered directory for manual roots).
  registry.setCanvasOpener(openCanvasForRoot);
  // The base (active) config's opener delegates to the same root-aware path so
  // the active-root case goes through setActiveRoot / rebindRoot / sync as well.
  config.setCanvasOpener(async (uri, returnTo) => {
    const todoId = /^((?:(?:cql|sq)-)?\d{3,})-/.exec(path.basename(uri.fsPath))?.[1];
    if (!todoId) {
      return false;
    }
    const manualRoot = config.getManualRoot();
    const workspaceRoot = manualRoot ? manualRoot.fsPath : config.getWorkspaceFolder()?.uri.fsPath;
    if (!workspaceRoot) {
      return false;
    }
    const rootMode = manualRoot ? "manual" : "workspace";
    // Duplicate-ID check is scoped to the active (base) repository.
    if (repository.getTodos().filter((todo) => todo.id === todoId).length > 1) {
      vscode.window.showWarningMessage(
        `Duplicate todo ID ${todoId}: opening the selected source file instead of an ambiguous canvas session.`,
      );
      return false;
    }
    return openCanvasForRoot(todoId, returnTo, workspaceRoot, rootMode);
  });
  const treeProvider = new MultiRootTreeProvider(registry, context.workspaceState, busy, "todos");
  const scanningTreeProvider = new MultiRootTreeProvider(
    registry,
    context.workspaceState,
    busy,
    "code-scanning",
  );
  // Start each root context's repo watcher once; disposal happens via the
  // registry (and thus via context.subscriptions) when roots disappear or the
  // extension deactivates.
  for (const ctx of registry.getContexts()) {
    ctx.repository.startWatching();
  }
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

  const settingsService = new SettingsService({
    get,
    set,
    setDefault,
    executeCommand: async (command: string, ...args: unknown[]) => {
      return vscode.commands.executeCommand(command, ...args);
    },
    config,
    boardViewProvider,
    scanningBoardViewProvider,
    repository,
    treeProvider,
    scanningTreeProvider: scanningTreeProvider,
    skillStatusTreeProvider,
    extensionVersion: context.extension.packageJSON.version,
    getSkillStatus: async () => {
      let status: unknown;
      try {
        status = await skill.getStatus();
      } catch {
        /* ignore */
      }
      return status;
    },
    getCanvasStatus: async () => {
      let status: unknown;
      try {
        status = await canvas.getStatus();
      } catch {
        /* ignore */
      }
      return status;
    },
  });

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
      const node = event.element;
      if (node) {
        treeProvider.collapse(node);
      }
    }),
    treeView.onDidExpandElement(async (event) => {
      const node = event.element;
      if (node) {
        treeProvider.expand(node);
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
      const node = event.element;
      if (node) {
        scanningTreeProvider.collapse(node);
      }
    }),
    scanningTreeView.onDidExpandElement(async (event) => {
      const node = event.element;
      if (node) {
        scanningTreeProvider.expand(node);
      }
    }),
    // Dispose the shared registry and tree providers on deactivation so every
    // root context's repository watcher is released.
    registry,
    treeProvider,
    scanningTreeProvider,
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

  // Expose the local diagnostics IPC endpoint to MCP configuration commands.
  // Register the bridge's endpoint under every registered todo root (workspace
  // folders and manually added roots) and the saved workspace file as an alias,
  // so the MCP server can route by CWD and bind to the owning root. Each
  // registration record carries the root's normalized absolute path, label, and
  // root mode; the alias is endpoint-only and is never a todo root.
  const discoveryDirectories = computeDiscoveryDirectories(context, registry.getRoots());
  const problemsBridge = await IpcBridge.create({
    context,
    diagnostics: new DiagnosticsService(),
    discoveryDirectories,
  });
  // Reconcile the active workspace folder, todo repository, and live MCP
  // discovery registrations whenever the workspace folder set changes
  // (add/remove/reorder) or the root registry changes (manual add/remove,
  // active root, tree mode). The config service restores the persisted
  // selection or falls back to the first folder; the repository rebinds its
  // watcher to the new active root; the bridge republishes each root's
  // endpoint record without tearing down the IPC endpoint.
  context.subscriptions.push(
    problemsBridge,
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      config.refreshActiveFolder();
      await repository.rebindRoot();
      problemsBridge.refreshDiscoveryDirectories(computeDiscoveryDirectories(context, registry.getRoots()));
    }),
    registry.onDidChange(async () => {
      problemsBridge.refreshDiscoveryDirectories(computeDiscoveryDirectories(context, registry.getRoots()));
    }),
  );

  const services = {
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
    // Shared root registry consumed by the command worker's registerCommands.
    rootRegistry: registry,
  };
  registerCommands(context, services as unknown as CommandServices);

  await updateFilterContexts(filter);
  await updateFilterContexts(scanningFilter, "agendo.codeScanning");
  repository.startWatching();

  // Show loading state during initial repository scan. In single mode, the
  // MultiRootTreeProvider delegates to the active root's child provider, so
  // loading is driven there; in multi mode there is no single loading node.
  const activeRootId = registry.getActiveRootId();
  if (activeRootId) {
    const activeChild = treeProvider.getChildProvider(activeRootId);
    if (activeChild) {
      activeChild.setLoading(true);
    }
    const activeScanningChild = scanningTreeProvider.getChildProvider(activeRootId);
    if (activeScanningChild) {
      activeScanningChild.setLoading(true);
    }
  }
  await vscode.commands.executeCommand("setContext", "agendo.loading", true);
  await vscode.commands.executeCommand("setContext", "agendo.codeScanning.loading", true);
  await repository.refresh();
  // Refresh every root context so each child provider's cache is populated.
  for (const ctx of registry.getContexts()) {
    await ctx.repository.refresh();
  }
  if (activeRootId) {
    const activeChild = treeProvider.getChildProvider(activeRootId);
    if (activeChild) {
      activeChild.markLoaded();
    }
    const activeScanningChild = scanningTreeProvider.getChildProvider(activeRootId);
    if (activeScanningChild) {
      activeScanningChild.markLoaded();
    }
  }
  await vscode.commands.executeCommand("setContext", "agendo.loading", false);
  await vscode.commands.executeCommand("setContext", "agendo.codeScanning.loading", false);

  // Auto-check for skill and canvas updates. Not awaited: the prompt only resolves when the
  // user dismisses it, and activation must finish first or the views never load.
  // Each bundled version is reported at most once; a newer bundled version can notify again.
  if (get(Settings.SkillUpdateCheck)) {
    void promptForSkillUpdate(context, skill);
    void promptForCanvasUpdate(context, canvas);
  }
}

export async function promptForSkillUpdate(
  context: vscode.ExtensionContext,
  skill: SkillManager,
): Promise<void> {
  try {
    const skillStatus = await skill.getStatus();
    if (!skillStatus.updateAvailable) {
      return;
    }
    const bundledVersion = skillStatus.bundledVersion;
    if (!bundledVersion) {
      return;
    }
    // Do not repeat the notice for a bundled version already reported on a
    // previous activation. A newer bundled version can notify again.
    let notified: string | undefined;
    try {
      notified = await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY);
    } catch {
      // Persistence read failure: do not suppress the notice.
      notified = undefined;
    }
    if (notified === bundledVersion) {
      return;
    }
    const updateButton = "Review Versions";
    const result = await vscode.window.showInformationMessage(
      `Agendo skill: installed v${skillStatus.installedVersion}; bundled v${bundledVersion} (included in this extension) is newer. GitHub/source has not been checked.`,
      updateButton,
    );
    if (result === updateButton) {
      await vscode.commands.executeCommand(Command.ManageSkill);
    }
    // Record the bundled version so the same notice is not repeated until a
    // newer bundled version ships. A persistence failure must not suppress the
    // notice that was just shown.
    try {
      await recordNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY, bundledVersion);
    } catch {
      // Non-critical: keep the notice visible rather than silently suppressing.
    }
  } catch {
    // Non-critical: don't surface update check failures
  }
}

export async function promptForCanvasUpdate(
  context: vscode.ExtensionContext,
  canvas: CanvasManager,
): Promise<void> {
  try {
    const canvasStatus = await canvas.getStatus();
    if (!canvasStatus.updateAvailable) {
      return;
    }
    const bundledVersion = canvasStatus.bundledVersion;
    if (!bundledVersion) {
      return;
    }
    // Do not repeat the notice for a bundled version already reported on a
    // previous activation. A newer bundled version can notify again.
    let notified: string | undefined;
    try {
      notified = await getNotifiedBundledVersion(context, CANVAS_NOTIFIED_VERSION_KEY);
    } catch {
      // Persistence read failure: do not suppress the notice.
      notified = undefined;
    }
    if (notified === bundledVersion) {
      return;
    }
    const updateButton = "Review Versions";
    const result = await vscode.window.showInformationMessage(
      `Agendo canvas: installed v${canvasStatus.installedVersion}; bundled v${bundledVersion} (included in this extension) is newer. GitHub/source has not been checked.`,
      updateButton,
    );
    if (result === updateButton) {
      await vscode.commands.executeCommand(Command.ManageCanvas);
    }
    // Record the bundled version so the same notice is not repeated until a
    // newer bundled version ships. A persistence failure must not suppress the
    // notice that was just shown.
    try {
      await recordNotifiedBundledVersion(context, CANVAS_NOTIFIED_VERSION_KEY, bundledVersion);
    } catch {
      // Non-critical: keep the notice visible rather than silently suppressing.
    }
  } catch {
    // Non-critical: don't surface update check failures
  }
}

export function deactivate() {
  out`${Settings.Identifier} deactivated`;
}
