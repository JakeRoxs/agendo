import type * as vscode from "vscode";

/**
 * Lifecycle status of a todo.
 *
 * - `pending` / `ready` are active states that live directly in the root folder.
 * - `backlogged` is a deprioritized-but-open state (moves to the backlog subfolder).
 * - `complete` and `cancelled` are terminal states (each has its own subfolder).
 */
export type TodoStatus = "pending" | "ready" | "backlogged" | "complete" | "cancelled";

export type TodoPriority = "p1" | "p2" | "p3";

export const TODO_STATUSES: TodoStatus[] = [
  "pending",
  "ready",
  "backlogged",
  "complete",
  "cancelled",
];

export const TODO_PRIORITIES: TodoPriority[] = ["p1", "p2", "p3"];

/** Statuses that represent active, in-progress work. */
export const ACTIVE_STATUSES: TodoStatus[] = ["pending", "ready"];

/** Statuses that are terminal (finished or abandoned). */
export const TERMINAL_STATUSES: TodoStatus[] = ["complete", "cancelled"];

/** Parsed representation of a single todo markdown file. */
export interface Todo {
  /** Zero-padded issue id, e.g. "060". */
  id: string;
  status: TodoStatus;
  priority: TodoPriority;
  /** Human-friendly title (first `# heading` if present, else the description). */
  title: string;
  /** Kebab-case description token from the filename. */
  description: string;
  tags: string[];
  dependencies: string[];
  /** External tracking key, e.g. a Jira issue key. */
  key?: string;
  /** Legacy Jira-specific alias retained for API compatibility. */
  jira?: string;
  parent?: string;
  children: string[];
  epic: boolean;
  group?: string;
  supersededBy?: string;
  /** Subfolder name relative to the root ("" for the root itself). */
  folder: string;
  fileName: string;
  uri: vscode.Uri;
  /** Last filesystem modification time, populated by the repository. */
  updatedAt?: number;
  /** Raw parsed frontmatter, for fields not surfaced as first-class properties. */
  frontmatter: Record<string, unknown>;
}

/**
 * Check whether a todo is blocked by any incomplete dependencies.
 *
 * A todo is "blocked" when at least one of its declared dependencies is not yet
 * in a terminal state (`complete` or `cancelled`). This is a pure function — the
 * caller passes the full repository snapshot so the check remains stateless.
 */
export function isBlocked(todo: Todo, allTodos: readonly Todo[]): boolean {
  if (!todo.dependencies.length) {
    return false;
  }
  const completeIds = new Set(
    allTodos.filter((t) => TERMINAL_STATUSES.includes(t.status)).map((t) => t.id),
  );
  return todo.dependencies.some((depId) => !completeIds.has(depId));
}

/**
 * Get the IDs of todos that this todo blocks (reverse dependency lookup).
 */
export function getBlockedBy(todo: Todo, allTodos: readonly Todo[]): string[] {
  return allTodos
    .filter((t) => t.dependencies.includes(todo.id) && !TERMINAL_STATUSES.includes(t.status))
    .map((t) => t.id);
}

const FILENAME_RE = /^(\d{3})-(pending|ready|backlogged|complete|cancelled)-(p[123])-(.+)\.md$/i;

/** True when a filename matches the Agendo naming contract. */
export function isTodoFileName(fileName: string): boolean {
  return FILENAME_RE.test(fileName);
}

/** Normalize a todo description into a safe filename segment. */
function sanitizeDescription(description: string): string {
  const normalized = description
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[._]+/g, "-")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  const withoutLeadingHyphen = normalized.startsWith("-") ? normalized.slice(1) : normalized;
  const withoutTrailingHyphen = withoutLeadingHyphen.endsWith("-")
    ? withoutLeadingHyphen.slice(0, -1)
    : withoutLeadingHyphen;

  return withoutTrailingHyphen || "todo";
}

