import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { ConfigService } from "./configService";
import { TodoRepository } from "./todoRepository";
import type { Todo } from "./todoModel";
import type { BoardReturnTarget } from "./workspaceNavigation";
import { InMemoryMemento } from "./inMemoryMemento";

/** Keys used to persist root registry state per workspace in Memento. */
export const ROOT_REGISTRY_KEY = "agendo.manualRoots";
export const ACTIVE_ROOT_KEY = "agendo.activeRootId";
export const TREE_MODE_KEY = "agendo.treeMode";

/** Tree presentation mode: a single active root or multiple named roots. */
export type TreeMode = "single" | "multi";

/** A persisted manual root record. */
interface ManualRootRecord {
  /** Canonical filesystem path; doubles as the stable root id. */
  readonly uri: string;
  /** User-facing label. */
  readonly label: string;
}

/** A named, independent todo root context. */
export interface TodoRootDescriptor {
  /** Stable canonical id derived from the canonical filesystem path. */
  readonly id: string;
  /** User-facing label (basename by default, disambiguated on collision). */
  label: string;
  /** Absolute URI of the todo root. */
  readonly uri: vscode.Uri;
  readonly source: "workspace" | "manual";
  /** Associated workspace folder for workspace roots. */
  readonly folder?: vscode.WorkspaceFolder;
  /** Whether the root directory currently exists on disk. */
  readonly available: boolean;
}

/**
 * A root-bound runtime context: a descriptor plus its own config and
 * repository. Each context has an isolated ID sequence and dependency graph,
 * so duplicate IDs across roots never collide. Contexts are not aggregated.
 */
export interface RootContext {
  readonly descriptor: TodoRootDescriptor;
  readonly config: ConfigService;
  readonly repository: TodoRepository;
  dispose(): void;
}

/** Canonical local filesystem path for a file: URI. */
function canonicalPath(uri: vscode.Uri): string {
  if (uri.scheme !== "file") {
    throw new Error(`Expected a file: URI, got ${uri.scheme}`);
  }
  let p = uri.fsPath.replace(/\\/g, "/");
  p = path.posix.normalize(p);
  // Drop trailing slashes so "/root/" and "/root" share one stable id, but
  // preserve the root path "/". A single left-to-right scan keeps this
  // linear; a regex with a trailing `$` anchor and a quantifier can
  // backtrack super-linearly on long inputs.
  if (p.length > 1) {
    let end = p.length;
    while (end > 0 && p[end - 1] === "/") {
      end--;
    }
    p = p.slice(0, end);
  }
  return p;
}

/** Default label: the basename of the root path. */
function defaultLabel(uri: vscode.Uri): string {
  const base = path.posix.basename(canonicalPath(uri));
  return base || uri.fsPath;
}

/** Shortest ancestor path of `uri` not shared by any other root in `group`. */
function distinguishingHint(uri: vscode.Uri, group: TodoRootDescriptor[]): string {
  const own = canonicalPath(uri);
  const parts = own.split("/").filter(Boolean);
  const others = group.filter((other) => canonicalPath(other.uri) !== own);
  for (let depth = 1; depth < parts.length; depth++) {
    // Hints carry a leading slash so they compare as path prefixes against
    // full (absolute) root paths; the leading slash is dropped for display.
    const hint = `/${parts.slice(0, depth).join("/")}`;
    const shared = others.some((other) => {
      const op = canonicalPath(other.uri);
      return op === hint || op.startsWith(`${hint}/`);
    });
    if (!shared) {
      return hint.slice(1);
    }
  }
  return "";
}

function disambiguateLabels(descriptors: TodoRootDescriptor[]): void {
  const byLabel = new Map<string, TodoRootDescriptor[]>();
  for (const d of descriptors) {
    const group = byLabel.get(d.label) ?? [];
    group.push(d);
    byLabel.set(d.label, group);
  }
  for (const group of byLabel.values()) {
    if (group.length < 2) continue;
    for (const d of group) {
      const hint = distinguishingHint(d.uri, group);
      d.label = hint ? `${d.label} (${hint})` : `${d.label} ${group.indexOf(d) + 1}`;
    }
  }
}

