import * as assert from "node:assert";
import * as vscode from "vscode";
import { SettingsService } from "../todos/settingsService";
import { Command } from "../commands";
import type { BoardViewProvider } from "../todos/boardViewProvider";
import type { ConfigService } from "../todos/configService";
import type { TodoRepository } from "../todos/todoRepository";
import type { TodoTreeProvider } from "../todos/todoTreeProvider";
import type { SkillStatusTreeProvider } from "../todos/skillStatusTreeProvider";

type BoardProviderFake = BoardViewProvider & {
  getHiddenStatusesCalls: Array<{ scope: string; statuses: string[] }>;
  setStatusVisibilityCalls: Array<{ scope: string; status: string; visible: boolean }>;
  refreshCalls: number;
};

function boardProviderFake(scope: "todos" | "code-scanning"): BoardProviderFake {
  const getHiddenStatusesCalls: Array<{ scope: string; statuses: string[] }> = [];
  const setStatusVisibilityCalls: Array<{ scope: string; status: string; visible: boolean }> = [];
  return {
    getHiddenStatusesCalls,
    setStatusVisibilityCalls,
    getHiddenStatuses: () => {
      getHiddenStatusesCalls.push({ scope, statuses: [] });
      return [];
    },
    setStatusVisibility: async (_status: unknown, visible: unknown) => {
      setStatusVisibilityCalls.push({ scope, status: String(_status), visible: Boolean(visible) });
      return true;
    },
    refresh: () => {},
    getSnapshot: () => ({} as any),
    handleCanvasMessage: async () => {},
    open: () => {},
    dispose: () => {},
    sendSnapshot: () => {},
  } as unknown as BoardProviderFake;
}

type ConfigFake = ConfigService & {
  writeConfigFileCalls: number;
  applyGitignoreCalls: number;
};

function configFake(root = "docs/todos"): ConfigFake {
  let writeConfigFileCalls = 0;
  let applyGitignoreCalls = 0;
  const config: any = {
    root,
    gitignored: true,
    backloggedFolder: "backlog",
    cancelledFolder: "cancelled",
    completedFolder: "completed",
    viewMode: "preview",
    codeScanningEnabled: false,
    get writeConfigFileCalls() {
      return writeConfigFileCalls;
    },
    get applyGitignoreCalls() {
      return applyGitignoreCalls;
    },
    writeConfigFile: async () => {
      writeConfigFileCalls++;
    },
    applyGitignore: async () => {
      applyGitignoreCalls++;
    },
  };
  return config as unknown as ConfigFake;
}

type RepositoryFake = TodoRepository & { refreshCalls: number };
function repositoryFake(): RepositoryFake {
  let refreshCalls = 0;
  const repo: any = {
    get refreshCalls() {
      return refreshCalls;
    },
    refresh: async () => {
      refreshCalls++;
    },
    getTodos: () => [],
    getDependencyGraph: () => ({ blockedBy: new Map(), blocking: new Map() }),
    onDidChange: () => new vscode.Disposable(() => {}),
  };
  return repo as unknown as RepositoryFake;
}

type TreeProviderFake = TodoTreeProvider & { refreshCalls: number };
function treeProviderFake(): TreeProviderFake {
  let refreshCalls = 0;
  const provider: any = {
    get refreshCalls() {
      return refreshCalls;
    },
    refresh: () => {
      refreshCalls++;
    },
  };
  return provider as unknown as TreeProviderFake;
}

type SkillTreeProviderFake = SkillStatusTreeProvider & { refreshCalls: number };
function skillTreeProviderFake(): SkillTreeProviderFake {
  let refreshCalls = 0;
  const provider: any = {
    get refreshCalls() {
      return refreshCalls;
    },
    refresh: () => {
      refreshCalls++;
    },
  };
  return provider as unknown as SkillTreeProviderFake;
}

interface ServiceHarness {
  service: SettingsService;
  config: ConfigFake;
  board: BoardProviderFake;
  scanning: BoardProviderFake;
  repository: RepositoryFake;
  treeProvider: TreeProviderFake;
  scanningTreeProvider: TreeProviderFake;
  skillStatusTreeProvider: SkillTreeProviderFake;
  setCalls: Array<{ key: string; value: unknown }>;
  setDefaultCalls: Array<{ key: string; value: unknown }>;
  executeCommandCalls: Array<{ command: string; args: unknown[] }>;
}

