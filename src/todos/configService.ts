import * as vscode from "vscode";
import { FILENAME_RE } from "../../resources/canvas/agendo-work-session/statusLifecycle.js";
import { get, Settings } from "../configuration";
import { out } from "../output";
import type { BoardReturnTarget } from "./workspaceNavigation";

/**
 * Default configuration values, mirrored from package.json. The skill falls
 * back to these whenever the config file omits a field.
 */
export const DEFAULT_TODOS_CONFIG = {
  root: "docs/todos",
  gitignored: true,
  backloggedFolder: "backlogged",
  cancelledFolder: "cancelled",
  completedFolder: "completed",
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
  backloggedFolder?: string;
  cancelledFolder?: string;
  completedFolder?: string;
}

interface ProjectionOptions {
  force?: boolean;
}

/**
 * How a todo should be opened:
 * - `default` — VS Code's own default behavior (respects editor associations).
 * - `editor` — the source text editor, forced even when markdown files are
 *   associated with a custom editor.
 * - `preview` — the rendered markdown preview.
 * - `previewEditor` — VS Code's newer (beta) markdown editor preview.
 * - `canvas` — the Agendo work-session canvas dashboard in an editor tab.
 */
export type ViewMode = "default" | "editor" | "preview" | "previewEditor" | "canvas";

export const VIEW_MODES: ViewMode[] = ["default", "editor", "preview", "previewEditor", "canvas"];

const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  default: "VSCode Default",
  editor: "Editor (source)",
  preview: "Preview",
  previewEditor: "Preview editor (beta)",
  canvas: "Work session canvas",
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
export const TODO_FILE_PATTERN = FILENAME_RE;

/**
 * Bridges VS Code settings and the on-disk `.agendo-config.json` projection that
 * the Agendo skill reads. VS Code settings are the source of truth; the
 * file is a skill-readable projection of them.
 */
export class ConfigService {
  private readonly workspaceState?: vscode.Memento;
  private activeFolder: vscode.WorkspaceFolder | undefined;
  private readonly explicitRootUri?: vscode.Uri;
  private manualRootUri: vscode.Uri | undefined;
  private canvasOpener?: (uri: vscode.Uri, returnTo?: BoardReturnTarget) => Promise<boolean>;

  /**
   * Constructs the config service. When `workspaceState` is provided, the
   * selected workspace folder is persisted so it survives reloads; when the
   * persisted folder is removed, the service falls back to the first folder.
   *
   * When `rootUri` is provided, the service is bound to that exact todo root
   * URI and `getRootUri()` returns it directly; this is used for per-root
   * contexts (workspace and manual) without touching the active folder state.
   */
  constructor(workspaceState?: vscode.Memento, rootUri?: vscode.Uri) {
    this.workspaceState = workspaceState;
    this.explicitRootUri = rootUri;
    if (!rootUri) {
      this.refreshActiveFolder();
    }
  }

  /** All workspace folders, or an empty array when there is no workspace. */
  get workspaceFolders(): readonly vscode.WorkspaceFolder[] {
    return vscode.workspace.workspaceFolders ?? [];
  }

  /**
   * Re-evaluate the active workspace folder from the persisted selection and
   * the current workspace folders. Called by the extension host on
   * `onDidChangeWorkspaceFolders` so the active folder stays consistent when
   * folders are added, removed, or reordered.
   */
  refreshActiveFolder(): void {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      this.activeFolder = undefined;
      return;
    }

    let persistedUri: string | undefined;
    if (this.workspaceState) {
      persistedUri = this.workspaceState.get("activeWorkspaceFolder") as string | undefined;
    }

    if (persistedUri) {
      const found = folders.find((folder) => folder.uri.toString() === persistedUri);
      if (found) {
        this.activeFolder = found;
        return;
      }
      // Persisted folder no longer exists; clear the stale reference.
      if (this.workspaceState) {
        this.workspaceState.update("activeWorkspaceFolder", undefined);
      }
    }

