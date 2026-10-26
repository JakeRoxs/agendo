import type { TodoViewScope } from "./todoModel";

/** Host-neutral selections. A group or board is never represented by a todo ID. */
export type WorkspaceView =
  | { kind: "todo"; todoId: string }
  | { kind: "group"; groupName: string }
  | { kind: "board"; scope: TodoViewScope };

export type BoardReturnTarget = Extract<WorkspaceView, { kind: "board" }>;

export function boardReturnTarget(value: unknown): BoardReturnTarget | undefined {
  if (!value || typeof value !== "object") return undefined;
  const target = value as Record<string, unknown>;
  return target.kind === "board" && (target.scope === "todos" || target.scope === "code-scanning")
    ? { kind: "board", scope: target.scope }
    : undefined;
}
