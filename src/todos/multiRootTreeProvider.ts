import * as vscode from "vscode";
import type { BusyIndicator } from "../busyIndicator";
import { FilterService } from "./filterService";
import { getTreeNodeKey, TodoTreeProvider, type TreeNode } from "./todoTreeProvider";
import type { TodoRootDescriptor, TodoRootRegistry } from "./rootRegistry";
import { TreeStateService } from "./treeStateService";
import type { TodoViewScope } from "./todoModel";

/** A top-level node representing a single todo root in multi-root mode. */
export interface RootNode {
  kind: "root";
  /** Stable root id. */
  rootId: string;
}

/** A child of a root container, wrapping a node from the root's TodoTreeProvider. */
export interface RootChildNode {
  kind: "root-child";
  rootId: string;
  /** The inner node from the root's child provider. */
  node: TreeNode;
}

/** The node type consumed by {@link MultiRootTreeProvider}. */
export type MultiRootTreeNode = RootNode | RootChildNode | TreeNode;

/** Persistence key prefix for root-container collapsed state, kept separate from
 * per-root child collapse state so root expansion never collides with child
 * node collapse keys. Each root derives its own key from its root ID so that
 * collapsing one root never overwrites another root's stored ID. */
const ROOT_COLLAPSE_KEY_PREFIX = "agendo.tree.collapsed.roots";

/** Deterministic, short suffix derived from a root id for namespacing per-root
 * persistence keys. */
function encodeRootId(rootId: string): string {
  let hash = 0;
  for (const char of rootId) {
    const next = Math.trunc((hash * 31) + (char.codePointAt(0) ?? 0));
    // Preserve the signed 32-bit wraparound of the previous `| 0` hash step.
    hash = next % 4_294_967_296;
    if (hash >= 2_147_483_648) hash -= 4_294_967_296;
    else if (hash < -2_147_483_648) hash += 4_294_967_296;
  }
  return `r${Math.abs(hash).toString(36)}`;
}

function rootKeys(rootId: string): { filter: string; tree: string } {
  const suffix = encodeRootId(rootId);
  return {
    filter: `agendo.filter.${suffix}`,
    tree: `agendo.tree.collapsed.${suffix}`,
  };
}

/**
 * Tree presentation layer that shows either the active root's tree (single
 * mode) or every configured root as a named, collapsible top-level node
 * (multi mode). Each root owns an isolated {@link TodoTreeProvider} over its
 * own {@link TodoRepository} with per-root {@link FilterService} and
 * {@link TreeStateService} keys, so IDs, dependencies, filters, and collapsed
 * state never collide across roots.
 */