    this.activeFolder = folders[0];
  }

  /** The active workspace folder (default: first folder; persisted selection when available). */
  getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    return this.activeFolder;
  }

  /**
   * Set the active workspace folder. When `workspaceState` is injected, the
   * selection is persisted; passing `undefined` clears it. Falls back to the
   * first folder on the next refresh when the persisted folder is removed.
   */
  setWorkspaceFolder(folder: vscode.WorkspaceFolder | undefined): void {
    this.activeFolder = folder;
    this.manualRootUri = undefined;
    if (this.workspaceState) {
      if (folder) {
        this.workspaceState.update("activeWorkspaceFolder", folder.uri.toString());
      } else {
        this.workspaceState.update("activeWorkspaceFolder", undefined);
      }
    }
  }

  /** Workspace-relative root folder for the active workspace folder. */
  get root(): string {
    const folder = this.activeFolder;
    if (!folder) {
      return DEFAULT_TODOS_CONFIG.root.replace(/\\/g, "/").split("/").filter(Boolean).join("/");
    }
    return this.getRootValue(folder);
  }

  private getRootValue(folder: vscode.WorkspaceFolder): string {
    const config = vscode.workspace.getConfiguration(Settings.Identifier, folder);
    const inspect = config.inspect<string>(Settings.Root);
    const value =
      inspect?.workspaceFolderValue ?? inspect?.workspaceValue ?? inspect?.globalValue ?? DEFAULT_TODOS_CONFIG.root;
    return value.replace(/\\/g, "/").split("/").filter(Boolean).join("/");
  }

  get defaultPriority(): "p1" | "p2" | "p3" {
    return get<"p1" | "p2" | "p3">(Settings.DefaultPriority) || "p3";
  }

  get completedFolder(): string {
    return get<string>(Settings.CompletedFolder) || DEFAULT_TODOS_CONFIG.completedFolder;
  }

  get cancelledFolder(): string {
    return get<string>(Settings.CancelledFolder) || DEFAULT_TODOS_CONFIG.cancelledFolder;
  }

  get backloggedFolder(): string {
    return get<string>(Settings.BackloggedFolder) || DEFAULT_TODOS_CONFIG.backloggedFolder;
  }

  /** Existing scanning todos stay visible even when fetching is disabled. */
  getTodoFolders(): string[] {
    const states = ["", this.completedFolder, this.cancelledFolder, this.backloggedFolder];
    return [
      ...new Set([
        ...states,
        ...["codeql", "sonarqube"].flatMap((source) =>
          states.map((state) => ["code-scanning", source, state].filter(Boolean).join("/")),
        ),
      ]),
    ];
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
    const folder = this.activeFolder;
    const config = folder
      ? vscode.workspace.getConfiguration(Settings.Identifier, folder)
      : vscode.workspace.getConfiguration(Settings.Identifier);
    const inspect = config.inspect<ViewMode>(Settings.ViewMode);
    const explicit =
      inspect?.workspaceFolderValue ?? inspect?.workspaceValue ?? inspect?.globalValue;
    if (isViewMode(explicit)) {
      return explicit;
    }
    return this.openInPreview ? "preview" : "default";
  }

  setCanvasOpener(
    opener: (uri: vscode.Uri, returnTo?: BoardReturnTarget) => Promise<boolean>,
  ): void {
    this.canvasOpener = opener;
  }

  async openInCanvas(uri: vscode.Uri, returnTo?: BoardReturnTarget): Promise<void> {
    const opened = await this.canvasOpener?.(uri, returnTo);
    if (!opened) {
      await vscode.window.showTextDocument(uri, { preview: true });
    }
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
    if (mode === "canvas") {
      await this.openInCanvas(uri);
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

  /** Absolute URI of the todos root folder for the active folder (or a given folder). */
  getRootUri(folder?: vscode.WorkspaceFolder): vscode.Uri | undefined {
    if (folder) {
      // A specific folder always resolves to its own folder-scoped root, even
      // when a manual root is currently active.
      return vscode.Uri.joinPath(folder.uri, ...this.getRootValue(folder).split("/"));
    }
    if (this.manualRootUri) {
      return this.manualRootUri;
    }
    if (this.explicitRootUri) {
      return this.explicitRootUri;
    }
    const targetFolder = this.activeFolder;
    if (!targetFolder) {
      return undefined;
    }
    return vscode.Uri.joinPath(targetFolder.uri, ...this.getRootValue(targetFolder).split("/"));
  }

  /** The manually selected absolute todo root URI, when a manual root is
   * active. Overrides the workspace-folder root in {@link getRootUri} when no
   * folder is supplied. */
  getManualRoot(): vscode.Uri | undefined {
    return this.manualRootUri;
  }

  /** Select a manual (external) todo root as the active root. Clears the
   * active workspace folder selection. */
  setManualRoot(uri: vscode.Uri): void {
    this.manualRootUri = uri;
  }

  /** Clear the manually selected root so the active workspace folder root is
   * used again. */
  clearManualRoot(): void {
    this.manualRootUri = undefined;
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
    if (this.backloggedFolder !== DEFAULT_TODOS_CONFIG.backloggedFolder) {
      config.backloggedFolder = this.backloggedFolder;
    }
    if (this.cancelledFolder !== DEFAULT_TODOS_CONFIG.cancelledFolder) {
      config.cancelledFolder = this.cancelledFolder;
    }
    if (this.completedFolder !== DEFAULT_TODOS_CONFIG.completedFolder) {
      config.completedFolder = this.completedFolder;
    }
    return config;
  }

  private async exists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch (error) {
      if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
        return false;
      }
      throw error;
    }
  }

  private async hasTodoFiles(rootUri: vscode.Uri): Promise<boolean> {
    const subfolders = this.getTodoFolders();
    for (const subfolder of subfolders) {
      const uri = subfolder ? vscode.Uri.joinPath(rootUri, subfolder) : rootUri;
      let entries: [string, vscode.FileType][];
      try {
        entries = await vscode.workspace.fs.readDirectory(uri);
      } catch (error) {
        if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
          continue;
        }
        throw error;
      }
      if (
        entries.some(
          ([name, type]) => type === vscode.FileType.File && TODO_FILE_PATTERN.test(name),
        )
      ) {
        return true;
      }
    }
    return false;
  }

  private async shouldWriteProjection(rootUri: vscode.Uri): Promise<boolean> {
    return (
      (await this.exists(vscode.Uri.joinPath(rootUri, ".agendo-config.json"))) ||
      (await this.exists(vscode.Uri.joinPath(rootUri, ".gitignore"))) ||
      (await this.hasTodoFiles(rootUri))
    );
  }

  /**
   * Keep `.agendo-config.json` in the root folder in sync with the active
   * configuration so the skill can choose a file-discovery strategy. The file
   * is removed when every setting is at its default — the skill falls back to
   * the same defaults when the file is absent.
   */
  async writeConfigFile(options: ProjectionOptions = {}): Promise<void> {
    const rootUri = this.getRootUri();
    if (!rootUri) {
      return;
    }
    const target = vscode.Uri.joinPath(rootUri, ".agendo-config.json");
    try {
      if (!options.force && !(await this.shouldWriteProjection(rootUri))) {
        return;
      }
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
   * Create or remove the .gitignore inside the todos root to match the
   * gitignoreTodos setting. Uses a blanket ignore with selective un-ignores
   * for essential content only.
   */
  async applyGitignore(options: ProjectionOptions = {}): Promise<void> {
    const rootUri = this.getRootUri();
    if (!rootUri) {
      return;
    }
    const gitignoreUri = vscode.Uri.joinPath(rootUri, ".gitignore");
    try {
      if (!options.force && !(await this.shouldWriteProjection(rootUri))) {
        return;
      }
      if (this.gitignored) {
        await vscode.workspace.fs.createDirectory(rootUri);
        // Ignore everything except the .gitignore itself and the config
        // projection. The config must stay visible to git-aware search tools
        // and the Agendo skill (a blanket ignore would hide it from search
        // indexes and break config discovery), and committable so teams
        // share the same root/folder configuration.
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
