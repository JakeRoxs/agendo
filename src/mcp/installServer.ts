import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionContext } from "vscode";

export async function installMcpServer(
  context: Pick<ExtensionContext, "extensionPath" | "globalStorageUri">,
): Promise<string> {
  const filename = "server.bundle.mjs";
  const bundle = await readFile(join(context.extensionPath, "resources", "mcp", filename));
  const directory = join(context.globalStorageUri.fsPath, "mcp");
  const target = join(directory, filename);
  try {
    if (bundle.equals(await readFile(target))) return target;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await mkdir(directory, { recursive: true });
  // Replace the complete bundle so a client never starts from a partial copy.
  const temporary = join(directory, `${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bundle, { flag: "wx" });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return target;
}
