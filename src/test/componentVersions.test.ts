import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import * as vscode from "vscode";
import { CanvasManager } from "../todos/canvasManager";
import {
  checkSourceVersion,
  compareVersions,
  versionRelationship,
} from "../todos/componentVersions";
import { fetchText } from "../todos/skillManager";

const importModule = new Function("url", "return import(url)") as (
  url: string,
) => Promise<Record<string, unknown>>;

suite("Component version comparison", () => {
  test("component downloads reject non-HTTPS and credential URLs before connecting", async () => {
    await assert.rejects(fetchText("http://example.com/file"), /HTTPS/);
    await assert.rejects(fetchText("https://user:pass@example.com/file"), /credentials/);
  });
  test("compareVersions handles older, newer, and equal versions", () => {
    assert.ok(compareVersions("1.0.0", "2.0.0") < 0);
    assert.ok(compareVersions("2.0.0", "1.0.0") > 0);
    assert.strictEqual(compareVersions("1.2.3", "1.2.3"), 0);
    assert.strictEqual(compareVersions("1.0.0", undefined), 1);
    assert.strictEqual(compareVersions(undefined, "1.0.0"), -1);
    assert.strictEqual(compareVersions(undefined, undefined), 0);
  });

  test("versionRelationship reports newer, matches, differs, and unknown", () => {
    assert.strictEqual(versionRelationship("1.0.0", "2.0.0"), "newer version available");
    assert.strictEqual(versionRelationship("2.0.0", "1.0.0"), "installed is newer; differs");
    assert.strictEqual(versionRelationship("1.0.0", "1.0.0"), "version matches");
    assert.strictEqual(versionRelationship("1.0.0-rc.1", "1.0.0"), "newer version available");
    assert.strictEqual(versionRelationship("1.0.0+local", "1.0.0+source"), "version differs");
    assert.strictEqual(versionRelationship(undefined, "1.0.0"), "comparison unknown");
    assert.strictEqual(versionRelationship("1.0.0", undefined), "comparison unknown");
  });

  test("prerelease precedence and build metadata do not mislabel newer installs", () => {
    assert.ok(compareVersions("1.0.0", "1.0.0-rc.1") > 0);
    assert.ok(compareVersions("1.0.0-rc.10", "1.0.0-rc.2") > 0);
    assert.strictEqual(compareVersions("1.0.0+build.1", "1.0.0+build.2"), 0);
  });

  test("checkSourceVersion returns source version from valid metadata", async () => {
    const fetch = async () => JSON.stringify({ version: "2.1.0" });
    const result = await checkSourceVersion("https://example.com/skill", ".skill-meta.json", fetch);
    assert.strictEqual(result.sourceVersion, "2.1.0");
    assert.strictEqual(result.sourceUrl, "https://example.com/skill");
  });

  test("checkSourceVersion rejects invalid JSON", async () => {
    const fetch = async () => "not json";
    const result = await checkSourceVersion("https://example.com/skill", ".skill-meta.json", fetch);
    assert.strictEqual(result.sourceVersion, undefined);
    assert.ok(result.sourceError);
  });

  test("checkSourceVersion rejects invalid version string", async () => {
    const fetch = async () => JSON.stringify({ version: "latest" });
    const result = await checkSourceVersion("https://example.com/skill", ".skill-meta.json", fetch);
    assert.strictEqual(result.sourceVersion, undefined);
    assert.ok(result.sourceError);
  });

  test("checkSourceVersion rejects network failures", async () => {
    const fetch = async () => {
      throw new Error("connection refused");
    };
    const result = await checkSourceVersion("https://example.com/skill", ".skill-meta.json", fetch);
    assert.strictEqual(result.sourceVersion, undefined);
    assert.ok(result.sourceError);
  });

  test("compareVersions prerelease comparison edge cases", () => {
    assert.strictEqual(compareVersions("1.0.0-rc.1", "1.0.0-rc.1"), 0);
    assert.ok(compareVersions("1.0.0-rc.1", "1.0.0-rc.2") < 0);
    assert.ok(compareVersions("1.0.0-rc.2", "1.0.0-rc.1") > 0);
    assert.ok(compareVersions("1.0.0-rc.1", "1.0.0") < 0);
    assert.ok(compareVersions("1.0.0", "1.0.0-rc.1") > 0);
    assert.ok(compareVersions("1.0.0-rc.1", "1.0.0-rc.10") < 0);
    assert.ok(compareVersions("1.0.0-rc.10", "1.0.0-rc.1") > 0);
    assert.ok(compareVersions("1.0.0-1.0", "1.0.0-rc.1") < 0);
    assert.ok(compareVersions("1.0.0-rc.1", "1.0.0-1.0") > 0);
    assert.strictEqual(compareVersions("1.0.0+build.1", "1.0.0+build.2"), 0);
    assert.strictEqual(compareVersions("1.0.0+local", "1.0.0+source"), 0);
  });

  test("checkSourceVersion rejects long malformed version strings", async () => {
    const longInvalid = `1.2.3-${"a".repeat(10000)}!`;
    const fetch = async () => JSON.stringify({ version: longInvalid });
    const result = await checkSourceVersion("https://example.com/skill", ".skill-meta.json", fetch);
    assert.strictEqual(result.sourceVersion, undefined);
    assert.ok(result.sourceError);
  });

  test("checkSourceVersion preserves permissive prerelease identifier validation", async () => {
    const version = `1.2.3-${".".repeat(5000)}`;
    const fetch = async () => JSON.stringify({ version });
    const result = await checkSourceVersion("https://example.com/skill", ".skill-meta.json", fetch);
    assert.strictEqual(result.sourceVersion, version);
  });

  test("checkSourceVersion trims long trailing slash runs without changing URL contents", async () => {
    const requested: string[] = [];
    const fetch = async (url: string) => {
      requested.push(url);
      return JSON.stringify({ version: "1.2.3" });
    };
    const source = "https://example.com/skill";
    const result = await checkSourceVersion(
      `${source}${"/".repeat(20000)}`,
      ".skill-meta.json",
      fetch,
    );
    assert.strictEqual(result.sourceVersion, "1.2.3");
    assert.deepStrictEqual(requested, [`${source}/.skill-meta.json`]);
    const invalid = await checkSourceVersion("/".repeat(20000), ".skill-meta.json", fetch);
    assert.ok(invalid.sourceError);
    assert.strictEqual(requested.length, 1);
  });

  test("checkSourceVersion accepts long valid version", async () => {
    const longValid = `1.2.3-${"abc".repeat(1000)}+build.1`;
    const fetch = async () => JSON.stringify({ version: longValid });
    const result = await checkSourceVersion("https://example.com/skill", ".skill-meta.json", fetch);
    assert.strictEqual(result.sourceVersion, longValid);
    assert.strictEqual(result.sourceUrl, "https://example.com/skill");
  });

  test("checkSourceVersion rejects empty source URL", async () => {
    const fetch = async () => JSON.stringify({ version: "1.0.0" });
    const result = await checkSourceVersion("", ".skill-meta.json", fetch);
    assert.strictEqual(result.sourceVersion, undefined);
    assert.ok(result.sourceError);
  });

  test("checkSourceVersion rejects http URLs", async () => {
    const fetch = async () => JSON.stringify({ version: "1.0.0" });
    const result = await checkSourceVersion("http://example.com/skill", ".skill-meta.json", fetch);
    assert.strictEqual(result.sourceVersion, undefined);
    assert.ok(result.sourceError);
  });

  test("checkSourceVersion rejects URLs with credentials", async () => {
    const fetch = async () => JSON.stringify({ version: "1.0.0" });
    const result = await checkSourceVersion(
      "https://user:pass@example.com/skill",
      ".skill-meta.json",
      fetch,
    );
    assert.strictEqual(result.sourceVersion, undefined);
    assert.ok(result.sourceError);
  });
});

