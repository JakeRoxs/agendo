import { existsSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import type { BusyIndicator } from "./busyIndicator";
import { Command } from "./commands";
import { get, Settings, set, setDefault } from "./configuration";
import { buildAccomplishmentsPacket } from "./todos/accomplishmentsService";
import type { BoardViewProvider } from "./todos/boardViewProvider";
import type { CanvasManager } from "./todos/canvasManager";
import type { CanvasViewer } from "./todos/canvasViewer";
import {
  fetchCodeQL,
  fetchCodeQLBranches,
  fetchSonarQube,
  fetchSonarQubeBranches,
  fetchSonarQubeCliBranches,
  fetchSonarQubeCli,
  importScanningFindings,
  sonarQubeCliServer,
  sonarQubeDefaults,
  sonarQubeEnvironmentToken,
  validateSonarUrl,
} from "./todos/codeScanningService";
import { compareVersions, versionRelationship } from "./todos/componentVersions";
import {
  type ConfigService,
  VIEW_MODES,
  type ViewMode,
  viewModeLabel,
} from "./todos/configService";
import { buildTodoDigest } from "./todos/digestService";
import type { FilterService } from "./todos/filterService";
import type { LinkService } from "./todos/linkService";
import {
  type FindingChanges,
  readScanningProvenance,
  type ScanningProvenance,
} from "./todos/scanningSnapshot";
import type { SkillManager, SkillStatus } from "./todos/skillManager";
import type { StatusService } from "./todos/statusService";
import { buildCollisionReconcileContext, findTodoCollisions } from "./todos/todoCollisions";
import {
  buildFileName,
  getTodoSource,
  matchesTodoScope,
  type ScanningSource,
  TERMINAL_STATUSES,
  TODO_PRIORITIES,
  TODO_STATUSES,
  type Todo,
  type TodoPriority,
  type TodoStatus,
  type TodoViewScope,
} from "./todos/todoModel";
import type { TodoRepository } from "./todos/todoRepository";
import {
  getTreeNodeKey,
  type TodoNode,
  type TodoTreeProvider,
  type TreeNode,
} from "./todos/todoTreeProvider";
import type { TreeStateService } from "./todos/treeStateService";
import { boardReturnTarget } from "./todos/workspaceNavigation";

export interface CommandServices {
  config: ConfigService;
  repository: TodoRepository;
  filter: FilterService;
  treeState: TreeStateService;
  status: StatusService;
  links: LinkService;
  skill: SkillManager;
  canvas: CanvasManager;
  canvasViewer: CanvasViewer;
  busy: BusyIndicator;
  treeProvider: TodoTreeProvider;
  boardViewProvider: BoardViewProvider;
  refreshSkillStatus: () => void;
  scanning?: Pick<CommandServices, "filter" | "treeState" | "treeProvider" | "boardViewProvider">;
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
  register(Command.FocusCollision, async (arg: unknown) => {
    await services.repository.refresh();
    const todo = resolveTodo(arg);
    const context = arg as { todoId?: unknown; collisionSource?: unknown } | undefined;
    const collision = findTodoCollisions(services.repository.getTodos()).find((group) =>
      todo
        ? group.todos.some((candidate) => candidate.uri.toString() === todo.uri.toString())
        : group.id === context?.todoId &&
          (!context?.collisionSource || group.source === context.collisionSource),
    );
    if (!collision) {
      return;
    }
    const target = collision.source === "todo" ? services : services.scanning;
    if (!target) {
      return;
    }
    await target.filter.set({ collision: { id: collision.id, source: collision.source } });
    await updateFilterContexts(
      target.filter,
      collision.source === "todo" ? "agendo" : "agendo.codeScanning",
    );
    target.treeProvider.refresh();
    target.boardViewProvider.refresh();
  });
  register(Command.CopyCollisionContext, async (arg: unknown) => {
    await services.repository.refresh();
    const todo = resolveTodo(arg);
    const todoId = (arg as { todoId?: unknown } | undefined)?.todoId;
    const collisions = findTodoCollisions(services.repository.getTodos()).filter((collision) => {
      if (todo) {
        return collision.todos.some(
          (candidate) => candidate.uri.toString() === todo.uri.toString(),
        );
      }
      return typeof todoId !== "string" || collision.id === todoId;
    });
    if (!collisions.length) {
      vscode.window.showInformationMessage("No duplicate todo IDs detected for this selection.");
      return;
    }
    await vscode.env.clipboard.writeText(
      buildCollisionReconcileContext(collisions, services.config.root),
    );
    vscode.window.showInformationMessage(
      `Copied reconciliation context for ${collisions.length} ID collision(s).`,
    );
  });
  register(Command.CopyAccomplishmentsContext, async () => {
    await services.repository.refresh();
    const todos = services.repository.getTodos();
    const packet = buildAccomplishmentsPacket(todos, {});
    await vscode.env.clipboard.writeText(packet.text);
    vscode.window.showInformationMessage(
      `Copied accomplishments context: ${packet.matched} completed todo(s), ${packet.included.length} included${packet.omittedCount > 0 ? `, ${packet.omittedCount} omitted` : ""}.`,
    );
  });
  if (services.scanning) {
    const scanningServices = { ...services, ...services.scanning };
    registerFilterCommands(register, scanningServices, busy, "code-scanning");
    registerBoardCommands(register, scanningServices, busy, "code-scanning");
    register(Command.CodeScanningToggleSortDate, async () => {
      await set(Settings.CodeScanningSortByDate, !get<boolean>(Settings.CodeScanningSortByDate));
      scanningServices.treeProvider.refresh();
    });
  }
  let scanning = false;
  register(Command.ImportCodeScanning, async () => {
    if (scanning) {
      return;
    }
    scanning = true;
    try {
      try {
        await runCodeScanningImport(context, services);
      } finally {
        await services.repository.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Code-scanning import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      scanning = false;
    }
  });
  register(Command.RefreshScanningTodo, async (arg: unknown) => {
    if (scanning) {
      return;
    }
    scanning = true;
    try {
      try {
        await runScanningTodoRefresh(context, services, arg);
      } finally {
        await services.repository.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Scanner refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      scanning = false;
    }
  });
  register(Command.ShowMcpConfig, async () => {
    const serverDirectory = path.join(context.extensionPath, "resources", "mcp");
    const bundledServer = path.join(serverDirectory, "server.bundle.mjs");
    const mcpConfig = {
      mcpServers: {
        agendo: {
          command: "node",
          args: [
            existsSync(bundledServer) ? bundledServer : path.join(serverDirectory, "server.mjs"),
          ],
          description: "Agendo todo management",
        },
      },
    };
    const json = JSON.stringify(mcpConfig, null, 2);
    const doc = await vscode.workspace.openTextDocument({
      content: json,
      language: "json",
    });
    vscode.window.showTextDocument(doc, { preview: false });
  });
}

async function runCodeScanningImport(
  context: vscode.ExtensionContext,
  services: CommandServices,
): Promise<void> {
  const { config, repository } = services;
  if (!vscode.workspace.isTrusted) {
    vscode.window.showWarningMessage(
      "Trust this workspace before importing code-scanning findings.",
    );
    return;
  }
  const workspace = config.getWorkspaceFolder();
  if (workspace?.uri.scheme !== "file") {
    vscode.window.showWarningMessage(
      "Open a filesystem workspace before importing code-scanning findings.",
    );
    return;
  }
  if (!config.codeScanningEnabled) {
    const choice = await vscode.window.showInformationMessage(
      "Enable optional code-scanning imports for this workspace? Scans are fetched only when you run this command.",
      "Enable",
    );
    if (choice !== "Enable") {
      return;
    }
    await set(Settings.CodeScanningEnabled, true);
  }
  const source = await vscode.window.showQuickPick(
    [
      {
        label: "CodeQL",
        description: "GitHub code-scanning alerts (requires gh auth login)",
        source: "codeql" as const,
      },
      {
        label: "SonarQube",
        description: "Unresolved issues from a SonarQube project",
        source: "sonarqube" as const,
      },
    ],
    { placeHolder: "Import code-scanning todos from..." },
  );
  if (!source) {
    return;
  }
  const sonar =
    source.source === "sonarqube"
      ? await promptSonarQubeSettings(context, workspace.uri)
      : undefined;
  if (source.source === "sonarqube" && !sonar) {
    return;
  }
  const branches = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Loading ${source.label} branches...`,
    },
    async () => {
      if (source.source === "codeql") return fetchCodeQLBranches(workspace.uri.fsPath);
      if (!sonar) throw new Error("SonarQube settings are missing.");
      return sonar.cli
        ? fetchSonarQubeCliBranches(workspace.uri.fsPath, sonar.server, sonar.project)
        : fetchSonarQubeBranches(sonar.server, sonar.project, sonar.token);
    },
  );
  const branchChoice = await vscode.window.showQuickPick(
    [
      {
        label: `${branches.defaultBranch} (default)`,
        description: "Use the scanner's default branch",
        branch: undefined,
      },
      ...branches.branches
        .filter((branch) => branch !== branches.defaultBranch)
        .sort((a, b) => a.localeCompare(b))
        .map((branch) => ({ label: branch, branch })),
    ],
    {
      title: `Select ${source.label} branch`,
      placeHolder: `Choose the branch to import from; default is ${branches.defaultBranch}`,
    },
  );
  if (!branchChoice) return;
  const grouping = await vscode.window.showQuickPick(
    [
      {
        label: "By file (default)",
        description: "One todo per affected file",
        detail: "Keep related changes together, with separate context for each rule.",
        grouping: "file" as const,
      },
      {
        label: "By rule/type",
        description: "One todo per rule across files",
        detail: "Review or resolve the same kind of issue across the project.",
        grouping: "rule" as const,
      },
      {
        label: "By individual issue",
        description: "One todo per scanner issue or alert",
        detail: "Track each finding independently, including multiple findings on the same line.",
        grouping: "finding" as const,
      },
    ],
    {
      title: "Group imported findings",
      placeHolder:
        "Default: by file. Changing grouping creates separate todos; previous imports remain.",
    },
  );
  if (!grouping) return;
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Importing ${source.label} todos...` },
    async () => {
      const scan =
        source.source === "codeql"
          ? await fetchCodeQL(workspace.uri.fsPath, undefined, branchChoice.branch)
          : sonar?.cli
            ? await fetchSonarQubeCli(
                workspace.uri.fsPath,
                sonar.server,
                sonar.project,
                undefined,
                branchChoice.branch,
              )
            : sonar
              ? await fetchSonarQube(
                  sonar.server,
                  sonar.project,
                  sonar.token,
                  undefined,
                  undefined,
                  branchChoice.branch,
                )
              : undefined;
      if (!scan) return;
      const result = await importScanningFindings(
        config,
        repository,
        source.source,
        scan.scope,
        scan.findings,
        grouping.grouping,
        { branch: branchChoice.branch },
      );
      vscode.window.showInformationMessage(
        `${source.label} (${branchChoice.label}, ${grouping.label}): ${result.created} todos created, ${result.updated} updated from ${scan.findings.length} findings. Existing lifecycle and notes were preserved.`,
      );
    },
  );
}

async function promptSonarQubeSettings(
  context: vscode.ExtensionContext,
  workspace: vscode.Uri,
  fixed?: { server: string; project: string },
): Promise<{ server: string; project: string; token: string; cli: boolean } | undefined> {
  const defaults = await sonarQubeDefaults(workspace);
  const auth = await vscode.window.showQuickPick(
    [
      { label: "SonarQube CLI", description: "Reuse sonar auth login (no token entry)", cli: true },
      {
        label: "Direct token",
        description: "Use a saved, environment, or entered token",
        cli: false,
      },
    ],
    { placeHolder: "Choose SonarQube authentication" },
  );
  if (!auth) {
    return;
  }
  let server: string;
  let project: string;
  if (fixed) {
    server = validateSonarUrl(fixed.server).toString();
    project = fixed.project;
    if (auth.cli) {
      const active = await sonarQubeCliServer(workspace.fsPath);
      if (active !== server) {
        throw new Error(
          `SonarQube CLI is connected to a different server (${active}). Log in to ${server} and retry.`,
        );
      }
    }
  } else {
    const urlInput = auth.cli
      ? await sonarQubeCliServer(workspace.fsPath)
      : await vscode.window.showInputBox({
          prompt: "SonarQube server URL",
          value: get<string>(Settings.SonarQubeUrl) || defaults.server,
          validateInput: (value) => {
            try {
              validateSonarUrl(value);
              return undefined;
            } catch {
              return "Enter an HTTPS URL, or HTTP on loopback";
            }
          },
        });
    if (!urlInput) {
      return;
    }
    server = validateSonarUrl(urlInput).toString();
    const projectInput = await vscode.window.showInputBox({
      prompt: `SonarQube project key (${server})`,
      value: get<string>(Settings.SonarQubeProjectKey) || defaults.project,
      validateInput: (value) => (value.trim() ? undefined : "Enter the project key"),
    });
    if (!projectInput) {
      return;
    }
    project = projectInput.trim();
  }
  if (auth.cli) {
    return { server, project, token: "", cli: true };
  }
  const secretKey = `agendo.sonarqube:${server}`;
  const saved = await context.secrets.get(secretKey);
  const environmentToken = sonarQubeEnvironmentToken(server, defaults);
  const tokenInput = await vscode.window.showInputBox({
    prompt: saved
      ? "SonarQube token (leave blank to reuse saved token)"
      : environmentToken
        ? "SonarQube token (leave blank to import environment token into secure storage)"
        : "SonarQube user token (stored securely in VS Code)",
    password: true,
    ignoreFocusOut: true,
  });
  if (tokenInput === undefined) {
    return;
  }
  const token = tokenInput.trim() || saved || environmentToken;
  if (!token) {
    return;
  }
  await context.secrets.store(secretKey, token);
  await set(Settings.SonarQubeUrl, server);
  await set(Settings.SonarQubeProjectKey, project);
  return { server, project, token, cli: false };
}

async function runScanningTodoRefresh(
  context: vscode.ExtensionContext,
  services: CommandServices,
  arg: unknown,
): Promise<void> {
  const { repository } = services;
  if (!vscode.workspace.isTrusted) {
    vscode.window.showWarningMessage("Trust this workspace before refreshing scanner todos.");
    return;
  }
  const workspace = services.config.getWorkspaceFolder();
  if (workspace?.uri.scheme !== "file") {
    vscode.window.showWarningMessage(
      "Open a filesystem workspace before refreshing scanner todos.",
    );
    return;
  }
  const scanningTodos = repository.getTodos().filter((t) => matchesTodoScope(t, "code-scanning"));
  let todo = resolveRefreshableTodo(arg, repository.getTodos());
  if (!todo && arg === undefined) {
    const picked = await vscode.window.showQuickPick(
      scanningTodos.map((t) => ({
        label: `${t.id} · ${t.title}`,
        description: `[${t.status}] ${t.folder}`,
        todo: t,
      })),
      { placeHolder: "Select an imported scanner todo to refresh" },
    );
    todo = picked?.todo;
  }
  if (!todo) {
    return;
  }
  const expectedSource = getTodoSource(todo);
  if (!expectedSource) {
    vscode.window.showErrorMessage(`Todo ${todo.id} is not a scanner-imported todo.`);
    return;
  }
  const content = await vscode.workspace.fs.readFile(todo.uri);
  const textContent = Buffer.from(content).toString("utf8");
  let provenance: ScanningProvenance | undefined;
  try {
    provenance = readScanningProvenance(textContent);
  } catch (error) {
    vscode.window.showErrorMessage(
      `Cannot refresh ${todo.id}: ${error instanceof Error ? error.message : "invalid provenance"}. Re-import the original scope and grouping instead.`,
    );
    return;
  }
  if (!provenance) {
    vscode.window.showErrorMessage(
      `Todo ${todo.id} has no scanner provenance. Re-import the original scope and grouping to update it.`,
    );
    return;
  }
  if (provenance.source === "codeql") {
    await refreshCodeQLTodo(services, todo, provenance);
  } else {
    await refreshSonarTodo(context, services, todo, provenance);
  }
}

async function refreshCodeQLTodo(
  services: CommandServices,
  todo: Todo,
  provenance: ScanningProvenance,
): Promise<void> {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Refreshing ${todo.id}…` },
    async () => {
      const workspace = services.config.getWorkspaceFolder();
      if (workspace?.uri.scheme !== "file") {
        vscode.window.showWarningMessage(
          "Open a filesystem workspace before refreshing scanner todos.",
        );
        return;
      }
      const scan = await fetchCodeQL(workspace.uri.fsPath, undefined, provenance.branch);
      if (scan.scope !== provenance.scope || scan.branch !== provenance.branch) {
        throw new Error(
          `Workspace scanner target ${scan.scope} (${scan.branch || "default branch"}) does not match todo ${todo.id} (${provenance.scope}, ${provenance.branch || "default branch"}).`,
        );
      }
      const targetFindings = scan.findings.filter((f) => {
        if (provenance.grouping === "finding") return f.id === provenance.target;
        if (provenance.grouping === "file") return f.path === provenance.target;
        return f.rule === provenance.target;
      });
      if (!targetFindings.length) {
        vscode.window.showInformationMessage(
          `Finding ${provenance.target} is no longer returned by the scanner; it may have been resolved.`,
        );
        return;
      }
      const result = await importScanningFindings(
        services.config,
        services.repository,
        "codeql",
        scan.scope,
        scan.findings,
        provenance.grouping,
        { target: provenance.target, branch: provenance.branch },
      );
      showScanningImportResult("CodeQL", todo.id, result);
    },
  );
}

async function refreshSonarTodo(
  context: vscode.ExtensionContext,
  services: CommandServices,
  todo: Todo,
  provenance: ScanningProvenance,
): Promise<void> {
  const parts = provenance.scope.split("#");
  const server = validateSonarUrl(parts[0]).toString();
  const project = parts.slice(1).join("#");
  // biome-ignore lint/style/noNonNullAssertion: workspace validated above
  const sonar = await promptSonarQubeSettings(context, services.config.getWorkspaceFolder()!.uri, {
    server,
    project,
  });
  if (!sonar) {
    return;
  }
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Refreshing ${todo.id}…` },
    async () => {
      const scan = sonar.cli
        ? await fetchSonarQubeCli(
            // biome-ignore lint/style/noNonNullAssertion: workspace validated above
            services.config.getWorkspaceFolder()!.uri.fsPath,
            sonar.server,
            sonar.project,
            undefined,
            provenance.branch,
          )
        : await fetchSonarQube(
            sonar.server,
            sonar.project,
            sonar.token,
            undefined,
            undefined,
            provenance.branch,
          );
      if (scan.scope !== provenance.scope || scan.branch !== provenance.branch) {
        throw new Error(
          `SonarQube target ${scan.scope} (${scan.branch || "default branch"}) does not match todo ${todo.id} (${provenance.scope}, ${provenance.branch || "default branch"}).`,
        );
      }
      const targetFindings = scan.findings.filter((f) => {
        if (provenance.grouping === "finding") return f.id === provenance.target;
        if (provenance.grouping === "file") return f.path === provenance.target;
        return f.rule === provenance.target;
      });
      if (!targetFindings.length) {
        vscode.window.showInformationMessage(
          `Finding ${provenance.target} is no longer returned by the scanner; it may have been resolved.`,
        );
        return;
      }
      const result = await importScanningFindings(
        services.config,
        services.repository,
        "sonarqube",
        scan.scope,
        scan.findings,
        provenance.grouping,
        { target: provenance.target, branch: provenance.branch },
      );
      showScanningImportResult("SonarQube", todo.id, result);
    },
  );
}

