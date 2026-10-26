import * as assert from "node:assert";
import * as fs from "node:fs";
import type { Server } from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { CanvasViewer } from "../todos/canvasViewer";

suite("Native canvas approval lifetime", () => {
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