function makeService(
  overrides: Partial<{
    config: ConfigFake;
    board: BoardProviderFake;
    scanning: BoardProviderFake;
    repository: RepositoryFake;
    treeProvider: TreeProviderFake;
    scanningTreeProvider: TreeProviderFake;
    skillStatusTreeProvider: SkillTreeProviderFake;
    globalValues: Record<string, unknown>;
    beforeSet: () => PromiseLike<void>;
  }> = {},
): ServiceHarness {
  const config = overrides.config ?? configFake();
  const board = overrides.board ?? boardProviderFake("todos");
  const scanning = overrides.scanning ?? boardProviderFake("code-scanning");
  const repository = overrides.repository ?? repositoryFake();
  const treeProvider = overrides.treeProvider ?? treeProviderFake();
  const scanningTreeProvider = overrides.scanningTreeProvider ?? treeProviderFake();
  const skillStatusTreeProvider = overrides.skillStatusTreeProvider ?? skillTreeProviderFake();
  const setCalls: Array<{ key: string; value: unknown }> = [];
  const setDefaultCalls: Array<{ key: string; value: unknown }> = [];
  const executeCommandCalls: Array<{ command: string; args: unknown[] }> = [];
  const globalValues = overrides.globalValues ?? {};
  const values: Record<string, unknown> = {};

  Object.defineProperty(vscode.workspace, "getConfiguration", {
    configurable: true,
    value: () => ({
      inspect: (key: string) => ({ globalValue: globalValues[key] }),
      get: <T>(_key: string) => undefined as unknown as T,
      update: () => Promise.resolve(),
    }),
  });

  const service = new SettingsService({
    get: <T>(key: string) => values[key] as unknown as T,
    set: async (key: string, value: unknown) => {
      if (overrides.beforeSet) {
        await overrides.beforeSet();
      }
      values[key] = value;
      setCalls.push({ key, value });
    },
    setDefault: async (key: string, value: unknown) => {
      setDefaultCalls.push({ key, value });
    },
    executeCommand: async (command: string, ...args: unknown[]) => {
      executeCommandCalls.push({ command, args });
      return undefined;
    },
    config,
    boardViewProvider: board,
    scanningBoardViewProvider: scanning,
    repository,
    treeProvider,
    scanningTreeProvider,
    skillStatusTreeProvider,
    extensionVersion: "0.3.0",
    getSkillStatus: async () => ({ installed: true }),
    getCanvasStatus: async () => ({ installed: true }),
  });

  return {
    service,
    config,
    board,
    scanning,
    repository,
    treeProvider,
    scanningTreeProvider,
    skillStatusTreeProvider,
    setCalls,
    setDefaultCalls,
    executeCommandCalls,
  };
}

