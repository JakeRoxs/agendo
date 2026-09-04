import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import type { BusyIndicator } from "./busyIndicator";
import { Command } from "./commands";
import { Settings, set, setDefault } from "./configuration";
import type { BoardViewProvider } from "./todos/boardViewProvider";
import {
  type ConfigService,
  VIEW_MODES,
  type ViewMode,
  viewModeLabel,
} from "./todos/configService";
import { buildTodoDigest } from "./todos/digestService";
import type { FilterService } from "./todos/filterService";
import type { LinkService } from "./todos/linkService";
import type { SkillManager } from "./todos/skillManager";
import type { StatusService } from "./todos/statusService";
import {
  buildFileName,
  TERMINAL_STATUSES,
  TODO_PRIORITIES,
  TODO_STATUSES,
  type Todo,
  type TodoPriority,
  type TodoStatus,
} from "./todos/todoModel";
import type { TodoRepository } from "./todos/todoRepository";
import type { TodoNode, TodoTreeProvider, TreeNode } from "./todos/todoTreeProvider";
import type { TreeStateService } from "./todos/treeStateService";

export interface CommandServices {
  config: ConfigService;
  repository: TodoRepository;
  filter: FilterService;
  treeState: TreeStateService;
  status: StatusService;
  links: LinkService;
  skill: SkillManager;
  busy: BusyIndicator;
  treeProvider: TodoTreeProvider;
  boardViewProvider: BoardViewProvider;
  refreshSkillStatus: () => void;
}

type Register = (command: string, callback: (...args: any[]) => any) => void;

export function registerCommands(
  context: vscode.ExtensionContext,
  services: CommandServices,
): void {
  const register: Register = (command, callback) => {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  };
  const { busy } = services;

  registerLoadingCommands(register);
  registerFilterCommands(register, services, busy);
  registerBoardCommands(register, services, busy);
  registerTodoCommands(register, services, busy);
  registerConfigCommands(register, services);
  registerSkillCommands(register, services, busy);
  registerTreeCommands(register, services);
}

/**
 * Spinner-state commands shown in place of the real toolbar buttons while an
 * operation runs. They are no-ops; the real button is hidden via a when clause
 * driven by the operation's context key.
 */
function registerLoadingCommands(register: Register): void {
  register(Command.ShowDigestLoading, () => undefined);
  register(Command.EnableSkillLoading, () => undefined);
  register(Command.UpdateSkillLoading, () => undefined);
  register(Command.RefreshLoading, () => undefined);
  register(Command.OpenBoardLoading, () => undefined);
  register(Command.CreateTodoLoading, () => undefined);
  register(Command.ImportFromClipboardLoading, () => undefined);
}

function registerBoardCommands(
  register: Register,
  services: CommandServices,
  busy: BusyIndicator,
): void {
  register(Command.OpenBoard, async () => {
    await busy.run(
      "Opening board…",
      async () => services.boardViewProvider.open(),
      "agendo.openingBoard",
    );
  });
}

export async function updateFilterContexts(filter: FilterService): Promise<void> {
  await Promise.all([
    vscode.commands.executeCommand("setContext", "agendo.filterActive", filter.isActive),
    vscode.commands.executeCommand(
      "setContext",
      "agendo.searchActive",
      Boolean(filter.current.text),
    ),
  ]);
}

