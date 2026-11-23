import * as assert from "node:assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as vscode from "vscode";
import { registerCommands } from "../commandRegistration";
import { Command } from "../commands";
import { installMcpServer } from "../mcp/installServer";
import { workspaceDiscoveryDirectory } from "../mcp/workspaceDiscovery";

suite("McpConfig commands", () => {
  const restores: Array<() => void> = [];
  let directory: string;
  setup(async () => {
    directory = await mkdtemp(join(tmpdir(), "agendo-mcp-config-"));
  });
  function mock(target: object, key: string, value: unknown) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, value });
    restores.push(() => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
    });
  }
  teardown(async () => {
    for (const restore of restores.reverse()) restore();
    restores.length = 0;
    await rm(directory, { recursive: true, force: true });
  });

  async function makeContext(version: string, content: string) {
    const extensionPath = join(directory, `agendo-${version}`);
    const bundleDirectory = join(extensionPath, "resources", "mcp");
    await mkdir(bundleDirectory, { recursive: true });
    await writeFile(join(bundleDirectory, "server.bundle.mjs"), content);
    return { extensionPath, globalStorageUri: vscode.Uri.file(join(directory, "global storage")) };
  }

  async function setupCommands() {
    const captured: Array<{ command: string; callback: () => Promise<void> }> = [];
    mock(vscode.commands, "registerCommand", (id: string, callback: () => Promise<void>) => {
      captured.push({ command: id, callback });
      return new vscode.Disposable(() => {});
    });
    const openedDocs: Array<{ content: string }> = [];
    mock(vscode.workspace, "openTextDocument", async (options: any) => {
      openedDocs.push({ content: options.content });
      return { content: "" } as unknown as vscode.TextDocument;
    });
    const shownDocs: Array<{ content: string }> = [];
    mock(vscode.window, "showTextDocument", (doc: any) => {
      shownDocs.push({ content: doc.content });
      return { content: "" } as unknown as vscode.TextDocument;
    });
    const infoMessages: string[] = [];
    mock(vscode.window, "showInformationMessage", (msg: string) => {
      infoMessages.push(msg);
    });
    const warnings: string[] = [];
    mock(vscode.window, "showWarningMessage", (msg: string) => {
      warnings.push(msg);
    });

    const services: any = {};
    const context: any = {
      ...await makeContext("1.0.0", "// MCP server bundle"),
      subscriptions: [],
    };
    registerCommands(context, services);

    const stablePath = join(context.globalStorageUri.fsPath, "mcp", "server.bundle.mjs");
    return { captured, openedDocs, shownDocs, infoMessages, warnings, stablePath };
  }

  test("extension updates replace the bundle at the same storage path", async () => {
    const first = await installMcpServer(await makeContext("1.0.0", "// version one"));
    assert.strictEqual(await readFile(first, "utf8"), "// version one");

    const updatedContext = await makeContext("2.0.0", "// version two");
    assert.strictEqual(await installMcpServer(updatedContext), first);
    assert.strictEqual(await readFile(first, "utf8"), "// version two");
    assert.strictEqual(await installMcpServer(updatedContext), first);
  });

  test("ShowMcpConfig emits generic mcpServers shape without endpoint or discovery args", async () => {
    const { captured, openedDocs, shownDocs, infoMessages, stablePath } = await setupCommands();
    const showMcpConfig = captured.find((c) => c.command === Command.ShowMcpConfig)?.callback;
    assert.ok(showMcpConfig, "ShowMcpConfig callback should be registered");
    await showMcpConfig();

    assert.strictEqual(openedDocs.length, 1);
    const config = JSON.parse(openedDocs[0].content);
    const serverArgs = config.mcpServers.agendo.args;
    assert.ok(Array.isArray(serverArgs) && serverArgs.length === 1);
    assert.strictEqual(serverArgs[0], stablePath);
    assert.strictEqual(config.mcpServers.agendo.command, "node");
    assert.strictEqual(config.mcpServers.agendo.description, "Agendo todo management");
    assert.strictEqual(config.mcpServers.agendo.environment, undefined);
    assert.strictEqual(shownDocs.length, 1);
    assert.strictEqual(infoMessages.length, 1);
    assert.ok(infoMessages[0].includes("no workspace, socket, or PID values"));
  });

  test("ShowKiloMcpConfig emits generic Kilo shape without workspace or host PID", async () => {
    const { captured, openedDocs, shownDocs, infoMessages, warnings, stablePath } = await setupCommands();
    const showKiloMcpConfig = captured.find((c) => c.command === Command.ShowKiloMcpConfig)?.callback;
    assert.ok(showKiloMcpConfig, "ShowKiloMcpConfig callback should be registered");
    await showKiloMcpConfig();

    assert.strictEqual(openedDocs.length, 1);
    assert.strictEqual(warnings.length, 0);
    const config = JSON.parse(openedDocs[0].content);
    const kilo = config.mcp.agendo;
    assert.strictEqual(kilo.type, "local");
    assert.deepStrictEqual(kilo.command, ["node", stablePath]);
    assert.strictEqual(kilo.enabled, true);
    assert.strictEqual(kilo.environment, undefined);
    assert.strictEqual(kilo.description, "Agendo todo management and diagnostics");
    assert.strictEqual(shownDocs.length, 1);
    assert.strictEqual(infoMessages.length, 1);
    assert.ok(infoMessages[0].includes("KILO_PARENT_PID"));
    assert.ok(infoMessages[0].includes("no workspace, socket, or PID values"));
  });

  test("both config formats are generic with no endpoint, discovery, or host PID values", async () => {
    const { captured, openedDocs, infoMessages, stablePath } = await setupCommands();
    for (const command of [Command.ShowMcpConfig, Command.ShowKiloMcpConfig]) {
      const entry = captured.find((item) => item.command === command);
      assert.ok(entry);
      await entry.callback();
    }
    const generic = JSON.parse(openedDocs[0].content).mcpServers.agendo;
    const kilo = JSON.parse(openedDocs[1].content).mcp.agendo;
    assert.deepStrictEqual(generic.args, [stablePath]);
    assert.strictEqual(generic.command, "node");
    assert.strictEqual(generic.environment, undefined);
    assert.deepStrictEqual(kilo.command, ["node", stablePath]);
    assert.strictEqual(kilo.type, "local");
    assert.strictEqual(kilo.enabled, true);
    assert.strictEqual(kilo.environment, undefined);
    assert.ok(infoMessages[0].includes("no workspace, socket, or PID values"));
    assert.ok(infoMessages[1].includes("KILO_PARENT_PID"));
  });

  test("an untitled workspace with a local folder uses the same discovery key as the folder", () => {
    const context = { globalStorageUri: vscode.Uri.file(directory) } as vscode.ExtensionContext;
    const local = { uri: vscode.Uri.file(join(directory, "project")), name: "project", index: 0 };
    mock(vscode.workspace, "workspaceFolders", [local]);
    mock(vscode.workspace, "workspaceFile", undefined);
    const standalone = workspaceDiscoveryDirectory(context);
    assert.ok(standalone);
    mock(vscode.workspace, "workspaceFile", vscode.Uri.parse("untitled:workspace"));
    assert.strictEqual(workspaceDiscoveryDirectory(context), standalone);
    mock(vscode.workspace, "workspaceFolders", []);
    assert.strictEqual(workspaceDiscoveryDirectory(context), undefined);
  });

  test("a local folder can use VS Code's user-data storage URI for discovery", () => {
    const storage = vscode.Uri.file(directory);
    mock(vscode.workspace, "workspaceFile", undefined);
    mock(vscode.workspace, "workspaceFolders", [{ uri: vscode.Uri.file(join(directory, "project")) }]);
    const fileDirectory = workspaceDiscoveryDirectory({ globalStorageUri: storage } as vscode.ExtensionContext);
    assert.ok(fileDirectory);
    assert.strictEqual(workspaceDiscoveryDirectory({
      globalStorageUri: storage.with({ scheme: "vscode-userdata" }),
    } as vscode.ExtensionContext), fileDirectory);
  });
});
