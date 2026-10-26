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
}

interface CanvasServerModule {
  createInstanceServer(
    workspaceRoot: string,
    actions?: Partial<CanvasHostActions> & {
      edit?: (filePath: string) => Promise<void>;
      returnToBoard?: (scope: "todos" | "code-scanning") => Promise<void>;
      getBoardSnapshot?: (scope: "todos" | "code-scanning") => Promise<unknown>;
      handleBoardMessage?: (scope: "todos" | "code-scanning", message: unknown) => Promise<void>;
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
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "agendo.workSessionCanvas",
        "Agendo",
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true },
      );
      this.panel.iconPath = {
        light: vscode.Uri.joinPath(this.extensionUri, "resources", "images", "agendo-icon.svg"),
        dark: vscode.Uri.joinPath(this.extensionUri, "resources", "images", "agendo-icon.svg"),
      };
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }
    this.panel.title = "Agendo";
    this.panel.webview.html = this.html(url);
    this.panel.reveal(undefined, false);
  }

  // The cache-busting query makes an already-open panel reload to the newly selected todo at once.
  private html(url: string): string {
    const target = new URL(url);
    const origin = target.origin;
    target.searchParams.set("t", String(Date.now()));
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; style-src 'unsafe-inline';">
<style>html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:0;}</style></head>
<body><iframe src="${target.toString()}" title="Agendo work session"></iframe></body></html>`;
  }

  private async stopServer(): Promise<void> {
    const entry = this.entry;
    this.entry = undefined;
    if (entry) {
      await new Promise<void>((resolve) => entry.server.close(() => resolve()));
    }
  }

  dispose(): void {
    this.panel?.dispose();
    void this.stopServer();
  }
}
