import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { out } from "../output";
import type {
  DiagnosticsService,
  GetProblemsParams,
  GetProblemsResult,
} from "./diagnosticsService";
import {
  McpError,
  ProblemErrorCode,
} from "./diagnosticsService";

const MAX_FRAME = 64 * 1024; // 64 KiB, aligned with the MCP client's outbound request cap
const MAX_RESPONSE = 1024 * 1024; // 1 MiB, aligned with the MCP client's inbound response cap
const REQUEST_TIMEOUT = 30_000; // 30 seconds

export interface IpcBridgeOptions {
  context: vscode.ExtensionContext;
  diagnostics: DiagnosticsService;
}

/**
 * Windows named-pipe path for the Agendo problems bridge:
 * `\\.\pipe\agendo-<token>`. Pure of `process.platform` so it can be asserted
 * on any host.
 */
export function windowsNamedPipe(token: string): string {
  return `\\\\.\\\\pipe\\\\agendo-${token}`;
}

/**
 * Compute a fresh endpoint per start so concurrent/restarted bridges do not
 * collide. Linux: Unix domain socket under a private mode-0700 temp directory.
 * Windows: named pipe `\\.\pipe\agendo-<random-token>`.
 */
function computeEndpoint(): string {
  if (process.platform === "win32") {
    return windowsNamedPipe(crypto.randomUUID());
  }
  const dir = path.join(os.tmpdir(), `agendo-ipc-${crypto.randomUUID()}`);
  fs.mkdirSync(dir, { mode: 0o700 });
  return path.join(dir, "socket");
}

/**
 * Per-window local IPC bridge. Exposes the `get_problems` diagnostics contract
 * over a Node `net` endpoint:
 * - Linux: Unix domain socket under a private mode-0700 temp directory.
 * - Windows: named pipe `\\.\pipe\agendo-<random-token>` (no readableAll/writableAll).
 *
 * One request per connection, byte-bounded 64 KiB frame, 30 s request timeout.
 * The bridge observes `agendo.mcp.problems.enabled` (default true) and stops
 * listening on opt-out while keeping the configuration listener alive so a
 * later opt-in re-enables it. It refuses/disables on web or remote hosts.
 * `dispose()` is terminal: it stops listening, unsubscribes the configuration
 * listener, and cleans up only the owned endpoint. It is registered as a
 * `context.subscriptions` disposable so it is torn down on deactivation.
 */
export class IpcBridge implements vscode.Disposable {
  private server: net.Server | undefined;
  private endpoint: string;
  private listening = false;
  private disposed = false;
  private readonly context: vscode.ExtensionContext;
  private readonly diagnostics: DiagnosticsService;
  private configListener: vscode.Disposable | undefined;