function registerFilterCommands(
  register: Register,
  services: CommandServices,
  busy: BusyIndicator,
): void {
  const { repository, filter, treeProvider } = services;
  let digestLoading = false;

  register(Command.Refresh, async () => {
    await busy.run("Refreshing todos…", () => repository.refresh(), "agendo.refreshing");
  });
  register(Command.ShowDigest, async () => {
    if (digestLoading) {
      vscode.window.showInformationMessage("Task digest is already loading.");
      return;
    }
    digestLoading = true;
    try {
      await busy.run(
        "Loading task digest…",
        async () => {
          await repository.refresh();
          const content = buildTodoDigest(repository.getTodos(), repository.getDependencyGraph());
          // Write to a real temp file and preview it the same way todos do. Showing the
          // preview on an untitled in-memory document materializes both an editor and a
          // preview; a real file URI shows only the preview.
          const digestUri = vscode.Uri.file(path.join(os.tmpdir(), "agendo-task-digest.md"));
          await vscode.workspace.fs.writeFile(digestUri, Buffer.from(content, "utf8"));
          await vscode.commands.executeCommand("markdown.showPreview", digestUri);
        },
        "agendo.digestLoading",
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show task digest: ${error}`);
    } finally {
      digestLoading = false;
    }
  });
  register(Command.ClearFilters, async () => {
    await filter.clear();
    await updateFilterContexts(filter);
    treeProvider.refresh();
  });
  register(Command.Filter, async () => {
    await runFilterPicker(filter, treeProvider, repository);
  });
  register(Command.Search, async () => {
    const text = await vscode.window.showInputBox({
      prompt: "Search todos (id, title, tag, key, dependency)",
      value: filter.current.text ?? "",
      placeHolder: "Type text to filter...",
    });
    if (text === undefined) {
      return;
    }
    await filter.set({ ...filter.current, text: text.trim() || undefined });
    await updateFilterContexts(filter);
    treeProvider.refresh();
  });
  register(Command.ClearSearch, async () => {
    await filter.set({ ...filter.current, text: undefined });
    await updateFilterContexts(filter);
    treeProvider.refresh();
  });
}

function registerTodoCommands(
  register: Register,
  services: CommandServices,
  busy: BusyIndicator,
): void {
  const { config, repository, status, links } = services;

  register(Command.OpenPreview, async (arg: unknown) => {
    const todo = resolveTodo(arg);
    if (!todo) {
      return;
    }
    await config.openTodo(todo.uri);
  });

  for (const targetStatus of TODO_STATUSES) {
    register(`agendo.setStatus.${targetStatus}`, async (arg: unknown) => {
      const todo = resolveTodo(arg);
      if (!todo) {
        return;
      }
      const oldFileName = todo.fileName;
      try {
        await busy.run(
          "Updating todo…",
          async () => {
            const result = await status.setStatus(todo, targetStatus as TodoStatus);
            await repository.refresh();
            if (result) {
              await links.warnOnBrokenReferences(oldFileName, result);
            }
          },
          undefined,
          todo.id,
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to set status: ${error}`);
      }
    });
  }

  register(Command.SetPriority, async (arg: unknown) => {
    const todo = resolveTodo(arg);
    if (!todo) {
      return;
    }
    const picked = await vscode.window.showQuickPick(
      TODO_PRIORITIES.map((priority) => ({ label: priority })),
      { placeHolder: "Select a priority" },
    );
    if (!picked) {
      return;
    }
    const oldFileName = todo.fileName;
    try {
      await busy.run(
        "Updating todo…",
        async () => {
          const result = await status.setPriority(todo, picked.label as TodoPriority);
          await repository.refresh();
          if (result) {
            await links.warnOnBrokenReferences(oldFileName, result);
          }
        },
        undefined,
        todo.id,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to set priority: ${error}`);
    }
  });

  register(Command.SetGroup, async (arg: unknown) => {
    const todo = resolveTodo(arg);
    if (!todo) {
      return;
    }
    const value = await vscode.window.showInputBox({
      prompt: "Group name (leave blank to clear)",
      value: todo.group ?? "",
      placeHolder: "e.g. authentication",
    });
    if (value === undefined) {
      return;
    }
    try {
      await busy.run(
        "Updating todo…",
        async () => {
          await status.setGroup(todo, value.trim() || undefined);
          await repository.refresh();
        },
        undefined,
        todo.id,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to set group: ${error}`);
    }
  });

  register(Command.DeleteTodo, async (arg: unknown) => {
    const todo = resolveTodo(arg);
    if (!todo) {
      return;
    }
    const answer = await vscode.window.showWarningMessage(
      `Delete todo ${todo.id} ("${todo.title}")? This cannot be undone.`,
      "Delete",
      "Cancel",
    );
    if (answer !== "Delete") {
      return;
    }
    try {
      await busy.run(
        "Deleting todo…",
        async () => {
          await status.deleteTodo(todo);
          await repository.refresh();
        },
        undefined,
        todo.id,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete todo: ${error}`);
    }
  });

  register(Command.SetDependency, async (arg: unknown) => {
    const todo = resolveTodo(arg);
    if (!todo) {
      return;
    }
    const allTodos = repository.getTodos();
    const availableTodos = allTodos.filter(
      (candidate) =>
        candidate.id !== todo.id &&
        (!TERMINAL_STATUSES.includes(candidate.status) || todo.dependencies.includes(candidate.id)),
    );
    const knownIds = new Set(allTodos.map((candidate) => candidate.id));
    const missingDependencies = todo.dependencies.filter((id) => !knownIds.has(id));
    const picked = await vscode.window.showQuickPick(
      [
        ...availableTodos.map((candidate) => ({
          label: `${candidate.id} · ${candidate.title}`,
          description: `[${candidate.status}]`,
          picked: todo.dependencies.includes(candidate.id),
        })),
        ...missingDependencies.map((id) => ({
          label: `${id} · Missing dependency`,
          description: "[missing]",
          picked: true,
        })),
      ],
      {
        placeHolder: "Select a dependency (leave blank to clear)",
        canPickMany: true,
      },
    );
    if (picked === undefined) {
      return;
    }
    const newDependencies = picked.map((item) => item.label.split(" · ")[0]).filter(Boolean);
    const oldFileName = todo.fileName;
    try {
      await busy.run(
        "Updating todo…",
        async () => {
          const result = await status.setDependencies(todo, newDependencies);
          await repository.refresh();
          if (result) {
            await links.warnOnBrokenReferences(oldFileName, result);
          }
        },
        undefined,
        todo.id,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to set dependency: ${error}`);
    }
  });

  register(Command.CreateTodo, async () => {
    await createTodo(config, repository, busy);
  });

  register(Command.ImportFromClipboard, async () => {
    await importFromClipboard(config, repository);
  });
}

