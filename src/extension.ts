import * as vscode from "vscode";
import { registerCommands, updateFilterContexts } from "./commandRegistration";
import { Settings } from "./configuration";
import { out, outputChannel } from "./output";
import { BoardViewProvider } from "./todos/boardViewProvider";
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
  const treeProvider = new TodoTreeProvider(repository, filter, treeState);
  const skillStatusTreeProvider = new SkillStatusTreeProvider(skill, config);
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
    treeProvider,
    boardViewProvider,
    refreshSkillStatus: () => skillStatusTreeProvider.refresh(),
  });

  await updateFilterContexts(filter);
  repository.startWatching();
  await repository.refresh();
}

export function deactivate() {
  out`${Settings.Identifier} deactivated`;
}
