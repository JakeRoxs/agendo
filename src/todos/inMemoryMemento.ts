import type * as vscode from "vscode";

/** Minimal in-memory Memento for hosts and tests without persisted workspace state. */
export class InMemoryMemento implements vscode.Memento {
  private readonly store = new Map<string, unknown>();

  keys(): readonly string[] {
    return Array.from(this.store.keys());
  }

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  update(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }
}