function registerConfigCommands(register: Register, services: CommandServices): void {
  const { config } = services;

  register(Command.ChooseRoot, async () => {
    const value = await vscode.window.showInputBox({
      prompt: "Workspace-relative path to the todos root folder",
      value: config.root,
    });
    if (value === undefined) {
      return;
    }
    await set(Settings.Root, value.trim() || "docs/todos");
  });
  register(Command.ToggleGitignore, async () => {
    await set(Settings.GitignoreTodos, !config.gitignored);
  });
  register(Command.SetViewMode, async () => {
    const currentMode = config.viewMode;
    const picked = await vscode.window.showQuickPick(
      VIEW_MODES.map((mode) => ({
        label: viewModeLabel(mode),
        description: mode === currentMode ? "current" : undefined,
        picked: mode === currentMode,
        mode,
      })),
      { placeHolder: "Choose how todos open" },
    );
    if (picked?.mode) {
      await set(Settings.ViewMode, picked.mode as ViewMode);
      vscode.window.showInformationMessage(
        `Agendo: Todos now open in ${viewModeLabel(picked.mode as ViewMode)}.`,
      );
    }
  });
  register(Command.SetDefaultRoot, async () => {
    const value = await vscode.window.showInputBox({
      prompt: "Global default for todos root folder",
      value: config.root,
      placeHolder: "docs/todos",
    });
    if (value === undefined) {
      return;
    }
    await setDefault(Settings.Root, value.trim() || "docs/todos");
  });
  register(Command.SetDefaultPriority, async () => {
    const value = await vscode.window.showQuickPick(["p1", "p2", "p3"], {
      prompt: "Global default priority",
      placeHolder: "p3",
      canPickMany: false,
    });
    if (value !== undefined) {
      await setDefault(Settings.DefaultPriority, value);
    }
  });
  register(Command.SetDefaultPreview, async () => {
    const currentMode = config.viewMode;
    const picked = await vscode.window.showQuickPick(
      VIEW_MODES.map((mode) => ({
        label: viewModeLabel(mode),
        description: mode === currentMode ? "current" : undefined,
        picked: mode === currentMode,
        mode,
      })),
      { prompt: "Global default for how todos open", placeHolder: viewModeLabel(currentMode) },
    );
    if (picked?.mode) {
      await setDefault(Settings.ViewMode, picked.mode as ViewMode);
    }
  });
}

