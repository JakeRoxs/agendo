import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { registerCommands } from "../commandRegistration";
import { Command } from "../commands";
import type { SkillStatus } from "../todos/skillManager";
import { SkillStatusTreeProvider } from "../todos/skillStatusTreeProvider";

suite("Skill panel refresh", () => {
  const restores: Array<() => void> = [];
  let callbacks: Map<string, () => Promise<void>>;
  let info: string[];
  let warnings: string[];
  let calls: boolean[];
  let refreshes: number;
  let loadingKey: string | undefined;
  let status: SkillStatus;
  let getSkill: () => Promise<SkillStatus>;

  function mock(target: object, key: string, value: unknown) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, value });
    restores.push(() => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
    });
  }

  setup(() => {
    callbacks = new Map();
    info = [];
    warnings = [];
    calls = [];
    refreshes = 0;
    status = {
      installed: true,
      installedVersion: "2.0.0",
      bundledVersion: "1.0.0",
      sourceVersion: "2.0.0",
      updateAvailable: false,
    };
    getSkill = async () => status;
    mock(vscode.commands, "registerCommand", (id: string, callback: () => Promise<void>) => {
      callbacks.set(id, callback);
      return new vscode.Disposable(() => {});
    });
    mock(vscode.window, "showInformationMessage", async (text: string) => {
      info.push(text);
    });
    mock(vscode.window, "showWarningMessage", async (text: string) => {
      warnings.push(text);
    });
    const noInstall = () => {
      assert.fail("Refresh must never install files");
    };
    registerCommands(
      { subscriptions: [] } as never,
      {
        skill: {
          getStatus: (fresh: boolean) => {
            calls.push(fresh);
            return getSkill();
          },
          install: noInstall,
          updateFromSource: noInstall,
        },
        canvas: {
          getStatus: async (fresh: boolean) => {
            calls.push(fresh);
            return status;
          },
          install: noInstall,
          updateFromSource: noInstall,
        },
        refreshSkillStatus: () => {
          refreshes++;
        },
        busy: {
          run: async (_label: string, operation: () => Promise<void>, key: string) => {
            loadingKey = key;
            return operation();
          },
        },
      } as never,
    );
  });
  teardown(() => {
    for (const restore of restores.reverse()) restore();
    restores.length = 0;
  });

  test("checks both components explicitly without installing and reports newer local copy correctly", async () => {
    await callbacks.get(Command.RefreshComponents)?.();
    assert.deepStrictEqual(calls, [true, true]);
    assert.strictEqual(loadingKey, "agendo.componentsChecking");
    assert.strictEqual(refreshes, 1);
    assert.match(info[0], /No newer versions found/);
    assert.match(info[0], /installed is newer/);
    assert.strictEqual(warnings.length, 0);
  });

  test("counts components with newer source versions", async () => {
    status = { ...status, sourceVersion: "3.0.0" };
    await callbacks.get(Command.RefreshComponents)?.();
    assert.match(info[0], /2 component\(s\) have newer versions available/);
  });

  test("source failures warn rather than claiming all versions are up to date", async () => {
    status = { ...status, sourceVersion: undefined, sourceError: "Source unavailable" };
    await callbacks.get(Command.RefreshComponents)?.();
    assert.strictEqual(info.length, 0);
    assert.match(warnings[0], /could not be checked/);
    assert.match(warnings[0], /source unavailable/);
  });

  test("prevents duplicate concurrent checks and accepts a later refresh", async () => {
    let release!: (value: SkillStatus) => void;
    getSkill = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const first = callbacks.get(Command.RefreshComponents)?.();
    await callbacks.get(Command.RefreshComponents)?.();
    assert.deepStrictEqual(calls, [true, true]);
    release(status);
    await first;
    getSkill = async () => status;
    await callbacks.get(Command.RefreshComponents)?.();
    assert.strictEqual(calls.length, 4);
  });

  test("panel displays the last checked source version without another remote check", async () => {
    const provider = new SkillStatusTreeProvider(
      { getStatus: async () => ({ ...status, sourceVersion: "3.0.0" }) } as never,
      { viewMode: "preview" } as never,
      { getStatus: async () => status } as never,
    );
    const [node] = await provider.getChildren();
    const item = provider.getTreeItem(node);
    assert.strictEqual(item.description, "Source v3.0.0 available");
    assert.match(String(item.tooltip), /last checked v3.0.0/);
    assert.strictEqual(item.command?.command, Command.ManageSkill);
  });

  test("manifest exposes refresh and disabled loading state only on the Skill toolbar", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf8"),
    );
    const toolbar = manifest.contributes.menus["view/title"];
    for (const id of [Command.RefreshComponents, Command.RefreshComponentsLoading]) {
      const item = toolbar.find((entry: { command: string }) => entry.command === id);
      assert.ok(item);
      assert.match(item.when, /view == agendo.skillStatus/);
      assert.match(item.group, /navigation/);
    }
    const loading = manifest.contributes.commands.find(
      (entry: { command: string }) => entry.command === Command.RefreshComponentsLoading,
    );
    assert.strictEqual(loading.enablement, "false");
  });
});
