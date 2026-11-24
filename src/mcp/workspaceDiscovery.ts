import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import * as vscode from "vscode";

/**
 * Canonicalize an absolute filesystem path for cross-platform identity
 * comparison: resolved, backslashes normalized to forward slashes.
 */
function normalizePath(path: string): string {
  return resolve(path).replace(/\\/g, "/");
}

/**
 * Stable identity for a workspace root: SHA-256 of the normalized absolute
 * path. Shared-compatible so the extension and the bundled MCP server (which
 * has no VS Code API access) compute the same identity from a path.
 */
export function workspaceIdentity(workspacePath: string): string {
  return createHash("sha256").update(normalizePath(workspacePath)).digest("hex");
}

export function workspaceDiscoveryDirectory(
  context: vscode.ExtensionContext,
  workspaceUri?: vscode.Uri,
): string | undefined {
  const storage = context.globalStorageUri;
  // Desktop VS Code can expose on-disk profile storage as vscode-userdata.
  if (!storage || (storage.scheme !== "file" && storage.scheme !== "vscode-userdata"))
    return undefined;
  if (!isAbsolute(storage.fsPath)) return undefined;
  let workspace: vscode.Uri | undefined;
  if (workspaceUri) {
    workspace = workspaceUri;
  } else if (vscode.workspace.workspaceFile?.scheme === "file") {
    workspace = vscode.workspace.workspaceFile;
  } else {
    workspace = vscode.workspace.workspaceFolders?.find(
      (folder) => folder.uri.scheme === "file",
    )?.uri;
  }
  if (!workspace) return undefined;
  const key = workspaceIdentity(workspace.fsPath);
  return join(storage.fsPath, "mcp", "workspaces", key);
}

function writeRegistration(directory: string, filename: string, content: string): void {
  const temporary = join(directory, `${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, content, { mode: 0o600, flag: "wx" });
    renameSync(temporary, join(directory, filename));
  } finally {
    rmSync(temporary, { force: true });
  }
}

/**
 * Publish an IPC endpoint registration record under `directory`. When a
 * `workspacePath` is supplied, the record carries the normalized absolute
 * filesystem path under the `workspace` field so a discovery consumer can bind
 * the endpoint to a specific todo root. `rootMode` (`workspace` or `manual`)
 * and `label` identify the root's source and display name so MCP clients can
 * select and attribute operations to the owning root. Standalone calls without
 * a path keep the prior `{ endpoint, hostPid }` shape.
 */
export function publishEndpoint(
  directory: string,
  endpoint: string,
  workspacePath?: string,
  options: { rootMode?: "workspace" | "manual"; label?: string } = {},
): vscode.Disposable {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = `${randomUUID()}.json`;
  const record: Record<string, unknown> = {
    endpoint,
    hostPid: process.pid,
  };
  if (workspacePath !== undefined) {
    if (!isAbsolute(workspacePath)) {
      throw new Error(`workspace path must be an absolute filesystem path: ${workspacePath}`);
    }
    record.workspace = normalizePath(workspacePath);
  }
  if (options.rootMode !== undefined) {
    record.rootMode = options.rootMode;
  }
  if (options.label !== undefined) {
    record.label = options.label;
  }
  writeRegistration(directory, filename, JSON.stringify(record));
  return {
    dispose: () => rmSync(join(directory, filename), { force: true }),
  };
}