function registerSkillCommands(
  register: Register,
  services: CommandServices,
  busy: BusyIndicator,
): void {
  const { skill, refreshSkillStatus } = services;

  register(Command.EnableSkill, async () => {
    const status = await skill.getStatus();
    if (status.installed && !status.updateAvailable) {
      vscode.window.showInformationMessage(
        `Agendo skill already installed (v${status.installedVersion ?? "?"}).`,
      );
      return;
    }
    try {
      await busy.run(
        "Installing skill…",
        async () => {
          await skill.install();
          refreshSkillStatus();
        },
        "agendo.skillInstalling",
      );
      vscode.window.showInformationMessage(
        `Agendo skill installed (v${status.bundledVersion ?? "?"}).`,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to install skill: ${error}`);
    }
  });
  register(Command.UpdateSkill, async () => {
    try {
      await busy.run(
        "Updating skill…",
        async () => {
          await skill.updateFromSource();
          refreshSkillStatus();
        },
        "agendo.skillUpdating",
      );
      vscode.window.showInformationMessage("Agendo skill updated from configured source.");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update skill: ${error}`);
    }
  });
}

function registerTreeCommands(register: Register, services: CommandServices): void {
  const { treeState, treeProvider } = services;

  register(Command.CollapseNode, async (arg: unknown) => {
    const node = arg as TreeNode | undefined;
    if (node && "id" in node && node.id) {
      await treeState.collapse(node.id as string);
      treeProvider.refresh();
    }
  });
  register(Command.ExpandNode, async (arg: unknown) => {
    const node = arg as TreeNode | undefined;
    if (node && "id" in node && node.id) {
      await treeState.expand(node.id as string);
      treeProvider.refresh();
    }
  });
}

export function resolveTodo(arg: unknown): Todo | undefined {
  if (arg && typeof arg === "object" && "kind" in arg) {
    const node = arg as TreeNode;
    if (node.kind === "todo") {
      return (node as TodoNode).todo;
    }
  }
  return undefined;
}

