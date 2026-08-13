import * as fs from "node:fs";
import * as path from "node:path";
import { glob } from "glob";
import Mocha from "mocha";

type TestExecutionStatus = "ok" | "skipped" | "failure" | "error";

type TestExecution = {
  filePath: string;
  name: string;
  duration: number;
  status: TestExecutionStatus;
  message?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toReportXml(testExecutions: TestExecution[]): string {
  const byFile = new Map<string, TestExecution[]>();

  for (const execution of testExecutions) {
    const current = byFile.get(execution.filePath) ?? [];
    current.push(execution);
    byFile.set(execution.filePath, current);
  }

  const fileXml = [...byFile.entries()]
    .map(([filePath, executions]) => {
      const cases = executions
        .map((execution) => {
          const attrs = `name="${escapeXml(execution.name)}" duration="${Math.max(0, Math.round(execution.duration))}"`;

          if (execution.status === "skipped") {
            return `    <testCase ${attrs}><skipped/></testCase>`;
          }

          if (execution.status === "failure") {
            return `    <testCase ${attrs}><failure message="${escapeXml(execution.message ?? "Test failed")}"/></testCase>`;
          }

          if (execution.status === "error") {
            return `    <testCase ${attrs}><error message="${escapeXml(execution.message ?? "Test errored")}"/></testCase>`;
          }

          return `    <testCase ${attrs}/>`;
        })
        .join("\n");

      return `  <file path="${escapeXml(filePath)}">\n${cases}\n  </file>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<testExecutions version="1">\n${fileXml}\n</testExecutions>\n`;
}

export async function run(): Promise<void> {
  const projectRoot = path.resolve(__dirname, "../../..");
  const reportPath = path.resolve(projectRoot, "reports/test-results.xml");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });

  const testsRoot = path.resolve(__dirname, "..");
  const files = await glob("**/**.test.js", { cwd: testsRoot });

  for (const f of files) {
    mocha.addFile(path.resolve(testsRoot, f));
  }

  const testExecutions: TestExecution[] = [];

  await new Promise<void>((resolve, reject) => {
    try {
      const runner = mocha.run((failures) => {
        try {
          fs.writeFileSync(reportPath, toReportXml(testExecutions), "utf8");

          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      });

      runner.on("pass", (test) => {
        const file = test.file
          ? path.relative(projectRoot, test.file).replace(/\\/g, "/")
          : "unknown";
        testExecutions.push({
          filePath: file,
          name: test.fullTitle(),
          duration: test.duration ?? 0,
          status: "ok",
        });
      });

      runner.on("pending", (test) => {
        const file = test.file
          ? path.relative(projectRoot, test.file).replace(/\\/g, "/")
          : "unknown";
        testExecutions.push({
          filePath: file,
          name: test.fullTitle(),
          duration: test.duration ?? 0,
          status: "skipped",
        });
      });

      runner.on("fail", (test, err) => {
        const file = test.file
          ? path.relative(projectRoot, test.file).replace(/\\/g, "/")
          : "unknown";
        const message = err?.message ?? String(err);
        testExecutions.push({
          filePath: file,
          name: test.fullTitle(),
          duration: test.duration ?? 0,
          status: err?.name === "Error" ? "error" : "failure",
          message,
        });
      });
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
}
