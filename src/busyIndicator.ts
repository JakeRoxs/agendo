import * as vscode from "vscode";

/**
 * Shared status-bar busy spinner. Multiple concurrent operations increment a
 * counter so the spinner stays visible until all of them finish, and each can
 * set its own context key (used to disable UI) while it runs.
 */
export class BusyIndicator {
  private readonly item: vscode.StatusBarItem;
  private activeCount = 0;

  constructor(context: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    context.subscriptions.push(this.item);
  }

  /** True while at least one operation is running under the spinner. */
  get isBusy(): boolean {
    return this.activeCount > 0;
  }

  /**
   * Run an operation under a status-bar spinner. Optionally sets a context key
   * while running. Returns the operation's result.
   */
  async run<T>(label: string, operation: () => Promise<T>, contextKey?: string): Promise<T> {
    this.activeCount += 1;
    this.item.text = `$(sync~spin) ${label}`;
    this.item.tooltip = label;
    this.item.show();
    if (contextKey) {
      await vscode.commands.executeCommand("setContext", contextKey, true);
    }
    try {
      return await operation();
    } finally {
      this.activeCount -= 1;
      if (this.activeCount <= 0) {
        this.activeCount = 0;
        this.item.hide();
      }
      if (contextKey) {
        await vscode.commands.executeCommand("setContext", contextKey, false);
      }
    }
  }
}
