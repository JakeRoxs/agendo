import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main() {
  const copilotHome = await fs.mkdtemp(path.join(os.tmpdir(), "agendo-test-copilot-"));
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    // Extension hosts set this for their own Node child processes, but the
    // downloaded VS Code executable must start in Electron mode.
    delete process.env.ELECTRON_RUN_AS_NODE;

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      // Startup activation provisions the canvas; never touch the user's installation in tests.
      extensionTestsEnv: { COPILOT_HOME: copilotHome },
    });
  } catch (err) {
    console.error("Failed to run tests:", err);
    process.exitCode = 1;
  } finally {
    await fs.rm(copilotHome, { recursive: true, force: true });
  }
}

main();
