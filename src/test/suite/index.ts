import * as fs from "node:fs";
import * as path from "node:path";
import { glob } from "glob";
import Mocha from "mocha";

export async function run(): Promise<void> {
  const reportPath = path.resolve(
    __dirname,
    "../../../reports/test-results.xml",
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    reporter: "xunit",
    reporterOptions: {
      output: reportPath,
    },
  });

  const testsRoot = path.resolve(__dirname, "..");
  const files = await glob("**/**.test.js", { cwd: testsRoot });

  for (const f of files) {
    mocha.addFile(path.resolve(testsRoot, f));
  }

  await new Promise<void>((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
}