async function runFilterPicker(
  filter: FilterService,
  treeProvider: TodoTreeProvider,
  repository: TodoRepository,
): Promise<void> {
  type Item = vscode.QuickPickItem & {
    itemType?: "status" | "priority" | "blocked" | "group";
    value?: string;
    description?: string;
    picked?: boolean;
    kind?: vscode.QuickPickItemKind;
  };

  const current = filter.current;
  const items: Item[] = [
    ...TODO_STATUSES.map<Item>((status) => ({
      label: status,
      description: "status",
      itemType: "status",
      value: status,
      picked: current.statuses?.includes(status) ?? false,
    })),
    ...TODO_PRIORITIES.map<Item>((priority) => ({
      label: priority,
      description: "priority",
      itemType: "priority",
      value: priority,
      picked: current.priorities?.includes(priority) ?? false,
    })),
    {
      label: "Blocked only",
      description: "dependency",
      itemType: "blocked",
      value: "blocked",
      picked: current.blocked === true,
    },
    {
      label: "Unblocked only",
      description: "dependency",
      itemType: "blocked",
      value: "unblocked",
      picked: current.blocked === false,
    },
    { label: "── Groups ──", kind: vscode.QuickPickItemKind.Separator },
    ...repository.getGroups().map<Item>((group) => ({
      label: group,
      description: "group",
      itemType: "group",
      value: group,
      picked: current.group === group,
    })),
    {
      label: "(Clear group filter)",
      description: "group",
      itemType: "group",
      value: "__clear__",
      picked: !current.group,
    },
  ];

  const selected = await vscode.window.showQuickPick<Item>(items, {
    placeHolder: "Select statuses and priorities to show (none = all)",
    canPickMany: true,
  });
  if (selected === undefined) {
    return;
  }

  const statuses = selected
    .filter((item) => item.itemType === "status")
    .map((item) => item.value as TodoStatus);
  const priorities = selected
    .filter((item) => item.itemType === "priority")
    .map((item) => item.value as TodoPriority);
  const blockedPick = selected.find(
    (item) => item.itemType === "blocked" && ["blocked", "unblocked"].includes(item.value ?? ""),
  );
  let blocked: boolean | undefined;
  if (blockedPick?.value === "blocked") {
    blocked = true;
  } else if (blockedPick?.value === "unblocked") {
    blocked = false;
  }
  const group = selected.find(
    (item) => item.itemType === "group" && item.value !== "__clear__",
  )?.value;

  await filter.set({
    ...current,
    statuses: statuses.length ? statuses : undefined,
    priorities: priorities.length ? priorities : undefined,
    blocked,
    group,
  });
  await updateFilterContexts(filter);
  treeProvider.refresh();
}

/**
 * Parse a GitHub or GitLab issue/PR URL to extract useful metadata.
 *
 * Returns an object with parsed fields, or undefined if the URL doesn't match
 * known patterns.
 */
export function parseIssueUrl(url: string): { title: string; externalKey?: string } | undefined {
  // GitHub: github.com/owner/repo/issues/123
  const githubRegex = /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i;
  const githubMatch = githubRegex.exec(url);
  if (githubMatch) {
    const [, owner, repo, num] = githubMatch;
    return {
      title: `${owner}/${repo}#${num}`,
      externalKey: `${owner}/${repo}#${num}`,
    };
  }

  // GitLab: gitlab.com/owner/repo/-/issues/123
  const gitlabRegex = /gitlab\.com\/([^/]+)\/([^/]+)\/-\/issues\/(\d+)/i;
  const gitlabMatch = gitlabRegex.exec(url);
  if (gitlabMatch) {
    const [, owner, repo, num] = gitlabMatch;
    return {
      title: `${owner}/${repo}#${num}`,
      externalKey: `${owner}/${repo}#${num}`,
    };
  }

  return undefined;
}

/**
 * Command to create a todo from a GitHub/GitLab issue URL in the clipboard.
 */
