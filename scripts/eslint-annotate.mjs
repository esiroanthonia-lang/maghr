// CI helper: turns ESLint's JSON report into GitHub annotations shown on commits and pull requests.
import { readFileSync } from "node:fs";

const report = JSON.parse(readFileSync(process.argv[2] ?? "eslint.json", "utf8"));
const root = process.cwd() + "/";
let errors = 0;
for (const file of report) {
  for (const m of file.messages) {
    if (m.severity === 2) errors++;
    const level = m.severity === 2 ? "error" : "warning";
    const msg = `${m.ruleId ?? "eslint"}: ${m.message}`.replace(/\r?\n/g, " ");
    console.log(`::${level} file=${file.filePath.replace(root, "")},line=${m.line ?? 1},col=${m.column ?? 1}::${msg}`);
  }
}
console.log(`ESLint: ${errors} error(s)`);
process.exit(errors ? 1 : 0);
