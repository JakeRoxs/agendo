import * as vscode from "vscode";
import { out } from "../output";
import type { ConfigService } from "./configService";
import { isTodoFileName, parseTodo, type Todo } from "./todoModel";

/**
 * Discovers and caches todos from the root folder and its terminal/parked
 * subfolders, and refreshes when files change on disk.
 */
export class TodoRepository implements vscode.Disposable {
  private todos: Todo[] = [];
  private watcher: vscode.FileSystemWatcher | undefined;

  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  /** Fires after the cache has been refreshed. */
  readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(private readonly config: ConfigService) {}

  /** Current cached todos (does not trigger a scan). */
  getTodos(): Todo[] {
    return this.todos;
  }

  /** Rescan all folders and rebuild the cache. */
  async refresh(): Promise<void> {
    const rootUri = this.config.getRootUri();
    if (!rootUri) {
      this.todos = [];
      this.onDidChangeEmitter.fire();
      return;
    }

    const folders: Array<{ uri: vscode.Uri; folder: string }> = [
      { uri: rootUri, folder: "" },
      {
        uri: vscode.Uri.joinPath(rootUri, this.config.completeFolder),
        folder: this.config.completeFolder,
      },
      {
        uri: vscode.Uri.joinPath(rootUri, this.config.cancelledFolder),
        folder: this.config.cancelledFolder,
      },
      {
        uri: vscode.Uri.joinPath(rootUri, this.config.backlogFolder),
        folder: this.config.backlogFolder,
      },
    ];

    const collected: Todo[] = [];
    for (const { uri, folder } of folders) {
      collected.push(...(await this.scanFolder(uri, folder)));
    }

    collected.sort((a, b) => a.id.localeCompare(b.id));
    this.todos = collected;
    this.onDidChangeEmitter.fire();
  }

  private async scanFolder(uri: vscode.Uri, folder: string): Promise<Todo[]> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(uri);
    } catch {
      // Folder may not exist yet; treat as empty.
      return [];
    }

    const results: Todo[] = [];
    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File || !isTodoFileName(name)) {
        continue;
      }
      const fileUri = vscode.Uri.joinPath(uri, name);
      try {
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        const todo = parseTodo(fileUri, Buffer.from(bytes).toString("utf8"), folder);
        if (todo) {
          results.push(todo);
        }
      } catch (error) {
        out`Failed to read todo ${name}: ${error}`;
      }
    }
    return results;
  }

  /** Watch the root folder tree and refresh automatically on changes. */
  startWatching(): void {
    this.disposeWatcher();
    const rootUri = this.config.getRootUri();
    if (!rootUri) {
      return;
    }
    const pattern = new vscode.RelativePattern(rootUri, "**/*.md");
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const trigger = () => void this.refresh();
    this.watcher.onDidCreate(trigger);
    this.watcher.onDidChange(trigger);
    this.watcher.onDidDelete(trigger);
  }

  private disposeWatcher(): void {
    this.watcher?.dispose();
    this.watcher = undefined;
  }

  /** Highest numeric id across all known todos, for id allocation. */
  getMaxId(): number {
    return this.todos.reduce((max, todo) => {
      const value = parseInt(todo.id, 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0);
  }

  dispose(): void {
    this.disposeWatcher();
    this.onDidChangeEmitter.dispose();
  }
}
