import * as assert from "node:assert";
import * as vscode from "vscode";
import { get, Settings } from "../configuration";

function mockGetConfiguration(config: {
  get: (key: string) => unknown;
  update: (key: string, value: unknown) => PromiseLike<void>;
  inspect: (key: string) => {
    workspaceFolderValue?: unknown;
    workspaceValue?: unknown;
    globalValue?: unknown;
  } | undefined;
}): () => void {
  const original = vscode.workspace.getConfiguration;
  Object.defineProperty(vscode.workspace, "getConfiguration", {
    value: () => config as unknown as vscode.WorkspaceConfiguration,
    configurable: true,
  });
  return () => {
    Object.defineProperty(vscode.workspace, "getConfiguration", {
      value: original,
      configurable: true,
    });
  };
}

suite("configuration get with folder scope", () => {
  let restore: Array<() => void> = [];

  teardown(() => {
    for (const fn of restore) {
      fn();
    }
    restore = [];
  });

  test("reads workspace-level value when no folder is provided", () => {
    const restoreConfig = mockGetConfiguration({
      get: (key) => (key === Settings.Root ? "workspace/root" : undefined),
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceValue: "workspace/root" }),
    });
    restore.push(restoreConfig);

    const value = get<string>(Settings.Root);
    assert.strictEqual(value, "workspace/root");
  });

  test("reads folder-scoped value when folder is provided", () => {
    const folder = { name: "folder-a", uri: vscode.Uri.file("/path/a"), index: 0 } as unknown as vscode.WorkspaceFolder;
    const restoreConfig = mockGetConfiguration({
      get: (key) => (key === Settings.Root ? "folder/root" : undefined),
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "folder/root" }),
    });
    restore.push(restoreConfig);

    const value = get<string>(Settings.Root, folder);
    assert.strictEqual(value, "folder/root");
  });

  test("falls back to workspace value when folder has no folder-scoped value", () => {
    const folder = { name: "folder-a", uri: vscode.Uri.file("/path/a"), index: 0 } as unknown as vscode.WorkspaceFolder;
    const restoreConfig = mockGetConfiguration({
      get: (key) => (key === Settings.Root ? "workspace/root" : undefined),
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceValue: "workspace/root" }),
    });
    restore.push(restoreConfig);

    const value = get<string>(Settings.Root, folder);
    assert.strictEqual(value, "workspace/root");
  });

  test("reads boolean setting with folder scope", () => {
    const folder = { name: "folder-a", uri: vscode.Uri.file("/path/a"), index: 0 } as unknown as vscode.WorkspaceFolder;
    const restoreConfig = mockGetConfiguration({
      get: (key) => (key === Settings.GitignoreTodos ? false : undefined),
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: false }),
    });
    restore.push(restoreConfig);

    const value = get<boolean>(Settings.GitignoreTodos, folder);
    assert.strictEqual(value, false);
  });

  test("reads default priority with folder scope", () => {
    const folder = { name: "folder-a", uri: vscode.Uri.file("/path/a"), index: 0 } as unknown as vscode.WorkspaceFolder;
    const restoreConfig = mockGetConfiguration({
      get: (key) => (key === Settings.DefaultPriority ? "p1" : undefined),
      update: () => Promise.resolve(),
      inspect: () => ({ workspaceFolderValue: "p1" }),
    });
    restore.push(restoreConfig);

    const value = get<"p1" | "p2" | "p3">(Settings.DefaultPriority, folder);
    assert.strictEqual(value, "p1");
  });
});
