import * as assert from "node:assert";
import * as vscode from "vscode";
import type { SkillManager } from "../todos/skillManager";
import type { CanvasManager } from "../todos/canvasManager";
import {
  CANVAS_NOTIFIED_VERSION_KEY,
  getNotifiedBundledVersion,
  recordNotifiedBundledVersion,
  SKILL_NOTIFIED_VERSION_KEY,
} from "../updateNotification";
import { promptForCanvasUpdate, promptForSkillUpdate } from "../extension";
import { Command } from "../commands";

function mock(target: object, key: string, value: unknown, restore: Array<() => void> = []) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  restore.push(() => {
    if (descriptor) Object.defineProperty(target, key, descriptor);
  });
}

/** In-memory memento backed by a map, mirroring context.globalState semantics. */
function makeContext(store: Map<string, unknown>): vscode.ExtensionContext {
  return {
    globalState: {
      get: (key: string) => store.get(key),
      update: async (key: string, value: unknown) => {
        store.set(key, value);
        return true;
      },
    } as unknown as vscode.Memento,
  } as vscode.ExtensionContext;
}

/** A manager whose status is fully controllable. */
function makeManager(status: {
  updateAvailable: boolean;
  bundledVersion?: string;
  installedVersion?: string;
}) {
  return {
    getStatus: async () => status,
  };
}

const showInformationMessageCalls: string[] = [];
let showInformationMessageResult: string | undefined;

function setupShowInformationMessage(result: string | undefined): () => void {
  const restore: Array<() => void> = [];
  showInformationMessageCalls.length = 0;
  showInformationMessageResult = result;
  mock(
    vscode.window,
    "showInformationMessage",
    async (_message: string, ..._items: unknown[]) => {
      showInformationMessageCalls.push(_message);
      return showInformationMessageResult;
    },
    restore,
  );
  return () => {
    for (const fn of restore) {
      fn();
    }
    restore.length = 0;
  };
}

const executeCommandCalls: string[] = [];
function setupExecuteCommand(): () => void {
  const restore: Array<() => void> = [];
  executeCommandCalls.length = 0;
  mock(
    vscode.commands,
    "executeCommand",
    async (_command: string) => {
      executeCommandCalls.push(_command);
      return undefined;
    },
    restore,
  );
  return () => {
    for (const fn of restore) {
      fn();
    }
    restore.length = 0;
  };
}

