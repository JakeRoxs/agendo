import * as vscode from "vscode";
import { get, Settings } from "../configuration";
import { out } from "../output";

/**
 * Default configuration values, mirrored from package.json. The skill falls
 * back to these whenever the config file omits a field.
 */
export const DEFAULT_TODOS_CONFIG = {
  root: "docs/todos",
  gitignored: false,
  backlogFolder: "backlog",
  cancelledFolder: "cancelled",
  completeFolder: "complete",
} as const;

/**
 * Shape of the `.agendo-config.json` file the skill reads.
 *
 * Only fields that differ from {@link DEFAULT_TODOS_CONFIG} are written; an
 * absent key means the default applies, keeping default configurations
 * minimal.
 */
export interface TodosConfig {
  root?: string;
  gitignored?: boolean;
  backlogFolder?: string;
  cancelledFolder?: string;
  completeFolder?: string;
}

/**
 * How a todo should be opened:
 * - `default` — VS Code's own default behavior (respects editor associations).
 * - `editor` — the source text editor, forced even when markdown files are
 *   associated with a custom editor.
 * - `preview` — the rendered markdown preview.
 * - `previewEditor` — VS Code's newer (beta) markdown editor preview.
 */
export type ViewMode = "default" | "editor" | "preview" | "previewEditor";

export const VIEW_MODES: ViewMode[] = ["default", "editor", "preview", "previewEditor"];

const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  default: "VSCode Default",
  editor: "Editor (source)",
  preview: "Preview",
  previewEditor: "Preview editor (beta)",
};

export function isViewMode(value: unknown): value is ViewMode {
  return typeof value === "string" && (VIEW_MODES as string[]).includes(value);
}

export function viewModeLabel(mode: ViewMode): string {
  return VIEW_MODE_LABEL[mode] ?? mode;
}

/**
 * The viewType for VS Code's integrated markdown editor preview.
 */
const PREVIEW_EDITOR_VIEW_TYPE = "vscode.markdown.preview.editor";

/**
 * Bridges VS Code settings and the on-disk `.agendo-config.json` projection that
 * the Agendo skill reads. VS Code settings are the source of truth; the
 * file is a skill-readable projection of them.
 */
export class ConfigService {
  /** Workspace-relative root folder for todos. */
  get root(): string {
    const value = (get<string>(Settings.Root) ?? DEFAULT_TODOS_CONFIG.root).replace(/\\/g, "/");
    return value.split("/").filter(Boolean).join("/");
  }

  get defaultPriority(): "p1" | "p2" | "p3" {
    return get<"p1" | "p2" | "p3">(Settings.DefaultPriority) || "p3";
  }

  get completeFolder(): string {
    return get<string>(Settings.CompleteFolder) || DEFAULT_TODOS_CONFIG.completeFolder;
  }

  get cancelledFolder(): string {
    return get<string>(Settings.CancelledFolder) || DEFAULT_TODOS_CONFIG.cancelledFolder;
  }

  get backlogFolder(): string {
    return get<string>(Settings.BacklogFolder) || DEFAULT_TODOS_CONFIG.backlogFolder;
  }

  get openInPreview(): boolean {
    const value = get<boolean>(Settings.OpenInPreview);
    return value ?? true;
  }

  /**
   * The active view mode. Honors an explicit `viewMode` setting first;
   * otherwise derives from the deprecated `openInPreview` flag so existing
   * users keep their behavior (a `false` flag historically meant "don't force
   * preview", i.e. let VS Code open it its normal way).
   */
  get viewMode(): ViewMode {
    const config = vscode.workspace.getConfiguration(Settings.Identifier);
    const inspect = config.inspect<ViewMode>(Settings.ViewMode);
    const explicit =
      inspect?.workspaceFolderValue ?? inspect?.workspaceValue ?? inspect?.globalValue;
    if (isViewMode(explicit)) {
      return explicit;
    }
    return this.openInPreview ? "preview" : "default";
  }

  /**
   * Open a todo according to the current view mode, delegating the actual
   * rendering to VS Code's native markdown commands.
   */
  async openTodo(uri: vscode.Uri): Promise<void> {
    const mode = this.viewMode;
    if (mode === "default") {
      // Use VS Code's own default open behavior (respects editor associations).
      await vscode.commands.executeCommand("vscode.open", uri);
      return;
    }
    if (mode === "editor") {
      // Force the plain text editor, bypassing editor associations.
      await vscode.window.showTextDocument(uri, { preview: true });
      return;
    }
    if (mode === "previewEditor") {
      // VS Code's integrated markdown editor preview (custom editor).
      await vscode.commands.executeCommand("vscode.openWith", uri, PREVIEW_EDITOR_VIEW_TYPE);
      return;
    }
    await vscode.commands.executeCommand("markdown.showPreview", uri);
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

  /**
   * Build the {@link TodosConfig} projection from current settings, omitting
   * fields that match their default so the on-disk file only carries
   * non-default configuration.
   */
  toTodosConfig(): TodosConfig {
    const config: TodosConfig = {};
    if (this.root !== DEFAULT_TODOS_CONFIG.root) {
      config.root = this.root;
    }
    if (this.gitignored !== DEFAULT_TODOS_CONFIG.gitignored) {
      config.gitignored = this.gitignored;
    }
    if (this.backlogFolder !== DEFAULT_TODOS_CONFIG.backlogFolder) {
      config.backlogFolder = this.backlogFolder;
    }
    if (this.cancelledFolder !== DEFAULT_TODOS_CONFIG.cancelledFolder) {
      config.cancelledFolder = this.cancelledFolder;
    }
    if (this.completeFolder !== DEFAULT_TODOS_CONFIG.completeFolder) {
      config.completeFolder = this.completeFolder;
    }
    return config;
  }

  /**
   * Keep `.agendo-config.json` in the root folder in sync with the active
   * configuration so the skill can choose a file-discovery strategy. The file
   * is removed when every setting is at its default — the skill falls back to
   * the same defaults when the file is absent.
   */
  async writeConfigFile(): Promise<void> {
    const rootUri = this.getRootUri();
    if (!rootUri) {
      return;
    }
    const target = vscode.Uri.joinPath(rootUri, ".agendo-config.json");
    try {
      const config = this.toTodosConfig();
      if (Object.keys(config).length === 0) {
        await vscode.workspace.fs.delete(target);
        out`Removed ${target.fsPath} (all settings are defaults)`;
      } else {
        await vscode.workspace.fs.createDirectory(rootUri);
        const content = `${JSON.stringify(config, null, 2)}\n`;
        await vscode.workspace.fs.writeFile(target, Buffer.from(content, "utf8"));
        out`Wrote ${target.fsPath}`;
      }
    } catch (error) {
      // Deleting a file that is already absent is expected and not worth logging.
      if (!(error instanceof vscode.FileSystemError && error.code === "FileNotFound")) {
        out`Failed to write .agendo-config.json: ${error}`;
      }
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
      // Deleting a file that is already absent is expected and not worth logging.
      if (!(error instanceof vscode.FileSystemError && error.code === "FileNotFound")) {
        out`Failed to apply .gitignore in ${rootUri.fsPath}: ${error}`;
      }
    }
  }
}
