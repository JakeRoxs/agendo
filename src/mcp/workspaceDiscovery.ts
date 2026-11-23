import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import * as vscode from "vscode";

export function workspaceDiscoveryDirectory(context: vscode.ExtensionContext): string | undefined {
  const workspaceFile = vscode.workspace.workspaceFile;
  // An untitled workspace can still contain local folders. Its workspace
  // descriptor is not a stable file URI, but the first local folder is.
  const workspace = workspaceFile?.scheme === "file"
    ? workspaceFile
    : vscode.workspace.workspaceFolders?.find((folder) => folder.uri.scheme === "file")?.uri;
  const storage = context.globalStorageUri;
  // Desktop VS Code can expose on-disk profile storage as vscode-userdata.
  if (!workspace || (storage.scheme !== "file" && storage.scheme !== "vscode-userdata")) return undefined;
  if (!isAbsolute(storage.fsPath)) return undefined;
  const key = createHash("sha256").update(workspace.toString()).digest("hex");
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

export function publishEndpoint(directory: string, endpoint: string): vscode.Disposable {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = `${randomUUID()}.json`;
  writeRegistration(directory, filename, JSON.stringify({ endpoint, hostPid: process.pid }));
  return {
    dispose: () => rmSync(join(directory, filename), { force: true }),
  };
}
