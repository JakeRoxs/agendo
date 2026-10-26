import * as assert from "node:assert";
import * as vscode from "vscode";
import { registerCommands } from "../commandRegistration";
import { Command } from "../commands";

suite("Component version actions", () => {
  const restores: Array<() => void> = [];
  function mock(target: object, key: string, value: unknown) {
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

  for (const component of ["skill", "canvas"] as const) {
    test(`${component}: source is checked before picker and cancel is harmless`, async () => {
      const callbacks = new Map<string, () => Promise<void>>();
      const checked: boolean[] = [];
      let mutations = 0;
      const manager = {
        getStatus: async (check = false) => {
          checked.push(check);
          return {
            installed: true,
            installedVersion: "3.0.0",
            bundledVersion: "1.0.0",
            updateAvailable: false,
            sourceUrl: "https://raw.githubusercontent.com/example/repo/main/component",
            sourceVersion: check ? "2.0.0" : undefined,
          };
        },
        install: async () => {
          mutations++;
        },
        updateFromSource: async () => {
          mutations++;
        },
      };
      mock(vscode.commands, "registerCommand", (id: string, callback: () => Promise<void>) => {
        callbacks.set(id, callback);
        return new vscode.Disposable(() => {});
      });
      mock(
        vscode.window,
        "showQuickPick",
        async (
          _items: Array<{ label: string; detail?: string; action: string }>,
          options?: { title?: string },
        ) => {
          assert.ok(options?.title?.includes("installed v3.0.0"));
          assert.ok(options?.title?.includes("bundled v1.0.0"));
          assert.ok(options?.title?.includes("source v2.0.0"));
          return undefined;
        },
      );
      registerCommands(
        { subscriptions: [] } as never,
        { skill: manager, canvas: manager } as never,
      );
      await callbacks.get(component === "skill" ? Command.ManageSkill : Command.ManageCanvas)?.();
      assert.deepStrictEqual(checked, [true]);
      assert.strictEqual(mutations, 0);
    });

    test(`${component}: explicit bundled replacement proceeds without extra confirmation`, async () => {
      const callbacks = new Map<string, () => Promise<void>>();
      let mutations = 0;
      const manager = {
        getStatus: async () => ({
          installed: true,
          installedVersion: "3.0.0",
          bundledVersion: "1.0.0",
          updateAvailable: false,
        }),
        install: async () => {
          mutations++;
        },
      };
      mock(vscode.commands, "registerCommand", (id: string, callback: () => Promise<void>) => {
        callbacks.set(id, callback);
        return new vscode.Disposable(() => {});
      });
      const busy = { run: async (_label: string, fn: () => Promise<void>) => fn() };
      registerCommands(
        { subscriptions: [] } as never,
        { skill: manager, canvas: manager, busy } as never,
      );
      await callbacks.get(component === "skill" ? Command.EnableSkill : Command.InstallCanvas)?.();
      assert.strictEqual(mutations, 1);
    });
  }
});
