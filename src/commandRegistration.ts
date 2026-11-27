import * as vscode from "vscode";
import * as path from "node:path";
import type { BusyIndicator } from "./busyIndicator";
import { Command } from "./commands";
import { get, Settings, set, setDefault } from "./configuration";
import { installMcpServer } from "./mcp/installServer";
import {
  type AccomplishmentsFilter,
  buildAccomplishmentsPacket,
} from "./todos/accomplishmentsService";
import type { BoardViewProvider } from "./todos/boardViewProvider";
import type { CanvasManager } from "./todos/canvasManager";
import type { CanvasViewer } from "./todos/canvasViewer";
import {
  fetchCodeQL,
  fetchCodeQLBranches,
  fetchSonarQube,
  fetchSonarQubeBranches,
  fetchSonarQubeCli,
  fetchSonarQubeCliBranches,
  importScanningFindings,
  ScanningImportCancelledError,
  type ScanningFinding,
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
import { TodoRootRegistry, type TodoRootDescriptor } from "./todos/rootRegistry";
import type { FilterService } from "./todos/filterService";
import { LinkService } from "./todos/linkService";
import {
  type FindingChanges,
  readScanningProvenance,
  type ScanningProvenance,
} from "./todos/scanningSnapshot";
import type { SkillManager, SkillStatus } from "./todos/skillManager";
import { StatusService } from "./todos/statusService";
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
  type TreeNode,
} from "./todos/todoTreeProvider";
import type { TreeStateService } from "./todos/treeStateService";
import { boardReturnTarget } from "./todos/workspaceNavigation";

/** Minimal structural interface for the tree provider used by commands.
 * Only `refresh()` is ever invoked on it, so both `TodoTreeProvider` and
 * `MultiRootTreeProvider` satisfy it without unsafe casts. */
export interface RefreshableTreeProvider {
  refresh(): void;
}

export interface CommandServices {
  config: ConfigService;
  repository: TodoRepository;
  rootRegistry?: TodoRootRegistry;
  filter: FilterService;
  treeState: TreeStateService;
  status: StatusService;
  links: LinkService;
  skill: SkillManager;
  canvas: CanvasManager;
  canvasViewer: CanvasViewer;
  busy: BusyIndicator;
  treeProvider: RefreshableTreeProvider;
  boardViewProvider: BoardViewProvider;
  refreshSkillStatus: () => void;
  scanning?: Pick<CommandServices, "filter" | "treeState" | "treeProvider" | "boardViewProvider">;
}

type Register = (command: string, callback: (...args: any[]) => any) => void;