export class MultiRootTreeProvider implements vscode.TreeDataProvider<MultiRootTreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<MultiRootTreeNode | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private readonly childProviders = new Map<string, TodoTreeProvider>();
  private readonly providerDisposables = new Map<string, vscode.Disposable>();
  private readonly rootTreeStates = new Map<string, TreeStateService>();
  private readonly rootCollapseStates = new Map<string, TreeStateService>();
  private registryDisposable: vscode.Disposable | undefined;

  constructor(
    private readonly registry: TodoRootRegistry,
    private readonly workspaceState: vscode.Memento,
    private readonly busy?: BusyIndicator,
    private readonly scope: TodoViewScope = "todos",
  ) {
    this.registryDisposable = this.registry.onDidChange(() => this.rebuild());
    this.rebuild();
  }

  /** Build (or rebuild) one child provider per current root, disposing providers
   * for roots that are no longer present. */
  private rebuild(): void {
    const currentIds = new Set<string>(this.registry.getRoots().map((root) => root.id));

    for (const id of this.childProviders.keys()) {
      if (!currentIds.has(id)) {
        this.disposeProvider(id);
      }
    }

    for (const descriptor of this.registry.getRoots()) {
      if (!this.childProviders.has(descriptor.id)) {
        this.createChildProvider(descriptor);
      }
    }

    this.refresh();
  }

  private createChildProvider(descriptor: TodoRootDescriptor): void {
    const context = this.registry.resolveContext(descriptor);
    const keys = rootKeys(descriptor.id);
    const filter = new FilterService(this.workspaceState, keys.filter);
    const treeState = new TreeStateService(this.workspaceState, keys.tree);
    const rootCollapse = new TreeStateService(this.workspaceState, `${ROOT_COLLAPSE_KEY_PREFIX}.${encodeRootId(descriptor.id)}`);
    const provider = new TodoTreeProvider(context.repository, filter, treeState, this.busy, this.scope);

    this.childProviders.set(descriptor.id, provider);
    this.rootTreeStates.set(descriptor.id, treeState);
    this.rootCollapseStates.set(descriptor.id, rootCollapse);

    const disposable = provider.onDidChangeTreeData(() => this.refresh());
    this.providerDisposables.set(descriptor.id, disposable);
  }

  private disposeProvider(rootId: string): void {
    const disposable = this.providerDisposables.get(rootId);
    disposable?.dispose();
    this.providerDisposables.delete(rootId);
    const provider = this.childProviders.get(rootId);
    provider?.dispose();
    this.childProviders.delete(rootId);
    this.rootTreeStates.delete(rootId);
    this.rootCollapseStates.delete(rootId);
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  private activeProvider(): TodoTreeProvider | undefined {
    const activeId = this.registry.getActiveRootId();
    if (!activeId) return undefined;
    return this.childProviders.get(activeId);
  }

  getTreeItem(node: MultiRootTreeNode): vscode.TreeItem {
    switch (node.kind) {
      case "root": {
        const descriptor = this.registry.getRoot(node.rootId);
        if (!descriptor) {
          return new vscode.TreeItem(node.rootId);
        }
        const isCollapsed = this.rootCollapseStates.get(node.rootId)?.isCollapsed(node.rootId);
        const item = new vscode.TreeItem(
          descriptor.label,
          isCollapsed
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.Expanded,
        );
        item.description = descriptor.uri.fsPath;
        item.contextValue = "rootContainer";
        item.id = node.rootId;
        item.resourceUri = descriptor.uri;
        return item;
      }
      case "root-child": {
        const provider = this.childProviders.get(node.rootId);
        if (!provider) {
          return new vscode.TreeItem(`Unknown root: ${node.rootId}`);
        }
        const item = provider.getTreeItem(node.node);
        // Root-prefix the stable id so collapse state cannot collide across roots.
        item.id = `${node.rootId}:${item.id ?? ""}`;
        return item;
      }
      default: {
        // Single mode: delegate to the active root's provider with no wrapper.
        const provider = this.activeProvider();
        if (!provider) {
          return new vscode.TreeItem("No active root");
        }
        return provider.getTreeItem(node);
      }
    }
  }

  getChildren(node?: MultiRootTreeNode): MultiRootTreeNode[] {
    if (this.registry.getMode() === "multi") {
      if (!node) {
        return this.registry.getRoots().map((root) => ({
          kind: "root" as const,
          rootId: root.id,
        }));
      }

      if (node.kind === "root") {
        const provider = this.childProviders.get(node.rootId);
        if (!provider) return [];
        return provider.getChildren().map((child) => ({
          kind: "root-child" as const,
          rootId: node.rootId,
          node: child,
        }));
      }

      if (node.kind === "root-child") {
        const provider = this.childProviders.get(node.rootId);
        if (!provider) return [];
        return provider.getChildren(node.node).map((child) => ({
          kind: "root-child" as const,
          rootId: node.rootId,
          node: child,
        }));
      }

      // A bare TreeNode is unexpected in multi mode; ignore it.
      return [];
    }

    // Single mode: delegate to the active root's provider with no wrapper.
    const provider = this.activeProvider();
    if (!provider) return [];
    return provider.getChildren(node as TreeNode | undefined);
  }

  /** Returns the child provider for a root, for tests and integration wiring. */
  getChildProvider(rootId: string): TodoTreeProvider | undefined {
    return this.childProviders.get(rootId);
  }

  /** Collapse a node, routing root containers to the root-container state and
   * root-child nodes to that root's child TreeStateService using the inner
   * node's canonical key. Single mode delegates to the active provider. */
  collapse(node: MultiRootTreeNode): void {
    switch (node.kind) {
      case "root": {
        const state = this.rootCollapseStates.get(node.rootId);
        if (state) {
          state.collapse(node.rootId);
          this.refresh();
        }
        break;
      }
      case "root-child": {
        const provider = this.childProviders.get(node.rootId);
        if (!provider) return;
        const key = getTreeNodeKey(node.node);
        if (key) {
          provider.collapse(key);
        }
        break;
      }
      default: {
        // Single mode: delegate to the active root's provider unchanged.
        this.activeProvider()?.collapseNode(node);
        break;
      }
    }
  }

  /** Expand a node, routing root containers to the root-container state and
   * root-child nodes to that root's child TreeStateService using the inner
   * node's canonical key. Single mode delegates to the active provider. */
  expand(node: MultiRootTreeNode): void {
    switch (node.kind) {
      case "root": {
        const state = this.rootCollapseStates.get(node.rootId);
        if (state) {
          state.expand(node.rootId);
          this.refresh();
        }
        break;
      }
      case "root-child": {
        const provider = this.childProviders.get(node.rootId);
        if (!provider) return;
        const key = getTreeNodeKey(node.node);
        if (key) {
          provider.expand(key);
        }
        break;
      }
      default: {
        // Single mode: delegate to the active root's provider unchanged.
        this.activeProvider()?.expandNode(node);
        break;
      }
    }
  }

  dispose(): void {
    this.registryDisposable?.dispose();
    this.registryDisposable = undefined;
    for (const rootId of this.childProviders.keys()) {
      this.disposeProvider(rootId);
    }
    this.childProviders.clear();
    this.rootTreeStates.clear();
    this.rootCollapseStates.clear();
    this.onDidChangeTreeDataEmitter.dispose();
  }
}
