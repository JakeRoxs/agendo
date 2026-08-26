import * as vscode from "vscode";
import { out } from "../output";
import type { ConfigService } from "./configService";
import { readText } from "./fileSystem";
import { isTodoFileName, parseTodo, TERMINAL_STATUSES, type Todo } from "./todoModel";

const REFRESH_DEBOUNCE_MS = 400;

export interface DependencyGraph {
  /** Todo ID to dependency IDs that are missing or not terminal. */
  readonly blockedBy: ReadonlyMap<string, readonly string[]>;
  /** Todo ID to active todo IDs that directly depend on it. */
  readonly blocking: ReadonlyMap<string, readonly string[]>;
}

function emptyDependencyGraph(): DependencyGraph {
  return { blockedBy: new Map(), blocking: new Map() };
}

/**
 * Discovers and caches todos from the root folder and its terminal/parked
 * subfolders, and refreshes when files change on disk.
 */
export class TodoRepository implements vscode.Disposable {
  private todos: Todo[] = [];
  private dependencyGraph: DependencyGraph = emptyDependencyGraph();
  private groups: readonly string[] = [];
  private watcher: vscode.FileSystemWatcher | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  /** Fires after the cache has been refreshed. */
  readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(private readonly config: ConfigService) {}

  /** Current cached todos (does not trigger a scan). */
  getTodos(): Todo[] {
    return this.todos;
  }

  /** Dependency indexes rebuilt atomically with the todo cache. */
  getDependencyGraph(): DependencyGraph {
    return this.dependencyGraph;
  }

  /** Sorted group names computed with the current repository snapshot. */
  getGroups(): readonly string[] {
    return this.groups;
  }

  /** Rescan all folders and rebuild the cache. */
  async refresh(): Promise<void> {
    const rootUri = this.config.getRootUri();
    if (!rootUri) {
      this.todos = [];
      this.dependencyGraph = emptyDependencyGraph();
      this.groups = [];
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
    this.dependencyGraph = this.computeDependencyGraph();
    this.groups = [
      ...new Set(
        collected.map((todo) => todo.group).filter((group): group is string => Boolean(group)),
      ),
    ].sort((left, right) => left.localeCompare(right));
    this.onDidChangeEmitter.fire();
  }

  private computeDependencyGraph(): DependencyGraph {
    const todosById = new Map(this.todos.map((todo) => [todo.id, todo]));
    const blockedBy = new Map<string, string[]>();
    const blocking = new Map<string, string[]>();

    for (const todo of this.todos) {
      const unmetDependencies = todo.dependencies.filter((dependencyId) => {
        const dependency = todosById.get(dependencyId);
        return !dependency || !TERMINAL_STATUSES.includes(dependency.status);
      });
      blockedBy.set(todo.id, unmetDependencies);
      blocking.set(todo.id, []);
    }

    for (const todo of this.todos) {
      if (TERMINAL_STATUSES.includes(todo.status)) {
        continue;
      }
      for (const dependencyId of todo.dependencies) {
        const dependents = blocking.get(dependencyId);
        if (dependents) {
          dependents.push(todo.id);
        }
      }
    }

    return { blockedBy, blocking };
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
        const [content, stat] = await Promise.all([
          readText(fileUri),
          vscode.workspace.fs.stat(fileUri),
        ]);
        const todo = parseTodo(fileUri, content, folder);
        if (todo) {
          results.push({ ...todo, createdAt: stat.ctime, updatedAt: stat.mtime });
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
    const trigger = () => this.scheduleRefresh();
    this.watcher.onDidCreate(trigger);
    this.watcher.onDidChange(trigger);
    this.watcher.onDidDelete(trigger);
  }

  private scheduleRefresh(): void {
    this.cancelScheduledRefresh();
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh().catch((error) => out`Failed to refresh todos: ${error}`);
    }, REFRESH_DEBOUNCE_MS);
  }

  private cancelScheduledRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private disposeWatcher(): void {
    this.cancelScheduledRefresh();
    this.watcher?.dispose();
    this.watcher = undefined;
  }

  /** Highest numeric id across all known todos, for id allocation. */
  getMaxId(): number {
    return this.todos.reduce((max, todo) => {
      const value = Number.parseInt(todo.id, 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0);
  }

  dispose(): void {
    this.disposeWatcher();
    this.onDidChangeEmitter.dispose();
  }
}
