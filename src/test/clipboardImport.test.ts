import * as assert from "node:assert";
import * as vscode from "vscode";
import { importFromClipboard } from "../commandRegistration";

suite("Clipboard import refresh reporting", () => {
  const restores: Array<() => void> = [];
  let errors: string[];
  let warnings: string[];
  let information: string[];
  let writes: number;
  let refreshes: number;
  let writeFailure: Error | undefined;
  let refresh: () => Promise<void>;

  function mock(target: object, key: string, value: unknown) {
    const original = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, value });
    restores.push(() => {
      if (original) Object.defineProperty(target, key, original);
    });
  }
  setup(() => {
    errors = [];
    warnings = [];
    information = [];
    writes = 0;
    refreshes = 0;
    writeFailure = undefined;
    refresh = async () => {};
    mock(vscode.env, "clipboard", {
      readText: async () => "https://github.com/owner/repo/issues/99",
    });
    mock(vscode.window, "showInputBox", async () => "Imported");
    mock(vscode.window, "showInformationMessage", async (message: string) => {
      information.push(message);
    });
    mock(vscode.window, "showWarningMessage", async (message: string) => {
      warnings.push(message);
    });
    mock(vscode.window, "showErrorMessage", async (message: string) => {
      errors.push(message);
    });
    mock(vscode.workspace, "fs", {
      ...vscode.workspace.fs,
      createDirectory: async () => {},
      writeFile: async () => {
        if (writeFailure) throw writeFailure;
        writes++;
      },
    });
  });
  teardown(() => {
    for (const restore of restores.reverse()) restore();
    restores.length = 0;
  });

  function run() {
    return importFromClipboard(
      { getRootUri: () => vscode.Uri.file("/tmp/agendo-clipboard-fixture") } as never,
      {
        getTodos: () => [],
        refresh: async () => {
          refreshes++;
          await refresh();
        },
      } as never,
    );
  }

  test("waits for repository refresh before reporting import success", async () => {
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    refresh = async () => {
      entered();
      await gate;
    };
    let complete = false;
    const action = run().then(() => {
      complete = true;
    });
    await started;
    try {
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.strictEqual(complete, false);
      assert.deepStrictEqual(information, []);
    } finally {
      release();
      await action;
    }
    assert.strictEqual(writes, 1);
    assert.strictEqual(refreshes, 1);
    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(warnings, []);
    assert.deepStrictEqual(information, ["Created todo 001 from owner/repo#99."]);
  });

  test("a refresh rejection reports that the file was created rather than claiming creation failed", async () => {
    refresh = async () => {
      throw new Error("refresh unavailable");
    };
    await run();
    assert.strictEqual(writes, 1);
    assert.strictEqual(refreshes, 1);
    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(information, []);
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /Todo 001 was created, but refreshing the todo list failed/);
    assert.match(warnings[0], /refresh unavailable/);
  });

  test("a real file write failure still reports creation failure without refreshing", async () => {
    writeFailure = new Error("disk unavailable");
    await run();
    assert.strictEqual(writes, 0);
    assert.strictEqual(refreshes, 0);
    assert.deepStrictEqual(information, []);
    assert.deepStrictEqual(warnings, []);
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0], /Failed to create todo: Error: disk unavailable/);
  });
});
