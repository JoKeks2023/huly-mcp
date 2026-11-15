var import_node_globals = require("./node-globals.js");
var import_stdio = require("./stdio.js");
(0, import_stdio.runStdio)().catch((err) => {
  console.error("Fatal error starting huly-mcp:", err instanceof Error ? err.message : err);
  process.exit(1);
});
