import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    // Extension hosts set this for their own Node child processes, but the
    // downloaded VS Code executable must start in Electron mode.
    delete process.env.ELECTRON_RUN_AS_NODE;

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
    });
  } catch (err) {
    console.error("Failed to run tests:", err);
    process.exit(1);
  }
}

main();
