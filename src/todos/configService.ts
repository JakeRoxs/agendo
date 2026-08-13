import * as vscode from "vscode";
import { get, Settings } from "../configuration";
import { out } from "../output";

/** Shape of the `.agendo-config.json` file the skill reads. */
export interface TodosConfig {
  root: string;
  gitignored: boolean;
  backlogFolder: string;
  cancelledFolder: string;
  completeFolder: string;
}

/**
 * Bridges VS Code settings and the on-disk `.agendo-config.json` projection that
 * the Agendo skill reads. VS Code settings are the source of truth; the
 * file is a skill-readable projection of them.
 */
export class ConfigService {
  /** Workspace-relative root folder for todos. */
  get root(): string {
    const value = (get<string>(Settings.Root) ?? "docs/todos").replace(/\\/g, "/");
    return value.split("/").filter(Boolean).join("/");
  }

  get defaultPriority(): "p1" | "p2" | "p3" {
    return get<"p1" | "p2" | "p3">(Settings.DefaultPriority) || "p3";
  }

  get completeFolder(): string {
    return get<string>(Settings.CompleteFolder) || "complete";
  }

  get cancelledFolder(): string {
    return get<string>(Settings.CancelledFolder) || "cancelled";
  }

  get backlogFolder(): string {
    return get<string>(Settings.BacklogFolder) || "backlog";
  }

  get openInPreview(): boolean {
    const value = get<boolean>(Settings.OpenInPreview);
    return value ?? true;
  }

  get gitignored(): boolean {
    return get<boolean>(Settings.GitignoreTodos) === true;
  }

  /**
   * Resolve the workspace folder that should contain the todos root. In a
   * multi-root workspace this is the first folder; single-root workspaces
   * return their only folder.
   */
  getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }
    return folders[0];
  }

  /** Absolute URI of the todos root folder, or undefined without a workspace. */
  getRootUri(): vscode.Uri | undefined {
    const folder = this.getWorkspaceFolder();
    if (!folder) {
      return undefined;
    }
    return vscode.Uri.joinPath(folder.uri, ...this.root.split("/"));
  }

  /** Absolute URI of a named subfolder under the root. */
  getSubfolderUri(subfolder: string): vscode.Uri | undefined {
    const rootUri = this.getRootUri();
    if (!rootUri) {
      return undefined;
    }
    return vscode.Uri.joinPath(rootUri, subfolder);
  }

  /** Build the {@link TodosConfig} projection from current settings. */
  toTodosConfig(): TodosConfig {
    return {
      root: this.root,
      gitignored: this.gitignored,
      backlogFolder: this.backlogFolder,
      cancelledFolder: this.cancelledFolder,
      completeFolder: this.completeFolder,
    };
  }

  /**
   * Write `.agendo-config.json` into the root folder so the skill can read the
   * active configuration and choose a file-discovery strategy.
   */
  async writeConfigFile(): Promise<void> {
    const rootUri = this.getRootUri();
    if (!rootUri) {
      return;
    }
    try {
      await vscode.workspace.fs.createDirectory(rootUri);
      const target = vscode.Uri.joinPath(rootUri, ".agendo-config.json");
      const content = `${JSON.stringify(this.toTodosConfig(), null, 2)}\n`;
      await vscode.workspace.fs.writeFile(target, Buffer.from(content, "utf8"));
      out`Wrote ${target.fsPath}`;
    } catch (error) {
      out`Failed to write .agendo-config.json: ${error}`;
    }
  }

  /**
   * Create or remove the `*` .gitignore inside the todos root to match the
   * `gitignoreTodos` setting.
   */
  async applyGitignore(): Promise<void> {
    const rootUri = this.getRootUri();
    if (!rootUri) {
      return;
    }
    const gitignoreUri = vscode.Uri.joinPath(rootUri, ".gitignore");
    try {
      if (this.gitignored) {
        await vscode.workspace.fs.createDirectory(rootUri);
        // Keep the config file trackable even when everything else is ignored.
        const content = "*\n!.gitignore\n!.agendo-config.json\n";
        await vscode.workspace.fs.writeFile(gitignoreUri, Buffer.from(content, "utf8"));
        out`Wrote .gitignore in ${rootUri.fsPath}`;
      } else {
        await vscode.workspace.fs.delete(gitignoreUri);
        out`Removed .gitignore in ${rootUri.fsPath}`;
      }
    } catch (error) {
      // Deleting a non-existent file throws; that is fine.
      out`applyGitignore no-op or error: ${error}`;
    }
  }
}