/** Build a filename from its component parts. */
export function buildFileName(
  id: string,
  status: TodoStatus,
  priority: TodoPriority,
  description: string,
): string {
  const safeDescription = sanitizeDescription(description);
  return `${id}-${status}-${priority}-${safeDescription}.md`;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function coerce(value: string): unknown {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}

/** Split a document into its frontmatter block and body. */
export function splitFrontmatter(content: string): {
  data: string;
  body: string;
} {
  const normalized = content.replace("\uFEFF", "").replace(/\r/g, "");
  const lines = normalized.split("\n");

  if (lines[0]?.trim() !== "---") {
    return { data: "", body: content };
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (endIndex === -1) {
    return { data: "", body: content };
  }

  return {
    data: lines.slice(1, endIndex).join("\n"),
    body: lines.slice(endIndex + 1).join("\n"),
  };
}

function parseFrontmatterValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") {
    return [];
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => unquote(item))
      .filter((item) => item.length > 0);
  }
  return coerce(unquote(trimmed));
}

function parseFrontmatterLine(line: string): { key: string; value: unknown } | undefined {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex <= 0) {
    return undefined;
  }

  const key = line.slice(0, separatorIndex).trim();
  if (!/^\w+$/.test(key)) {
    return undefined;
  }

  return {
    key,
    value: parseFrontmatterValue(line.slice(separatorIndex + 1)),
  };
}

/**
 * Minimal, dependency-free parser for the subset of YAML used by todo frontmatter:
 * scalar `key: value`, flow arrays `key: [a, b]`, and block arrays (`- item`).
 */
export function parseFrontmatter(data: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;

  for (const rawLine of data.split("\n")) {
    const line = rawLine.replace(/\r/g, "").trimEnd();
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    if (line.trimStart().startsWith("- ") && currentKey) {
      const existing = Array.isArray(result[currentKey]) ? (result[currentKey] as string[]) : [];
      existing.push(unquote(line.trimStart().slice(2).trim()));
      result[currentKey] = existing;
      continue;
    }

    const parsed = parseFrontmatterLine(line);
    if (!parsed) {
      continue;
    }

    currentKey = parsed.key;
    result[currentKey] = parsed.value;
  }

  return result;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter((item) => item.length > 0);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return undefined;
}

function extractTitle(body: string, fallback: string): string {
  const lines = body.split("\n");
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("#")) {
      return trimmed.replace(/^#+\s*/, "").trim() || fallback;
    }
  }
  return fallback;
}

/**
 * Parse a todo file into a {@link Todo}. Returns `undefined` when the filename
 * does not match the naming contract.
 *
 * @param uri Location of the file.
 * @param content Raw file contents.
 * @param folder Subfolder relative to the root ("" for the root itself).
 */
export function parseTodo(uri: vscode.Uri, content: string, folder: string): Todo | undefined {
  const fileName = uri.path.split("/").pop() ?? "";
  const nameMatch = FILENAME_RE.exec(fileName);
  if (!nameMatch) {
    return undefined;
  }

  const [, id, statusToken, priorityToken, description] = nameMatch;
  const { data, body } = splitFrontmatter(content);
  const frontmatter = parseFrontmatter(data);

  // Filename token is the source of truth for status/priority; frontmatter is
  // used only when the filename is somehow ambiguous.
  const status = statusToken.toLowerCase() as TodoStatus;
  const priority = priorityToken.toLowerCase() as TodoPriority;
  const jira = optionalString(frontmatter.jira);

  return {
    id,
    status,
    priority,
    title: extractTitle(body, description),
    description,
    tags: toStringArray(frontmatter.tags),
    dependencies: toStringArray(frontmatter.dependencies),
    key: optionalString(frontmatter.key) ?? jira,
    jira,
    parent: optionalString(frontmatter.parent),
    children: toStringArray(frontmatter.children),
    epic: frontmatter.epic === true,
    group: optionalString(frontmatter.group),
    supersededBy: optionalString(frontmatter.superseded_by),
    folder,
    fileName,
    uri,
    frontmatter,
  };
}
