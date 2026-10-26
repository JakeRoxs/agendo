import * as os from "node:os";
import * as vscode from "vscode";
import { get, Settings } from "../configuration";
import { out } from "../output";
import { checkSourceVersion, type SourceVersion } from "./componentVersions";
import { readText } from "./fileSystem";
import { compareVersions, fetchText } from "./skillManager";

const CANVAS_NAME = "agendo-work-session";
const META_FILE = ".canvas-meta.json";

/** Relative files that make up the bundled canvas. */
const CANVAS_FILES = [
  "agent-requests.mjs",
  "proposals.mjs",
  "approval.mjs",
  "board.html",
  "board.mjs",
  "copilot-extension.json",
  "errors.mjs",
  META_FILE,
  "extension.mjs",
  "server.mjs",
  "settings.mjs",
  "todos.mjs",
  "page.mjs",
  "markdown.mjs",
  "assets/page.css",
  "assets/page.js",
];

/** Files shipped by earlier canvas versions that must not linger after an update. */
const OBSOLETE_FILES = ["package.json"];

/** Result of comparing the bundled canvas against the installed copy. */
export interface CanvasStatus extends SourceVersion {
  installed: boolean;
  installedVersion?: string;
  bundledVersion?: string;
  updateAvailable: boolean;
}

/**
 * Installs and updates the bundled `agendo-work-session` Copilot canvas at
 * user level (`<COPILOT_HOME or ~/.copilot>/extensions/`), which every Copilot
 * session loads regardless of workspace, like the skill in `~/.agents`.
 * Versioned independently of the extension and the skill through
 * `.canvas-meta.json`. An older project-level copy in the workspace's
 * `.github/extensions/` is migrated away so the canvas is not registered twice.
 */
export class CanvasManager {
  private sourceStatus?: SourceVersion;
  constructor(private readonly extensionUri: vscode.Uri) {}

  private get bundledDir(): vscode.Uri {
    return vscode.Uri.joinPath(this.extensionUri, "resources", "canvas", CANVAS_NAME);
  }

  private get installDir(): vscode.Uri {
    const home =
      process.env.COPILOT_HOME ||
      vscode.Uri.joinPath(vscode.Uri.file(os.homedir()), ".copilot").fsPath;
    return vscode.Uri.joinPath(vscode.Uri.file(home), "extensions", CANVAS_NAME);
  }

  private get legacyDir(): vscode.Uri | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder
      ? vscode.Uri.joinPath(folder.uri, ".github", "extensions", CANVAS_NAME)
      : undefined;
  }

  private async readVersion(dir: vscode.Uri): Promise<string | undefined> {
    try {
      const meta = JSON.parse(await readText(vscode.Uri.joinPath(dir, META_FILE)));
      return typeof meta.version === "string" ? meta.version : undefined;
    } catch {
      return undefined;
    }
  }

  /** Compare bundled vs installed versions. */
  async getStatus(checkSource = false): Promise<CanvasStatus> {
    const bundledVersion = await this.readVersion(this.bundledDir);
    const installedVersion = await this.readVersion(this.installDir);
    let installed = false;
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(this.installDir, "extension.mjs"));
      installed = true;
    } catch {
      // Missing entry point is not an installed canvas.
    }
    const sourceUrl = (get<string>(Settings.CanvasUpdateSource) || "").trim();
    if (checkSource) this.sourceStatus = await checkSourceVersion(sourceUrl, META_FILE, fetchText);
    return {
      installed,
      installedVersion,
      bundledVersion,
      updateAvailable: Boolean(
        installed &&
          installedVersion &&
          bundledVersion &&
          compareVersions(bundledVersion, installedVersion) > 0,
      ),
      ...(this.sourceStatus?.sourceUrl === sourceUrl ? this.sourceStatus : { sourceUrl }),
    };
  }

  /** Copy the bundled canvas to the user-level extensions folder. */
  async install(): Promise<void> {
    const dir = this.installDir;
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(dir, "assets"));
    for (const relative of CANVAS_FILES) {
      const parts = relative.split("/");
      const bytes = await vscode.workspace.fs.readFile(
        vscode.Uri.joinPath(this.bundledDir, ...parts),
      );
      await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(dir, ...parts), bytes);
    }
    for (const obsolete of OBSOLETE_FILES) {
      try {
        await vscode.workspace.fs.delete(vscode.Uri.joinPath(dir, obsolete));
      } catch {
        // Already absent
      }
    }
    out`Installed ${CANVAS_NAME} canvas to ${dir.fsPath}`;
    await this.removeLegacyCopy();
  }

  /**
   * Refresh the installed canvas from the configured GitHub raw source. The
   * source is expected to be a raw base URL under which the canvas files live.
   */
  async updateFromSource(): Promise<void> {
    const base = (get<string>(Settings.CanvasUpdateSource) || "").trim();
    if (!base) {
      throw new Error("No canvas update source configured (agendo.canvasUpdateSource).");
    }
    const baseUrl = stripTrailingSlashes(base);
    const files = await Promise.all(
      CANVAS_FILES.map(async (relative) => ({
        relative,
        body: await fetchText(`${baseUrl}/${relative}`),
      })),
    );
    const dir = this.installDir;
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(dir, "assets"));
    for (const { relative, body } of files) {
      const parts = relative.split("/");
      const target = vscode.Uri.joinPath(dir, ...parts);
      await vscode.workspace.fs.writeFile(target, Buffer.from(body, "utf8"));
    }
    for (const obsolete of OBSOLETE_FILES) {
      try {
        await vscode.workspace.fs.delete(vscode.Uri.joinPath(dir, obsolete));
      } catch {
        // Already absent
      }
    }
    out`Updated ${CANVAS_NAME} canvas from ${baseUrl}`;
    await this.removeLegacyCopy();
  }

  /** Remove the workspace copy if it is one of ours (it carries `.canvas-meta.json`). */
  private async removeLegacyCopy(): Promise<void> {
    const legacy = this.legacyDir;
    if (!legacy || (await this.readVersion(legacy)) === undefined) {
      return;
    }
    await vscode.workspace.fs.delete(legacy, { recursive: true, useTrash: false });
    out`Removed project-level ${CANVAS_NAME} canvas at ${legacy.fsPath}; the user-level copy replaces it`;
  }

  /**
   * Refresh an already-installed canvas when the bundled one is newer, and
   * migrate a project-level copy to user level. Never creates a brand-new
   * install, and never replaces a newer installed copy with an older bundled one.
   */
  async updateIfInstalled(): Promise<boolean> {
    const status = await this.getStatus();
    const legacy = this.legacyDir;
    const hasLegacy = legacy ? (await this.readVersion(legacy)) !== undefined : false;
    if (status.updateAvailable || (hasLegacy && !status.installed)) {
      await this.install();
      return true;
    }
    if (hasLegacy) {
      await this.removeLegacyCopy();
    }
    return false;
  }
}

/** Remove any trailing '/' characters without regex backtracking. */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charAt(end - 1) === "/") {
    end--;
  }
  return value.slice(0, end);
}
