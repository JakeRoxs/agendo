import * as https from "node:https";
import * as os from "node:os";
import * as vscode from "vscode";
import { get, Settings } from "../configuration";
import { out } from "../output";
import { checkSourceVersion, compareVersions, type SourceVersion } from "./componentVersions";

export { compareVersions } from "./componentVersions";

import { readText } from "./fileSystem";

/** Relative files that make up the bundled skill. */
const SKILL_FILES = [
  ".skill-meta.json",
  "SKILL.md",
  "reconcile.md",
  "subagent-workflow.md",
  "assets/todo-template.md",
];

/** Result of comparing the bundled skill against the installed one. */
export interface SkillStatus extends SourceVersion {
  installed: boolean;
  installedVersion?: string;
  bundledVersion?: string;
  updateAvailable: boolean;
}

/**
 * Installs and updates the bundled `agendo` skill into the user's agent
 * skills directory (`~/.agents/skills/agendo/`), and can refresh it from a
 * configurable GitHub raw source.
 */
export class SkillManager {
  private sourceStatus?: SourceVersion;
  constructor(private readonly extensionUri: vscode.Uri) {}

  /** URI of the skill assets bundled inside the extension. */
  private get bundledDir(): vscode.Uri {
    return vscode.Uri.joinPath(this.extensionUri, "resources", "skill");
  }

  /** URI of the on-disk install location for the skill. */
  private get installDir(): vscode.Uri {
    return vscode.Uri.joinPath(vscode.Uri.file(os.homedir()), ".agents", "skills", "agendo");
  }

  /** True when a skill is already installed on disk. */
  async isInstalled(): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(this.installDir, "SKILL.md"));
      return true;
    } catch {
      return false;
    }
  }

  private async readVersion(dir: vscode.Uri): Promise<string | undefined> {
    try {
      const meta = JSON.parse(await readText(vscode.Uri.joinPath(dir, ".skill-meta.json")));
      return typeof meta.version === "string" ? meta.version : undefined;
    } catch {
      return undefined;
    }
  }

  /** Compare bundled vs installed versions. */
  async getStatus(checkSource = false): Promise<SkillStatus> {
    const installed = await this.isInstalled();
    const bundledVersion = await this.readVersion(this.bundledDir);
    const installedVersion = installed ? await this.readVersion(this.installDir) : undefined;
    const sourceUrl = (get<string>(Settings.SkillUpdateSource) || "").trim();
    if (checkSource)
      this.sourceStatus = await checkSourceVersion(sourceUrl, ".skill-meta.json", fetchText);
    return {
      installed,
      installedVersion,
      bundledVersion,
      updateAvailable: Boolean(
        installedVersion && bundledVersion && compareVersions(bundledVersion, installedVersion) > 0,
      ),
      ...(this.sourceStatus?.sourceUrl === sourceUrl ? this.sourceStatus : { sourceUrl }),
    };
  }

  /** Copy the bundled skill files into the install directory. */
  async install(): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.installDir);
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(this.installDir, "assets"));
    for (const relative of SKILL_FILES) {
      const source = vscode.Uri.joinPath(this.bundledDir, ...relative.split("/"));
      const target = vscode.Uri.joinPath(this.installDir, ...relative.split("/"));
      const bytes = await vscode.workspace.fs.readFile(source);
      await vscode.workspace.fs.writeFile(target, bytes);
    }
    out`Installed agendo skill to ${this.installDir.fsPath}`;
  }

  /**
   * Refresh the installed skill from the configured GitHub raw source. The
   * source is expected to be a raw base URL under which `SKILL.md`,
   * `reconcile.md`, and `assets/todo-template.md` live.
   */
  async updateFromSource(): Promise<void> {
    const base = (get<string>(Settings.SkillUpdateSource) || "").trim();
    if (!base) {
      throw new Error("No skill update source configured (agendo.skillUpdateSource).");
    }
    const baseUrl = stripTrailingSlashes(base);
    const files = await Promise.all(
      SKILL_FILES.map(async (relative) => ({
        relative,
        body: await fetchText(`${baseUrl}/${relative}`),
      })),
    );
    await vscode.workspace.fs.createDirectory(this.installDir);
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(this.installDir, "assets"));
    for (const { relative, body } of files) {
      const target = vscode.Uri.joinPath(this.installDir, ...relative.split("/"));
      await vscode.workspace.fs.writeFile(target, Buffer.from(body, "utf8"));
    }
    out`Updated agendo skill from ${baseUrl}`;
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

/** Fetch a bounded HTTPS response, following at most three redirects. */
export function fetchText(url: string, redirects = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      reject(new Error("Component sources must use HTTPS without URL credentials"));
      return;
    }
    const request = https
      .get(url, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
          res.resume();
          resolve(fetchText(new URL(res.headers.location, url).toString(), redirects - 1));
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`Request to ${url} failed with status ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += Buffer.byteLength(chunk);
          if (size > 5_000_000) {
            res.destroy(new Error("Component source response exceeds size limit"));
          } else {
            chunks.push(Buffer.from(chunk));
          }
        });
        res.on("error", reject);
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      })
      .on("error", reject);
    request.setTimeout(15_000, () =>
      request.destroy(new Error("Component source request timed out")),
    );
  });
}