suite("update notification suppression", () => {
  let restore: Array<() => void> = [];

  teardown(() => {
    for (const fn of restore) {
      fn();
    }
    restore = [];
  });

  test("getNotifiedBundledVersion returns undefined when nothing is recorded", async () => {
    const context = makeContext(new Map());
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), undefined);
    assert.strictEqual(await getNotifiedBundledVersion(context, CANVAS_NOTIFIED_VERSION_KEY), undefined);
  });

  test("recordNotifiedBundledVersion is readable back via getNotifiedBundledVersion", async () => {
    const context = makeContext(new Map());
    await recordNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY, "1.8.0");
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), "1.8.0");
    assert.strictEqual(await getNotifiedBundledVersion(context, CANVAS_NOTIFIED_VERSION_KEY), undefined);
  });

  test("skill and canvas keys are independent", async () => {
    const context = makeContext(new Map());
    await recordNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY, "1.8.0");
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), "1.8.0");
    assert.strictEqual(await getNotifiedBundledVersion(context, CANVAS_NOTIFIED_VERSION_KEY), undefined);
    await recordNotifiedBundledVersion(context, CANVAS_NOTIFIED_VERSION_KEY, "2.1.0");
    assert.strictEqual(await getNotifiedBundledVersion(context, CANVAS_NOTIFIED_VERSION_KEY), "2.1.0");
    // Skill key unaffected by canvas write.
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), "1.8.0");
  });

  test("skill: first activation with bundled newer than installed shows once and records", async () => {
    const context = makeContext(new Map());
    const show = setupShowInformationMessage("Review Versions");
    const execute = setupExecuteCommand();
    const skill = makeManager({
      updateAvailable: true,
      bundledVersion: "1.8.0",
      installedVersion: "1.7.0",
    });

    await promptForSkillUpdate(context, skill as unknown as SkillManager);

    assert.strictEqual(showInformationMessageCalls.length, 1);
    assert.strictEqual(showInformationMessageCalls[0], "Agendo skill: installed v1.7.0; bundled v1.8.0 (included in this extension) is newer. GitHub/source has not been checked.");
    assert.strictEqual(executeCommandCalls.length, 1);
    assert.strictEqual(executeCommandCalls[0], Command.ManageSkill);
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), "1.8.0");
    show();
    execute();
  });

  test("skill: subsequent activation with same bundled version does not show again", async () => {
    const context = makeContext(new Map([[SKILL_NOTIFIED_VERSION_KEY, "1.8.0"]]));
    const show = setupShowInformationMessage("Review Versions");
    const skill = makeManager({
      updateAvailable: true,
      bundledVersion: "1.8.0",
      installedVersion: "1.7.0",
    });

    await promptForSkillUpdate(context, skill as unknown as SkillManager);

    assert.strictEqual(showInformationMessageCalls.length, 0);
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), "1.8.0");
    show();
  });

  test("skill: newer bundled version notifies again even though a previous version was recorded", async () => {
    const context = makeContext(new Map([[SKILL_NOTIFIED_VERSION_KEY, "1.8.0"]]));
    const show = setupShowInformationMessage("Review Versions");
    const execute = setupExecuteCommand();
    const skill = makeManager({
      updateAvailable: true,
      bundledVersion: "1.9.0",
      installedVersion: "1.8.0",
    });

    await promptForSkillUpdate(context, skill as unknown as SkillManager);

    assert.strictEqual(showInformationMessageCalls.length, 1);
    assert.strictEqual(showInformationMessageCalls[0], "Agendo skill: installed v1.8.0; bundled v1.9.0 (included in this extension) is newer. GitHub/source has not been checked.");
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), "1.9.0");
    show();
    execute();
  });

  test("skill: updateAvailable false means no prompt and nothing recorded", async () => {
    const context = makeContext(new Map());
    const show = setupShowInformationMessage("Review Versions");
    const skill = makeManager({
      updateAvailable: false,
      bundledVersion: "1.8.0",
      installedVersion: "1.8.0",
    });

    await promptForSkillUpdate(context, skill as unknown as SkillManager);

    assert.strictEqual(showInformationMessageCalls.length, 0);
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), undefined);
    show();
  });

  test("skill: dismissal still records the version so the notice is suppressed next time", async () => {
    const context = makeContext(new Map());
    const show = setupShowInformationMessage(undefined); // dismissed
    const skill = makeManager({
      updateAvailable: true,
      bundledVersion: "1.8.0",
      installedVersion: "1.7.0",
    });

    await promptForSkillUpdate(context, skill as unknown as SkillManager);

    assert.strictEqual(showInformationMessageCalls.length, 1);
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), "1.8.0");
    // A second activation with the same bundled version must not show again.
    await promptForSkillUpdate(context, skill as unknown as SkillManager);
    assert.strictEqual(showInformationMessageCalls.length, 1);
    show();
  });

  test("skill: clicking Review Versions executes the manage command and records", async () => {
    const context = makeContext(new Map());
    const show = setupShowInformationMessage("Review Versions");
    const execute = setupExecuteCommand();
    const skill = makeManager({
      updateAvailable: true,
      bundledVersion: "1.8.0",
      installedVersion: "1.7.0",
    });

    await promptForSkillUpdate(context, skill as unknown as SkillManager);

    assert.strictEqual(showInformationMessageCalls.length, 1);
    assert.strictEqual(executeCommandCalls.length, 1);
    assert.strictEqual(executeCommandCalls[0], Command.ManageSkill);
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), "1.8.0");
    show();
    execute();
  });

  test("canvas: first activation with bundled newer than installed shows once and records", async () => {
    const context = makeContext(new Map());
    const show = setupShowInformationMessage("Review Versions");
    const execute = setupExecuteCommand();
    const canvas = makeManager({
      updateAvailable: true,
      bundledVersion: "3.2.0",
      installedVersion: "3.1.0",
    });

    await promptForCanvasUpdate(context, canvas as unknown as CanvasManager);

    assert.strictEqual(showInformationMessageCalls.length, 1);
    assert.strictEqual(
      showInformationMessageCalls[0],
      "Agendo canvas: installed v3.1.0; bundled v3.2.0 (included in this extension) is newer. GitHub/source has not been checked.",
    );
    assert.strictEqual(executeCommandCalls.length, 1);
    assert.strictEqual(executeCommandCalls[0], Command.ManageCanvas);
    assert.strictEqual(await getNotifiedBundledVersion(context, CANVAS_NOTIFIED_VERSION_KEY), "3.2.0");
    show();
    execute();
  });

  test("canvas: subsequent activation with same bundled version does not show again", async () => {
    const context = makeContext(new Map([[CANVAS_NOTIFIED_VERSION_KEY, "3.2.0"]]));
    const show = setupShowInformationMessage("Review Versions");
    const canvas = makeManager({
      updateAvailable: true,
      bundledVersion: "3.2.0",
      installedVersion: "3.1.0",
    });

    await promptForCanvasUpdate(context, canvas as unknown as CanvasManager);

    assert.strictEqual(showInformationMessageCalls.length, 0);
    assert.strictEqual(await getNotifiedBundledVersion(context, CANVAS_NOTIFIED_VERSION_KEY), "3.2.0");
    show();
  });

  test("canvas and skill suppression are independent", async () => {
    const context = makeContext(new Map([[SKILL_NOTIFIED_VERSION_KEY, "1.8.0"]]));
    const show = setupShowInformationMessage("Review Versions");
    const execute = setupExecuteCommand();
    const skill = makeManager({
      updateAvailable: true,
      bundledVersion: "1.8.0",
      installedVersion: "1.7.0",
    });
    const canvas = makeManager({
      updateAvailable: true,
      bundledVersion: "3.2.0",
      installedVersion: "3.1.0",
    });

    // Skill already notified for this bundled version -> suppressed (no show).
    await promptForSkillUpdate(context, skill as unknown as SkillManager);
    assert.strictEqual(showInformationMessageCalls.length, 0);
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), "1.8.0");

    // Canvas not notified for this bundled version -> shows once.
    await promptForCanvasUpdate(context, canvas as unknown as CanvasManager);
    assert.strictEqual(showInformationMessageCalls.length, 1);
    assert.strictEqual(
      showInformationMessageCalls[0],
      "Agendo canvas: installed v3.1.0; bundled v3.2.0 (included in this extension) is newer. GitHub/source has not been checked.",
    );

    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), "1.8.0");
    assert.strictEqual(await getNotifiedBundledVersion(context, CANVAS_NOTIFIED_VERSION_KEY), "3.2.0");
    show();
    execute();
  });

  test("persistence read failure does not suppress the notice", async () => {
    const context = makeContext(new Map());
    const originalGet = context.globalState.get;
    Object.defineProperty(context.globalState, "get", {
      configurable: true,
      value: () => {
        throw new Error("memento read failed");
      },
    });
    const show = setupShowInformationMessage("Review Versions");
    const execute = setupExecuteCommand();
    const skill = makeManager({
      updateAvailable: true,
      bundledVersion: "1.8.0",
      installedVersion: "1.7.0",
    });

    await promptForSkillUpdate(context, skill as unknown as SkillManager);

    assert.strictEqual(showInformationMessageCalls.length, 1);
    // Restore original get so the record can succeed.
    Object.defineProperty(context.globalState, "get", {
      configurable: true,
      value: originalGet,
    });
    assert.strictEqual(await getNotifiedBundledVersion(context, SKILL_NOTIFIED_VERSION_KEY), "1.8.0");
    show();
    execute();
  });
});