suite("settings service", () => {
  let configurationDescriptor: PropertyDescriptor | undefined;
  setup(() => {
    configurationDescriptor = Object.getOwnPropertyDescriptor(vscode.workspace, "getConfiguration");
  });
  teardown(() => {
    if (configurationDescriptor) {
      Object.defineProperty(vscode.workspace, "getConfiguration", configurationDescriptor);
    } else {
      Reflect.deleteProperty(vscode.workspace, "getConfiguration");
    }
  });

  test("rejects unsupported board scope without executing a command", async () => {
    const { service, executeCommandCalls } = makeService();
    await assert.rejects(service.handleSettingsAction({ action: "open-board", scope: "unknown" }));
    assert.deepStrictEqual(executeCommandCalls, []);
  });

  test("lifecycle folder settings must remain readable by the shared canvas loader", async () => {
    for (const action of ["set-backlogged-folder", "set-cancelled-folder", "set-completed-folder"]) {
      const { service, setCalls } = makeService();
      for (const value of ["nested/folder", "folder with spaces", "../outside", ".", "..", "C:\\temp"]) {
        await assert.rejects(service.handleSettingsAction({ action, value }));
      }
      assert.strictEqual(setCalls.length, 0);
      await service.handleSettingsAction({ action, value: " archived-todos " });
      assert.strictEqual(setCalls[0].value, "archived-todos");
    }
  });

  test("source preferences reject credential-bearing or ambiguous URLs before writing", async () => {
    const { service, setCalls } = makeService();
    for (const action of ["set-skill-update-source", "set-canvas-update-source"]) {
      for (const value of ["https://user:password@example.com/source", "https://example.com/source?key=value", "https://example.com/source#fragment"]) {
        await assert.rejects(service.handleSettingsAction({ action, value }));
      }
    }
    assert.deepStrictEqual(setCalls, []);
  });

  test("rejects unknown action without writing", async () => {
    const { service, setCalls } = makeService();
    await assert.rejects(service.handleSettingsAction({ action: "bogus" }));
    assert.strictEqual(setCalls.length, 0);
  });

  test("successful mutation returns success:true so the canvas reloads", async () => {
    const { service } = makeService();
    const result = await service.handleSettingsAction({ action: "set-view-mode", value: "canvas" });
    assert.deepStrictEqual(result, { success: true });
  });

  test("type mismatches raise TypeError without writing settings", async () => {
    const { service, setCalls } = makeService();
    for (const payload of [
      { action: 123 },
      { action: "open-board", scope: 123 },
      { action: "set-sort-by-date", value: "true" },
    ]) {
      await assert.rejects(service.handleSettingsAction(payload), TypeError);
    }
    assert.deepStrictEqual(setCalls, []);
  });

  test("tree refreshes wait for the asynchronous settings write", async () => {
    let release!: () => void;
    const pendingWrite = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { service, treeProvider, scanningTreeProvider, setCalls } = makeService({
      beforeSet: () => pendingWrite,
    });
    const result = service.handleSettingsAction({ action: "set-group-by", value: "priority" });
    try {
      assert.strictEqual(treeProvider.refreshCalls, 0);
      assert.strictEqual(scanningTreeProvider.refreshCalls, 0);
      assert.deepStrictEqual(setCalls, []);
    } finally {
      release();
      await result;
    }
    assert.deepStrictEqual(setCalls, [{ key: "groupBy", value: "priority" }]);
    assert.strictEqual(treeProvider.refreshCalls, 1);
    assert.strictEqual(scanningTreeProvider.refreshCalls, 1);
  });

  test("relative paths preserve supplementary Unicode and reject embedded controls", async () => {
    const { service, setCalls } = makeService();
    for (const value of ["docs/\u{1F680}/\u0000todos", "docs/\u001ftodos", "docs/\ttodos"]) {
      await assert.rejects(service.handleSettingsAction({ action: "set-root", value }));
    }
    assert.deepStrictEqual(setCalls, []);
    const value = "docs/\u{1F680}/todos";
    await service.handleSettingsAction({ action: "set-root", value });
    assert.deepStrictEqual(setCalls, [{ key: "root", value }]);
  });

  test("rejects non-object payload", async () => {
    const { service } = makeService();
    await assert.rejects(service.handleSettingsAction("not-an-object"));
    await assert.rejects(service.handleSettingsAction([1, 2]));
  });

  test("open-extension-settings executes workbench settings command", async () => {
    const { service, executeCommandCalls } = makeService();
    await service.handleSettingsAction({ action: "open-extension-settings" });
    assert.deepStrictEqual(executeCommandCalls, [
      { command: "workbench.action.openSettings", args: ["@ext:agendo.agendo"] },
    ]);
  });

  test("open-board executes OpenBoard for todos scope", async () => {
    const { service, executeCommandCalls } = makeService();
    await service.handleSettingsAction({ action: "open-board", scope: "todos" });
    assert.deepStrictEqual(executeCommandCalls, [{ command: Command.OpenBoard, args: [] }]);
  });

  test("open-board executes CodeScanningOpenBoard for code-scanning scope", async () => {
    const { service, executeCommandCalls } = makeService();
    await service.handleSettingsAction({ action: "open-board", scope: "code-scanning" });
    assert.deepStrictEqual(executeCommandCalls, [{ command: Command.CodeScanningOpenBoard, args: [] }]);
  });

  test("open-tree executes extension view command", async () => {
    const { service, executeCommandCalls } = makeService();
    await service.handleSettingsAction({ action: "open-tree" });
    assert.deepStrictEqual(executeCommandCalls, [{ command: "workbench.view.extension.agendo", args: [] }]);
  });

  test("check-source/install executes ManageSkill/ManageCanvas and validates component", async () => {
    const { service, executeCommandCalls } = makeService();
    assert.deepStrictEqual(
      await service.handleSettingsAction({ action: "check-source", component: "skill" }),
      { success: true },
    );
    assert.deepStrictEqual(executeCommandCalls, [{ command: Command.ManageSkill, args: [] }]);
    assert.deepStrictEqual(
      await service.handleSettingsAction({ action: "install", component: "canvas" }),
      { success: true },
    );
    assert.deepStrictEqual(executeCommandCalls, [
      { command: Command.ManageSkill, args: [] },
      { command: Command.ManageCanvas, args: [] },
    ]);
    await assert.rejects(service.handleSettingsAction({ action: "check-source", component: "bogus" }));
    assert.strictEqual(executeCommandCalls.length, 2);
  });

  test("set-view-mode validates enum and writes workspace setting", async () => {
    const { service, setCalls } = makeService();
    await assert.rejects(service.handleSettingsAction({ action: "set-view-mode", value: "bogus" }));
    assert.strictEqual(setCalls.length, 0);

    await service.handleSettingsAction({ action: "set-view-mode", value: "canvas" });
    assert.deepStrictEqual(setCalls, [{ key: "viewMode", value: "canvas" }]);
  });

  test("set-group-by validates enum and retains scope fallback for old links", async () => {
    const { service, setCalls } = makeService();
    await assert.rejects(service.handleSettingsAction({ action: "set-group-by", value: "bogus" }));
    assert.strictEqual(setCalls.length, 0);

    await service.handleSettingsAction({ action: "set-group-by", value: "priority" });
    assert.deepStrictEqual(setCalls, [{ key: "groupBy", value: "priority" }]);

    // scope fallback for old links when value absent
    await service.handleSettingsAction({ action: "set-group-by", scope: "none" });
    assert.deepStrictEqual(setCalls, [
      { key: "groupBy", value: "priority" },
      { key: "groupBy", value: "none" },
    ]);

    // malformed provided value rejected, no fallback
    await assert.rejects(service.handleSettingsAction({ action: "set-group-by", value: 123 }));
    assert.strictEqual(setCalls.length, 2);
  });

  test("set-sort-by-date requires boolean, not string", async () => {
    const { service, setCalls } = makeService();
    await assert.rejects(service.handleSettingsAction({ action: "set-sort-by-date", value: "true" }));
    assert.strictEqual(setCalls.length, 0);

    await service.handleSettingsAction({ action: "set-sort-by-date", value: true });
    assert.deepStrictEqual(setCalls, [{ key: "sortByDate", value: true }]);
  });

  test("set-code-scanning-sort-by-date requires boolean", async () => {
    const { service, setCalls } = makeService();
    await assert.rejects(service.handleSettingsAction({
      action: "set-code-scanning-sort-by-date",
      value: 1,
    }));
    assert.strictEqual(setCalls.length, 0);
  });

  test("set-root requires relative path and writes workspace + refreshes", async () => {
    const { service, setCalls, config, repository, treeProvider } = makeService();
    await assert.rejects(service.handleSettingsAction({ action: "set-root", value: "/abs" }));
    await assert.rejects(service.handleSettingsAction({ action: "set-root", value: "../x" }));
    await assert.rejects(service.handleSettingsAction({ action: "set-root", value: "./x" }));
    await assert.rejects(service.handleSettingsAction({ action: "set-root", value: "C:\\foo" }));
    await assert.rejects(service.handleSettingsAction({ action: "set-root", value: "   " }));
    assert.strictEqual(setCalls.length, 0);

    await service.handleSettingsAction({ action: "set-root", value: "docs/todos" });
    await service.handleSettingsAction({ action: "set-root", value: "a/b" });
    assert.deepStrictEqual(setCalls, [
      { key: "root", value: "docs/todos" },
      { key: "root", value: "a/b" },
    ]);
    assert.strictEqual(config.writeConfigFileCalls, 2);
    assert.strictEqual(repository.refreshCalls, 2);
    assert.strictEqual(treeProvider.refreshCalls, 0);
  });

  test("set-gitignored writes workspace and applies gitignore", async () => {
    const { service, setCalls, config } = makeService();
    await service.handleSettingsAction({ action: "set-gitignored", value: false });
    assert.deepStrictEqual(setCalls, [{ key: "gitignoreTodos", value: false }]);
    assert.strictEqual(config.applyGitignoreCalls, 1);
  });

  test("set-default-root writes global (setDefault), not workspace", async () => {
    const { service, setCalls, setDefaultCalls } = makeService();
    await service.handleSettingsAction({ action: "set-default-root", value: "docs/todos" });
    assert.deepStrictEqual(setDefaultCalls, [{ key: "root", value: "docs/todos" }]);
    assert.strictEqual(setCalls.length, 0);
  });

  test("set-default-priority validates enum and writes global", async () => {
    const { service, setDefaultCalls } = makeService();
    await assert.rejects(service.handleSettingsAction({ action: "set-default-priority", value: "p4" }));
    assert.strictEqual(setDefaultCalls.length, 0);

    await service.handleSettingsAction({ action: "set-default-priority", value: "p1" });
    assert.deepStrictEqual(setDefaultCalls, [{ key: "defaultPriority", value: "p1" }]);
  });

  test("set-default-preview validates enum and writes global", async () => {
    const { service, setDefaultCalls } = makeService();
    await assert.rejects(service.handleSettingsAction({ action: "set-default-preview", value: "bogus" }));
    assert.strictEqual(setDefaultCalls.length, 0);

    await service.handleSettingsAction({ action: "set-default-preview", value: "editor" });
    assert.deepStrictEqual(setDefaultCalls, [{ key: "viewMode", value: "editor" }]);
  });

  test("set-board-status-visibility isolates scopes and validates", async () => {
    const { service, board, scanning } = makeService();
    await assert.rejects(service.handleSettingsAction({
      action: "set-board-status-visibility",
      value: true,
      scope: "bogus",
      status: "pending",
    }));
    await assert.rejects(service.handleSettingsAction({
      action: "set-board-status-visibility",
      value: true,
      scope: "todos",
      status: "bogus",
    }));
    await assert.rejects(service.handleSettingsAction({
      action: "set-board-status-visibility",
      value: "yes",
      scope: "todos",
      status: "pending",
    }));

    await service.handleSettingsAction({
      action: "set-board-status-visibility",
      value: false,
      scope: "todos",
      status: "cancelled",
    });
    await service.handleSettingsAction({
      action: "set-board-status-visibility",
      value: true,
      scope: "code-scanning",
      status: "completed",
    });

    assert.deepStrictEqual(board.setStatusVisibilityCalls, [
      { scope: "todos", status: "cancelled", visible: false },
    ]);
    assert.deepStrictEqual(scanning.setStatusVisibilityCalls, [
      { scope: "code-scanning", status: "completed", visible: true },
    ]);
  });

  test("getSettingsInfo boards reflect per-scope persisted hidden statuses", async () => {
    const { service, board, scanning } = makeService();
    board.getHiddenStatuses = () => ["cancelled"];
    scanning.getHiddenStatuses = () => ["completed", "cancelled"];

    const info = await service.getSettingsInfo();
    assert.deepStrictEqual(info.boards, [
      { scope: "todos", hiddenStatuses: ["cancelled"] },
      { scope: "code-scanning", hiddenStatuses: ["completed", "cancelled"] },
    ]);
  });

  test("getSettingsInfo exposes sonar and update-source fields", async () => {
    const { service } = makeService({
      globalValues: {},
    });
    // values map is empty so get returns undefined; cast to expected types via the fake get
    const info = await service.getSettingsInfo();
    assert.strictEqual(info.workspace.sonarQubeUrl, undefined);
    assert.strictEqual(info.workspace.sonarQubeProjectKey, undefined);
    assert.strictEqual(info.viewOptions.skillUpdateCheck, undefined);
    assert.strictEqual(info.viewOptions.skillUpdateSource, undefined);
    assert.strictEqual(info.viewOptions.canvasUpdateSource, undefined);
  });

  test("defaults reflect global values with package fallbacks", async () => {
    const { service } = makeService({
      globalValues: { root: "custom/root", defaultPriority: "p1", viewMode: "editor" },
    });
    const info = await service.getSettingsInfo();
    assert.deepStrictEqual(info.defaults, {
      root: "custom/root",
      priority: "p1",
      viewMode: "editor",
    });
  });

  test("defaults fall back to package values when not globally configured", async () => {
    const { service } = makeService({ globalValues: {} });
    const info = await service.getSettingsInfo();
    assert.deepStrictEqual(info.defaults, {
      root: "docs/todos",
      priority: "p3",
      viewMode: "default",
    });
  });

  test("defaults use global values even when workspace overrides exist", async () => {
    const { service } = makeService({
      globalValues: { root: "global/root", defaultPriority: "p1", viewMode: "canvas" },
    });
    // values map simulates workspace overrides being read by `get`.
    // `get` is injected and returns values map; here it's empty so workspace reads undefined.
    // The point: defaults come from globalValue (inspect.globalValue), not workspace.
    const info = await service.getSettingsInfo();
    assert.deepStrictEqual(info.defaults, {
      root: "global/root",
      priority: "p1",
      viewMode: "canvas",
    });
  });

  test("toggle-criteria-changes alias flips workspace setting", async () => {
    const { service, setCalls } = makeService();
    await service.handleSettingsAction({ action: "toggle-criteria-changes" });
    assert.deepStrictEqual(setCalls, [{ key: "criteriaChanges.enabled", value: true }]);
    await service.handleSettingsAction({ action: "toggle-criteria-changes" });
    assert.deepStrictEqual(setCalls, [
      { key: "criteriaChanges.enabled", value: true },
      { key: "criteriaChanges.enabled", value: false },
    ]);
  });

  test("set-criteria-changes-enabled sets explicit boolean idempotently", async () => {
    const { service, setCalls } = makeService();
    await service.handleSettingsAction({ action: "set-criteria-changes-enabled", value: true });
    assert.deepStrictEqual(setCalls, [{ key: "criteriaChanges.enabled", value: true }]);
    await service.handleSettingsAction({ action: "set-criteria-changes-enabled", value: true });
    assert.deepStrictEqual(setCalls, [
      { key: "criteriaChanges.enabled", value: true },
      { key: "criteriaChanges.enabled", value: true },
    ]);
    await assert.rejects(service.handleSettingsAction({ action: "set-criteria-changes-enabled", value: "yes" }));
    assert.strictEqual(setCalls.length, 2);
  });

  test("set-sonarqube-url validates Sonar URL and allows empty", async () => {
    const { service, setCalls } = makeService();
    await service.handleSettingsAction({ action: "set-sonarqube-url", value: "" });
    assert.deepStrictEqual(setCalls, [{ key: "codeScanning.sonarqube.url", value: "" }]);

    await service.handleSettingsAction({ action: "set-sonarqube-url", value: "https://sonar.example.com" });
    assert.deepStrictEqual(setCalls, [
      { key: "codeScanning.sonarqube.url", value: "" },
      { key: "codeScanning.sonarqube.url", value: "https://sonar.example.com" },
    ]);

    await assert.rejects(service.handleSettingsAction({ action: "set-sonarqube-url", value: "http://evil.com" }));
    await assert.rejects(service.handleSettingsAction({ action: "set-sonarqube-url", value: "https://evil.com?x=1" }));
    // no writes on rejection
    assert.strictEqual(setCalls.length, 2);
  });

  test("set-sonarqube-project-key writes workspace setting", async () => {
    const { service, setCalls } = makeService();
    await service.handleSettingsAction({ action: "set-sonarqube-project-key", value: "my-project" });
    assert.deepStrictEqual(setCalls, [{ key: "codeScanning.sonarqube.projectKey", value: "my-project" }]);
  });

  test("set-skill-update-check requires boolean", async () => {
    const { service, setCalls } = makeService();
    await assert.rejects(service.handleSettingsAction({ action: "set-skill-update-check", value: "yes" }));
    assert.strictEqual(setCalls.length, 0);

    await service.handleSettingsAction({ action: "set-skill-update-check", value: false });
    assert.deepStrictEqual(setCalls, [{ key: "skillUpdateCheck", value: false }]);
  });

  test("set-skill-update-source requires HTTPS URL or empty", async () => {
    const { service, setCalls } = makeService();
    await service.handleSettingsAction({ action: "set-skill-update-source", value: "" });
    assert.deepStrictEqual(setCalls, [{ key: "skillUpdateSource", value: "" }]);

    await service.handleSettingsAction({ action: "set-skill-update-source", value: "https://raw.githubusercontent.com/x/y" });
    assert.deepStrictEqual(setCalls, [
      { key: "skillUpdateSource", value: "" },
      { key: "skillUpdateSource", value: "https://raw.githubusercontent.com/x/y" },
    ]);

    await assert.rejects(service.handleSettingsAction({ action: "set-skill-update-source", value: "http://evil.com" }));
    assert.strictEqual(setCalls.length, 2);
  });

  test("set-canvas-update-source requires HTTPS URL or empty", async () => {
    const { service, setCalls } = makeService();
    await service.handleSettingsAction({ action: "set-canvas-update-source", value: "https://raw.githubusercontent.com/x/y" });
    assert.deepStrictEqual(setCalls, [{ key: "canvasUpdateSource", value: "https://raw.githubusercontent.com/x/y" }]);

    await assert.rejects(service.handleSettingsAction({ action: "set-canvas-update-source", value: "ftp://evil.com" }));
    assert.strictEqual(setCalls.length, 1);
  });
});
