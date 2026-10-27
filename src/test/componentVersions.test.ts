import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { CanvasManager } from "../todos/canvasManager";
import {
  checkSourceVersion,
  compareVersions,
  versionRelationship,
} from "../todos/componentVersions";
import { fetchText } from "../todos/skillManager";

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
    const result = await checkSourceVersion(`${source}${"/".repeat(20000)}`, ".skill-meta.json", fetch);
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
    fs.mkdirSync(bundledDir, { recursive: true });
    fs.writeFileSync(
      path.join(bundledDir, ".canvas-meta.json"),
      JSON.stringify({ version: "1.0.0" }),
    );
    fs.writeFileSync(path.join(bundledDir, "extension.mjs"), "");
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
});