export function registerCommands(
  context: vscode.ExtensionContext,
  services: CommandServices,
): void {
  const registry = services.rootRegistry ?? new TodoRootRegistry(services.config, context.workspaceState);
  const register: Register = (command, callback) => {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  };
  const { busy } = services;

  registerLoadingCommands(register);
  registerFilterCommands(register, services, busy);
  registerBoardCommands(register, services, busy);
  registerTodoCommands(register, services, registry, busy);
  registerConfigCommands(register, services, registry);
  registerManualRootCommands(register, services, registry);
  registerSkillCommands(register, services, busy);
  registerTreeCommands(register, services);
  register(Command.ToggleTreeMode, async () => {
    const current = registry.getMode();
    const next = current === "single" ? "multi" : "single";
    registry.setMode(next);
    await vscode.window.showInformationMessage(
      `Agendo: Tree mode is now ${next}.`,
    );
  });
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
    const filter = await promptAccomplishmentsFilter();
    const packet = buildAccomplishmentsPacket(todos, filter);
    await vscode.env.clipboard.writeText(packet.text);
    const omittedSuffix = packet.omittedCount > 0 ? `, ${packet.omittedCount} omitted` : "";
    vscode.window.showInformationMessage(
      `Copied accomplishments context: ${packet.matched} completed todo(s), ${packet.included.length} included${omittedSuffix}.`,
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
  async function prepareMcpServer(): Promise<string | undefined> {
    try {
      return await installMcpServer(context);
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Could not prepare the Agendo MCP server: ${String(error)}`,
      );
      return undefined;
    }
  }

  register(Command.ShowMcpConfig, async () => {
    const serverPath = await prepareMcpServer();
    if (!serverPath) return;
    // Generic MCP client configuration shape: no workspace, socket, or PID
    // values are needed; the server discovers the matching VS Code diagnostics
    // bridge from the client's working directory and inherited environment.
    const mcpConfig = {
      mcpServers: {
        agendo: {
          command: "node",
          args: [serverPath],
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
    await vscode.window.showInformationMessage(
      "This configuration needs no workspace, socket, or PID values. The server discovers the matching VS Code diagnostics bridge from the client's working directory and inherited environment.",
    );
  });
  register(Command.ShowKiloMcpConfig, async () => {
    const serverPath = await prepareMcpServer();
    if (!serverPath) return;
    // Kilo-compatible shape: Kilo supplies the launching window's identity
    // automatically through the inherited KILO_PARENT_PID environment variable.
    const mcpConfig = {
      mcp: {
        agendo: {
          type: "local",
          command: ["node", serverPath],
          enabled: true,
          description: "Agendo todo management and diagnostics",
        },
      },
    };
    const json = JSON.stringify(mcpConfig, null, 2);
    const doc = await vscode.workspace.openTextDocument({
      content: json,
      language: "json",
    });
    await vscode.window.showTextDocument(doc, { preview: false });
    void vscode.window.showInformationMessage(
      "Use this entry in Kilo's user-level configuration, not project config. Kilo supplies the launching window's identity automatically via the inherited KILO_PARENT_PID environment variable; no workspace, socket, or PID values are needed.",
    );
  });
}

async function runCodeScanningImport(
  context: vscode.ExtensionContext,
  services: CommandServices,
): Promise<void> {
  const workspace = getCodeScanningWorkspace(services);
  if (!workspace) return;
  const savedConfig = readSavedScanningImport(context, services, workspace);
  const selection = await chooseScanningImport(context, workspace, savedConfig);
  if (!selection) return;
  await runScanningImport(context, services, workspace, savedConfig.key, selection);
}

type SavedScanningImport = {
  source: "codeql" | "sonarqube";
  branch?: string;
  grouping: "file" | "rule" | "finding";
  sonar?: { server: string; project: string; cli: boolean };
};

type ScanningImportSource = { label: string; source: "codeql" | "sonarqube" };
type ScanningSelection = {
  source: ScanningImportSource;
  sonar?: Awaited<ReturnType<typeof promptSonarQubeSettings>>;
  branch: { label: string; branch?: string };
  grouping: { label: string; grouping: SavedScanningImport["grouping"] };
};

function getCodeScanningWorkspace(
  services: CommandServices,
): vscode.WorkspaceFolder | undefined {
  const { config } = services;
  if (!vscode.workspace.isTrusted) {
    vscode.window.showWarningMessage(
      "Trust this workspace before importing code-scanning findings.",
    );
    return undefined;
  }
  const { path: rootPath, rootMode } = resolveActiveRoot(services.rootRegistry, config);
  if (rootMode === "manual") {
    vscode.window.showWarningMessage(
      "The active root is a manual todo directory with no associated workspace folder. " +
        "Code-scanning import operates on source-code workspaces; select a workspace folder root instead.",
    );
    return undefined;
  }
  if (!rootPath) {
    return undefined;
  }
  const workspace = { uri: vscode.Uri.file(rootPath) } as vscode.WorkspaceFolder;
  if (workspace.uri.scheme !== "file") {
    vscode.window.showWarningMessage(
      "Open a filesystem workspace before importing code-scanning findings.",
    );
    return undefined;
  }
  return workspace;
}

function readSavedScanningImport(
  context: vscode.ExtensionContext,
  services: CommandServices,
  workspace: vscode.WorkspaceFolder,
): { key: string; value?: SavedScanningImport } {
  const normalizedWorkspacePath = path.resolve(workspace.uri.fsPath).replace(/\\/g, "/");
  let normalizedRootId = normalizedWorkspacePath;
  while (normalizedRootId.endsWith("/") && normalizedRootId.length > 1) {
    normalizedRootId = normalizedRootId.slice(0, -1);
  }
  const rootId =
    services.rootRegistry?.getActiveRoot()?.id ??
    (normalizedRootId || "/");
  const key = `agendo.codeScanningImport.${encodeURIComponent(rootId)}`;
  return { key, value: validateSavedScanningImport(context.workspaceState.get<unknown>(key)) };
}

function validateSavedScanningImport(value: unknown): SavedScanningImport | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<SavedScanningImport>;
  if (
    !["codeql", "sonarqube"].includes(candidate.source as string) ||
    !["file", "rule", "finding"].includes(candidate.grouping as string) ||
    (candidate.branch !== undefined && typeof candidate.branch !== "string") ||
    (candidate.source === "sonarqube" &&
      (!candidate.sonar || typeof candidate.sonar.server !== "string" ||
        typeof candidate.sonar.project !== "string" || !candidate.sonar.project.trim() ||
        typeof candidate.sonar.cli !== "boolean" ||
        !isValidSavedSonarServer(candidate.sonar.server)))
  ) return undefined;
  return candidate as SavedScanningImport;
}

function isValidSavedSonarServer(server: string): boolean {
  try {
    validateSonarUrl(server);
    return true;
  } catch {
    return false;
  }
}

async function chooseScanningImport(
  context: vscode.ExtensionContext,
  workspace: vscode.WorkspaceFolder,
  savedConfig: { key: string; value?: SavedScanningImport },
): Promise<ScanningSelection | undefined> {
  const saved = savedConfig.value;
  const choice = await chooseScanningSource(saved);
  if (!choice) return undefined;
  const { source, reuse } = choice;
  const sonar = await chooseScanningSonar(context, workspace, source, reuse, saved);
  if (source.source === "sonarqube" && !sonar) return undefined;
  const branches = await loadScanningBranches(workspace, source, sonar);
  return chooseScanningBranchAndGrouping(source, branches, reuse, saved, sonar);
}

async function chooseScanningSource(
  saved?: SavedScanningImport,
): Promise<{ source: ScanningImportSource; reuse: boolean } | undefined> {
  const mode = saved
    ? await vscode.window.showQuickPick(
        [
          { label: "Use last configuration", description: `${saved.source === "codeql" ? "CodeQL" : "SonarQube"} · ${saved.branch ?? "default branch"} · by ${saved.grouping}`, value: "reuse" as const },
          { label: "Choose configuration", description: "Pick source, branch, and grouping again", value: "edit" as const },
        ],
        { placeHolder: "Repeat the previous code-scanning import?" },
      )
    : { value: "edit" as const };
  if (!mode) return undefined;
  const reuse = mode.value === "reuse" && !!saved;
  let source: ScanningImportSource | undefined;
  if (reuse && saved) {
    source = saved.source === "codeql"
      ? { label: "CodeQL", source: "codeql" }
      : { label: "SonarQube", source: "sonarqube" };
  } else {
    source = await vscode.window.showQuickPick(
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
  }
  if (!source) {
    return undefined;
  }
  return { source, reuse };
}

async function chooseScanningBranchAndGrouping(
  source: ScanningImportSource,
  branches: Awaited<ReturnType<typeof fetchCodeQLBranches>>,
  reuse: boolean,
  saved: SavedScanningImport | undefined,
  sonar: ScanningSelection["sonar"],
): Promise<ScanningSelection | undefined> {
  let branch = reuse && saved ? reuseScanningBranch(branches, saved) : undefined;
  branch ??= await promptScanningBranch(source, branches);
  if (!branch) return undefined;
  let grouping = reuse && saved ? reuseScanningGrouping(saved) : undefined;
  grouping ??= await promptScanningGrouping();
  if (!grouping) return undefined;
  return { source, sonar, branch, grouping };
}

async function chooseScanningSonar(
  context: vscode.ExtensionContext,
  workspace: vscode.WorkspaceFolder,
  source: ScanningImportSource,
  reuse: boolean,
  saved?: SavedScanningImport,
): Promise<Awaited<ReturnType<typeof promptSonarQubeSettings>> | undefined> {
  if (source.source !== "sonarqube") return undefined;
  if (!reuse || !saved?.sonar) return promptSonarQubeSettings(context, workspace.uri);
  try {
    return await promptSonarQubeSettings(context, workspace.uri, saved.sonar);
  } catch {
    // Saved CLI server/configuration may have gone stale since the last import.
    return promptSonarQubeSettings(context, workspace.uri);
  }
}

async function loadScanningBranches(
  workspace: vscode.WorkspaceFolder,
  source: ScanningImportSource,
  sonar: ScanningSelection["sonar"],
) {
  return vscode.window.withProgress(
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
}

function reuseScanningBranch(
  branches: Awaited<ReturnType<typeof loadScanningBranches>>,
  saved: SavedScanningImport,
): ScanningSelection["branch"] | undefined {
  if (saved.branch !== undefined && !branches.branches.includes(saved.branch)) return undefined;
  return {
    label: saved.branch ?? `${branches.defaultBranch} (default)`,
    branch: saved.branch,
  };
}

async function promptScanningBranch(
  source: ScanningImportSource,
  branches: Awaited<ReturnType<typeof loadScanningBranches>>,
): Promise<ScanningSelection["branch"] | undefined> {
  return vscode.window.showQuickPick(
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
}

function reuseScanningGrouping(
  saved: SavedScanningImport,
): ScanningSelection["grouping"] | undefined {
  if (!["file", "rule", "finding"].includes(saved.grouping)) return undefined;
  return { label: `By ${saved.grouping}`, grouping: saved.grouping };
}

async function promptScanningGrouping(): Promise<ScanningSelection["grouping"] | undefined> {
  return vscode.window.showQuickPick(
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
}

async function runScanningImport(
  context: vscode.ExtensionContext,
  services: CommandServices,
  workspace: vscode.WorkspaceFolder,
  configKey: string,
  selection: ScanningSelection,
): Promise<void> {
  const { config, repository } = services;
  const { source, sonar, branch, grouping } = selection;
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Importing ${source.label} todos...` },
    async (progress, token) => {
      const scan = await loadScanningFindings(workspace, source, sonar, branch.branch);
      if (!scan) return;
      if (token.isCancellationRequested) {
        vscode.window.showInformationMessage(`${source.label} import cancelled before any todos were written.`);
        return;
      }
      let result: Awaited<ReturnType<typeof importScanningFindings>>;
      try {
        result = await importScanningFindings(
          config,
          repository,
          source.source,
          scan.scope,
          scan.findings,
          grouping.grouping,
          {
            branch: branch.branch,
            isCancellationRequested: () => token.isCancellationRequested,
            onProgress: ({ completed, total, label }) => {
              progress.report({
                message: total === 0
                  ? "No findings to import"
                  : `${completed}/${total} groups · ${label}`,
                ...(total > 0 && completed > 0 ? { increment: 100 / total } : {}),
              });
            },
          },
        );
      } catch (error) {
        if (!(error instanceof ScanningImportCancelledError)) throw error;
        vscode.window.showInformationMessage(`${source.label} import cancelled before any todos were written.`);
        return;
      }
      vscode.window.showInformationMessage(
        `${source.label} (${branch.label}, ${grouping.label}): ${result.created} todos created, ${result.updated} updated from ${scan.findings.length} findings. Existing lifecycle and notes were preserved.`,
      );
      await context.workspaceState.update(configKey, {
        source: source.source,
        branch: branch.branch,
        grouping: grouping.grouping,
        ...(sonar ? { sonar: { server: sonar.server, project: sonar.project, cli: sonar.cli } } : {}),
      } satisfies SavedScanningImport);
    },
  );
}

async function loadScanningFindings(
  workspace: vscode.WorkspaceFolder,
  source: ScanningImportSource,
  sonar: ScanningSelection["sonar"],
  branch: string | undefined,
): Promise<{ scope: string; branch?: string; findings: ScanningFinding[] } | undefined> {
  if (source.source === "codeql") return fetchCodeQL(workspace.uri.fsPath, undefined, branch);
  if (sonar?.cli) {
    return fetchSonarQubeCli(workspace.uri.fsPath, sonar.server, sonar.project, undefined, branch);
  }
  if (sonar) {
    return fetchSonarQube(
      sonar.server, sonar.project, sonar.token, undefined, undefined, branch,
    );
  }
  return undefined;
}

async function resolveSonarServerAndProject(
  workspace: vscode.Uri,
  auth: { cli: boolean },
  defaults: { server: string; project: string },
  fixed?: { server: string; project: string },
): Promise<{ server: string; project: string } | undefined> {
  if (fixed) {
    const server = validateSonarUrl(fixed.server).toString();
    const project = fixed.project;
    if (auth.cli) {
      const active = await sonarQubeCliServer(workspace.fsPath);
      if (active !== server) {
        throw new Error(
          `SonarQube CLI is connected to a different server (${active}). Log in to ${server} and retry.`,
        );
      }
    }
    return { server, project };
  }
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
    return undefined;
  }
  const server = validateSonarUrl(urlInput).toString();
  const projectInput = await vscode.window.showInputBox({
    prompt: `SonarQube project key (${server})`,
    value: get<string>(Settings.SonarQubeProjectKey) || defaults.project,
    validateInput: (value) => (value.trim() ? undefined : "Enter the project key"),
  });
  if (!projectInput) {
    return undefined;
  }
  return { server, project: projectInput.trim() };
}

