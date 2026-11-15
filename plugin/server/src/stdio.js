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
var stdio_exports = {};
__export(stdio_exports, {
  runStdio: () => runStdio
});
module.exports = __toCommonJS(stdio_exports);
var import_stdio = require("../vendor/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js");
var import_server = require("./server.js");
var import_connection = require("./connection.js");
var import_env = require("./env.js");
var import_redact = require("./utils/redact.js");
async function runStdio() {
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
