import * as vscode from "vscode";

/**
 * Settings enumeration for the extension.
 *
 * The Identifier matches the "name" field in package.json and is used for
 * configuration scoping and output channel naming.
 */
export enum Settings {
  Identifier = "agendo",
  Root = "root",
  DefaultPriority = "defaultPriority",
  CompletedFolder = "completedFolder",
  CancelledFolder = "cancelledFolder",
  BackloggedFolder = "backloggedFolder",
  OpenInPreview = "openInPreview",
  ViewMode = "viewMode",
  GitignoreTodos = "gitignoreTodos",
  SkillUpdateSource = "skillUpdateSource",
  SkillUpdateCheck = "skillUpdateCheck",
  CanvasUpdateSource = "canvasUpdateSource",
  SortByDate = "sortByDate",
  ShowDependencyNodes = "showDependencyNodes",
  GroupBy = "groupBy",
  CodeScanningSortByDate = "codeScanning.sortByDate",
  SonarQubeUrl = "codeScanning.sonarqube.url",
  SonarQubeProjectKey = "codeScanning.sonarqube.projectKey",
  CriteriaChangesEnabled = "criteriaChanges.enabled",
  McpProblemsEnabled = "mcp.problems.enabled",
}

/**
 * Set a configuration value for this extension.
 *
 * When `folder` is provided, the value is scoped to that workspace folder
 * (resource-scoped). Otherwise it is written at the workspace level, preserving
 * existing behavior.
 */
export function set(key: Settings, value: any, folder?: vscode.WorkspaceFolder) {
  const config = folder
    ? vscode.workspace.getConfiguration(Settings.Identifier, folder)
    : vscode.workspace.getConfiguration(Settings.Identifier);
  return config.update(
    key,
    value,
    folder ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace,
  );
}

/**
 * Set a global (user-level) default for this extension.
 * Takes priority over package.json defaults but is overridden by workspace settings.
 */
export function setDefault(key: Settings, value: any) {
  return vscode.workspace
    .getConfiguration(Settings.Identifier)
    .update(key, value, vscode.ConfigurationTarget.Global);
}

/**
 * Get a configuration value for this extension.
 *
 * When `folder` is provided, the value is read from that workspace folder's
 * resource-scoped configuration. Otherwise it is read at the workspace level,
 * preserving existing behavior.
 */
export function get<T>(key: Settings, folder?: vscode.WorkspaceFolder): T {
  const config = folder
    ? vscode.workspace.getConfiguration(Settings.Identifier, folder)
    : vscode.workspace.getConfiguration(Settings.Identifier);
  return config.get<T>(key) as T;
}
