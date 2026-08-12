import * as vscode from "vscode";

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
    supersededBy?: string;
    /** Subfolder name relative to the root ("" for the root itself). */
    folder: string;
    fileName: string;
    uri: vscode.Uri;
    /** Raw parsed frontmatter, for fields not surfaced as first-class properties. */
    frontmatter: Record<string, unknown>;
}

const FILENAME_RE =
    /^(\d{3})-(pending|ready|backlogged|complete|cancelled)-(p[123])-(.+)\.md$/i;

/** True when a filename matches the Agendo naming contract. */
export function isTodoFileName(fileName: string): boolean {
    return FILENAME_RE.test(fileName);
}

/** Build a filename from its component parts. */
export function buildFileName(
    id: string,
    status: TodoStatus,
    priority: TodoPriority,
    description: string
): string {
    return `${id}-${status}-${priority}-${description}.md`;
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
export function splitFrontmatter(content: string): { data: string; body: string } {
    const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content);
    if (!match) {
        return { data: "", body: content };
    }
    return { data: match[1], body: match[2] };
}

/**
 * Minimal, dependency-free parser for the subset of YAML used by todo frontmatter:
 * scalar `key: value`, flow arrays `key: [a, b]`, and block arrays (`- item`).
 */
export function parseFrontmatter(data: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = data.split(/\r?\n/);
    let currentKey: string | null = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\s+$/, "");
        if (!line.trim() || line.trim().startsWith("#")) {
            continue;
        }

        const listMatch = /^\s*-\s+(.*)$/.exec(line);
        if (listMatch && currentKey) {
            const existing = Array.isArray(result[currentKey])
                ? (result[currentKey] as string[])
                : [];
            existing.push(unquote(listMatch[1]));
            result[currentKey] = existing;
            continue;
        }

        const kv = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
        if (kv) {
            currentKey = kv[1];
            const value = kv[2].trim();
            if (value === "") {
                result[currentKey] = [];
            } else if (value.startsWith("[") && value.endsWith("]")) {
                result[currentKey] = value
                    .slice(1, -1)
                    .split(",")
                    .map((s) => unquote(s))
                    .filter((s) => s.length > 0);
            } else {
                result[currentKey] = coerce(unquote(value));
            }
        }
    }

    return result;
}

function toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((v) => String(v)).filter((v) => v.length > 0);
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
    const match = /^\s*#\s+(.+?)\s*$/m.exec(body);
    return match ? match[1].trim() : fallback;
}

/**
 * Parse a todo file into a {@link Todo}. Returns `undefined` when the filename
 * does not match the naming contract.
 *
 * @param uri Location of the file.
 * @param content Raw file contents.
 * @param folder Subfolder relative to the root ("" for the root itself).
 */
export function parseTodo(
    uri: vscode.Uri,
    content: string,
    folder: string
): Todo | undefined {
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
        supersededBy: optionalString(frontmatter.superseded_by),
        folder,
        fileName,
        uri,
        frontmatter,
    };
}
