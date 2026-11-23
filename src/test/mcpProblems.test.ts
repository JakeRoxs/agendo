import * as assert from "node:assert";
import * as fs from "node:fs";
import * as net from "node:net";
import { tmpdir } from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { DiagnosticsService, ProblemErrorCode } from "../mcp/diagnosticsService";
import type { GetProblemsParams, GetProblemsResult } from "../mcp/diagnosticsService";
import { IpcBridge, windowsNamedPipe } from "../mcp/ipcBridge";

function makeUri(path: string): vscode.Uri {
  return vscode.Uri.file(path);
}

function makeDiagnostic(
  _uri: vscode.Uri,
  message: string,
  severity: vscode.DiagnosticSeverity,
  source?: string,
  code?: string | number,
): vscode.Diagnostic {
  return {
    range: new vscode.Range(0, 0, 1, 5),
    message,
    severity,
    source,
    code,
  };
}

const originalGetDiagnostics = vscode.languages.getDiagnostics;
const originalWorkspaceFolders = vscode.workspace.workspaceFolders;

function mockGetDiagnostics(entries: [vscode.Uri, vscode.Diagnostic[]][]): () => void {
  Object.defineProperty(vscode.languages, "getDiagnostics", {
    value: () => entries,
    configurable: true,
  });
  return () => {
    Object.defineProperty(vscode.languages, "getDiagnostics", {
      value: originalGetDiagnostics,
      configurable: true,
    });
  };
}

function mockWorkspaceFolders(folders: vscode.WorkspaceFolder[]): () => void {
  Object.defineProperty(vscode.workspace, "workspaceFolders", {
    value: folders,
    configurable: true,
  });
  return () => {
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: originalWorkspaceFolders,
      configurable: true,
    });
  };
}

const mockContext: vscode.ExtensionContext = {
  subscriptions: [] as vscode.Disposable[],
} as vscode.ExtensionContext;

async function waitForListening(endpoint: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: Error | undefined;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(endpoint);
        let connected = false;
        socket.on("connect", () => {
          connected = true;
          socket.end();
          resolve();
        });
        socket.on("error", (error) => {
          lastError = error;
          socket.end();
          reject(error);
        });
        socket.on("close", () => {
          if (!connected) resolve();
        });
      });
      return;
    } catch {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError ?? new Error(`Server not listening on ${endpoint}`);
}

function assertConnectionFails(endpoint: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection(endpoint);
    let failed = false;
    socket.on("error", (error) => {
      if (!failed) {
        failed = true;
        const code = (error as { code?: string }).code;
        if (code === "ENOENT" || code === "ECONNREFUSED") {
          resolve();
        } else {
          reject(error);
        }
      }
    });
    socket.on("connect", () => {
      socket.end();
      reject(new Error("connection should not succeed"));
    });
    socket.on("close", () => {
      if (!failed) {
        reject(new Error("connection closed without error"));
      }
    });
    setTimeout(() => {
      if (!failed) {
        reject(new Error("connection attempt timed out"));
      }
    }, 2000);
  });
}

function requestResponse(
  socket: net.Socket,
  request: unknown,
): Promise<{ id: unknown; ok: boolean; result?: unknown; error?: { code: string; message: string } }> {
  return new Promise<{ id: unknown; ok: boolean; result?: unknown; error?: { code: string; message: string } }>(
    (resolve, reject) => {
      let buffer = "";
      const handler = (data: Buffer) => {
        buffer += data.toString("utf8");
        const index = buffer.indexOf("\n");
        if (index !== -1) {
          socket.removeListener("data", handler);
          resolve(
            JSON.parse(buffer.slice(0, index)) as {
              id: unknown;
              ok: boolean;
              result?: unknown;
              error?: { code: string; message: string };
            },
          );
        }
      };
      socket.on("data", handler);
      socket.write(`${JSON.stringify(request)}\n`);
      socket.on("close", () => {
        socket.removeListener("data", handler);
        if (buffer) {
          resolve(
            JSON.parse(buffer) as {
              id: unknown;
              ok: boolean;
              result?: unknown;
              error?: { code: string; message: string };
            },
          );
        } else {
          reject(new Error("no response"));
        }
      });
      socket.on("error", reject);
    },
  );
}