suite("CanvasManager local status", () => {
  let fixtureDir: string;
  let previousCopilotHome: string | undefined;

  const installDirName = "extensions/agendo-work-session";
  function installDir(): string {
    return path.join(fixtureDir, installDirName);
  }
  function resetInstallDir(): void {
    fs.rmSync(installDir(), { recursive: true, force: true });
  }

  setup(() => {
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "agendo-canvas-test-"));
    previousCopilotHome = process.env.COPILOT_HOME;
    process.env.COPILOT_HOME = fixtureDir;
    const bundledDir = path.join(
      fixtureDir,
      "bundled",
      "resources",
      "canvas",
      "agendo-work-session",
    );
    // Ship the real bundled canvas so copy tests exercise real files.
    fs.cpSync(
      path.join(__dirname, "..", "..", "resources", "canvas", "agendo-work-session"),
      bundledDir,
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(bundledDir, ".canvas-meta.json"),
      JSON.stringify({ version: "1.0.0" }),
    );
  });

  teardown(() => {
    if (previousCopilotHome !== undefined) {
      process.env.COPILOT_HOME = previousCopilotHome;
    } else {
      delete process.env.COPILOT_HOME;
    }
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  test("updateAvailable is true only when bundled is newer than installed", async () => {
    const installDir = path.join(fixtureDir, "extensions", "agendo-work-session");
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, "extension.mjs"), "");

    // Installed older than bundled
    fs.writeFileSync(
      path.join(installDir, ".canvas-meta.json"),
      JSON.stringify({ version: "0.9.0" }),
    );
    const managerOlder = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    const olderStatus = await managerOlder.getStatus();
    assert.strictEqual(olderStatus.installed, true);
    assert.strictEqual(olderStatus.updateAvailable, true);

    // Installed equal to bundled
    fs.writeFileSync(
      path.join(installDir, ".canvas-meta.json"),
      JSON.stringify({ version: "1.0.0" }),
    );
    const managerEqual = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    const equalStatus = await managerEqual.getStatus();
    assert.strictEqual(equalStatus.updateAvailable, false);

    // Installed newer than bundled
    fs.writeFileSync(
      path.join(installDir, ".canvas-meta.json"),
      JSON.stringify({ version: "2.0.0" }),
    );
    const managerNewer = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    const newerStatus = await managerNewer.getStatus();
    assert.strictEqual(newerStatus.installed, true);
    assert.strictEqual(newerStatus.installedVersion, "2.0.0");
    assert.strictEqual(newerStatus.updateAvailable, false);
  });

  test("source check is off by default and does not perform network requests", async () => {
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    const status = await manager.getStatus();
    assert.strictEqual(status.sourceVersion, undefined);
    assert.strictEqual(status.sourceError, undefined);
  });

  test("missing metadata with existing extension.mjs reports installed unknown version", async () => {
    const installDir = path.join(fixtureDir, "extensions", "agendo-work-session");
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, "extension.mjs"), "");
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    const status = await manager.getStatus();
    assert.strictEqual(status.installed, true);
    assert.strictEqual(status.installedVersion, undefined);
    assert.strictEqual(status.updateAvailable, false);
  });

  test("ensureBundledInstalled copies the full bundle and returns true on first install", async () => {
    resetInstallDir();
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    const installed = await manager.ensureBundledInstalled();
    assert.strictEqual(installed, true);
    const dir = installDir();
    const bundledDir = path.join(
      fixtureDir,
      "bundled",
      "resources",
      "canvas",
      "agendo-work-session",
    );
    // Discover runtime modules independently of the installer's allowlist so a
    // newly added dependency cannot be missed by duplicating the same stale list.
    const runtimeFiles = fs
      .readdirSync(bundledDir)
      .filter((name) => /\.(mjs|html|json)$/.test(name));
    for (const relative of [...runtimeFiles, "assets/page.css", "assets/page.js"]) {
      assert.ok(
        fs.existsSync(path.join(dir, relative)),
        `${relative} was not copied on first install`,
      );
    }
    // Bundled version is written into the installed copy.
    const meta = JSON.parse(fs.readFileSync(path.join(dir, ".canvas-meta.json"), "utf8"));
    assert.strictEqual(meta.version, "1.0.0");
  });

  test("installed canvas server resolves its runtime imports without the source tree", async () => {
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    await manager.install();
    const server = await importModule(pathToFileURL(path.join(installDir(), "server.mjs")).href);
    assert.strictEqual(typeof server.createInstanceServer, "function");
    assert.strictEqual(typeof server.listen, "function");
    assert.strictEqual(typeof server.navigate, "function");
  });

  test("installed Copilot entry point registers the canvas with the host-provided SDK", async () => {
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    await manager.install();
    // Copilot injects its SDK at bootstrap. Provide only that boundary here;
    // all Agendo runtime modules must resolve from the installed copy itself.
    const sdkDir = path.join(installDir(), "node_modules", "@github", "copilot-sdk");
    fs.mkdirSync(sdkDir, { recursive: true });
    fs.writeFileSync(
      path.join(sdkDir, "package.json"),
      JSON.stringify({
        type: "module",
        exports: { "./extension": "./extension.mjs" },
      }),
    );
    const sdkFile = path.join(sdkDir, "extension.mjs");
    fs.writeFileSync(
      sdkFile,
      `
      export class CanvasError extends Error {}
      export const joinedCanvases = [];
      export function createCanvas(definition) { return definition; }
      export async function joinSession({ canvases }) {
        joinedCanvases.push(...canvases);
        return {};
      }
    `,
    );
    await importModule(pathToFileURL(path.join(installDir(), "extension.mjs")).href);
    const sdk = await importModule(pathToFileURL(sdkFile).href);
    const canvases = sdk.joinedCanvases as { id: string; open: unknown; actions: unknown[] }[];
    assert.strictEqual(canvases.length, 1);
    assert.strictEqual(canvases[0].id, "agendo-work-session");
    assert.strictEqual(typeof canvases[0].open, "function");
    assert.ok(canvases[0].actions.length > 0);
  });

  test("ensureBundledInstalled copies and returns true when installed is older than bundled", async () => {
    resetInstallDir();
    const dir = installDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "extension.mjs"), "");
    fs.writeFileSync(path.join(dir, ".canvas-meta.json"), JSON.stringify({ version: "0.9.0" }));
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    const installed = await manager.ensureBundledInstalled();
    assert.strictEqual(installed, true);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, ".canvas-meta.json"), "utf8"));
    assert.strictEqual(meta.version, "1.0.0");
  });

  test("ensureBundledInstalled provisions and returns true when installed equals bundled", async () => {
    resetInstallDir();
    const dir = installDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "extension.mjs"), "");
    fs.writeFileSync(path.join(dir, ".canvas-meta.json"), JSON.stringify({ version: "1.0.0" }));
    fs.writeFileSync(path.join(dir, "server.mjs"), "stale content");
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    const installed = await manager.ensureBundledInstalled();
    assert.strictEqual(installed, true);
    // Equal version is re-provisioned; version stays the same.
    const meta = JSON.parse(fs.readFileSync(path.join(dir, ".canvas-meta.json"), "utf8"));
    assert.strictEqual(meta.version, "1.0.0");
    assert.strictEqual(
      fs.readFileSync(path.join(dir, "server.mjs"), "utf8"),
      fs.readFileSync(
        path.join(
          fixtureDir,
          "bundled",
          "resources",
          "canvas",
          "agendo-work-session",
          "server.mjs",
        ),
        "utf8",
      ),
    );
  });

  test("ensureBundledInstalled does not copy and returns false when installed is newer than bundled", async () => {
    resetInstallDir();
    const dir = installDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "extension.mjs"), "");
    fs.writeFileSync(path.join(dir, ".canvas-meta.json"), JSON.stringify({ version: "2.0.0" }));
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    const installed = await manager.ensureBundledInstalled();
    assert.strictEqual(installed, false);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, ".canvas-meta.json"), "utf8"));
    assert.strictEqual(meta.version, "2.0.0");
  });

  test("ensureBundledInstalled preserves an unknown installed version and returns false", async () => {
    resetInstallDir();
    const dir = installDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "extension.mjs"), "");
    // Malformed metadata: version is not guessable as older.
    fs.writeFileSync(
      path.join(dir, ".canvas-meta.json"),
      JSON.stringify({ version: "not-a-version" }),
    );
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    const installed = await manager.ensureBundledInstalled();
    assert.strictEqual(installed, false);
    // Unknown copy is left untouched.
    assert.strictEqual(fs.readFileSync(path.join(dir, "extension.mjs"), "utf8"), "");
  });

  test("ensureBundledInstalled copies into the configured COPILOT_HOME", async () => {
    resetInstallDir();
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    const installed = await manager.ensureBundledInstalled();
    assert.strictEqual(installed, true);
    const dir = installDir();
    assert.ok(fs.existsSync(path.join(dir, "extension.mjs")));
    assert.strictEqual(process.env.COPILOT_HOME, fixtureDir);
  });

  for (const version of ["2.0.0", "not-a-version", undefined]) {
    test(`automatic provisioning preserves a metadata-only installation with version ${version}`, async () => {
      const dir = installDir();
      fs.mkdirSync(dir, { recursive: true });
      const original = JSON.stringify({ version });
      fs.writeFileSync(path.join(dir, ".canvas-meta.json"), original);
      const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
      assert.strictEqual(await manager.ensureBundledInstalled(), false);
      assert.strictEqual(fs.readFileSync(path.join(dir, ".canvas-meta.json"), "utf8"), original);
      assert.strictEqual(fs.existsSync(path.join(dir, "extension.mjs")), false);
    });
  }

  test("automatic provisioning preserves an entry point without metadata", async () => {
    fs.mkdirSync(installDir(), { recursive: true });
    fs.writeFileSync(path.join(installDir(), "extension.mjs"), "unknown custom canvas");
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    assert.strictEqual(await manager.ensureBundledInstalled(), false);
    assert.strictEqual(
      fs.readFileSync(path.join(installDir(), "extension.mjs"), "utf8"),
      "unknown custom canvas",
    );
  });

  for (const version of ["0.9.0", "1.0.0", "2.0.0", "not-a-version", undefined]) {
    test(`automatic provisioning handles legacy workspace version ${version} without downgrades`, async () => {
      const legacy = path.join(fixtureDir, "legacy");
      fs.mkdirSync(legacy, { recursive: true });
      fs.writeFileSync(path.join(legacy, ".canvas-meta.json"), JSON.stringify({ version }));
      fs.writeFileSync(path.join(legacy, "extension.mjs"), "legacy canvas");
      const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
      Object.defineProperty(manager, "legacyDir", { get: () => vscode.Uri.file(legacy) });
      const canMigrate = version === "0.9.0" || version === "1.0.0";
      assert.strictEqual(await manager.ensureBundledInstalled(), canMigrate);
      assert.strictEqual(fs.existsSync(legacy), !canMigrate);
      assert.strictEqual(fs.existsSync(path.join(installDir(), "extension.mjs")), canMigrate);
    });
  }

  test("automatic provisioning refuses an invalid bundled version", async () => {
    const metadata = path.join(
      fixtureDir,
      "bundled",
      "resources",
      "canvas",
      "agendo-work-session",
      ".canvas-meta.json",
    );
    fs.writeFileSync(metadata, JSON.stringify({ version: "invalid" }));
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    assert.strictEqual(await manager.ensureBundledInstalled(), false);
    assert.strictEqual(fs.existsSync(installDir()), false);
  });

  test("automatic provisioning propagates copy failures for the activation caller to handle", async () => {
    fs.unlinkSync(
      path.join(fixtureDir, "bundled", "resources", "canvas", "agendo-work-session", "server.mjs"),
    );
    const manager = new CanvasManager(vscode.Uri.file(path.join(fixtureDir, "bundled")));
    await assert.rejects(manager.ensureBundledInstalled());
  });
});
