import { ACTIVE_STATUSES, type Todo, type TodoPriority } from "./todoModel";
import type { DependencyGraph } from "./todoRepository";

const PRIORITY_RANK: Record<TodoPriority, number> = { p1: 0, p2: 1, p3: 2 };
const DIGEST_LIMIT = 5;

function compareTodos(left: Todo, right: Todo): number {
  return (
    PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority] ||
    Number(right.status === "ready") - Number(left.status === "ready") ||
    (right.updatedAt ?? 0) - (left.updatedAt ?? 0) ||
    left.id.localeCompare(right.id)
  );
}

function formatTodo(todo: Todo): string {
  return `- **${todo.priority.toUpperCase()}** · ${todo.status} · ${todo.id} · ${todo.title}`;
}

function renderSection(title: string, lines: string[]): string[] {
  return [`## ${title}`, "", ...(lines.length > 0 ? lines : ["None."]), ""];
}

/** Build a stable Markdown summary from one repository snapshot. */
export function buildTodoDigest(todos: readonly Todo[], graph: DependencyGraph): string {
  const active = todos.filter((todo) => ACTIVE_STATUSES.includes(todo.status));
  const blocked = active.filter((todo) => (graph.blockedBy.get(todo.id)?.length ?? 0) > 0);
  const nextActions = active
    .filter((todo) => (graph.blockedBy.get(todo.id)?.length ?? 0) === 0)
    .sort(compareTodos)
    .slice(0, DIGEST_LIMIT);
  const highPriority = active
    .filter((todo) => todo.priority === "p1")
    .sort(compareTodos)
    .slice(0, DIGEST_LIMIT);
  const recentlyUpdated = active.filter((todo) => todo.updatedAt !== undefined);
  recentlyUpdated.sort(
    (left, right) =>
      (right.updatedAt ?? 0) - (left.updatedAt ?? 0) || left.id.localeCompare(right.id),
  );
  const recentlyUpdatedTop = recentlyUpdated.slice(0, DIGEST_LIMIT);

  const overview = [
    `- Active: **${active.length}**`,
    `- Ready: **${active.filter((todo) => todo.status === "ready").length}**`,
    `- In Progress: **${active.filter((todo) => todo.status === "in-progress").length}**`,
    `- Pending: **${active.filter((todo) => todo.status === "pending").length}**`,
    `- Blocked: **${blocked.length}**`,
    `- Backlogged: **${todos.filter((todo) => todo.status === "backlogged").length}**`,
  ];
  blocked.sort(compareTodos);
  const blockedLines = blocked.slice(0, DIGEST_LIMIT).map((todo) => {
    const dependencies = graph.blockedBy.get(todo.id) ?? [];
    return `${formatTodo(todo)} · blocked by ${dependencies.join(", ")}`;
  });
  const recentLines = recentlyUpdatedTop.map(
    (todo) => `${formatTodo(todo)} · ${new Date(todo.updatedAt ?? 0).toISOString().slice(0, 10)}`,
  );
  const resumeTodos = active
    .filter((todo) => Boolean(todo.resumeContext?.currentState || todo.resumeContext?.nextStep))
    .sort(compareTodos);
  const resumeLines = resumeTodos.flatMap((todo) => {
    const { currentState, nextStep } = todo.resumeContext ?? {};
    const lines = [`${formatTodo(todo)}`];
    if (currentState) {
      lines.push(`  - **Now:** ${currentState}`);
    }
    if (nextStep) {
      lines.push(`  - **Next:** ${nextStep}`);
    }
    return lines;
  });

  return [
    "# Agendo Task Digest",
    "",
    "Deterministic summary of the current repository state.",
    "",
    ...renderSection("Overview", overview),
    ...renderSection("Recommended Next Actions", nextActions.map(formatTodo)),
    ...renderSection("Latest Updates & Next Steps", resumeLines),
    ...renderSection("High Priority", highPriority.map(formatTodo)),
    ...renderSection("Blocked", blockedLines),
    ...renderSection("Recently Updated", recentLines),
  ].join("\n");
}
