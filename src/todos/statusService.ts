import * as vscode from "vscode";
import { out } from "../output";
import type { ConfigService } from "./configService";
import { readText } from "./fileSystem";
import {
  buildFileName,
  splitFrontmatter,
  type Todo,
  type TodoPriority,
  type TodoStatus,
} from "./todoModel";
import type { TodoRepository } from "./todoRepository";

const CANCELLED_BANNER_RE = /^>\s*\*\*CANCELLED[\s\S]*?(?:\r?\n>.*)*\r?\n?/m;

/**
 * Executes status/priority transitions: rewrites frontmatter, renames the file
 * (keeping the filename token in sync), moves it between folders, and manages
 * the contextual cancelled banner.
 */
export class StatusService {
  constructor(
    private readonly config: ConfigService,
    private readonly repository?: TodoRepository,
  ) {}

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
  async setStatus(todo: Todo, newStatus: TodoStatus): Promise<vscode.Uri | undefined> {
    if (todo.status === newStatus) {
      return undefined;
    }

    if (newStatus === "ready" && todo.dependencies.length > 0) {
      const allTodos = this.repository?.getTodos() ?? [];
      const todosById = new Map(allTodos.map((candidate) => [candidate.id, candidate]));
      const incompleteIds = this.repository?.getDependencyGraph().blockedBy.get(todo.id) ?? [];
      if (incompleteIds.length > 0) {
        const incomplete = incompleteIds.map((id) => {
          const dependency = todosById.get(id);
          return `${id} (${dependency?.status ?? "missing"})`;
        });
        const answer = await vscode.window.showWarningMessage(
          `Todo ${todo.id} has incomplete dependencies: ${incomplete.join(", ")}. Set to ready anyway?`,
          "Set anyway",
          "Cancel",
        );
        if (answer !== "Set anyway") {
          return undefined;
        }
      }
    }

    let content = await readText(todo.uri);

    content = this.rewriteFrontmatterField(content, "status", newStatus);

    if (newStatus === "cancelled") {
      content = this.ensureTag(content, "cancelled");
      content = this.insertCancelledBanner(content, todo);
    } else if (todo.status === "cancelled") {
      // Reopening: strip the cancelled banner.
      content = content.replace(CANCELLED_BANNER_RE, "");
    }

    const targetFolder = this.folderForStatus(newStatus);
    const newName = buildFileName(todo.id, newStatus, todo.priority, todo.description);

    return this.writeAndMove(todo, content, targetFolder, newName);
  }

  /** Change a todo's priority, renaming the file and updating frontmatter. */
  async setPriority(todo: Todo, newPriority: TodoPriority): Promise<vscode.Uri | undefined> {
    if (todo.priority === newPriority) {
      return undefined;
    }
    let content = await readText(todo.uri);
    content = this.rewriteFrontmatterField(content, "priority", newPriority);

    const newName = buildFileName(todo.id, todo.status, newPriority, todo.description);
    return this.writeAndMove(todo, content, todo.folder, newName);
  }

  /** Update the dependencies list in frontmatter and rename/move the file. */
  async setDependencies(todo: Todo, newDependencies: string[]): Promise<vscode.Uri | undefined> {
    if (
      JSON.stringify([...todo.dependencies].sort()) === JSON.stringify([...newDependencies].sort())
    ) {
      return undefined;
    }
    let content = await readText(todo.uri);
    const { data } = splitFrontmatter(content);
    if (data) {
      const depsRe = /^dependencies\s*:\s*(.*)$/m;
      const depsMatch = depsRe.exec(data);
      const newArray = `[${newDependencies.map((dependency) => JSON.stringify(dependency)).join(", ")}]`;
      if (depsMatch) {
        const newData = data.replace(depsRe, `dependencies: ${newArray}`);
        content = content.replace(data, newData);
      } else {
        const newData = `${data}\ndependencies: ${newArray}`;
        content = content.replace(data, newData);
      }
    }
    const newName = buildFileName(todo.id, todo.status, todo.priority, todo.description);
    return this.writeAndMove(todo, content, todo.folder, newName);
  }

  /** Update the group field in frontmatter and rename/move the file. */
  async setGroup(todo: Todo, newGroup: string | undefined): Promise<vscode.Uri | undefined> {
    if (todo.group === newGroup) {
      return undefined;
    }
    let content = await readText(todo.uri);
    const { data } = splitFrontmatter(content);
    if (data) {
      const groupRe = /^group\s*:\s*(.*)$/m;
      if (newGroup) {
        if (groupRe.test(data)) {
          const newData = data.replace(groupRe, `group: ${newGroup}`);
          content = content.replace(data, newData);
        } else {
          const newData = `${data}\ngroup: ${newGroup}`;
          content = content.replace(data, newData);
        }
      } else {
        const newData = data
          .replace(groupRe, "")
          .replace(/\n\s*\n/g, "\n")
          .replace(/^\n/, "");
        content = content.replace(data, newData);
      }
    }
    const newName = buildFileName(todo.id, todo.status, todo.priority, todo.description);
    return this.writeAndMove(todo, content, todo.folder, newName);
  }

  /** Rename first so editors and AI tooling follow the file, then update it in place. */
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

    const targetDir = targetFolder ? vscode.Uri.joinPath(rootUri, targetFolder) : rootUri;
    await vscode.workspace.fs.createDirectory(targetDir);
    const targetUri = vscode.Uri.joinPath(targetDir, newName);

    if (targetUri.toString() !== todo.uri.toString()) {
      await vscode.workspace.fs.rename(todo.uri, targetUri, { overwrite: false });
      out`Moved todo ${todo.uri.fsPath} to ${targetUri.fsPath} before updating its contents`;
    }

    await vscode.workspace.fs.writeFile(targetUri, Buffer.from(content, "utf8"));

    return targetUri;
  }

  /** Replace a scalar frontmatter field, inserting it if missing. */
  private rewriteFrontmatterField(content: string, key: string, value: string): string {
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
    const supersede = todo.supersededBy ? ` / SUPERSEDED by [${todo.supersededBy}]` : "";
    const banner = `> **CANCELLED${supersede}**`;
    const lines = content.split("\n");
    const headingIndex = lines.findIndex((line) => line.startsWith("# "));
    if (headingIndex >= 0) {
      const before = lines.slice(0, headingIndex + 1).join("\n");
      const after = lines.slice(headingIndex + 1).join("\n");
      const afterSection = after ? `\n\n${after}` : "";

      return `${before}\n\n${banner}${afterSection}`;
    }

    return `${banner}\n\n${content}`;
  }
}