async function promptForSonarToken(
  saved: string | undefined,
  environmentToken: string | undefined,
): Promise<string | undefined> {
  let tokenPrompt: string;
  if (saved) {
    tokenPrompt = "SonarQube token (leave blank to reuse saved token)";
  } else if (environmentToken) {
    tokenPrompt = "SonarQube token (leave blank to import environment token into secure storage)";
  } else {
    tokenPrompt = "SonarQube user token (stored securely in VS Code)";
  }
  const tokenInput = await vscode.window.showInputBox({
    prompt: tokenPrompt,
    password: true,
    ignoreFocusOut: true,
  });
  if (tokenInput === undefined) {
    return undefined;
  }
  const token = tokenInput.trim() || saved || environmentToken;
  if (!token) {
    return undefined;
  }
  return token;
}

async function promptSonarQubeSettings(
  context: vscode.ExtensionContext,
  workspace: vscode.Uri,
  fixed?: { server: string; project: string; cli?: boolean },
): Promise<{ server: string; project: string; token: string; cli: boolean } | undefined> {
  const defaults = await sonarQubeDefaults(workspace);
  const auth = fixed?.cli !== undefined
    ? { cli: fixed.cli }
    : await vscode.window.showQuickPick(
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
  const resolved = await resolveSonarServerAndProject(workspace, auth, defaults, fixed);
  if (!resolved) {
    return undefined;
  }
  const { server, project } = resolved;
  if (auth.cli) {
    return { server, project, token: "", cli: true };
  }
  const secretKey = `agendo.sonarqube:${server}`;
  const saved = await context.secrets.get(secretKey);
  const environmentToken = sonarQubeEnvironmentToken(server, defaults);
  const token = await promptForSonarToken(saved, environmentToken);
  if (!token) {
    return undefined;
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
  const { path: source, rootMode } = resolveActiveRoot(services.rootRegistry, services.config);
  if (rootMode === "manual") {
    vscode.window.showWarningMessage(
      "The active root is a manual todo directory with no associated workspace folder. " +
        "Scanner refresh operates on source-code workspaces; select a workspace folder root instead.",
    );
    return;
  }
  if (!source) {
    return;
  }
  const workspace = { uri: vscode.Uri.file(source) } as vscode.WorkspaceFolder;
  if (workspace.uri.scheme !== "file") {
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
    await refreshCodeQLTodo(services, todo, provenance, workspace);
  } else {
    await refreshSonarTodo(context, services, todo, provenance, workspace);
  }
}

async function refreshCodeQLTodo(
  services: CommandServices,
  todo: Todo,
  provenance: ScanningProvenance,
  workspace: vscode.WorkspaceFolder,
): Promise<void> {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Refreshing ${todo.id}…` },
    async () => {
      if (workspace.uri.scheme !== "file") {
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
      await importAndReportScanningFindings(services, todo, scan, provenance, "codeql", "CodeQL");
    },
  );
}

async function importAndReportScanningFindings(
  services: CommandServices,
  todo: Todo,
  scan: { scope: string; branch?: string; findings: ScanningFinding[] },
  provenance: ScanningProvenance,
  source: ScanningSource,
  displayLabel: string,
): Promise<void> {
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
    source,
    scan.scope,
    scan.findings,
    provenance.grouping,
    { target: provenance.target, branch: provenance.branch },
  );
  showScanningImportResult(displayLabel, todo.id, result);
}

async function refreshSonarTodo(
  context: vscode.ExtensionContext,
  services: CommandServices,
  todo: Todo,
  provenance: ScanningProvenance,
  workspace: vscode.WorkspaceFolder,
): Promise<void> {
  const parts = provenance.scope.split("#");
  const server = validateSonarUrl(parts[0]).toString();
  const project = parts.slice(1).join("#");
  const sonar = await promptSonarQubeSettings(context, workspace.uri, {
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
            workspace.uri.fsPath,
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
      await importAndReportScanningFindings(
        services,
        todo,
        scan,
        provenance,
        "sonarqube",
        "SonarQube",
      );
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
          const { path: root, rootMode } = resolveActiveRoot(
            services.rootRegistry,
            services.config,
          );
          if (!root) {
            return;
          }
          await services.canvasViewer.open(root, { kind: "board", scope }, undefined, rootMode);
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
          const { path: root, rootMode } = resolveActiveRoot(
            services.rootRegistry,
            services.config,
          );
          if (!root) {
            return;
          }
          await services.canvasViewer.open(root, { kind: "digest", scope }, undefined, rootMode);
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

/** Resolve a command argument to the owning root's config/repository and the
 * selected todo, falling back to the active root when no todo is selected.
 * Returns undefined for stale selections (the todo is not in any known
 * root), which callers treat as a safe no-op.
 *
 * Internal TreeNode (keyboard / command-palette path): the active provider's
 * repository owns the nodes it renders, so a selected todo that is a member of
 * the active repository is resolved through the active context. Otherwise the
 * todo is resolved by exact URI through the root registry.
 *
 * VS Code TreeItem (view / item / context right-click path): resolve by exact
 * resource URI across registry roots first, then fall back to the active
 * repository only when the URI is an actual member of it. Never resolve by a
 * bare todo ID, so duplicate IDs across roots never mutate the wrong root. */
function resolveRootServices(
  registry: TodoRootRegistry,
  services: CommandServices,
  arg: unknown,
): { config: ConfigService; repository: TodoRepository; todo: Todo | undefined } | undefined {
  // Internal TreeNode (keyboard/command-palette path).
  const fromNode = resolveFromTreeNode(registry, services, arg);
  if (fromNode) {
    return fromNode;
  }

  // VS Code TreeItem (view/item/context right-click path).
  const fromItem = resolveFromTreeItem(registry, services, arg);
  if (fromItem) {
    return fromItem;
  }

  // No todo selected: default to the active context; callers ignore `todo`.
  return { config: services.config, repository: services.repository, todo: undefined };
}

/** Resolve a command argument through the internal TreeNode path.
 * The active provider's repository owns the nodes it renders, so a selected
 * todo that is a member of the active repository is resolved through the
 * active context. Otherwise the todo is resolved by exact URI through the
 * root registry. Returns undefined for stale selections. */
function resolveFromTreeNode(
  registry: TodoRootRegistry,
  services: CommandServices,
  arg: unknown,
): { config: ConfigService; repository: TodoRepository; todo: Todo } | undefined {
  if (!arg || typeof arg !== "object" || !(arg as { kind?: unknown }).kind) {
    return undefined;
  }
  const node = arg as TreeNode;
  if (node.kind !== "todo") {
    return undefined;
  }
  const selectedTodo = (node as TodoNode).todo;
  const activeMember = services.repository.getTodos().some(
    (t) => t.uri.toString() === selectedTodo.uri.toString(),
  );
  if (activeMember) {
    return { config: services.config, repository: services.repository, todo: selectedTodo };
  }
  const owned = registry.resolveRootForTodo(selectedTodo);
  if (!owned) {
    // Stale selection: the todo is not in any known root. Safe no-op.
    return undefined;
  }
  return { config: owned.config, repository: owned.repository, todo: selectedTodo };
}

/** Resolve a command argument through the VS Code TreeItem path.
 * Resolve by exact resource URI across registry roots first, then fall back
 * to the active repository only when the URI is an actual member of it.
 * Never resolve by bare todo ID. */
function resolveFromTreeItem(
  registry: TodoRootRegistry,
  services: CommandServices,
  arg: unknown,
): { config: ConfigService; repository: TodoRepository; todo: Todo } | undefined {
  const item =
    arg && typeof arg === "object" && "resourceUri" in arg
      ? arg as { resourceUri?: unknown }
      : undefined;
  const resourceUri = item?.resourceUri as vscode.Uri | undefined;
  if (!resourceUri) {
    return undefined;
  }
  // Resolve by exact resource URI across registry roots first.
  for (const descriptor of registry.getRoots()) {
    const context = registry.getContext(descriptor.id);
    if (!context) continue;
    const matches = context.repository.getTodos().filter(
      (t) => t.uri.toString() === resourceUri.toString(),
    );
    if (matches.length === 1) {
      return { config: context.config, repository: context.repository, todo: matches[0] };
    }
  }
  // Fall back to the active repository only when the URI is an actual member.
  const activeMember = services.repository.getTodos().find(
    (t) => t.uri.toString() === resourceUri.toString(),
  );
  if (activeMember) {
    return { config: services.config, repository: services.repository, todo: activeMember };
  }
  return undefined;
}

/**
 * Resolve the active root to a filesystem path and root mode.
 * Workspace roots use their associated folder path; manual roots use their
 * registered directory. Falls back to the ConfigService workspace folder for
 * backward compatibility when no root is registered.
 */
function resolveActiveRoot(
  registry: TodoRootRegistry | undefined,
  config: ConfigService,
): { path: string | undefined; rootMode: "workspace" | "manual" } {
  const root = registry?.getActiveRoot();
  if (root) {
    if (root.source === "workspace" && root.folder) {
      return { path: root.folder.uri.fsPath, rootMode: "workspace" };
    }
    if (root.source === "manual") {
      return { path: root.uri.fsPath, rootMode: "manual" };
    }
  }
  const folder = config.getWorkspaceFolder();
  return folder
    ? { path: folder.uri.fsPath, rootMode: "workspace" }
    : { path: undefined, rootMode: "workspace" };
}

function registerTodoCommands(
  register: Register,
  services: CommandServices,
  registry: TodoRootRegistry,
  busy: BusyIndicator,
): void {

  register(Command.OpenPreview, async (arg: unknown) => {
    const resolved = resolveRootServices(registry, services, arg);
    if (!resolved) {
      return;
    }
    const { config, todo } = resolved;
    if (!todo) {
      return;
    }
    await config.openTodo(todo.uri);
  });

  register(Command.OpenCanvas, async (arg: unknown) => {
    const resolved = resolveRootServices(registry, services, arg);
    if (!resolved) {
      return;
    }
    const { config, todo } = resolved;
    if (!todo) {
      return;
    }
    const returnTo = boardReturnTarget(
      arg && typeof arg === "object" ? (arg as Record<string, unknown>).returnTo : undefined,
    );
    if (returnTo && !matchesTodoScope(todo, returnTo.scope)) return;
    await config.openInCanvas(todo.uri, returnTo);
  });

  for (const targetStatus of TODO_STATUSES) {
    register(`agendo.setStatus.${targetStatus}`, async (arg: unknown) => {
      const resolved = resolveRootServices(registry, services, arg);
      if (!resolved) {
        return;
      }
      const { config, repository, todo } = resolved;
      if (!todo) {
        return;
      }
      const oldFileName = todo.fileName;
      const statusService = new StatusService(config, repository);
      const linksService = new LinkService(config);
      try {
        await busy.run(
          "Updating todo…",
          async () => {
            const result = await statusService.setStatus(todo, targetStatus as TodoStatus);
            await repository.refresh();
            if (result) {
              await linksService.warnOnBrokenReferences(oldFileName, result);
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
    const resolved = resolveRootServices(registry, services, arg);
    if (!resolved) {
      return;
    }
    const { config, repository, todo } = resolved;
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
    const statusService = new StatusService(config, repository);
    const linksService = new LinkService(config);
    try {
      await busy.run(
        "Updating todo…",
        async () => {
          const result = await statusService.setPriority(todo, picked.label as TodoPriority);
          await repository.refresh();
          if (result) {
            await linksService.warnOnBrokenReferences(oldFileName, result);
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
    const resolved = resolveRootServices(registry, services, arg);
    if (!resolved) {
      return;
    }
    const { config, repository, todo } = resolved;
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
    const statusService = new StatusService(config, repository);
    try {
      await busy.run(
        "Updating todo…",
        async () => {
          await statusService.setGroup(todo, value.trim() || undefined);
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
    const resolved = resolveRootServices(registry, services, arg);
    if (!resolved) {
      return;
    }
    const { config, repository, todo } = resolved;
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
    const statusService = new StatusService(config, repository);
    try {
      await busy.run(
        "Deleting todo…",
        async () => {
          await statusService.deleteTodo(todo);
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
    const resolved = resolveRootServices(registry, services, arg);
    if (!resolved) {
      return;
    }
    const { config, repository, todo } = resolved;
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
    const statusService = new StatusService(config, repository);
    const linksService = new LinkService(config);
    try {
      await busy.run(
        "Updating todo…",
        async () => {
          const result = await statusService.setDependencies(todo, newDependencies);
          await repository.refresh();
          if (result) {
            await linksService.warnOnBrokenReferences(oldFileName, result);
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
    await createTodo(services.config, services.repository, busy);
  });

  register(Command.ImportFromClipboard, async () => {
    await importFromClipboard(services.config, services.repository);
  });
}

function registerConfigCommands(
  register: Register,
  services: CommandServices,
  registry: TodoRootRegistry,
): void {
  const { config, repository } = services;

  register(Command.OpenSettings, async (scope?: unknown) => {
    const { path: root, rootMode } = resolveActiveRoot(registry, config);
    if (!root) {
      return;
    }
    await services.canvasViewer.openSettings(
      root,
      scope === "todos" || scope === "code-scanning" ? { kind: "board", scope } : undefined,
      rootMode,
    );
  });

  register(Command.ChooseRoot, async () => {
    const roots = registry.getRoots();
    if (roots.length === 0) {
      vscode.window.showInformationMessage("No roots available.");
      return;
    }
    const activeId = registry.getActiveRootId();
    const items: vscode.QuickPickItem[] = [];
    const dataMap = new Map<string, TodoRootDescriptor>();
    for (const root of roots) {
      const isActive = root.id === activeId;
      items.push({
        label: root.label,
        description: `${root.source} · ${root.uri.fsPath}${isActive ? " (active)" : ""}${root.available ? "" : " (unavailable)"}`,
        picked: isActive,
      });
      dataMap.set(root.label, root);
    }
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a todo root",
    });
    if (!picked) {
      return;
    }
    const root = dataMap.get(picked.label);
    if (!root) {
      return;
    }
    registry.setActiveRoot(root.id);
    await config.writeConfigFile();
    await config.applyGitignore();
    await repository.rebindRoot();
  });
  register(Command.ChooseWorkspaceFolder, async () => {
    const folders = config.workspaceFolders;
    const manualRoot = config.getManualRoot();
    const items: vscode.QuickPickItem[] = [];
    const dataMap = new Map<string, { folder?: vscode.WorkspaceFolder; uri?: vscode.Uri }>();
    for (const folder of folders) {
      const rootUri = config.getRootUri(folder);
      const rootPath = rootUri?.fsPath || folder.uri.fsPath;
      items.push({ label: folder.name, description: rootPath });
      dataMap.set(folder.name, { folder });
    }
    if (manualRoot) {
      const label = `Manual: ${path.basename(manualRoot.fsPath)}`;
      items.push({ label, description: manualRoot.fsPath });
      dataMap.set(label, { uri: manualRoot });
    }
    if (items.length === 0) {
      vscode.window.showInformationMessage("No workspace folders available.");
      return;
    }
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a root folder for todos",
    });
    if (!picked) {
      return;
    }
    const data = dataMap.get(picked.label);
    if (data?.uri) {
      config.setManualRoot(data.uri);
    } else if (data?.folder) {
      config.setWorkspaceFolder(data.folder);
    }
    await config.writeConfigFile();
    await config.applyGitignore();
    await repository.rebindRoot();
    const rootUri = config.getRootUri();
    vscode.window.showInformationMessage(
      `Active root: ${rootUri?.fsPath || "none"}`,
    );
  });
  register(Command.ToggleGitignore, async () => {
    await set(Settings.GitignoreTodos, !config.gitignored);
    await config.writeConfigFile();
    await config.applyGitignore();
    await repository.refresh();
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

/** Register manual-root management commands (add/remove/select). */
function registerManualRootCommands(
  register: Register,
  services: CommandServices,
  registry: TodoRootRegistry,
): void {
  const { config, repository } = services;

  register(Command.AddManualRoot, async () => {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: vscode.Uri.file(
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "/",
      ),
    });
    if (!selected?.[0]) {
      return;
    }
    const uri = selected[0];
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      vscode.window.showErrorMessage("Selected path is not a directory.");
      return;
    }
    const label = await vscode.window.showInputBox({
      prompt: "Root label",
      value: path.basename(uri.fsPath),
    });
    if (label === undefined) {
      return;
    }
    registry.addManualRoot(uri, label);
    // Activate the newly added root so it becomes the active root.
    const added = registry
      .getRoots()
      .find((r) => r.source === "manual" && r.uri.toString() === uri.toString());
    if (added) {
      registry.setActiveRoot(added.id);
    }
    await config.writeConfigFile();
    await config.applyGitignore();
    await repository.rebindRoot();
    vscode.window.showInformationMessage(`Manual root added: ${label}`);
  });

  register(Command.RemoveManualRoot, async () => {
    const roots = registry.getRoots();
    const manualRoots = roots.filter((r) => r.source === "manual");
    if (manualRoots.length === 0) {
      vscode.window.showInformationMessage("No manual roots registered.");
      return;
    }
    const activeId = registry.getActiveRootId();
    const items: vscode.QuickPickItem[] = [];
    const dataMap = new Map<string, TodoRootDescriptor>();
    for (const root of manualRoots) {
      const label = `${root.label} (${root.uri.fsPath})`;
      dataMap.set(label, root);
      items.push({
        label,
        description: root.uri.fsPath,
        picked: root.id === activeId,
      });
    }
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Remove a manual root",
    });
    if (!picked) {
      return;
    }
    const context = dataMap.get(picked.label);
    if (!context) {
      return;
    }
    const wasActive = context.id === registry.getActiveRootId();
    registry.removeManualRoot(context.id);
    if (wasActive) {
      const fallback = registry.getActiveRootId();
      if (fallback) {
        // Let the registry choose a safe fallback and synchronize ConfigService.
        registry.setActiveRoot(fallback);
        await config.writeConfigFile();
        await config.applyGitignore();
      } else {
        // No roots remain: clear manual/active root without touching files.
        config.clearManualRoot();
      }
    }
    await repository.rebindRoot();
    vscode.window.showInformationMessage("Manual root removed.");
  });
}

/** Prompt the user for a time range and optional filters for the accomplishments report. */
async function promptAccomplishmentsFilter(): Promise<AccomplishmentsFilter> {
  const filter: AccomplishmentsFilter = {};

  const sinceInput = await vscode.window.showInputBox({
    prompt: "Start date (inclusive, ISO YYYY-MM-DD; leave blank for none)",
    placeHolder: "e.g. 2026-10-01",
  });
  if (sinceInput === undefined) {
    return {};
  }
  if (sinceInput.trim()) {
    filter.since = sinceInput.trim();
  }

  const untilInput = await vscode.window.showInputBox({
    prompt: "End date (inclusive, ISO YYYY-MM-DD; leave blank for none)",
    placeHolder: "e.g. 2026-10-31",
  });
  if (untilInput === undefined) {
    return {};
  }
  if (untilInput.trim()) {
    filter.until = untilInput.trim();
  }

  const groupInput = await vscode.window.showInputBox({
    prompt: "Group filter (leave blank for none)",
    placeHolder: "e.g. scanner-workflow",
  });
  if (groupInput === undefined) {
    return {};
  }
  if (groupInput.trim()) {
    filter.group = groupInput.trim();
  }

  const tagsInput = await vscode.window.showInputBox({
    prompt: "Tags filter (comma-separated; todos must have all listed tags)",
    placeHolder: "e.g. bug, critical",
  });
  if (tagsInput === undefined) {
    return {};
  }
  if (tagsInput.trim()) {
    filter.tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  const sourcePick = await vscode.window.showQuickPick(
    [
      { label: "CodeQL", description: "source", value: "codeql" as const },
      { label: "SonarQube", description: "source", value: "sonarqube" as const },
      { label: "None (all sources)", value: undefined as unknown as string },
    ],
    { placeHolder: "Filter by scanner source" },
  );
  if (sourcePick?.value !== undefined) {
    filter.source = sourcePick.value as "codeql" | "sonarqube";
  }

  return filter;
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
            const sourceDetail = status.sourceVersion
              ? `v${status.sourceVersion} (${versionRelationship(status.installedVersion, status.sourceVersion)})`
              : "unavailable";
            return `${name}: installed v${status.installedVersion ?? "unknown"}; bundled v${status.bundledVersion ?? "unknown"} (${versionRelationship(status.installedVersion, status.bundledVersion)}); source ${sourceDetail}`;
          });
          refreshSkillStatus();
          const updateMessage = updates
            ? `${updates} component(s) have newer versions available.`
            : "No newer versions found among checked versions.";
          const uncertainMessage = uncertain ? "Some versions could not be checked. " : "";
          const summary = `${updateMessage} ${uncertainMessage}${details.join(". ")}. No files were installed.`;
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
      let command: string;
      if (component === "skill") {
        command = picked.action === "bundle" ? Command.EnableSkill : Command.UpdateSkill;
      } else {
        command = picked.action === "bundle" ? Command.InstallCanvas : Command.UpdateCanvas;
      }
      await vscode.commands.executeCommand(command);
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
  treeProvider: RefreshableTreeProvider,
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

### ${now} — Created from ${url}
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
