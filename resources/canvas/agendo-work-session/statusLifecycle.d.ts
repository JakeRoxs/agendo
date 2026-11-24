/**
 * Type contract for the shared, runtime-neutral todo lifecycle core
 * implemented in `statusLifecycle.js`. Consumed by TypeScript adapters
 * (StatusService) without enabling broad `allowJs`.
 */

export const STATUSES: readonly [
  "pending",
  "in-progress",
  "ready",
  "backlogged",
  "completed",
  "cancelled",
];
export const TERMINAL_STATUSES: readonly ["completed", "cancelled"];
export const ACTIVE_STATUSES: readonly ["pending", "in-progress", "ready"];
export const PRIORITIES: readonly ["p1", "p2", "p3"];
export const FILENAME_RE: RegExp;

export type TodoStatus = (typeof STATUSES)[number];
export type TodoPriority = (typeof PRIORITIES)[number];

export function isValidStatus(status: unknown): status is TodoStatus;
export function buildFileName(
  id: string,
  status: TodoStatus,
  priority: TodoPriority,
  description: string,
): string;
export function sanitizeDescription(description: string): string;

export function planTransition(params: {
  content: string;
  id: string;
  status: TodoStatus;
  priority: TodoPriority;
  description: string;
  newStatus: TodoStatus;
  folders: Record<string, string>;
  todo?: { id: string; supersededBy?: string };
}): {
  newContent: string;
  fileName: string;
  targetFolder: string;
  oldStatus: TodoStatus;
  newStatus: TodoStatus;
};

/**
 * Check whether a todo is blocked from being set to "ready" by its dependencies.
 * A todo is blocked when at least one of its declared dependencies is not yet
 * in a terminal state (`completed` or `cancelled`).
 */
export function isReadyBlocked(
  dependencies: readonly string[],
  allTodos: readonly { id: string; status: TodoStatus }[],
): boolean;
