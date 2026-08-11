import * as vscode from "vscode";

/**
 * Settings enumeration for the extension.
 *
 * The Identifier matches the "name" field in package.json and is used for
 * configuration scoping and output channel naming.
 */
export enum Settings {
    Identifier = "file-todos",
    Root = "root",
    DefaultPriority = "defaultPriority",
    CompleteFolder = "completeFolder",
    CancelledFolder = "cancelledFolder",
    BacklogFolder = "backlogFolder",
    OpenInPreview = "openInPreview",
    GitignoreTodos = "gitignoreTodos",
    SkillUpdateSource = "skillUpdateSource",
}

/**
 * Set a configuration value for this extension.
 */
export function set(key: Settings, value: any) {
    return vscode.workspace
        .getConfiguration(Settings.Identifier)
        .update(key, value, vscode.ConfigurationTarget.Workspace);
}

/**
 * Get a configuration value for this extension.
 */
export function get<T>(key: Settings): T {
    return vscode.workspace.getConfiguration(Settings.Identifier).get<T>(key) as T;
}
