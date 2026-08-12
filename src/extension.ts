import * as vscode from "vscode";
import { Command } from "./commands";
import { Settings, set, setDefault } from "./configuration";
import { out, outputChannel } from "./output";
import { ConfigService } from "./todos/configService";
import { FilterService } from "./todos/filterService";
import { LinkService } from "./todos/linkService";
import { SkillManager } from "./todos/skillManager";
import { StatusService } from "./todos/statusService";
import { TodoRepository } from "./todos/todoRepository";
import { TodoNode, TodoTreeProvider, TreeNode } from "./todos/todoTreeProvider";
import {
  Todo,
  TodoPriority,
  TodoStatus,
  TODO_PRIORITIES,
  TODO_STATUSES,
  buildFileName,
} from "./todos/todoModel";

const subscriptions: vscode.Disposable[] = [];

export async function activate(context: vscode.ExtensionContext) {
  out`${Settings.Identifier} activated`;

  const config = new ConfigService();
  const repository = new TodoRepository(config);
  const filter = new FilterService(context.workspaceState);
  const status = new StatusService(config);
  const links = new LinkService(config);
  const skill = new SkillManager(context.extensionUri);
  const treeProvider = new TodoTreeProvider(repository, filter, config);

  const treeView = vscode.window.createTreeView("agendo.todos", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  subscriptions.push(outputChannel, repository, treeView);

  // Keep the on-disk config projection and gitignore in sync on activation and
  // whenever relevant settings change.
  await config.writeConfigFile();
  await config.applyGitignore();
  subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration(Settings.Identifier)) {
        await config.writeConfigFile();
        await config.applyGitignore();
        repository.startWatching();
        await repository.refresh();
      }
    }),
  );

  registerCommands(context, {
    config,
    repository,
    filter,
    status,
    links,
    skill,
    treeProvider,
  });

  repository.startWatching();
  await repository.refresh();

  context.subscriptions.push(...subscriptions);
}

interface Services {
  config: ConfigService;
  repository: TodoRepository;
  filter: FilterService;
  status: StatusService;
  links: LinkService;
  skill: SkillManager;
  treeProvider: TodoTreeProvider;
}

function resolveTodo(arg: unknown): Todo | undefined {
  if (arg && typeof arg === "object" && "kind" in arg) {
    const node = arg as TreeNode;
    if (node.kind === "todo") {
      return (node as TodoNode).todo;
    }
  }
  return undefined;
}

