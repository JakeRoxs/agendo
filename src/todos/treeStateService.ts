import * as vscode from "vscode";

const TREE_STATE_KEY = "agendo.tree.collapsed";

/**
 * Persists collapsed tree node state in workspace state.
 * Node keys follow the pattern: "status:<status>" or "priority:<status>:<priority>".
 */
export class TreeStateService {
  private collapsedNodes: Set<string> = new Set();

  constructor(private readonly state: vscode.Memento) {
    const stored = state.get<string[]>(TREE_STATE_KEY, []);
    this.collapsedNodes = new Set(stored);
  }

  /** True if the node with the given key is currently collapsed. */
  isCollapsed(nodeKey: string): boolean {
    return this.collapsedNodes.has(nodeKey);
  }

  /** Toggle the collapsed state for a node. */
  async toggle(nodeKey: string): Promise<void> {
    if (this.collapsedNodes.has(nodeKey)) {
      this.collapsedNodes.delete(nodeKey);
    } else {
      this.collapsedNodes.add(nodeKey);
    }
    await this.persist();
  }

  /** Collapse a node. */
  async collapse(nodeKey: string): Promise<void> {
    this.collapsedNodes.add(nodeKey);
    await this.persist();
  }

  /** Expand a node. */
  async expand(nodeKey: string): Promise<void> {
    this.collapsedNodes.delete(nodeKey);
    await this.persist();
  }

  /** Clear all collapsed state. */
  async clear(): Promise<void> {
    this.collapsedNodes.clear();
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.state.update(TREE_STATE_KEY, Array.from(this.collapsedNodes));
  }
}
