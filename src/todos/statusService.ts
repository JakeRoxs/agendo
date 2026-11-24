import * as vscode from "vscode";
import { out } from "../output";
import type { ConfigService } from "./configService";
import { readText } from "./fileSystem";
import {
  buildFileName,
  codeScanningBase,
  splitFrontmatter,
  type Todo,
  type TodoPriority,
  type TodoStatus,
} from "./todoModel";
import { isReadyBlocked, planTransition, TERMINAL_STATUSES } from "../../resources/canvas/agendo-work-session/statusLifecycle.js";
import type { TodoRepository } from "./todoRepository";

/**
 * Executes status/priority transitions: rewrites frontmatter, renames the file
 * (keeping the filename token in sync), moves it between folders, and manages
 * the contextual cancelled banner.
 *
 * The content, filename, and target-folder planning is delegated to the shared
 * {@link planTransition} lifecycle core so the VS Code adapter and the standalone
 * canvas/MCP adapter make identical decisions. This adapter supplies the file
 * system (`writeAndMove`) and the scanner-aware folder base.
 */
export class StatusService {
  constructor(
    private readonly config: ConfigService,
    private readonly repository?: TodoRepository,
  ) {}

  /** Change a todo's status, moving/renaming the file and updating its body. */
  async setStatus(todo: Todo, newStatus: TodoStatus): Promise<vscode.Uri | undefined> {
    if (todo.status === newStatus) {
      return undefined;
    }

    if (newStatus === "ready" && todo.dependencies.length > 0) {
      const allTodos = this.repository?.getTodos() ?? [];
      const todosById = new Map(allTodos.map((candidate) => [candidate.id, candidate]));
      if (isReadyBlocked(todo.dependencies, allTodos.map((t) => ({ id: t.id, status: t.status })))) {
        const terminalSet = new Set<TodoStatus>(TERMINAL_STATUSES);
        const incomplete = todo.dependencies
          .map((id) => {
            const dependency = todosById.get(id);
            if (!dependency || !terminalSet.has(dependency.status)) {
              return `${id} (${dependency?.status ?? "missing"})`;
            }
            return null;
          })
          .filter(Boolean);
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

    const content = await readText(todo.uri);

    // Delegate frontmatter, cancelled tag/banner, filename, and target folder to
    // the shared lifecycle core. The adapter prepends the scanner source base so
    // code-scanning todos stay in their own lifecycle folders.
    const plan = planTransition({
      content,
      id: todo.id,
      status: todo.status,
      priority: todo.priority,
      description: todo.description,
      newStatus,
      folders: {
        backlogged: this.config.backloggedFolder,
        completed: this.config.completedFolder,
        cancelled: this.config.cancelledFolder,
      },
      todo,
    });
    if (!plan) {
      return undefined;
    }

    const targetFolder = [codeScanningBase(todo.folder), plan.targetFolder]
      .filter(Boolean)
      .join("/");

    return this.writeAndMove(todo, plan.newContent, targetFolder, plan.fileName);
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
      const lineEnding = data.includes("\r\n") ? "\r\n" : "\n";
      const lines = data.split(lineEnding);
      const dependencyLineIndex = this.findFrontmatterFieldLine(lines, "dependencies");
      const newArray = `[${newDependencies.map((dependency) => JSON.stringify(dependency)).join(", ")}]`;
      if (dependencyLineIndex >= 0) {
        lines[dependencyLineIndex] = `dependencies: ${newArray}`;
        const newData = lines.join(lineEnding);
        content = content.replace(data, newData);
      } else {
        const newData = `${data}${lineEnding}dependencies: ${newArray}`;
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
    const groupValue =
      newGroup && (/^[\w.-]+$/.test(newGroup) ? newGroup : JSON.stringify(newGroup));
    if (data) {
      const lineEnding = data.includes("\r\n") ? "\r\n" : "\n";
      const lines = data.split(lineEnding);
      const groupLineIndex = this.findFrontmatterFieldLine(lines, "group");
      if (newGroup) {
        if (groupLineIndex >= 0) {
          lines[groupLineIndex] = `group: ${groupValue}`;
          const newData = lines.join(lineEnding);
          content = content.replace(data, newData);
        } else {
          const newData = `${data}${lineEnding}group: ${groupValue}`;
          content = content.replace(data, newData);
        }
      } else if (groupLineIndex >= 0) {
        lines.splice(groupLineIndex, 1);
        content = content.replace(data, lines.join(lineEnding));
      }
    } else if (newGroup) {
      content = `---\ngroup: ${groupValue}\n---\n\n${content}`;
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
    if (
      vscode.workspace.textDocuments.some(
        (document) => document.uri.toString() === todo.uri.toString() && document.isDirty,
      )
    ) {
      throw new Error("Save or discard unsaved todo changes before updating it.");
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

  /** Find a top-level scalar frontmatter field without using a regular expression. */
  private findFrontmatterFieldLine(lines: string[], key: string): number {
    return lines.findIndex((line) => {
      if (!line.startsWith(key)) {
        return false;
      }
      return line.slice(key.length).trimStart().startsWith(":");
    });
  }

  /** Replace a scalar frontmatter field, inserting it if missing. Used by priority/group updates. */
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

  /** Delete a todo file from disk. */
  async deleteTodo(todo: Todo): Promise<void> {
    await vscode.workspace.fs.delete(todo.uri, { recursive: false });
    out`Deleted todo file ${todo.uri.fsPath}`;
  }
}