/**
 * Parse a persisted manual root record into a `ManualRootRecord`.
 * Returns `undefined` for malformed records so the caller can skip them.
 * The parse is fallible: `canonicalPath` throws on non-file URIs, so it is
 * wrapped in a catch that treats the whole record as ignorable.
 */
function parseManualRootRecord(record: unknown): ManualRootRecord | undefined {
  if (!record || typeof record !== "object") {
    return undefined;
  }
  const uri = (record as { uri?: unknown }).uri;
  const label = (record as { label?: unknown }).label;
  if (typeof uri !== "string") {
    return undefined;
  }
  try {
    const canonical = canonicalPath(vscode.Uri.file(uri));
    const resolvedLabel =
      typeof label === "string" ? label : defaultLabel(vscode.Uri.file(uri));
    return { uri: canonical, label: resolvedLabel };
  } catch {
    // Malformed persisted record: ignore it.
    return undefined;
  }
}

/**
 * Persisted root registry: workspace-folder roots plus manually added roots.
 *
 * Workspace roots derive their todo URI from the folder-scoped `agendo.root`
 * setting. Manual roots are arbitrary local filesystem directories. The
 * registry deduplicates by canonical path, preferring the workspace descriptor
 * when a manual root overlaps a workspace root. Manual root records, the active
 * root id, and the tree mode are persisted in workspaceState (per workspace).
 *
 * The registry also caches a root-bound context ({descriptor, config,
 * repository}) per root. Each repository is isolated: it has its own ID
 * sequence and dependency graph, so duplicate IDs across roots never collide.
 * Contexts are created lazily and disposed when their root is removed.
 */
export class TodoRootRegistry {
  private readonly config: ConfigService;
  private readonly workspaceState: vscode.Memento;
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  /** Fires when the root set, active root, or tree mode changes. */
  readonly onDidChange = this.onDidChangeEmitter.event;

  private readonly manualRoots = new Map<string, ManualRootRecord>();
  private activeRootId: string | undefined;
  private treeMode: TreeMode = "single";
  private readonly contexts = new Map<string, RootContext>();
  /** Callback invoked by every root context's config to open a todo in the canvas. */
  private canvasOpener?: (todoId: string, returnTo: BoardReturnTarget | undefined, workspaceRoot: string, rootMode: "workspace" | "manual") => Promise<boolean>;

  constructor(config: ConfigService, workspaceState: vscode.Memento) {
    this.config = config;
    // Legacy hosts and tests that omit workspaceState get an in-memory fallback
    // so command registration works without a persistence backend. Real
    // activation always passes a live workspaceState, so persistence is intact.
    this.workspaceState = workspaceState ?? new InMemoryMemento();
    this.load();
    this.restoreSelection();
  }

  /** Set the callback used by every root context's config to open a todo in the canvas. */
  setCanvasOpener(opener: (todoId: string, returnTo: BoardReturnTarget | undefined, workspaceRoot: string, rootMode: "workspace" | "manual") => Promise<boolean>): void {
    this.canvasOpener = opener;
  }

  /** Restore the persisted active root selection into the config service so the
   * repository rebinds to the selected root on activation. */
  private restoreSelection(): void {
    if (!this.activeRootId) {
      return;
    }
    const descriptor = this.getRoot(this.activeRootId);
    if (!descriptor) {
      return;
    }
    if (descriptor.source === "manual") {
      this.config.setManualRoot(descriptor.uri);
    } else if (descriptor.folder) {
      this.config.setWorkspaceFolder(descriptor.folder);
    }
  }

  private load(): void {
    const raw = this.workspaceState.get(ROOT_REGISTRY_KEY);
    if (Array.isArray(raw)) {
      for (const record of raw as unknown[]) {
        const parsed = parseManualRootRecord(record);
        if (parsed) {
          this.manualRoots.set(parsed.uri, parsed);
        }
      }
    }
    const active = this.workspaceState.get(ACTIVE_ROOT_KEY);
    this.activeRootId = typeof active === "string" ? active : undefined;
    const mode = this.workspaceState.get(TREE_MODE_KEY);
    this.treeMode = mode === "single" || mode === "multi" ? mode : "single";
  }