function showScanningImportResult(
  source: string,
  todoId: string,
  result: {
    created: number;
    updated: number;
    refreshed: number;
    changes: FindingChanges;
    reviewRequired: string[];
  },
): void {
  const parts = [
    `${source} refresh for ${todoId}:`,
    `${result.created} created, ${result.updated} updated, ${result.refreshed} refreshed`,
    `findings: ${result.changes.added} added, ${result.changes.changed} changed, ${result.changes.unchanged} unchanged, ${result.changes.notReturned} no longer returned, ${result.changes.uncompared} uncompared`,
  ];
  if (result.reviewRequired.length) {
    parts.push(
      `Requires review: ${result.reviewRequired.join(", ")}. These are not auto-marked; update status when you've addressed them.`,
    );
  }
  parts.push("Import retrieves current scanner results; it does not trigger a new scan.");
  vscode.window.showInformationMessage(parts.join("\n"));
}

function resolveRefreshableTodo(arg: unknown, todos: readonly Todo[]): Todo | undefined {
  const node = resolveTodo(arg);
  if (node) {
    return node;
  }
  const matches = resolveBoardTodo(arg, todos);
  if (matches) {
    return matches;
  }
  vscode.window.showErrorMessage("Could not resolve the todo to refresh.");
  return undefined;
}

