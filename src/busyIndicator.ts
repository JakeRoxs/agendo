import * as vscode from "vscode";

/**
 * Tracks in-progress operations so views can show inline loading feedback.
 * While an operation runs it exposes the ids of the todos being updated (for
 * the tree's per-item spinner), toggles the operation's context key (used to
 * swap toolbar buttons into a spinner state), and notifies listeners so views
 * can refresh. Multiple concurrent operations are tracked independently so
 * state only clears when each one finishes.
 */
export class BusyIndicator {
  private activeCount = 0;
  private readonly busyTodoIds = new Set<string>();
  private readonly listeners = new Set<() => void>();

  /** True while at least one operation is running under the spinner. */
  get isBusy(): boolean {
    return this.activeCount > 0;
  }

  /** True while the given todo is being updated. */
  isTodoBusy(todoId: string): boolean {
    return this.busyTodoIds.has(todoId);
  }

  /** Subscribe to busy-state changes. Returns a disposable to unsubscribe. */
  onChange(listener: () => void): vscode.Disposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Run an operation under a busy state. Optionally sets a context key while
   * running and tags it with the id of the todo it updates (for the tree's
   * per-item spinner). The label describes the operation for callers but is
   * not rendered. Returns the operation's result.
   */
  async run<T>(
    _label: string,
    operation: () => Promise<T>,
    contextKey?: string,
    todoId?: string,
  ): Promise<T> {
    this.activeCount += 1;
    if (todoId) {
      this.busyTodoIds.add(todoId);
    }
    this.emitChange();
    if (contextKey) {
      await vscode.commands.executeCommand("setContext", contextKey, true);
    }
    try {
      return await operation();
    } finally {
      this.activeCount -= 1;
      if (todoId) {
        this.busyTodoIds.delete(todoId);
      }
      this.emitChange();
      if (contextKey) {
        await vscode.commands.executeCommand("setContext", contextKey, false);
      }
    }
  }
}
