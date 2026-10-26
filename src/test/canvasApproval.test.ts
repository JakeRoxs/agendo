import * as assert from "node:assert";
import * as fs from "node:fs";
import type { Server } from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { CanvasViewer } from "../todos/canvasViewer";

suite("Native canvas approval lifetime", () => {
  test("recreates a disposed canvas panel when opening another view", () => {
    const viewer = new CanvasViewer(vscode.Uri.file(path.resolve(__dirname, "../..")));
    const state = viewer as unknown as {
      panel?: vscode.WebviewPanel;
      show(url: string): void;
    };
    const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
    const panelControls: Array<{ markDisposed(): void; fireDispose(): void }> = [];
    let created = 0;
    const createPanel = (): vscode.WebviewPanel => {
      let disposed = false;
      let disposeListener: (() => void) | undefined;
      let html = "";
      const panel = {
        title: "Agendo",
        webview: {
          get html() {
            return html;
          },
          set html(value: string) {
            if (disposed) throw new Error("Webview is disposed");
            html = value;
          },
          onDidReceiveMessage: () => new vscode.Disposable(() => {}),
          postMessage: async () => true,
        },
        iconPath: undefined,
        onDidDispose: (listener: () => void) => {
          disposeListener = listener;
          return new vscode.Disposable(() => {});
        },
        reveal: () => {},
        dispose: () => {
          disposed = true;
          disposeListener?.();
        },
      } as unknown as vscode.WebviewPanel;
      panelControls.push({
        markDisposed: () => {
          disposed = true;
        },
        fireDispose: () => disposeListener?.(),
      });
      return panel;
    };

    Object.defineProperty(vscode.window, "createWebviewPanel", {
      configurable: true,
      value: () => {
        created += 1;
        return createPanel();
      },
    });
    try {
      state.show("http://localhost:3000/");
      const oldPanel = state.panel;
      assert.ok(oldPanel);
      panelControls[0].markDisposed();
      state.show("http://localhost:3000/");
      const replacement = state.panel;
      assert.strictEqual(created, 2);
      assert.ok(replacement);
      assert.notStrictEqual(replacement, oldPanel);
      assert.strictEqual(panelControls.length, 2);
      panelControls[0].fireDispose();
      assert.strictEqual(state.panel, replacement, "late disposal must not clear the replacement");
    } finally {
      viewer.dispose();
      Object.defineProperty(vscode.window, "createWebviewPanel", {
        configurable: true,
        value: originalCreateWebviewPanel,
      });
    }
  });

  test("closing the panel revokes auto-approval while preserving the todo and review session", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agendo-approval-viewer-"));
    const directory = path.join(root, "docs", "todos");
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, "001-pending-p2-first.md");
    const content = "---\nstatus: pending\npriority: p2\n---\n# First\n\n## Acceptance Criteria\n\n- [ ] Done\n";
    fs.writeFileSync(file, content);
    const viewer = new CanvasViewer(vscode.Uri.file(path.resolve(__dirname, "../..")), {
      assertWritable: async () => {},
    });
    const state = viewer as unknown as {
      entry?: {
        server: Server;
        approval: {
          setPolicy(policy: { mode: "auto"; scope: "workspace" }): unknown;
          getPolicy(): { mode: string };
        };
      };
      panel?: vscode.WebviewPanel;
    };
    try {
      await viewer.open(root, "001");
      const entry = state.entry;
      const panel = state.panel;
      assert.ok(entry && panel);
      entry.approval.setPolicy({ mode: "auto", scope: "workspace" });
      assert.strictEqual(entry.approval.getPolicy().mode, "auto");
      const closedPanel = new Promise<void>((resolve) => panel.onDidDispose(resolve));
      panel.dispose();
      await closedPanel;
      assert.strictEqual(entry.approval.getPolicy().mode, "manual");
      assert.strictEqual(fs.readFileSync(file, "utf8"), content);
      await viewer.open(root, "001");
      assert.strictEqual(state.entry, entry, "reopening preserves the review store, not auto authorization");
      assert.strictEqual(entry.approval.getPolicy().mode, "manual");
      const stopped = new Promise<void>((resolve) => entry.server.once("close", resolve));
      viewer.dispose();
      entry.server.closeAllConnections();
      await stopped;
    } finally {
      viewer.dispose();
      state.entry?.server.closeAllConnections();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