/**
 * Spinner-state commands shown in place of the real toolbar buttons while an
 * operation runs. They are no-ops; the real button is hidden via a when clause
 * driven by the operation's context key.
 */
function registerLoadingCommands(register: Register): void {
  register(Command.RefreshComponentsLoading, () => undefined);
  register(Command.CodeScanningRefreshLoading, () => undefined);
  register(Command.CodeScanningOpenBoardLoading, () => undefined);
  register(Command.CodeScanningShowDigestLoading, () => undefined);
  register(Command.ShowDigestLoading, () => undefined);
  register(Command.EnableSkillLoading, () => undefined);
  register(Command.InstallCanvasLoading, () => undefined);
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
  scope: TodoViewScope = "todos",
): void {
  const prefix = scope === "code-scanning" ? "agendo.codeScanning" : "agendo";
  register(
    scope === "code-scanning" ? Command.CodeScanningOpenBoard : Command.OpenBoard,
    async () => {
      await busy.run(
        "Opening board…",
        async () => {
          const root = services.config.getWorkspaceFolder()?.uri.fsPath;
          if (!root) {
            return;
          }
          await services.canvasViewer.open(root, { kind: "board", scope });
        },
        `${prefix}.openingBoard`,
      );
    },
  );
}

export async function updateFilterContexts(
  filter: FilterService,
  prefix = "agendo",
): Promise<void> {
  await Promise.all([
    vscode.commands.executeCommand("setContext", `${prefix}.filterActive`, filter.isActive),
    vscode.commands.executeCommand(
      "setContext",
      `${prefix}.searchActive`,
      Boolean(filter.current.text),
    ),
  ]);
}

