#!/usr/bin/env node
var import_node_globals = require("./node-globals.js");
var import_stdio = require("../vendor/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js");
var import_server = require("./server.js");
var import_connection = require("./connection.js");
var import_env = require("./env.js");
var import_watch = require("./watch.js");
var import_junit_cli = require("./junit-cli.js");
var import_http = require("./http.js");
var import_cli = require("./cli.js");
var import_redact = require("./utils/redact.js");
async function main() {
  if (process.argv[2] === "watch") {
    await (0, import_watch.runWatch)(process.argv.slice(3));
    return;
  }
  const sub = process.argv[2];
  if (sub != null && !["watch", "junit", "setup", "http"].includes(sub)) {
    if (["1", "true", "yes"].includes(String(process.env.HULY_DEBUG ?? "").toLowerCase())) (0, import_redact.routeConsoleToStderr)();
    else console.log = console.info = console.debug = console.warn = console.error = () => {
    };
    process.exit(await (0, import_cli.main)(process.argv.slice(2)));
  }
  if (process.argv[2] === "http") {
    (0, import_env.normalizeEnv)();
    (0, import_redact.routeConsoleToStderr)();
    await (0, import_http.runHttp)(process.argv.slice(3));
    return;
  }
  if (process.argv[2] === "setup") {
    process.env.HULY_SETUP_RUN = "1";
    require("../scripts/setup.js");
    return;
  }
  if (process.argv[2] === "junit") {
    await (0, import_junit_cli.runJUnit)(process.argv.slice(3));
    process.exit();
  }
  (0, import_env.normalizeEnv)();
  (0, import_redact.routeConsoleToStderr)();
  const server = (0, import_server.createServer)();
  const transport = new import_stdio.StdioServerTransport();
  process.on("SIGINT", async () => {
    await (0, import_connection.closeConnection)();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await (0, import_connection.closeConnection)();
    process.exit(0);
  });
  await server.connect(transport);
  void (0, import_connection.prewarm)();
}
main().catch((err) => {
  console.error("Fatal error starting huly-mcp:", err instanceof Error ? err.message : err);
  process.exit(1);
});
