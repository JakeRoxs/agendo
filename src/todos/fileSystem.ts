import * as vscode from "vscode";

/** Read a workspace file as UTF-8 text. */
export async function readText(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString("utf8");
}
