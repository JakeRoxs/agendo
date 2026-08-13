import * as vscode from "vscode";
import { out } from "../output";
import type { ConfigService } from "./configService";
import {
  buildFileName,
  splitFrontmatter,
  type Todo,
  type TodoPriority,
  type TodoStatus,
} from "./todoModel";

const CANCELLED_BANNER_RE = /^>\s*\*\*CANCELLED[\s\S]*?(?:\r?\n>.*)*\r?\n?/m;

/**
 * Executes status/priority transitions: rewrites frontmatter, renames the file
 * (keeping the filename token in sync), moves it between folders, and manages
 * the contextual cancelled banner.
 */
export class StatusService {
  constructor(private readonly config: ConfigService) {}

  /** Target subfolder ("" = root) for a given status. */
  private folderForStatus(status: TodoStatus): string {
    switch (status) {
      case "backlogged":
        return this.config.backlogFolder;
      case "complete":
        return this.config.completeFolder;
      case "cancelled":
        return this.config.cancelledFolder;
      default:
        return "";
    }
  }

  /** Change a todo's status, moving/renaming the file and updating its body. */
  async setStatus(
    todo: Todo,
    newStatus: TodoStatus,
  ): Promise<vscode.Uri | undefined> {
    if (todo.status === newStatus) {
      return undefined;
    }

    const bytes = await vscode.workspace.fs.readFile(todo.uri);
    let content = Buffer.from(bytes).toString("utf8");

    content = this.rewriteFrontmatterField(content, "status", newStatus);

    if (newStatus === "cancelled") {
      content = this.ensureTag(content, "cancelled");
      content = this.insertCancelledBanner(content, todo);
    } else if (todo.status === "cancelled") {
      // Reopening: strip the cancelled banner.
      content = content.replace(CANCELLED_BANNER_RE, "");
    }

    const targetFolder = this.folderForStatus(newStatus);
    const newName = buildFileName(
      todo.id,
      newStatus,
      todo.priority,
      todo.description,
    );

    return this.writeAndMove(todo, content, targetFolder, newName);
  }

  /** Change a todo's priority, renaming the file and updating frontmatter. */
  async setPriority(
    todo: Todo,
    newPriority: TodoPriority,
  ): Promise<vscode.Uri | undefined> {
    if (todo.priority === newPriority) {
      return undefined;
    }
    const bytes = await vscode.workspace.fs.readFile(todo.uri);
    let content = Buffer.from(bytes).toString("utf8");
    content = this.rewriteFrontmatterField(content, "priority", newPriority);

    const newName = buildFileName(
      todo.id,
      todo.status,
      newPriority,
      todo.description,
    );
    return this.writeAndMove(todo, content, todo.folder, newName);
  }

  /**
   * Write the new content to the target location and remove the old file when
   * the path changed. Returns the URI the todo now lives at.
   */
  private async writeAndMove(
    todo: Todo,
    content: string,
    targetFolder: string,
    newName: string,
  ): Promise<vscode.Uri> {
    const rootUri = this.config.getRootUri();
    if (!rootUri) {
      throw new Error("No workspace root configured for todos.");
    }

    const targetDir = targetFolder
      ? vscode.Uri.joinPath(rootUri, targetFolder)
      : rootUri;
    await vscode.workspace.fs.createDirectory(targetDir);
    const targetUri = vscode.Uri.joinPath(targetDir, newName);

    await vscode.workspace.fs.writeFile(
      targetUri,
      Buffer.from(content, "utf8"),
    );

    if (targetUri.toString() !== todo.uri.toString()) {
      try {
        await vscode.workspace.fs.delete(todo.uri);
      } catch (error) {
        out`Failed to delete old todo file ${todo.uri.fsPath}: ${error}`;
      }
    }

    return targetUri;
  }

  /** Replace a scalar frontmatter field, inserting it if missing. */
  private rewriteFrontmatterField(
    content: string,
    key: string,
    value: string,
  ): string {
    const { data } = splitFrontmatter(content);
    if (!data) {
      // No frontmatter block: create one.
      return `---\n${key}: ${value}\n---\n\n${content}`;
    }

    const fieldRe = new RegExp(String.raw`^(${key}\s*:\s*).*$`, "m");
    if (fieldRe.test(data)) {
      const newData = data.replace(fieldRe, `$1${value}`);
      return content.replace(data, newData);
    }
    // Field missing: append to the frontmatter block.
    const newData = `${data}\n${key}: ${value}`;
    return content.replace(data, newData);
  }

  /** Ensure a tag is present in the frontmatter `tags` list. */
  private ensureTag(content: string, tag: string): string {
    const { data } = splitFrontmatter(content);
    if (!data) {
      return content;
    }
    const tagsRe = /^tags\s*:\s*\[(.*)\]\s*$/m;
    const match = tagsRe.exec(data);
    if (match) {
      const existing = match[1]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (existing.some((t) => t.replace(/["']/g, "") === tag)) {
        return content;
      }
      existing.push(tag);
      const newData = data.replace(tagsRe, `tags: [${existing.join(", ")}]`);
      return content.replace(data, newData);
    }
    // No flow-style tags list found; leave body untouched to avoid corrupting
    // block-style lists.
    return content;
  }

  /** Insert the contextual cancelled banner directly under the `# title`. */
  private insertCancelledBanner(content: string, todo: Todo): string {
    if (CANCELLED_BANNER_RE.test(content)) {
      return content;
    }
    const supersede = todo.supersededBy
      ? ` / SUPERSEDED by [${todo.supersededBy}]`
      : "";
    const banner = `> **CANCELLED${supersede}**`;
    const lines = content.split("\n");
    const headingIndex = lines.findIndex((line) => line.startsWith("# "));
    if (headingIndex >= 0) {
      const before = lines.slice(0, headingIndex + 1).join("\n");
      const after = lines.slice(headingIndex + 1).join("\n");
        return before + "\n\n" + banner + (after ? "\n\n" + after : "");
    }
    return banner + "\n\n" + content;
  }
}
