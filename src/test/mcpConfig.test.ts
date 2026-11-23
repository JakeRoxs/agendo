import * as assert from "node:assert";
import * as vscode from "vscode";
import { registerCommands } from "../commandRegistration";
import { Command } from "../commands";

suite("McpConfig commands", () => {
  const restores: Array<() => void> = [];
  function mock<T>(target: object, key: string, value: unknown) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, value });
    restores.push(() => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
    });
  }
  teardown(() => {
    for (const restore of restores.reverse()) restore();
    restores.length = 0;
  });

  function setup() {
    const captured: Array<{ command: string; callback: () => void }> = [];
    mock(vscode.commands, "registerCommand", (id: string, callback: () => void) => {
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

    const services: any = {
      problemsEndpoint: "/tmp/agendo-problems.sock",
    };
    const context: any = {
      subscriptions: [],
      extensionPath: "/tmp/agendo-test-extension",
    };
    registerCommands(context, services);

    return { captured, openedDocs, shownDocs, infoMessages };
  }

  test("ShowMcpConfig emits generic mcpServers shape", async () => {
    const { captured, openedDocs, shownDocs, infoMessages } = setup();
    const showMcpConfig = captured.find((c) => c.command === Command.ShowMcpConfig)?.callback;
    assert.ok(showMcpConfig, "ShowMcpConfig callback should be registered");
    await showMcpConfig();

    assert.strictEqual(openedDocs.length, 1);
    const config = JSON.parse(openedDocs[0].content);
    const serverArgs = config.mcpServers.agendo.args;
    assert.ok(Array.isArray(serverArgs) && serverArgs.length === 3);
    assert.strictEqual(serverArgs[1], "--endpoint");
    assert.strictEqual(serverArgs[2], "/tmp/agendo-problems.sock");
    assert.ok(
        serverArgs[0].endsWith("server.mjs") || serverArgs[0].endsWith("server.bundle.mjs"),
        `Expected server path to end with server.mjs, got ${serverArgs[0]}`,
    );
    assert.strictEqual(config.mcpServers.agendo.description, "Agendo todo management");
    assert.strictEqual(shownDocs.length, 1);
    assert.strictEqual(infoMessages.length, 1);
    assert.ok(infoMessages[0].includes("diagnostics endpoint"));
  });

  test("ShowKiloMcpConfig emits Kilo-compatible shape", async () => {
    const { captured, openedDocs, shownDocs, infoMessages } = setup();
    const showKiloMcpConfig = captured.find((c) => c.command === Command.ShowKiloMcpConfig)?.callback;
    assert.ok(showKiloMcpConfig, "ShowKiloMcpConfig callback should be registered");
    await showKiloMcpConfig();

    assert.strictEqual(openedDocs.length, 1);
    const config = JSON.parse(openedDocs[0].content);
    const serverArgs = config.mcp.agendo.command;
    assert.ok(Array.isArray(serverArgs) && serverArgs.length === 4);
    assert.strictEqual(serverArgs[0], "node");
    assert.ok(
      serverArgs[1].endsWith("server.mjs") || serverArgs[1].endsWith("server.bundle.mjs"),
      `Expected server path to end with server.mjs, got ${serverArgs[1]}`,
    );
    assert.strictEqual(serverArgs[2], "--endpoint");
    assert.strictEqual(serverArgs[3], "/tmp/agendo-problems.sock");
    assert.strictEqual(config.mcp.agendo.type, "local");
    assert.strictEqual(config.mcp.agendo.enabled, true);
    assert.strictEqual(config.mcp.agendo.description, "Agendo todo management and diagnostics");
    assert.strictEqual(shownDocs.length, 1);
    assert.strictEqual(infoMessages.length, 1);
    assert.ok(infoMessages[0].includes("diagnostics endpoint"));
  });
});