  /** Create a root-bound ConfigService for a descriptor. It returns the
   * descriptor's URI directly, so workspace roots honor the folder-scoped
   * `agendo.root` and manual roots use their exact URI. */
  private createRootConfig(descriptor: TodoRootDescriptor): ConfigService {
    const config = new ConfigService(undefined, descriptor.uri);
    const workspaceRoot = descriptor.source === "workspace"
      ? descriptor.folder?.uri.fsPath
      : descriptor.uri.fsPath;
    const rootMode = descriptor.source === "workspace" ? "workspace" : "manual";
    config.setCanvasOpener(async (uri, returnTo) => {
      const todoId = /^((?:(?:cql|sq)-)?\d{3,})-/.exec(path.basename(uri.fsPath))?.[1];
      if (!todoId || !workspaceRoot) {
        return false;
      }
      // Duplicate-ID check is scoped to this root's isolated repository.
      const context = this.getContext(descriptor.id);
      const repository = context?.repository;
      if (repository) {
        const dupes = repository.getTodos().filter((todo) => todo.id === todoId);
        if (dupes.length > 1) {
          vscode.window.showWarningMessage(
            `Duplicate todo ID ${todoId}: opening the selected source file instead of an ambiguous canvas session.`,
          );
          return false;
        }
      }
      return await this.canvasOpener?.(todoId, returnTo, workspaceRoot, rootMode) ?? false;
    });
    return config;
  }

  private createContext(descriptor: TodoRootDescriptor): RootContext {
    const config = this.createRootConfig(descriptor);
    const repository = new TodoRepository(config);
    return {
      descriptor,
      config,
      repository,
      dispose: () => repository.dispose(),
    };
  }

  /** Resolve (creating if needed) the root-bound context for a descriptor. */
  resolveContext(descriptor: TodoRootDescriptor): RootContext {
    let context = this.contexts.get(descriptor.id);
    if (!context) {
      context = this.createContext(descriptor);
      this.contexts.set(descriptor.id, context);
    }
    return context;
  }

  /** Return the context for a root id when it is a current root; undefined
   * otherwise (disposing any stale cached context). */
  getContext(id: string): RootContext | undefined {
    const descriptor = this.getRoot(id);
    if (!descriptor) {
      this.removeContext(id);
      return undefined;
    }
    return this.contexts.get(id);
  }

  /** Contexts for every current root, creating missing ones and disposing
   * contexts for roots that are no longer present. */
  getContexts(): RootContext[] {
    const roots = this.getRoots();
    const currentIds = new Set<string>(roots.map((r) => r.id));
    for (const [id, context] of this.contexts) {
      if (!currentIds.has(id)) {
        context.dispose();
        this.contexts.delete(id);
      }
    }
    const contexts: RootContext[] = [];
    for (const descriptor of roots) {
      contexts.push(this.resolveContext(descriptor));
    }
    return contexts;
  }

  /** Resolve the root-bound context that owns a todo by matching its URI
   * against each root's repository. Returns undefined when the todo belongs to
   * no known root (stale or invalid selection). */
  resolveRootForTodo(todo: Todo): RootContext | undefined {
    for (const descriptor of this.getRoots()) {
      const context = this.getContext(descriptor.id);
      if (!context) continue;
      if (context.repository.getTodos().some((t) => t.uri.toString() === todo.uri.toString())) {
        return context;
      }
    }
    return undefined;
  }

  /** Dispose and remove a context (e.g. when a manual root is removed). */
  removeContext(id: string): void {
    const context = this.contexts.get(id);
    if (context) {
      context.dispose();
      this.contexts.delete(id);
    }
  }

  /** Dispose every cached context. */
  dispose(): void {
    for (const context of this.contexts.values()) {
      context.dispose();
    }
    this.contexts.clear();
  }

