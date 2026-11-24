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

export function publishEndpoint(
  directory: string,
  endpoint: string,
  workspacePath?: string,
): vscode.Disposable {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = `${randomUUID()}.json`;
  const record = {
    endpoint,
    hostPid: process.pid,
    ...(workspacePath ? { workspace: workspacePath } : {}),
  };
  writeRegistration(directory, filename, JSON.stringify(record));
  return {
    dispose: () => rmSync(join(directory, filename), { force: true }),
  };
}
