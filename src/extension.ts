import { basename } from "node:path";
import * as vscode from "vscode";
import { BusyIndicator } from "./busyIndicator";
import { registerCommands, updateFilterContexts } from "./commandRegistration";
import { Command } from "./commands";
import { get, Settings } from "./configuration";
import { out, outputChannel } from "./output";
import { BoardViewProvider } from "./todos/boardViewProvider";
import { CanvasManager } from "./todos/canvasManager";
import { CanvasViewer } from "./todos/canvasViewer";
import { ConfigService } from "./todos/configService";
import { FilterService } from "./todos/filterService";
import { LinkService } from "./todos/linkService";
import { SkillManager } from "./todos/skillManager";
import { SkillStatusTreeProvider } from "./todos/skillStatusTreeProvider";
import { StatusService } from "./todos/statusService";
import { TodoRepository } from "./todos/todoRepository";
import { getTreeNodeKey, TodoTreeProvider, type TreeNode } from "./todos/todoTreeProvider";
import { TreeStateService } from "./todos/treeStateService";

export async function activate(context: vscode.ExtensionContext) {
  out`${Settings.Identifier} activated`;

  const config = new ConfigService();
  const repository = new TodoRepository(config);
  const filter = new FilterService(context.workspaceState);
  const treeState = new TreeStateService(context.workspaceState);
  const status = new StatusService(config, repository);
  const links = new LinkService(config);
  const skill = new SkillManager(context.extensionUri);
  const canvas = new CanvasManager(context.extensionUri);
  const canvasViewer = new CanvasViewer(context.extensionUri);
  context.subscriptions.push(canvasViewer);
  config.setCanvasOpener(async (uri) => {
    const todoId = /^((?:(?:cql|sq)-)?\d{3,})-/.exec(basename(uri.fsPath))?.[1];
    const root = config.getWorkspaceFolder()?.uri.fsPath;
    if (!todoId || !root) {
      return false;
    }
    try {
      await canvasViewer.open(root, todoId);
      return true;
    } catch (error) {
      out`Could not open the work-session canvas: ${error}`;
      return false;
    }
  });
  const busy = new BusyIndicator();
  const treeProvider = new TodoTreeProvider(repository, filter, treeState, busy);
  const skillStatusTreeProvider = new SkillStatusTreeProvider(skill, config, canvas);
  const boardViewProvider = new BoardViewProvider(
    repository,
    filter,
    status,
    context.workspaceState,
  );

  const treeView = vscode.window.createTreeView("agendo.todos", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
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
    busy,
    treeProvider,
    boardViewProvider,
    refreshSkillStatus: () => skillStatusTreeProvider.refresh(),
  });

  await updateFilterContexts(filter);
  repository.startWatching();

  // Show loading state during initial repository scan
  treeProvider.setLoading(true);
  await vscode.commands.executeCommand("setContext", "agendo.loading", true);
  await repository.refresh();
  treeProvider.markLoaded();
  await vscode.commands.executeCommand("setContext", "agendo.loading", false);

  // Keep an already-installed work-session canvas in step with the bundled version
  try {
    await canvas.updateIfInstalled();
  } catch {
    // Non-critical: don't block activation on canvas refresh failures
  }

  // Auto-check for skill updates. Not awaited: the prompt only resolves when the
  // user dismisses it, and activation must finish first or the views never load.
  if (get(Settings.SkillUpdateCheck)) {
    void promptForSkillUpdate(skill);
  }
}

async function promptForSkillUpdate(skill: SkillManager): Promise<void> {
  try {
    const skillStatus = await skill.getStatus();
    if (!skillStatus.updateAvailable) {
      return;
    }
    const updateButton = "Update Skill";
    const result = await vscode.window.showInformationMessage(
      `Agendo skill update available: v${skillStatus.installedVersion} → v${skillStatus.bundledVersion}`,
      updateButton,
    );
    if (result === updateButton) {
      await vscode.commands.executeCommand(Command.EnableSkill);
    }
  } catch {
    // Non-critical: don't surface update check failures
  }
}

export function deactivate() {
  out`${Settings.Identifier} deactivated`;
}