suite("mcpProblems", () => {
  test("getProblems returns all diagnostics for a single root", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([
        [makeUri("/ws/a.ts"), [makeDiagnostic(makeUri("/ws/a.ts"), "x", vscode.DiagnosticSeverity.Error)]],
        [makeUri("/ws/b.ts"), [makeDiagnostic(makeUri("/ws/b.ts"), "y", vscode.DiagnosticSeverity.Warning)]],
      ]),
    ];
    try {
      const service = new DiagnosticsService();
      const result = await service.getProblems({});

      assert.strictEqual(result.workspaceFolder, "ws");
      assert.strictEqual(result.total, 2);
      assert.strictEqual(result.truncated, false);
      assert.strictEqual(result.diagnostics.length, 2);
      assert.strictEqual(result.diagnostics[0].message, "x");
      assert.strictEqual(result.diagnostics[0].severity, "error");
      assert.strictEqual(result.diagnostics[0].path, "a.ts");
      // zero-based (0,0)-(1,5) becomes 1-based (1,1)-(2,6)
      assert.deepStrictEqual(result.diagnostics[0].range, {
        start: { line: 1, character: 1 },
        end: { line: 2, character: 6 },
      });
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems reports a workspace-relative path for nested files", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([
        [makeUri("/ws/sub/c.ts"), [makeDiagnostic(makeUri("/ws/sub/c.ts"), "c", vscode.DiagnosticSeverity.Error)]],
      ]),
    ];
    try {
      const service = new DiagnosticsService();
      const result = await service.getProblems({});
      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.diagnostics[0].path, "sub/c.ts");
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems filters by path (file and directory)", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([
        [makeUri("/ws/a.ts"), [makeDiagnostic(makeUri("/ws/a.ts"), "a", vscode.DiagnosticSeverity.Error)]],
        [makeUri("/ws/sub/c.ts"), [makeDiagnostic(makeUri("/ws/sub/c.ts"), "c", vscode.DiagnosticSeverity.Error)]],
        [makeUri("/ws/b.ts"), [makeDiagnostic(makeUri("/ws/b.ts"), "b", vscode.DiagnosticSeverity.Error)]],
      ]),
    ];
    try {
      const service = new DiagnosticsService();
      // directory path includes nested files
      let result = await service.getProblems({ path: "sub" });
      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.diagnostics[0].message, "c");

      // file path includes only that file
      result = await service.getProblems({ path: "a.ts" });
      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.diagnostics[0].message, "a");
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems filters by severity", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([
        [makeUri("/ws/a.ts"), [makeDiagnostic(makeUri("/ws/a.ts"), "err", vscode.DiagnosticSeverity.Error)]],
        [makeUri("/ws/b.ts"), [makeDiagnostic(makeUri("/ws/b.ts"), "war", vscode.DiagnosticSeverity.Warning)]],
        [makeUri("/ws/c.ts"), [makeDiagnostic(makeUri("/ws/c.ts"), "inf", vscode.DiagnosticSeverity.Information)]],
      ]),
    ];
    try {
      const service = new DiagnosticsService();
      const result = await service.getProblems({ severity: ["error", "warning"] });
      assert.strictEqual(result.total, 2);
      assert.ok(result.diagnostics.every((d) => d.severity === "error" || d.severity === "warning"));
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems applies limit and truncation", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([
        [makeUri("/ws/a.ts"), [makeDiagnostic(makeUri("/ws/a.ts"), "d", vscode.DiagnosticSeverity.Error)]],
        [makeUri("/ws/b.ts"), [makeDiagnostic(makeUri("/ws/b.ts"), "d", vscode.DiagnosticSeverity.Error)]],
        [makeUri("/ws/c.ts"), [makeDiagnostic(makeUri("/ws/c.ts"), "d", vscode.DiagnosticSeverity.Error)]],
      ]),
    ];
    try {
      const service = new DiagnosticsService();
      const result = await service.getProblems({ limit: 2 });
      assert.strictEqual(result.total, 3);
      assert.strictEqual(result.truncated, true);
      assert.strictEqual(result.diagnostics.length, 2);
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems clamps limit to 1..500", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([]),
    ];
    try {
      const service = new DiagnosticsService();
      await assert.rejects(service.getProblems({ limit: 0 }), (error) => {
        assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.INVALID_PARAMS);
        return true;
      });
      await assert.rejects(service.getProblems({ limit: 501 }), (error) => {
        assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.INVALID_PARAMS);
        return true;
      });
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems requires workspaceFolder for multiple roots", async () => {
    const restore = [
      mockWorkspaceFolders([
        { uri: makeUri("/ws1"), name: "ws1", index: 0 },
        { uri: makeUri("/ws2"), name: "ws2", index: 1 },
      ]),
      mockGetDiagnostics([]),
    ];
    try {
      const service = new DiagnosticsService();
      await assert.rejects(service.getProblems({}), (error) => {
        assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.MULTIPLE_ROOTS_REQUIRED);
        return true;
      });
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems resolves workspaceFolder by name", async () => {
    const restore = [
      mockWorkspaceFolders([
        { uri: makeUri("/ws1"), name: "ws1", index: 0 },
        { uri: makeUri("/ws2"), name: "ws2", index: 1 },
      ]),
      mockGetDiagnostics([
        [makeUri("/ws2/a.ts"), [makeDiagnostic(makeUri("/ws2/a.ts"), "x", vscode.DiagnosticSeverity.Error)]],
      ]),
    ];
    try {
      const service = new DiagnosticsService();
      const result = await service.getProblems({ workspaceFolder: "ws2" });
      assert.strictEqual(result.workspaceFolder, "ws2");
      assert.strictEqual(result.total, 1);
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems rejects unknown workspaceFolder", async () => {
    const restore = [
      mockWorkspaceFolders([
        { uri: makeUri("/ws1"), name: "ws1", index: 0 },
        { uri: makeUri("/ws2"), name: "ws2", index: 1 },
      ]),
      mockGetDiagnostics([]),
    ];
    try {
      const service = new DiagnosticsService();
      await assert.rejects(service.getProblems({ workspaceFolder: "nope" }), (error) => {
        assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.WORKSPACE_NOT_FOUND);
        return true;
      });
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems rejects path traversal", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([]),
    ];
    try {
      const service = new DiagnosticsService();
      await assert.rejects(service.getProblems({ path: "../../etc/passwd" }), (error) => {
        assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.PATH_TRAVERSAL);
        return true;
      });
      await assert.rejects(service.getProblems({ path: "/absolute/foo" }), (error) => {
        assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.PATH_TRAVERSAL);
        return true;
      });
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems excludes diagnostics outside the workspace folder", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([
        [makeUri("/ws/a.ts"), [makeDiagnostic(makeUri("/ws/a.ts"), "inside", vscode.DiagnosticSeverity.Error)]],
        [makeUri("/outside/x.ts"), [makeDiagnostic(makeUri("/outside/x.ts"), "outside", vscode.DiagnosticSeverity.Error)]],
      ]),
    ];
    try {
      const service = new DiagnosticsService();
      const result = await service.getProblems({});
      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.diagnostics[0].message, "inside");
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems includes source and code", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([
        [makeUri("/ws/a.ts"), [makeDiagnostic(makeUri("/ws/a.ts"), "msg", vscode.DiagnosticSeverity.Error, "typescript", 123)]],
      ]),
    ];
    try {
      const service = new DiagnosticsService();
      const result = await service.getProblems({});
      assert.strictEqual(result.diagnostics[0].source, "typescript");
      assert.strictEqual(result.diagnostics[0].code, 123);
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems applies severity per diagnostic within one file", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([
        [
          makeUri("/ws/a.ts"),
          [
            makeDiagnostic(makeUri("/ws/a.ts"), "err", vscode.DiagnosticSeverity.Error),
            makeDiagnostic(makeUri("/ws/a.ts"), "war", vscode.DiagnosticSeverity.Warning),
            makeDiagnostic(makeUri("/ws/a.ts"), "inf", vscode.DiagnosticSeverity.Information),
          ],
        ],
      ]),
    ];
    try {
      const service = new DiagnosticsService();
      // Only errors are requested.
      let result = await service.getProblems({ severity: ["error"] });
      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.diagnostics[0].message, "err");
      // Multiple severities requested: each matching diagnostic is returned.
      result = await service.getProblems({ severity: ["error", "warning"] });
      assert.strictEqual(result.total, 2);
      assert.strictEqual(result.diagnostics[0].message, "err");
      assert.strictEqual(result.diagnostics[1].message, "war");
      // Empty severity array matches nothing.
      result = await service.getProblems({ severity: [] });
      assert.strictEqual(result.total, 0);
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems counts and truncates individual diagnostics, not files", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([
        [makeUri("/ws/a.ts"), [makeDiagnostic(makeUri("/ws/a.ts"), "d1", vscode.DiagnosticSeverity.Error)]],
        [makeUri("/ws/a.ts"), [makeDiagnostic(makeUri("/ws/a.ts"), "d2", vscode.DiagnosticSeverity.Error)]],
        [makeUri("/ws/b.ts"), [makeDiagnostic(makeUri("/ws/b.ts"), "d3", vscode.DiagnosticSeverity.Error)]],
      ]),
    ];
    try {
      const service = new DiagnosticsService();
      const result = await service.getProblems({ limit: 2 });
      // Three individual diagnostics match; two are returned.
      assert.strictEqual(result.total, 3);
      assert.strictEqual(result.truncated, true);
      assert.strictEqual(result.diagnostics.length, 2);
      assert.deepStrictEqual(
        result.diagnostics.map((d) => d.message),
        ["d1", "d2"],
      );
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("getProblems validates params before using them", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([]),
    ];
    try {
      const service = new DiagnosticsService();
      await assert.rejects(
        service.getProblems({ path: 1 } as unknown as GetProblemsParams),
        (error) => {
          assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.INVALID_PARAMS);
          return true;
        },
      );
      await assert.rejects(
        service.getProblems({ workspaceFolder: 1 } as unknown as GetProblemsParams),
        (error) => {
          assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.INVALID_PARAMS);
          return true;
        },
      );
      await assert.rejects(
        service.getProblems({ severity: ["bogus"] } as unknown as GetProblemsParams),
        (error) => {
          assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.INVALID_PARAMS);
          return true;
        },
      );
      await assert.rejects(
        service.getProblems({ severity: "error" } as unknown as GetProblemsParams),
        (error) => {
          assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.INVALID_PARAMS);
          return true;
        },
      );
      await assert.rejects(
        service.getProblems({ limit: 1.5 } as unknown as GetProblemsParams),
        (error) => {
          assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.INVALID_PARAMS);
          return true;
        },
      );
      await assert.rejects(
        service.getProblems({ limit: "2" } as unknown as GetProblemsParams),
        (error) => {
          assert.ok(error instanceof Error && (error as { code?: string }).code === ProblemErrorCode.INVALID_PARAMS);
          return true;
        },
      );
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("windows named pipe path is exact", () => {
    assert.strictEqual(windowsNamedPipe("abc-123"), "\\\\.\\pipe\\agendo-abc-123");
  });

  test("bridge stops on opt-out and re-enables on opt-in", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([]),
    ];
    let bridge: IpcBridge | undefined;
    try {
      // Intercept config reads and config-change notifications so we can drive
      // the enabled flag through the bridge's update() path.
      const originalOnDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration;
      const originalGetConfiguration = vscode.workspace.getConfiguration;
      const configListeners: Array<(event: never) => void> = [];
      let problemsEnabled = true;
      Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {
        value: (listener: (event: never) => void) => {
          configListeners.push(listener);
          return { dispose() {} };
        },
        configurable: true,
      });
      Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: () => ({
          get: (key: string, defaultValue?: unknown) =>
            key === "mcp.problems.enabled" ? problemsEnabled : defaultValue,
        }),
        configurable: true,
      });
      try {
      const service = new DiagnosticsService();
      bridge = await IpcBridge.create({ context: mockContext, diagnostics: service });
      if (!bridge) {
        throw new Error("bridge not created");
      }
      const endpoint = bridge.getEndpoint();
      await waitForListening(endpoint);

        // Opt-out: the bridge must stop listening but keep the config listener
        // alive so it can be re-enabled.
        problemsEnabled = false;
        configListeners.forEach((l) => {
          l({ affectsConfiguration: () => true } as never);
        });
        let removed = false;
        for (let i = 0; i < 100 && !removed; i++) {
          removed = !fs.existsSync(endpoint);
          if (!removed) await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
        assert.ok(removed, "endpoint socket should be removed on opt-out");
        await assertConnectionFails(endpoint);

        // Opt-in: the bridge must restart and serve requests again.
        problemsEnabled = true;
        configListeners.forEach((l) => {
          l({ affectsConfiguration: () => true } as never);
        });
        await waitForListening(endpoint);
        const socket = net.createConnection(endpoint);
        const response = await requestResponse(socket, {
          id: 1,
          method: "get_problems",
          params: {},
        });
        socket.end();
        assert.strictEqual(response.ok, true);
        assert.strictEqual(response.id, 1);
      } finally {
        Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {
          value: originalOnDidChangeConfiguration,
          configurable: true,
        });
        Object.defineProperty(vscode.workspace, "getConfiguration", {
          value: originalGetConfiguration,
          configurable: true,
        });
        if (bridge) {
          bridge.dispose();
        }
        for (const r of restore) {
          r();
        }
      }
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });

  test("bridge retains temp directory on opt-out and removes it on dispose", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([]),
    ];
    let bridge: IpcBridge | undefined;
    const discoveryDirectory = fs.mkdtempSync(path.join(tmpdir(), "agendo-discovery-test-"));
    try {
      const originalOnDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration;
      const originalGetConfiguration = vscode.workspace.getConfiguration;
      const configListeners: Array<(event: never) => void> = [];
      let problemsEnabled = true;
      Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {
        value: (listener: (event: never) => void) => {
          configListeners.push(listener);
          return { dispose() {} };
        },
        configurable: true,
      });
      Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: () => ({
          get: (key: string, defaultValue?: unknown) =>
            key === "mcp.problems.enabled" ? problemsEnabled : defaultValue,
        }),
        configurable: true,
      });
      try {
        const service = new DiagnosticsService();
        bridge = await IpcBridge.create({ context: mockContext, diagnostics: service, discoveryDirectory });
        if (!bridge) {
          throw new Error("bridge not created");
        }
        const endpoint = bridge.getEndpoint();
        await waitForListening(endpoint);
        const registrations = fs.readdirSync(discoveryDirectory);
        assert.strictEqual(registrations.length, 1);
        const recordPath = path.join(discoveryDirectory, registrations[0]);
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(recordPath, "utf8")), { endpoint, hostPid: process.pid });

        // The private temp directory is only meaningful on Unix; Windows uses
        // an OS named pipe with no per-window temp directory.
        const parentDir = process.platform !== "win32" ? path.dirname(endpoint) : undefined;

        // Opt-out: the socket is removed but the private temp directory is
        // retained so a later opt-in can reuse the same endpoint.
        problemsEnabled = false;
        configListeners.forEach((l) => {
          l({ affectsConfiguration: () => true } as never);
        });
        let removed = false;
        for (let i = 0; i < 100 && !removed; i++) {
          removed = !fs.existsSync(endpoint);
          if (!removed) await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
        assert.ok(removed, "endpoint socket should be removed on opt-out");
        assert.deepStrictEqual(fs.readdirSync(discoveryDirectory), []);
        if (parentDir) {
          assert.ok(
            fs.existsSync(parentDir),
            "private temp directory should remain reusable during opt-out",
          );
        }

        // Terminal disposal removes the owned endpoint/temp directory even
        // though the bridge was already stopped.
        bridge.dispose();
        if (parentDir) {
          let gone = false;
          for (let i = 0; i < 100 && !gone; i++) {
            gone = !fs.existsSync(parentDir);
            if (!gone) await new Promise<void>((resolve) => setTimeout(resolve, 50));
          }
          assert.ok(gone, "private temp directory should be removed on dispose");
        }
      } finally {
        Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {
          value: originalOnDidChangeConfiguration,
          configurable: true,
        });
        Object.defineProperty(vscode.workspace, "getConfiguration", {
          value: originalGetConfiguration,
          configurable: true,
        });
        if (bridge) {
          bridge.dispose();
        }
        for (const r of restore) {
          r();
        }
      }
    } finally {
      fs.rmSync(discoveryDirectory, { recursive: true, force: true });
      for (const r of restore) {
        r();
      }
    }
  });

  test("IpcBridge rejects oversized request frames and bounds responses", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([
        [
          makeUri("/ws/a.ts"),
          [
            makeDiagnostic(
              makeUri("/ws/a.ts"),
              "x".repeat(2 * 1024 * 1024),
              vscode.DiagnosticSeverity.Error,
              undefined,
              undefined,
            ),
          ],
        ],
      ]),
    ];
    let bridge: IpcBridge | undefined;
    try {
      const service = new DiagnosticsService();
      bridge = await IpcBridge.create({ context: mockContext, diagnostics: service });
      if (!bridge) {
        throw new Error("bridge not created");
      }
      const endpoint = bridge.getEndpoint();
      await waitForListening(endpoint);

      // Oversized request frame (> 64 KiB) is rejected promptly.
      const oversizeRequest = JSON.stringify({
        id: 1,
        method: "get_problems",
        params: {},
      }) + "x".repeat(70000) + "\n";
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(endpoint);
        let failed = false;
        let closed = false;
        socket.on("error", (error) => {
          if (!failed) {
            failed = true;
            // Connection should be destroyed/closed by the bridge.
            if (closed) resolve();
            else {
              closed = true;
              // Wait for the close event to fire before resolving.
              socket.once("close", resolve);
            }
          }
        });
        socket.on("connect", () => {
          socket.write(oversizeRequest);
        });
        socket.on("close", () => {
          if (!failed) {
            failed = true;
            resolve();
          }
        });
        setTimeout(() => {
          if (!failed) {
            reject(new Error("connection attempt timed out"));
          }
        }, 2000);
      });

      // Response is bounded: a large diagnostic message is byte-trimmed and
      // reports truncated=true while total stays the pre-truncation count.
      const socket2 = net.createConnection(endpoint);
      const response2 = await requestResponse(socket2, {
        id: 2,
        method: "get_problems",
        params: {},
      });
      socket2.end();
      assert.strictEqual(response2.ok, true);
      const result = response2.result as GetProblemsResult;
      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.truncated, true);
      assert.strictEqual(result.diagnostics.length, 0);
      const body = Buffer.from(JSON.stringify(response2) + "\n");
      assert.ok(
        Buffer.byteLength(body) <= 1024 * 1024,
        `response body ${body.length} bytes exceeds 1 MiB response cap`,
      );
    } finally {
      if (bridge) {
        bridge.dispose();
      }
      for (const r of restore) {
        r();
      }
    }
  });

  test("IpcBridge round trip returns a get_problems response", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([
        [makeUri("/ws/a.ts"), [makeDiagnostic(makeUri("/ws/a.ts"), "problem", vscode.DiagnosticSeverity.Error)]],
      ]),
    ];
    let bridge: IpcBridge | undefined;
    try {
      const service = new DiagnosticsService();
      bridge = await IpcBridge.create({ context: mockContext, diagnostics: service });
      if (!bridge) {
        throw new Error("bridge not created");
      }
      const endpoint = bridge.getEndpoint();
      await waitForListening(endpoint);

      const socket = net.createConnection(endpoint);
      const response = await requestResponse(socket, {
        id: 42,
        method: "get_problems",
        params: {},
      });
      socket.end();

      assert.strictEqual(response.ok, true);
      assert.strictEqual(response.id, 42);
      const result = response.result as GetProblemsResult;
      assert.strictEqual(result.workspaceFolder, "ws");
      assert.strictEqual(result.total, 1);
    } finally {
      if (bridge) {
        bridge.dispose();
      }
      for (const r of restore) {
        r();
      }
    }
  });

  test("IpcBridge returns error response for unknown method", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([]),
    ];
    let bridge: IpcBridge | undefined;
    try {
      const service = new DiagnosticsService();
      bridge = await IpcBridge.create({ context: mockContext, diagnostics: service });
      if (!bridge) {
        throw new Error("bridge not created");
      }
      const endpoint = bridge.getEndpoint();
      await waitForListening(endpoint);

      const socket = net.createConnection(endpoint);
      const response = await requestResponse(socket, {
        id: 7,
        method: "unknown_method",
        params: {},
      });
      socket.end();

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.id, 7);
      assert.ok(response.error?.code);
      assert.ok(response.error?.message);
    } finally {
      if (bridge) {
        bridge.dispose();
      }
      for (const r of restore) {
        r();
      }
    }
  });

  test("IpcBridge is disposed on deactivation", async () => {
    const restore = [
      mockWorkspaceFolders([{ uri: makeUri("/ws"), name: "ws", index: 0 }]),
      mockGetDiagnostics([]),
    ];
    try {
      const service = new DiagnosticsService();
      const bridge = await IpcBridge.create({ context: mockContext, diagnostics: service });
      const endpoint = bridge.getEndpoint();
      await waitForListening(endpoint);

      bridge.dispose();

      // Wait for the endpoint socket to be cleaned up.
      let gone = false;
      for (let i = 0; i < 100 && !gone; i++) {
        gone = !fs.existsSync(endpoint);
        if (!gone) await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }
      assert.ok(gone, "endpoint socket should be removed on dispose");

      // Connecting to the removed endpoint should fail quickly.
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(endpoint);
        let failed = false;
        socket.on("error", (error) => {
          if (!failed) {
            failed = true;
            const code = (error as { code?: string }).code;
            if (code === "ENOENT" || code === "ECONNREFUSED") {
              resolve();
            } else {
              reject(error);
            }
          }
        });
        socket.on("connect", () => {
          socket.end();
          reject(new Error("connection should not succeed after dispose"));
        });
        socket.on("close", () => {
          if (!failed) {
            reject(new Error("connection closed without error"));
          }
        });
        setTimeout(() => {
          if (!failed) {
            reject(new Error("connection attempt timed out"));
          }
        }, 2000);
      });
    } finally {
      for (const r of restore) {
        r();
      }
    }
  });
});