  /** All roots: workspace-folder roots first, then manual roots, deduplicated by
   * canonical path (workspace roots win on overlap). */
  getRoots(): TodoRootDescriptor[] {
    const roots: TodoRootDescriptor[] = [];
    const seen = new Set<string>();

    for (const folder of this.config.workspaceFolders ?? []) {
      const rootUri = this.config.getRootUri(folder);
      if (!rootUri) continue;
      const id = canonicalPath(rootUri);
      if (seen.has(id)) continue;
      seen.add(id);
      roots.push({
        id,
        label: defaultLabel(rootUri),
        uri: rootUri,
        source: "workspace",
        folder,
        available: true,
      });
    }

    for (const record of this.manualRoots.values()) {
      if (seen.has(record.uri)) continue; // workspace descriptor wins on overlap
      seen.add(record.uri);
      const uri = vscode.Uri.file(record.uri);
      roots.push({
        id: record.uri,
        label: record.label,
        uri,
        source: "manual",
        folder: undefined,
        available: this.isDirectory(uri),
      });
    }

    disambiguateLabels(roots);
    return roots;
  }

  /** Root descriptor for the given id, or undefined. */
  getRoot(id: string): TodoRootDescriptor | undefined {
    return this.getRoots().find((root) => root.id === id);
  }

  /** Persisted active root id, falling back to the first root when the
   * persisted root is no longer present. */
  getActiveRootId(): string | undefined {
    const id = this.activeRootId;
    if (id && this.getRoot(id)) return id;
    const roots = this.getRoots();
    return roots.length ? roots[0].id : undefined;
  }

  /** Active root descriptor, or undefined when there are no roots. */
  getActiveRoot(): TodoRootDescriptor | undefined {
    const id = this.getActiveRootId();
    return id ? this.getRoot(id) : undefined;
  }

  /** Persist the active root id and reflect it in the config service so the
   * repository rebinds to the selected root. Throws when the id is not a
   * known root. */
  setActiveRoot(id: string): void {
    const descriptor = this.getRoot(id);
    if (!descriptor) {
      throw new Error(`Unknown root: ${id}`);
    }
    this.activeRootId = id;
    this.persist();
    this.onDidChangeEmitter.fire();
    if (descriptor.source === "manual") {
      this.config.setManualRoot(descriptor.uri);
    } else if (descriptor.folder) {
      this.config.setWorkspaceFolder(descriptor.folder);
    }
  }

  /** Add a manual root. Validates a local file: URI and an existing directory. */
  addManualRoot(uri: vscode.Uri, label?: string): void {
    if (uri.scheme !== "file") {
      throw new Error(`Expected a file: URI, got ${uri.scheme}`);
    }
    const canonical = canonicalPath(uri);
    if (!this.isDirectory(vscode.Uri.file(canonical))) {
      throw new Error(`Not an existing directory: ${canonical}`);
    }
    const resolvedLabel = label ?? defaultLabel(vscode.Uri.file(canonical));
    this.manualRoots.set(canonical, { uri: canonical, label: resolvedLabel });
    this.persist();
    this.onDidChangeEmitter.fire();
  }

  /** Remove a manual root by id. No-op when the id is not a manual root. The
   * root's context is disposed and removed. */
  removeManualRoot(id: string): void {
    if (!this.manualRoots.has(id)) return;
    this.manualRoots.delete(id);
    if (this.activeRootId === id) {
      this.activeRootId = undefined;
    }
    this.removeContext(id);
    this.persist();
    this.onDidChangeEmitter.fire();
  }

  getMode(): TreeMode {
    return this.treeMode;
  }

  setMode(mode: TreeMode): void {
    if (mode !== "single" && mode !== "multi") {
      throw new Error(`Invalid tree mode: ${mode}`);
    }
    this.treeMode = mode;
    this.persist();
    this.onDidChangeEmitter.fire();
  }

  private isDirectory(uri: vscode.Uri): boolean {
    try {
      return fs.statSync(uri.fsPath).isDirectory();
    } catch {
      return false;
    }
  }

  private persist(): void {
    const records = Array.from(this.manualRoots.values(), (record) => ({
      uri: record.uri,
      label: record.label,
    }));
    this.workspaceState.update(ROOT_REGISTRY_KEY, records);
    this.workspaceState.update(ACTIVE_ROOT_KEY, this.activeRootId);
    this.workspaceState.update(TREE_MODE_KEY, this.treeMode);
  }
}
