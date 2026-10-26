import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as vscode from "vscode";
import { Command } from "../commands";
import { out } from "../output";
import type { CanvasHostActions } from "./canvasHostActions";
import type { BoardReturnTarget, WorkspaceView } from "./workspaceNavigation";

const CANVAS_NAME = "agendo-work-session";

/** The parts of the canvas's `server.mjs` this viewer relies on. */
interface InstanceServer {
  url: string;
  server: Server;
  resetApproval?: () => void;
  disposeProposals?: () => void;
}

interface CanvasServerModule {
  createInstanceServer(
    workspaceRoot: string,
    actions?: Partial<CanvasHostActions> & {
      edit?: (filePath: string) => Promise<void>;
      returnToBoard?: (scope: "todos" | "code-scanning") => Promise<void>;
      getBoardSnapshot?: (scope: "todos" | "code-scanning") => Promise<unknown>;
      handleBoardMessage?: (scope: "todos" | "code-scanning", message: unknown) => Promise<void>;
      getDigest?: (scope: "todos" | "code-scanning") => Promise<{ content: string }>;
      getSettingsInfo?: () => Promise<unknown>;
      handleSettingsAction?: (payload: unknown) => Promise<unknown>;
    },
  ): InstanceServer;
  listen(entry: InstanceServer): Promise<void>;
  navigate(
    entry: InstanceServer,
    target: string | WorkspaceView,
    returnTo?: BoardReturnTarget | null,
  ): void;
}

// The extension compiles to CommonJS, where a plain import() becomes require() and cannot load .mjs.
const importModule = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<CanvasServerModule>;

/**
 * Shows the bundled work-session canvas inside a VS Code editor tab. It runs the
 * same loopback server the Copilot canvas uses and embeds it in a webview, so
 * the dashboard is available without an agent session.
 */
export class CanvasViewer implements vscode.Disposable {
  private module?: CanvasServerModule;
  private entry?: InstanceServer;
  private root?: string;
  private panel?: vscode.WebviewPanel;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly actions: Partial<CanvasHostActions> & {
      getBoardSnapshot?: (scope: "todos" | "code-scanning") => Promise<unknown>;
      handleBoardMessage?: (scope: "todos" | "code-scanning", message: unknown) => Promise<void>;
      getDigest?: (scope: "todos" | "code-scanning") => Promise<{ content: string }>;
      getSettingsInfo?: () => Promise<unknown>;
      handleSettingsAction?: (payload: unknown) => Promise<unknown>;
    } = {},
  ) {}

  async open(
    workspaceRoot: string,
    target: string | WorkspaceView,
    returnTo?: BoardReturnTarget,
  ): Promise<void> {
    const server = await this.ensureServer(workspaceRoot);
    this.module?.navigate(server, target, returnTo ?? null);
    const external = await vscode.env.asExternalUri(vscode.Uri.parse(server.url));
    this.show(external.toString());
  }

  private async ensureServer(workspaceRoot: string): Promise<InstanceServer> {
    if (this.entry && this.root === workspaceRoot) {
      return this.entry;
    }
    await this.stopServer();
    this.module ??= await importModule(
      pathToFileURL(
        join(this.extensionUri.fsPath, "resources", "canvas", CANVAS_NAME, "server.mjs"),
      ).href,
    );
    const entry = this.module.createInstanceServer(workspaceRoot, {
      ...this.actions,
      returnToBoard: async (scope) => {
        await vscode.commands.executeCommand(
          scope === "code-scanning" ? Command.CodeScanningOpenBoard : Command.OpenBoard,
        );
      },
      edit: async (filePath) => {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
      },
    });
    await this.module.listen(entry);
    this.entry = entry;
    this.root = workspaceRoot;
    out`Work-session canvas server listening at ${entry.url}`;
    return entry;
  }

  private show(url: string): void {
    const html = this.html(url);
    if (this.panel && this.tryShow(this.panel, html)) {
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "agendo.workSessionCanvas",
      "Agendo",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel = panel;
    panel.iconPath = {
      light: vscode.Uri.joinPath(this.extensionUri, "resources", "images", "agendo-icon.svg"),
      dark: vscode.Uri.joinPath(this.extensionUri, "resources", "images", "agendo-icon.svg"),
    };
    panel.onDidDispose(() => {
      if (this.panel === panel) {
        this.panel = undefined;
        this.entry?.resetApproval?.();
      }
    });
    panel.webview.onDidReceiveMessage((message: unknown) => {
      if (typeof message !== "object" || !message) return;
      const msg = message as { type?: string; url?: string; text?: string };
      if (msg.type === "openExternal") {
        const url = externalHttpsUrl(message);
        if (url) {
          void vscode.env.openExternal(vscode.Uri.parse(url));
        }
      } else if (msg.type === "copyToClipboard" && typeof msg.text === "string") {
        void vscode.env.clipboard.writeText(msg.text).then(
          () => {
            this.panel?.webview.postMessage({ type: "clipboardResult", success: true });
          },
          (err) => {
            out`Canvas clipboard copy failed: ${err}`;
            this.panel?.webview.postMessage({ type: "clipboardResult", success: false });
          },
        );
      }
    });
    this.showPanel(panel, html);
  }

  private tryShow(panel: vscode.WebviewPanel, html: string): boolean {
    try {
      this.showPanel(panel, html);
      return true;
    } catch (error) {
      if (!isDisposedWebviewError(error)) throw error;
      if (this.panel === panel) this.panel = undefined;
      return false;
    }
  }

  private showPanel(panel: vscode.WebviewPanel, html: string): void {
    panel.title = "Agendo";
    panel.webview.html = html;
    panel.reveal(undefined, false);
  }

  // The cache-busting query makes an already-open panel reload to the newly selected todo at once.
  private html(url: string): string {
    const target = new URL(url);
    const origin = target.origin;
    const nonce = randomBytes(16).toString("base64");
    target.searchParams.set("t", String(Date.now()));
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:0;}</style></head>
<body><iframe src="${target.toString()}" title="Agendo work session"></iframe>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const frame = document.querySelector('iframe');
window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow) return;
  if (event.data?.type === 'agendo:openExternal') {
    try {
      const url = new URL(event.data.url);
      if (url.protocol === 'https:') vscode.postMessage({ type: 'openExternal', url: url.href });
    } catch {}
  } else if (event.data?.type === 'agendo:copyToClipboard') {
    vscode.postMessage({ type: 'copyToClipboard', text: event.data.text });
  }
});
</script></body></html>`;
  }

  private async stopServer(): Promise<void> {
    const entry = this.entry;
    this.entry = undefined;
    if (entry) {
      entry.disposeProposals?.();
      await new Promise<void>((resolve) => entry.server.close(() => resolve()));
    }
  }

  dispose(): void {
    const panel = this.panel;
    this.panel = undefined;
    panel?.dispose();
    void this.stopServer();
  }
}

function isDisposedWebviewError(error: unknown): boolean {
  return String(error).toLowerCase().includes("webview is disposed");
}

function externalHttpsUrl(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !("type" in value) || value.type !== "openExternal") {
    return undefined;
  }
  if (!("url" in value) || typeof value.url !== "string") {
    return undefined;
  }
  try {
    const url = new URL(value.url);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