export async function importFromClipboard(
  config: ConfigService,
  repository: TodoRepository,
): Promise<void> {
  const clipboardText = await vscode.env.clipboard.readText();
  if (!clipboardText) {
    vscode.window.showErrorMessage("No text in clipboard to import.");
    return;
  }

  // Try to find a GitHub/GitLab URL in the clipboard
  const urlRegex = /https?:\/\/(github|gitlab)\.com\/[^\s]+\/issues\/\d+/i;
  const urlMatch = urlRegex.exec(clipboardText);
  if (!urlMatch) {
    vscode.window.showErrorMessage("No GitHub/GitLab issue URL found in clipboard.");
    return;
  }

  const url = urlMatch[0];
  const parsed = parseIssueUrl(url);
  if (!parsed) {
    vscode.window.showErrorMessage("Could not parse issue URL.");
    return;
  }

  // Get user input for title and tags
  const title =
    (await vscode.window.showInputBox({
      prompt: "Enter todo title (or use URL as title)",
      value: parsed.title,
      placeHolder: "Todo title",
    })) ?? parsed.title;

  const tagsInput =
    (await vscode.window.showInputBox({
      prompt: "Enter tags (comma-separated, optional)",
      placeHolder: "e.g., bug, urgent",
    })) ?? "";
  const tags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Get the next available ID
  const todos = repository.getTodos();
  const maxId = todos.reduce((max, t) => Math.max(Number.parseInt(t.id, 10), max), 0);
  const newId = String(maxId + 1).padStart(3, "0");

  // Build the todo content
  const now = new Date().toISOString();
  const content = `---
status: pending
priority: p2
issue_id: "${newId}"
tags: [${tags.join(", ")}]
dependencies: []
key: ${parsed.externalKey ?? url}
---

# ${title}

## Problem Statement

Imported from ${url}.

**Why it matters:** TODO

## Proposed Solutions

TODO

## Acceptance Criteria

- [ ] TODO

## Resume Context

**Current state:** Awaiting triage.

**Next step:** Review and triage the imported todo.

## Work Log

- ${now.slice(0, 10)} — Created from ${url}
`;

  // Write the todo file
  const rootUri = config.getRootUri();
  if (!rootUri) {
    vscode.window.showErrorMessage("No todos root configured.");
    return;
  }

  const fileName = buildFileName(newId, "pending", "p2", title);
  const fileUri = vscode.Uri.joinPath(rootUri, fileName);

  try {
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, "utf8"));
    repository.refresh();
    vscode.window.showInformationMessage(
      `Created todo ${newId} from ${parsed.externalKey ?? url}.`,
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to create todo: ${err}`);
  }
}

export async function createTodo(
  config: ConfigService,
  repository: TodoRepository,
  busy: BusyIndicator,
): Promise<void> {
  const rootUri = config.getRootUri();
  if (!rootUri) {
    vscode.window.showErrorMessage("Open a workspace folder to create todos.");
    return;
  }

  const description = await vscode.window.showInputBox({
    prompt: "Short kebab-case description (e.g. add-login-page)",
    validateInput: (value) =>
      /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.trim())
        ? null
        : "Use lowercase letters, numbers and single hyphens.",
  });
  if (!description) {
    return;
  }

  const priorityPick = await vscode.window.showQuickPick(
    TODO_PRIORITIES.map((priority) => ({ label: priority })),
    { placeHolder: "Select a priority" },
  );
  const priority = (priorityPick?.label as TodoPriority) ?? config.defaultPriority;
  const keyInput = await vscode.window.showInputBox({
    prompt: "Optional external tracking key",
    placeHolder: "e.g. JIRA-123, GH-456, or #789 (leave blank for none)",
  });
  if (keyInput === undefined) {
    return;
  }

  const nextId = String(repository.getMaxId() + 1).padStart(3, "0");
  const fileName = buildFileName(nextId, "pending", priority, description.trim());
  const target = vscode.Uri.joinPath(rootUri, fileName);
  const title = description
    .trim()
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  const content = renderTemplate(nextId, priority, title, keyInput.trim() || undefined);

  await busy.run(
    "Creating todo…",
    async () => {
      await vscode.workspace.fs.createDirectory(rootUri);
      await vscode.workspace.fs.writeFile(target, Buffer.from(content, "utf8"));
      await repository.refresh();
    },
    "agendo.creatingTodo",
  );
  await vscode.commands.executeCommand("vscode.open", target);
}

export function renderTemplate(
  id: string,
  priority: TodoPriority,
  title: string,
  key?: string,
): string {
  return [
    "---",
    "status: pending",
    `priority: ${priority}`,
    `issue_id: "${id}"`,
    ...(key ? [`key: ${JSON.stringify(key)}`] : []),
    "tags: []",
    "dependencies: []",
    "---",
    "",
    `# ${title}`,
    "",
    "## Problem Statement",
    "",
    "",
    "## Acceptance Criteria",
    "",
    "- [ ] ",
    "",
    "## Resume Context",
    "",
    "**Current state:** Newly created and awaiting triage.",
    "",
    "**Next step:** Review the problem statement and define acceptance criteria.",
    "",
    "## Work Log",
    "",
    "",
  ].join("\n");
}
