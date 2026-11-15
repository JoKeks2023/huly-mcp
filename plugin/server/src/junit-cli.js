var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var junit_cli_exports = {};
__export(junit_cli_exports, {
  JUNIT_HELP: () => JUNIT_HELP,
  parseJUnitArgs: () => parseJUnitArgs,
  runJUnit: () => runJUnit
});
module.exports = __toCommonJS(junit_cli_exports);
var import_promises = require("node:fs/promises");
var import_env = require("./env.js");
var import_connection = require("./connection.js");
var import_test_automation = require("./tools/test-automation.js");
const JUNIT_HELP = `Usage: huly-mcp junit <report.xml> --project <test project> [options]

Imports a JUnit XML report (Jest, Vitest, pytest, Go, Gradle, Maven, xcpretty \u2026) as a Huly test
run. Suites and cases that do not exist yet are created. Credentials come from the usual HULY_*
environment variables.

Options:
  --project <name>        Test project (required)
  --workspace <slug>      Workspace (needed when the account has several)
  --run <name>            Run name (default: "CI <date time>")
  --parent-suite <name>   Put the report's suites under this suite
  --no-create             Only record results for cases that already exist
  --fail-on-failures      Exit with code 1 when the report has failed tests
  --dry-run               Show what would happen, change nothing
`;
function parseJUnitArgs(argv) {
  const o = { failOnFailures: false };
  const value = (i, flag) => {
    const v = argv[i + 1];
    if (v == null || v.startsWith("--")) throw new Error(`${flag} needs a value.`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--project":
        o.project = value(i, a);
        i++;
        break;
      case "--workspace":
        o.workspace = value(i, a);
        i++;
        break;
      case "--run":
        o.runName = value(i, a);
        i++;
        break;
      case "--parent-suite":
        o.parentSuite = value(i, a);
        i++;
        break;
      case "--no-create":
        o.createMissing = false;
        break;
      case "--fail-on-failures":
        o.failOnFailures = true;
        break;
      case "--dry-run":
        o.dryRun = true;
        break;
      default:
        if (a.startsWith("--")) throw new Error(`Unknown option ${a}.`);
        if (o.file != null) throw new Error("Only one report file.");
        o.file = a;
    }
  }
  if (o.file == null) throw new Error("Missing report file.");
  if (o.project == null) throw new Error("Missing --project.");
  return o;
}
async function runJUnit(argv) {
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    process.stdout.write(JUNIT_HELP);
    return;
  }
  let opts;
  try {
    opts = parseJUnitArgs(argv);
  } catch (e) {
    process.stderr.write(`${e.message}

${JUNIT_HELP}`);
    process.exitCode = 2;
    return;
  }
  (0, import_env.normalizeEnv)();
  try {
    const xml = await (0, import_promises.readFile)(opts.file, "utf8");
    const summary = await (0, import_test_automation.importJUnit)({ ...opts, xml });
    process.stdout.write(summary.text.replace(/\*\*/g, "") + "\n");
    if (opts.failOnFailures && summary.failed > 0) process.exitCode = 1;
  } catch (e) {
    process.stderr.write(`huly-mcp junit: ${e.message}
`);
    process.exitCode = 1;
  } finally {
    await (0, import_connection.closeConnection)();
  }
}