  constructor(options: IpcBridgeOptions) {
    this.context = options.context;
    this.diagnostics = options.diagnostics;
    this.endpoint = computeEndpoint();

    const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("agendo.mcp.problems.enabled")) {
        void this.update().catch((error) => {
          out`Failed to update problems bridge: ${error}`;
        });
      }
    });
    this.configListener = configListener;
    this.context.subscriptions.push(configListener);

    // Terminal disposal on extension deactivation.
    const lifecycleDisposable = new vscode.Disposable(() => this.dispose());
    this.context.subscriptions.push(lifecycleDisposable);

    this.update();
  }

  /** Endpoint the MCP server connects to via `--endpoint`. */
  getEndpoint(): string {
    return this.endpoint;
  }

  /** Terminal disposal: stop listening, drop the config listener, clean up. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stopListening();
    if (this.configListener) {
      this.configListener.dispose();
      this.configListener = undefined;
    }
  }

  private async update(): Promise<void> {
    const enabled = vscode.workspace
      .getConfiguration("agendo")
      .get("mcp.problems.enabled", true);
    if (!enabled || !isLocalDesktopHost()) {
      // Opt-out or non-local host: stop listening but keep the config listener
      // alive so a later opt-in re-enables the bridge.
      this.stopListening();
      return;
    }
    if (this.listening) {
      return;
    }
    await this.start();
  }

  private async start(): Promise<void> {
    if (this.disposed || this.listening) {
      return;
    }
    // Remove any stale socket left by an unclean shutdown so the server can
    // rebind to the same endpoint after a stop/start cycle.
    if (process.platform !== "win32") {
      try {
        fs.rmSync(this.endpoint, { force: true });
      } catch {
        /* ignore */
      }
    }
    let server: net.Server;
    try {
      server = net.createServer((socket) => {
        this.handleConnection(socket);
      });
    } catch (error) {
      throw new McpError(
        ProblemErrorCode.INTERNAL,
        `Failed to create IPC server: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.listen({ path: this.endpoint }, () => resolve());
      server.on("error", (error) => {
        reject(
          new McpError(
            ProblemErrorCode.INTERNAL,
            `Failed to listen on IPC endpoint: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      });
    });
    this.listening = true;
  }

  /** Stop listening and clean up the owned endpoint; keep the config listener alive. */
  private stopListening(): void {
    if (!this.listening) {
      return;
    }
    this.listening = false;
    if (this.server) {
      this.server.close(() => {
        this.server = undefined;
        this.cleanupEndpoint();
      });
    } else {
      this.cleanupEndpoint();
    }
  }

  private cleanupEndpoint(): void {
    if (this.disposed && !this.server) {
      try {
        if (process.platform === "win32") {
          // Named pipes are released by closing the server; best-effort removal.
          try {
            fs.rmSync(this.endpoint, { recursive: true, force: true });
          } catch {
            /* ignore */
          }
        } else {
          // Safe cleanup: only remove a socket we actually own.
          try {
            const stat = fs.statSync(this.endpoint);
            if (stat.isSocket()) {
              fs.rmSync(this.endpoint, { force: true });
            }
          } catch {
            /* ignore */
          }
          try {
            fs.rmSync(path.dirname(this.endpoint), { recursive: true, force: true });
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  private handleConnection(socket: net.Socket): void {
    let buffer: Buffer | undefined;
    let timer: NodeJS.Timeout | undefined;
    const refresh = () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => socket.destroy(), REQUEST_TIMEOUT);
    };
    refresh();

    const processLine = (lineBuf: Buffer): void => {
      try {
        void this.handleRequest(socket, lineBuf.toString("utf8"));
      } catch {
        // handleRequest converts all errors into a wire response internally.
      }
    };

    socket.on("data", (data: Buffer) => {
      if (timer) {
        clearTimeout(timer);
      }
      buffer = buffer ? Buffer.concat([buffer, data]) : data;
      if (buffer.length > MAX_FRAME) {
        socket.destroy();
        buffer = undefined;
        return;
      }
      while (true) {
        const index = buffer.indexOf(0x0A); // newline byte
        if (index === -1) {
          break;
        }
        const lineBuf = buffer.subarray(0, index);
        buffer = buffer.subarray(index + 1);
        processLine(lineBuf);
      }
      refresh();
    });

    socket.on("close", () => {
      if (timer) {
        clearTimeout(timer);
      }
    });
    socket.on("error", () => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  }

  /** Validate IPC params/fields before using them, so malformed caller input
   * yields a stable INVALID_PARAMS wire error instead of an INTERNAL TypeError. */
  private validateParams(params: unknown): void {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      throw new McpError(ProblemErrorCode.INVALID_PARAMS, "params must be a JSON object.");
    }
    const p = params as {
      path?: unknown;
      workspaceFolder?: unknown;
      severity?: unknown;
      limit?: unknown;
    };
    if (p.path !== undefined && typeof p.path !== "string") {
      throw new McpError(ProblemErrorCode.INVALID_PARAMS, "path must be a string.");
    }
    if (p.workspaceFolder !== undefined && typeof p.workspaceFolder !== "string") {
      throw new McpError(ProblemErrorCode.INVALID_PARAMS, "workspaceFolder must be a string.");
    }
    if (p.severity !== undefined) {
      if (!Array.isArray(p.severity)) {
        throw new McpError(ProblemErrorCode.INVALID_PARAMS, "severity must be an array.");
      }
      const valid = new Set(["error", "warning", "information", "hint"]);
      for (const severity of p.severity) {
        if (typeof severity !== "string" || !valid.has(severity)) {
          throw new McpError(
            ProblemErrorCode.INVALID_PARAMS,
            `Invalid severity: ${String(severity)}.`,
          );
        }
      }
    }
    if (p.limit !== undefined) {
      if (typeof p.limit !== "number" || !Number.isFinite(p.limit) || !Number.isInteger(p.limit)) {
        throw new McpError(ProblemErrorCode.INVALID_PARAMS, "limit must be an integer.");
      }
      if (p.limit < 1 || p.limit > 500) {
        throw new McpError(ProblemErrorCode.INVALID_PARAMS, "limit must be between 1 and 500.");
      }
    }
  }

  /** Bound the serialized response to the 1 MiB frame by truncating diagnostics
   * when the result is large. `total` stays the count of all matching
   * diagnostics; `truncated` is true whenever any diagnostics are dropped. */
  private boundResponse(
    response: { id: unknown; ok: boolean; result?: GetProblemsResult },
  ): { id: unknown; ok: boolean; result?: GetProblemsResult } {
    if (!response.ok || !response.result) {
      return response;
    }
    const result = response.result;
    const total = result.total;
    let truncated = result.truncated;
    let kept = result.diagnostics;
    let payload = JSON.stringify(response) + "\n";
    while (Buffer.byteLength(payload) > MAX_RESPONSE && kept.length > 0) {
      kept = kept.slice(0, kept.length / 2);
      truncated = true;
      response = { ...response, result: { ...result, diagnostics: kept, total, truncated } };
      payload = JSON.stringify(response) + "\n";
    }
    if (Buffer.byteLength(payload) > MAX_RESPONSE) {
      // Last resort: report an empty result so the reply always fits the frame.
      response = { ...response, result: { ...result, diagnostics: [], total, truncated: true } };
      truncated = true;
      payload = JSON.stringify(response) + "\n";
    }
    return response;
  }

  /** Handle one JSONL request and send one JSONL response, then close. */
  private async handleRequest(socket: net.Socket, line: string): Promise<void> {
    let id: unknown;
    let response: {
      id: unknown;
      ok: boolean;
      result?: GetProblemsResult;
      error?: { code: string; message: string };
    };
    try {
      const parsed = JSON.parse(line);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new McpError(ProblemErrorCode.INVALID_PARAMS, "Request must be a JSON object.");
      }
      id = (parsed as { id?: unknown }).id;
      const method = (parsed as { method?: unknown }).method;
      if (method !== "get_problems") {
        throw new McpError(ProblemErrorCode.INVALID_PARAMS, `Unknown method: ${String(method)}`);
      }
      const params = (parsed as { params?: unknown }).params ?? {};
      this.validateParams(params);
      const result = await this.diagnostics.getProblems(params as GetProblemsParams);
      response = { id, ok: true, result };
    } catch (error) {
      response = {
        id: id ?? null,
        ok: false,
        error: this.toError(error),
      };
    }
    response = this.boundResponse(response);
    const payload = `${JSON.stringify(response)}\n`;
    socket.write(payload, () => {
      // One request per connection: close after the response is flushed.
      socket.end();
    });
  }

  private toError(error: unknown): { code: string; message: string } {
    if (error instanceof McpError) {
      return { code: error.code, message: error.message };
    }
    if (error instanceof Error) {
      return { code: "INTERNAL", message: error.message };
    }
    return { code: "INTERNAL", message: String(error) };
  }
}

function isLocalDesktopHost(): boolean {
  return vscode.env.uiKind === vscode.UIKind.Desktop && vscode.env.remoteName === undefined;
}
