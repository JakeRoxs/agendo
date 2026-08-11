import * as os from "node:os";
import * as https from "node:https";
import * as vscode from "vscode";
import { Settings, get } from "../configuration";
import { out } from "../output";

/** Relative files that make up the bundled skill. */
const SKILL_FILES = [".skill-meta.json", "SKILL.md", "assets/todo-template.md"];

/** Result of comparing the bundled skill against the installed one. */
export interface SkillStatus {
    installed: boolean;
    installedVersion?: string;
    bundledVersion?: string;
    updateAvailable: boolean;
}

/**
 * Installs and updates the bundled `file-todos` skill into the user's agent
 * skills directory (`~/.agents/skills/file-todos/`), and can refresh it from a
 * configurable GitHub raw source.
 */
export class SkillManager {
    constructor(private readonly extensionUri: vscode.Uri) {}

    /** URI of the skill assets bundled inside the extension. */
    private get bundledDir(): vscode.Uri {
        return vscode.Uri.joinPath(this.extensionUri, "resources", "skill");
    }

    /** URI of the on-disk install location for the skill. */
    private get installDir(): vscode.Uri {
        return vscode.Uri.joinPath(
            vscode.Uri.file(os.homedir()),
            ".agents",
            "skills",
            "file-todos"
        );
    }

    /** True when a skill is already installed on disk. */
    async isInstalled(): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(
                vscode.Uri.joinPath(this.installDir, "SKILL.md")
            );
            return true;
        } catch {
            return false;
        }
    }

    private async readVersion(dir: vscode.Uri): Promise<string | undefined> {
        try {
            const bytes = await vscode.workspace.fs.readFile(
                vscode.Uri.joinPath(dir, ".skill-meta.json")
            );
            const meta = JSON.parse(Buffer.from(bytes).toString("utf8"));
            return typeof meta.version === "string" ? meta.version : undefined;
        } catch {
            return undefined;
        }
    }

    /** Compare bundled vs installed versions. */
    async getStatus(): Promise<SkillStatus> {
        const installed = await this.isInstalled();
        const bundledVersion = await this.readVersion(this.bundledDir);
        const installedVersion = installed
            ? await this.readVersion(this.installDir)
            : undefined;
        return {
            installed,
            installedVersion,
            bundledVersion,
            updateAvailable:
                installed &&
                compareVersions(bundledVersion, installedVersion) > 0,
        };
    }

    /** Copy the bundled skill files into the install directory. */
    async install(): Promise<void> {
        await vscode.workspace.fs.createDirectory(this.installDir);
        await vscode.workspace.fs.createDirectory(
            vscode.Uri.joinPath(this.installDir, "assets")
        );
        for (const relative of SKILL_FILES) {
            const source = vscode.Uri.joinPath(this.bundledDir, ...relative.split("/"));
            const target = vscode.Uri.joinPath(this.installDir, ...relative.split("/"));
            const bytes = await vscode.workspace.fs.readFile(source);
            await vscode.workspace.fs.writeFile(target, bytes);
        }
        out`Installed file-todos skill to ${this.installDir.fsPath}`;
    }

    /**
     * Refresh the installed skill from the configured GitHub raw source. The
     * source is expected to be a raw base URL under which `SKILL.md` and
     * `assets/todo-template.md` live.
     */
    async updateFromSource(): Promise<void> {
        const base = (get<string>(Settings.SkillUpdateSource) || "").trim();
        if (!base) {
            throw new Error(
                "No skill update source configured (file-todos.skillUpdateSource)."
            );
        }
        const baseUrl = stripTrailingSlashes(base);
        await vscode.workspace.fs.createDirectory(this.installDir);
        await vscode.workspace.fs.createDirectory(
            vscode.Uri.joinPath(this.installDir, "assets")
        );
        for (const relative of SKILL_FILES) {
            const url = `${baseUrl}/${relative}`;
            const body = await fetchText(url);
            const target = vscode.Uri.joinPath(this.installDir, ...relative.split("/"));
            await vscode.workspace.fs.writeFile(target, Buffer.from(body, "utf8"));
        }
        out`Updated file-todos skill from ${baseUrl}`;
    }
}

/** Compare two dotted version strings; returns >0 when `a` is newer than `b`. */
function compareVersions(a?: string, b?: string): number {
    if (!a) {
        return b ? -1 : 0;
    }
    if (!b) {
        return 1;
    }
    const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
    const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) {
            return diff;
        }
    }
    return 0;
}

/** Remove any trailing '/' characters without regex backtracking. */
function stripTrailingSlashes(value: string): string {
    let end = value.length;
    while (end > 0 && value.charAt(end - 1) === "/") {
        end--;
    }
    return value.slice(0, end);
}

/** Fetch a URL and return its body as text (follows a single redirect). */
function fetchText(url: string, redirects = 3): Promise<string> {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                const status = res.statusCode ?? 0;
                if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
                    res.resume();
                    resolve(fetchText(res.headers.location, redirects - 1));
                    return;
                }
                if (status < 200 || status >= 300) {
                    res.resume();
                    reject(new Error(`Request to ${url} failed with status ${status}`));
                    return;
                }
                const chunks: Buffer[] = [];
                res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
                res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            })
            .on("error", reject);
    });
}