function registerCommands(
  context: vscode.ExtensionContext,
  services: Services,
): void {
  const { config, repository, filter, status, links, skill, treeProvider } =
    services;

  const register = (command: string, callback: (...args: any[]) => any) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback),
    );
  };

  register(Command.Refresh, () => repository.refresh());

  register(Command.OpenPreview, async (arg: unknown) => {
    const todo = resolveTodo(arg);
    if (!todo) {
      return;
    }
    await vscode.commands.executeCommand("vscode.open", todo.uri, {
      preview: true,
    });
  });

  register(Command.ClearFilters, async () => {
    await filter.clear();
    treeProvider.refresh();
  });

  register(Command.Filter, async () => {
    await runFilterPicker(filter, treeProvider);
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
    treeProvider.refresh();
  });

  for (const targetStatus of TODO_STATUSES) {
    register(`agendo.setStatus.${targetStatus}`, async (arg: unknown) => {
      const todo = resolveTodo(arg);
      if (!todo) {
        return;
      }
      const oldFileName = todo.fileName;
      try {
        const newUri = await status.setStatus(todo, targetStatus as TodoStatus);
        await repository.refresh();
        if (newUri) {
          await links.warnOnBrokenReferences(oldFileName, newUri);
        }
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
      TODO_PRIORITIES.map((p) => ({ label: p })),
      { placeHolder: "Select a priority" },
    );
    if (!picked) {
      return;
    }
    const oldFileName = todo.fileName;
    try {
      const newUri = await status.setPriority(
        todo,
        picked.label as TodoPriority,
      );
      await repository.refresh();
      if (newUri) {
        await links.warnOnBrokenReferences(oldFileName, newUri);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to set priority: ${error}`);
    }
  });

  register(Command.CreateTodo, async () => {
    await createTodo(config, repository);
  });

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

  register(Command.TogglePreview, async () => {
    await set(Settings.OpenInPreview, !config.openInPreview);
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
    if (value === undefined) {
      return;
    }
    await setDefault(Settings.DefaultPriority, value);
  });

  register(Command.SetDefaultPreview, async () => {
    const currentValue = config.openInPreview;
    const picked = await vscode.window.showQuickPick(
      [
        { label: "Preview enabled (default)", description: currentValue ? "On" : "Off" },
        { label: "Preview disabled", description: currentValue ? "On" : "Off" },
      ],
      {
        prompt: "Global default for open-in-preview",
        placeHolder: currentValue ? "On" : "Off",
      }
    );
    if (!picked) {
      return;
    }
    const newValue = picked.label.includes("enabled");
    await setDefault(Settings.OpenInPreview, newValue);
  });

  register(Command.EnableSkill, async () => {
    try {
      const status = await skill.getStatus();
      if (status.installed && !status.updateAvailable) {
        vscode.window.showInformationMessage(
          `Agendo skill already installed (v${
            status.installedVersion ?? "?"
          }).`,
        );
        return;
      }
      await skill.install();
      vscode.window.showInformationMessage(
        `Agendo skill installed (v${status.bundledVersion ?? "?"}).`,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to install skill: ${error}`);
    }
  });

  register(Command.UpdateSkill, async () => {
    try {
      await skill.updateFromSource();
      vscode.window.showInformationMessage(
        "Agendo skill updated from configured source.",
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update skill: ${error}`);
    }
  });
}

async function runFilterPicker(
  filter: FilterService,
  treeProvider: TodoTreeProvider,
): Promise<void> {
  type Item = vscode.QuickPickItem & {
    itemType: "status" | "priority";
    value: string;
  };

  const current = filter.current;
  const items: Item[] = [
    ...TODO_STATUSES.map<Item>((s) => ({
      label: s,
      description: "status",
      itemType: "status",
      value: s,
      picked: current.statuses?.includes(s) ?? false,
    })),
    ...TODO_PRIORITIES.map<Item>((p) => ({
      label: p,
      description: "priority",
      itemType: "priority",
      value: p,
      picked: current.priorities?.includes(p) ?? false,
    })),
  ];

  const selected = await vscode.window.showQuickPick<Item>(items, {
    placeHolder: "Select statuses and priorities to show (none = all)",
    canPickMany: true,
  });
  if (selected === undefined) {
    return;
  }

  const statuses = selected
    .filter((i) => i.itemType === "status")
    .map((i) => i.value as TodoStatus);
  const priorities = selected
    .filter((i) => i.itemType === "priority")
    .map((i) => i.value as TodoPriority);

  await filter.set({
    ...current,
    statuses: statuses.length ? statuses : undefined,
    priorities: priorities.length ? priorities : undefined,
  });
  treeProvider.refresh();
}

async function createTodo(
  config: ConfigService,
  repository: TodoRepository,
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
    TODO_PRIORITIES.map((p) => ({ label: p })),
    { placeHolder: "Select a priority" },
  );
  const priority =
    (priorityPick?.label as TodoPriority) ?? config.defaultPriority;

  const keyInput = await vscode.window.showInputBox({
    prompt: "Optional external tracking key",
    placeHolder: "e.g. JIRA-123, GH-456, or #789 (leave blank for none)",
  });
  if (keyInput === undefined) {
    return;
  }
  const key = keyInput.trim() || undefined;

  const nextId = String(repository.getMaxId() + 1).padStart(3, "0");
  const fileName = buildFileName(
    nextId,
    "pending",
    priority,
    description.trim(),
  );
  const target = vscode.Uri.joinPath(rootUri, fileName);

  const title = description
    .trim()
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const content = renderTemplate(nextId, priority, title, key);
  await vscode.workspace.fs.createDirectory(rootUri);
  await vscode.workspace.fs.writeFile(target, Buffer.from(content, "utf8"));
  await repository.refresh();
  await vscode.commands.executeCommand("vscode.open", target);
}

function renderTemplate(
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
    "## Work Log",
    "",
    "",
  ].join("\n");
}

export function deactivate() {
  out`${Settings.Identifier} deactivated`;
  subscriptions.forEach((subscription) => subscription.dispose());
}