function registerFilterCommands(
  register: Register,
  services: CommandServices,
  busy: BusyIndicator,
  scope: TodoViewScope = "todos",
): void {
  const { repository, filter, treeProvider } = services;
  const commands =
    scope === "code-scanning"
      ? {
          Refresh: Command.CodeScanningRefresh,
          ShowDigest: Command.CodeScanningShowDigest,
          ClearFilters: Command.CodeScanningClearFilters,
          Filter: Command.CodeScanningFilter,
          Search: Command.CodeScanningSearch,
          ClearSearch: Command.CodeScanningClearSearch,
        }
      : Command;
  const prefix = scope === "code-scanning" ? "agendo.codeScanning" : "agendo";
  let digestLoading = false;

  register(commands.Refresh, async () => {
    await busy.run("Refreshing todos…", () => repository.refresh(), `${prefix}.refreshing`);
  });
  register(commands.ShowDigest, async () => {
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
          const content = buildTodoDigest(
            repository.getTodos().filter((todo) => matchesTodoScope(todo, scope)),
            repository.getDependencyGraph(),
          );
          // Write to a real temp file and preview it the same way todos do. Showing the
          // preview on an untitled in-memory document materializes both an editor and a
          // preview; a real file URI shows only the preview.
          const digestUri = vscode.Uri.file(
            path.join(
              os.tmpdir(),
              scope === "code-scanning"
                ? "agendo-code-scanning-digest.md"
                : "agendo-task-digest.md",
            ),
          );
          await vscode.workspace.fs.writeFile(digestUri, Buffer.from(content, "utf8"));
          await vscode.commands.executeCommand("markdown.showPreview", digestUri);
        },
        `${prefix}.digestLoading`,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show task digest: ${error}`);
    } finally {
      digestLoading = false;
    }
  });
  register(commands.ClearFilters, async () => {
    await filter.clear();
    await updateFilterContexts(filter, prefix);
    treeProvider.refresh();
    services.boardViewProvider.refresh();
  });
  register(commands.Filter, async () => {
    await runFilterPicker(filter, treeProvider, repository, scope);
    services.boardViewProvider.refresh();
  });
  register(commands.Search, async () => {
    const text = await vscode.window.showInputBox({
      prompt: "Search todos (id, title, tag, key, dependency)",
      value: filter.current.text ?? "",
      placeHolder: "Type text to filter...",
    });
    if (text === undefined) {
      return;
    }
    await filter.set({ ...filter.current, text: text.trim() || undefined });
    await updateFilterContexts(filter, prefix);
    treeProvider.refresh();
    services.boardViewProvider.refresh();
  });
  register(commands.ClearSearch, async () => {
    await filter.set({ ...filter.current, text: undefined });
    await updateFilterContexts(filter, prefix);
    treeProvider.refresh();
    services.boardViewProvider.refresh();
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

  register(Command.OpenCanvas, async (arg: unknown) => {
    const todo = resolveTodo(arg) ?? resolveBoardTodo(arg, repository.getTodos());
    if (todo) {
      const returnTo = boardReturnTarget(
        arg && typeof arg === "object" ? (arg as Record<string, unknown>).returnTo : undefined,
      );
      if (returnTo && !matchesTodoScope(todo, returnTo.scope)) return;
      await config.openInCanvas(todo.uri, returnTo);
    }
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
  register(Command.ToggleSortDate, async () => {
    const current = get<boolean>(Settings.SortByDate);
    await set(Settings.SortByDate, !current);
    vscode.window.showInformationMessage(
      !current
        ? "Agendo: Todos now sorted by last modified date (most recent first)."
        : "Agendo: Todos now sorted by issue ID.",
    );
  });
  register(Command.SetGroupBy, async () => {
    const modes: Array<{ label: string; mode: string }> = [
      { label: "Status", mode: "status" },
      { label: "Priority", mode: "priority" },
      { label: "Group", mode: "group" },
      { label: "None (flat)", mode: "none" },
    ];
    const current = get<string>(Settings.GroupBy);
    const picked = await vscode.window.showQuickPick(
      modes.map((m) => ({
        label: m.label,
        description: m.mode === current ? "Current" : undefined,
      })),
      { placeHolder: "Choose grouping mode" },
    );
    if (!picked) return;
    const mode = modes.find((m) => m.label === picked.label)?.mode ?? "status";
    await set(Settings.GroupBy, mode);
    services.treeProvider.refresh();
    vscode.window.showInformationMessage(
      `Agendo: Todos now grouped by ${picked.label.toLowerCase()}.`,
    );
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
  const { skill, canvas, refreshSkillStatus } = services;
  let checking = false;
  register(Command.RefreshComponents, async () => {
    if (checking) return;
    checking = true;
    try {
      await busy.run(
        "Checking skill and canvas versions",
        async () => {
          const results = await Promise.allSettled([skill.getStatus(true), canvas.getStatus(true)]);
          let updates = 0;
          let uncertain = false;
          const details = results.map((result, index) => {
            const name = index === 0 ? "Skill" : "Canvas";
            if (result.status === "rejected") {
              uncertain = true;
              return `${name}: version check unavailable`;
            }
            const status = result.value;
            if (!status.installed) return `${name}: not installed`;
            const available = [status.bundledVersion, status.sourceVersion].some((version) =>
              Boolean(
                version &&
                  status.installedVersion &&
                  compareVersions(version, status.installedVersion) > 0,
              ),
            );
            if (available) updates++;
            if (status.sourceError || !status.installedVersion || !status.bundledVersion)
              uncertain = true;
            return `${name}: installed v${status.installedVersion ?? "unknown"}; bundled v${status.bundledVersion ?? "unknown"} (${versionRelationship(status.installedVersion, status.bundledVersion)}); source ${status.sourceVersion ? `v${status.sourceVersion} (${versionRelationship(status.installedVersion, status.sourceVersion)})` : "unavailable"}`;
          });
          refreshSkillStatus();
          const summary = `${updates ? `${updates} component(s) have newer versions available.` : "No newer versions found among checked versions."} ${uncertain ? "Some versions could not be checked. " : ""}${details.join(". ")}. No files were installed.`;
          if (uncertain) await vscode.window.showWarningMessage(summary);
          else await vscode.window.showInformationMessage(summary);
        },
        "agendo.componentsChecking",
      );
    } finally {
      checking = false;
    }
  });

  for (const component of ["skill", "canvas"] as const) {
    register(component === "skill" ? Command.ManageSkill : Command.ManageCanvas, async () => {
      const manager = component === "skill" ? skill : canvas;
      const status: SkillStatus = await manager.getStatus(true);
      const installed: string = status.installed
        ? `v${status.installedVersion ?? "unknown"}`
        : "not installed";
      const sourceLabel = status.sourceVersion ? `v${status.sourceVersion}` : "unavailable";
      const sourceDetail =
        status.sourceError ||
        (status.sourceVersion
          ? versionRelationship(status.installedVersion, status.sourceVersion)
          : "GitHub/main by default; may differ from the extension bundle");
      const picked: (vscode.QuickPickItem & { action: string }) | undefined =
        await vscode.window.showQuickPick(
          [
            {
              label: `Install bundled version v${status.bundledVersion ?? "unknown"}`,
              detail: `${versionRelationship(status.installedVersion, status.bundledVersion)}; includes extension defaults`,
              action: "bundle",
            },
            {
              label: `Install from source ${sourceLabel}`,
              detail: sourceDetail,
              action: "source",
            },
          ],
          {
            title: `Agendo ${component}: installed ${installed} | bundled v${status.bundledVersion ?? "?"} | source ${sourceLabel}`,
            placeHolder: "Choose an action",
          },
        );
      if (!picked) return;
      await vscode.commands.executeCommand(
        component === "skill"
          ? picked.action === "bundle"
            ? Command.EnableSkill
            : Command.UpdateSkill
          : picked.action === "bundle"
            ? Command.InstallCanvas
            : Command.UpdateCanvas,
      );
    });
  }

  register(Command.EnableSkill, async () => {
    const status = await skill.getStatus();
    try {
      const previousVersion = status.installedVersion;
      await busy.run(
        "Installing skill…",
        async () => {
          await skill.install();
          refreshSkillStatus();
        },
        "agendo.skillInstalling",
      );
      const newVersion = status.bundledVersion ?? "?";
      if (previousVersion) {
        vscode.window.showInformationMessage(
          `Agendo skill replaced: installed v${previousVersion} → bundled v${newVersion} (included in this extension).`,
        );
      } else {
        vscode.window.showInformationMessage(
          `Agendo skill installed: bundled v${newVersion} (included in this extension).`,
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to install skill: ${error}`);
    }
  });
  register(Command.InstallCanvas, async () => {
    try {
      const previous = await canvas.getStatus();
      await busy.run(
        "Installing canvas…",
        async () => {
          await canvas.install();
          refreshSkillStatus();
        },
        "agendo.canvasInstalling",
      );
      const version = (await canvas.getStatus()).bundledVersion ?? "?";
      vscode.window.showInformationMessage(
        previous.installedVersion
          ? `Agendo canvas replaced: installed v${previous.installedVersion} → bundled v${version} (included in this extension).`
          : `Agendo canvas installed: bundled v${version} (included in this extension).`,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to install canvas: ${error}`);
    }
  });
  register(Command.UpdateSkill, async () => {
    try {
      const previousStatus = await skill.getStatus(true);
      if (previousStatus.sourceError) throw new Error(previousStatus.sourceError);
      await busy.run(
        "Updating skill…",
        async () => {
          await skill.updateFromSource();
          refreshSkillStatus();
        },
        "agendo.skillUpdating",
      );
      const newStatus = await skill.getStatus();
      if (previousStatus.installedVersion && newStatus.installedVersion) {
        vscode.window.showInformationMessage(
          `Agendo skill replaced: installed v${previousStatus.installedVersion} → source v${newStatus.installedVersion} from ${previousStatus.sourceUrl}.`,
        );
      } else {
        vscode.window.showInformationMessage(
          `Agendo skill installed: source v${newStatus.installedVersion ?? "?"} from ${previousStatus.sourceUrl}.`,
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update skill: ${error}`);
    }
  });
  register(Command.UpdateCanvas, async () => {
    try {
      const previousStatus = await canvas.getStatus(true);
      if (previousStatus.sourceError) throw new Error(previousStatus.sourceError);
      await busy.run(
        "Updating canvas…",
        async () => {
          await canvas.updateFromSource();
          refreshSkillStatus();
        },
        "agendo.canvasUpdating",
      );
      const newStatus = await canvas.getStatus();
      if (previousStatus.installedVersion && newStatus.installedVersion) {
        vscode.window.showInformationMessage(
          `Agendo canvas replaced: installed v${previousStatus.installedVersion} → source v${newStatus.installedVersion} from ${previousStatus.sourceUrl}.`,
        );
      } else {
        vscode.window.showInformationMessage(
          `Agendo canvas installed: source v${newStatus.installedVersion ?? "?"} from ${previousStatus.sourceUrl}.`,
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update canvas: ${error}`);
    }
  });
  register(Command.ToggleSkillUpdateCheck, async () => {
    const config = vscode.workspace.getConfiguration(Settings.Identifier);
    const enabled = config.get<boolean>(Settings.SkillUpdateCheck, true);
    const newEnabled = !enabled;
    await config.update(Settings.SkillUpdateCheck, newEnabled, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
      newEnabled
        ? "Agendo skill and canvas update notifications enabled for newer bundled versions."
        : "Agendo skill and canvas update notifications disabled.",
    );
  });
}

function registerTreeCommands(register: Register, services: CommandServices): void {
  register(Command.CollapseNode, async (arg: unknown) => {
    const key = getTreeNodeKey(arg as TreeNode | undefined);
    if (key) {
      const target = key.startsWith("source:") ? (services.scanning ?? services) : services;
      await target.treeState.collapse(key);
      target.treeProvider.refresh();
    }
  });
  register(Command.ExpandNode, async (arg: unknown) => {
    const key = getTreeNodeKey(arg as TreeNode | undefined);
    if (key) {
      const target = key.startsWith("source:") ? (services.scanning ?? services) : services;
      await target.treeState.expand(key);
      target.treeProvider.refresh();
    }
  });
}

/** Board cards pass the `data-vscode-context` object of the right-clicked card. */
function resolveBoardTodo(arg: unknown, todos: readonly Todo[]): Todo | undefined {
  const todoId = (arg as { todoId?: unknown } | undefined)?.todoId;
  const matches = typeof todoId === "string" ? todos.filter((todo) => todo.id === todoId) : [];
  if (matches.length > 1) {
    vscode.window.showWarningMessage(
      `Duplicate todo ID ${todoId}: reconcile the conflicting files before opening by ID.`,
    );
    return undefined;
  }
  return matches[0];
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
  scope: TodoViewScope = "todos",
): Promise<void> {
  type Item = vscode.QuickPickItem & {
    itemType?: "status" | "priority" | "blocked" | "group" | "source";
    value?: string;
    description?: string;
    picked?: boolean;
    kind?: vscode.QuickPickItemKind;
  };

  const current = filter.current;
  const items: Item[] = [
    ...(scope === "code-scanning"
      ? (["codeql", "sonarqube"] as const).map<Item>((source) => ({
          label: source === "codeql" ? "CodeQL" : "SonarQube",
          description: "source",
          itemType: "source",
          value: source,
          picked: current.sources?.includes(source) ?? false,
        }))
      : []),
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
    ...repository.getGroups(scope).map<Item>((group) => ({
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
    sources:
      scope === "code-scanning"
        ? selected
            .filter((item) => item.itemType === "source")
            .map((item) => item.value as ScanningSource)
        : undefined,
  });
  await updateFilterContexts(filter, scope === "code-scanning" ? "agendo.codeScanning" : "agendo");
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
  const maxId = todos.reduce((max, t) => {
    const value = Number.parseInt(t.id, 10);
    return Number.isNaN(value) ? max : Math.max(value, max);
  }, 0);
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
    await vscode.workspace.fs.createDirectory(rootUri);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, "utf8"));
    await config.writeConfigFile?.({ force: true });
    await config.applyGitignore?.({ force: true });
    try {
      await repository.refresh();
    } catch (err) {
      await vscode.window.showWarningMessage(
        `Todo ${newId} was created, but refreshing the todo list failed: ${err}`,
      );
      return;
    }
    await vscode.window.showInformationMessage(
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
      await config.writeConfigFile?.({ force: true });
      await config.applyGitignore?.({ force: true });
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
