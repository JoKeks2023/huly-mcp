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
var server_exports = {};
__export(server_exports, {
  ARG_ALIASES: () => ARG_ALIASES,
  TOOL_ARG_ALIASES: () => TOOL_ARG_ALIASES,
  aliasTarget: () => aliasTarget,
  createServer: () => createServer,
  normalizeArguments: () => normalizeArguments,
  parseToolsets: () => parseToolsets,
  pinnedInstructions: () => pinnedInstructions,
  stripLimits: () => stripLimits
});
module.exports = __toCommonJS(server_exports);
var import_mcp = require("../vendor/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js");
var import_zod = require("../vendor/zod/index.cjs");
var import_registry = require("./registry.js");
var import_guard = require("./guard.js");
var import_resources = require("./resources.js");
var import_version = require("./version.js");
const SERVER_INSTRUCTIONS = `
Huly workspaces (tracker, docs, chat, planner, \u2026), self-hosted or cloud.

- workspace: slug, name or id from list_workspaces. Required for changes \u2014 never guess; ask if unclear.
  Reads may omit it only if exactly one workspace exists. Ids are only valid within their workspace.
- Issue id PROJ-123; dates ISO 8601; people by name (ambiguous names are rejected); null clears a field; text is Markdown.
- Start with one-call overviews: my_day, standup, triage_inbox, project_report, get_issue_context.
- Agent work: start_work \u2192 work \u2192 finish_work; plans \u2192 create_issue_tree (dry run first); with parallel agents claim_issue first.
  The user says they start or are working on an issue \u2192 start_work it, even unasked. A side finding for that work \u2192 create_issue with parentIdentifier.
- Read before replacing: get_issue before update_issue description, get_document before update_document.
- Risky tools may ask the user; if declined, do not retry. Login or setup problems: check_setup. A change was wrong: undo_changes (dry run first).
- Missing tools may be in a disabled toolset (HULY_TOOLSETS).
`.trim();
function parseToolsets(value) {
  const raw = (value ?? "").split(",").map((t) => t.trim().toLowerCase()).filter((t) => t !== "");
  if (raw.length === 0) return /* @__PURE__ */ new Set(["core", ...import_registry.DEFAULT_TOOLSETS]);
  if (raw.includes("all")) return new Set(import_registry.TOOLSETS);
  const unknown = raw.filter((t) => !import_registry.TOOLSETS.includes(t));
  if (unknown.length > 0) {
    throw new Error(`Unknown toolset(s) in HULY_TOOLSETS: ${unknown.join(", ")}. Available: ${import_registry.TOOLSETS.filter((t) => t !== "core").join(", ")}, all`);
  }
  return /* @__PURE__ */ new Set(["core", ...raw]);
}
function pinnedInstructions(workspace) {
  return SERVER_INSTRUCTIONS.replace(/- workspace: [^\n]*\n[^\n]*\n/, `- All tools work in workspace '${workspace}' (HULY_WORKSPACE); there is no workspace argument.
`);
}
function createServer(options = {}) {
  const enabled = parseToolsets(options.toolsets ?? process.env.HULY_TOOLSETS);
  const pinned = (options.workspace ?? process.env.HULY_WORKSPACE ?? "").trim() || void 0;
  const annotate = options.annotations ?? ["1", "true", "yes"].includes(String(process.env.HULY_ANNOTATIONS ?? "").toLowerCase());
  const dynamic = options.dynamic ?? ["1", "true", "yes"].includes(String(process.env.HULY_DYNAMIC_TOOLSETS ?? "").toLowerCase());
  let instructions = pinned != null ? pinnedInstructions(pinned) : SERVER_INSTRUCTIONS;
  if (enabled.has("agent")) instructions += `
- Guides: resources huly://guide/workflow, huly://guide/costs, huly://guide/onboarding, huly://guide/features; prompt "setup" writes a project's Huly rules.`;
  if (dynamic) instructions = instructions.replace("- Missing tools may be in a disabled toolset (HULY_TOOLSETS).", "- More tools (calendar, cards, drive, testing, recruiting, \u2026) load on demand: enable_toolsets.");
  const server = new import_mcp.McpServer({ name: "huly-mcp-selfhost", version: import_version.VERSION }, { instructions });
  const asker = (0, import_guard.elicitationAsker)(server);
  const registered = /* @__PURE__ */ new Map();
  for (const tool of import_registry.TOOLS) {
    if (!enabled.has(tool.toolset) && !dynamic) continue;
    const handler = (0, import_guard.guard)(tool, process.env, asker);
    let reg;
    if (pinned == null || tool.schema.shape.workspace == null) {
      reg = annotate ? server.tool(tool.name, tool.description, tool.schema.shape, (0, import_guard.toolAnnotations)(tool), handler) : server.tool(tool.name, tool.description, tool.schema.shape, handler);
    } else {
      const { workspace: _ws, ...shape } = tool.schema.shape;
      const pinnedHandler = async (args, extra) => await handler({ ...args, workspace: pinned }, extra);
      reg = annotate ? server.tool(tool.name, tool.description, shape, (0, import_guard.toolAnnotations)(tool), pinnedHandler) : server.tool(tool.name, tool.description, shape, pinnedHandler);
    }
    if (!enabled.has(tool.toolset)) reg.disable();
    registered.set(tool.name, reg);
  }
  if (dynamic) registerEnableToolsets(server, enabled, registered);
  if (enabled.has("agent")) {
    (0, import_resources.registerResources)(server);
    server.hulySubscriptions = (0, import_resources.registerSubscriptions)(server);
    (0, import_resources.registerPrompts)(server);
  }
  slimToolList(server);
  checkArguments(server, new Map(import_registry.TOOLS.map((t) => [t.name, new Set(Object.keys(t.schema.shape))])));
  return server;
}
function registerEnableToolsets(server, enabled, registered) {
  const available = () => import_registry.TOOLSETS.filter((t) => !enabled.has(t));
  server.tool("enable_toolsets", "Load more Huly tools. No args: list toolsets and their tools; then pass the names you need", {
    toolsets: import_zod.z.array(import_zod.z.string()).optional()
  }, async (args) => {
    const names = (args.toolsets ?? []).map((t) => t.trim().toLowerCase());
    if (names.length === 0) {
      const lines = available().map((t) => `- **${t}** (${import_registry.TOOLS.filter((x) => x.toolset === t).length}): ${import_registry.TOOLS.filter((x) => x.toolset === t).map((x) => x.name).join(", ")}`);
      return { content: [{ type: "text", text: lines.length > 0 ? `## Toolsets not loaded yet

${lines.join("\n")}` : "All toolsets are loaded." }] };
    }
    const unknown = names.filter((n) => !import_registry.TOOLSETS.includes(n));
    if (unknown.length > 0) return { isError: true, content: [{ type: "text", text: `Unknown toolset(s): ${unknown.join(", ")}. Available: ${available().join(", ")}.` }] };
    const added = [];
    for (const n of names) {
      if (enabled.has(n)) continue;
      enabled.add(n);
      for (const tool of import_registry.TOOLS.filter((t) => t.toolset === n)) {
        registered.get(tool.name)?.enable();
        added.push(tool.name);
      }
    }
    return { content: [{ type: "text", text: added.length > 0 ? `\u2705 Loaded ${added.length} tool(s): ${added.join(", ")}. They are available from your next step.` : "Already loaded." }] };
  });
}
const LIMIT_KEYS = ["minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minItems", "maxItems"];
function stripLimits(node) {
  if (Array.isArray(node)) {
    for (const n of node) stripLimits(n);
    return;
  }
  if (node == null || typeof node !== "object") return;
  for (const k of LIMIT_KEYS) if (typeof node[k] === "number") delete node[k];
  for (const v of Object.values(node)) stripLimits(v);
}
const ARG_ALIASES = {
  status: "statusName",
  project: "projectIdentifier",
  projectId: "projectIdentifier",
  issue: "identifier",
  issueId: "identifier",
  id: "identifier",
  component: "componentLabel",
  milestone: "milestoneLabel"
};
const TOOL_ARG_ALIASES = {
  get_milestone: { milestoneLabel: "label", milestone: "label" },
  update_milestone: { milestoneLabel: "label", milestone: "label" },
  update_component: { componentLabel: "label", component: "label" }
};
function aliasTarget(tool, name, known) {
  const target = TOOL_ARG_ALIASES[tool]?.[name] ?? ARG_ALIASES[name];
  return target != null && known.has(target) ? target : void 0;
}
function normalizeArguments(tool, args, known) {
  const out = {};
  const unknown = [];
  for (const [k, v] of Object.entries(args)) {
    if (known.has(k) || k === "workspace") {
      out[k] = v;
      continue;
    }
    const target = aliasTarget(tool, k, known);
    if (target != null && !(target in args)) {
      out[target] = v;
      continue;
    }
    unknown.push(k);
  }
  if (unknown.length === 0) return { args: out };
  const valid = [...known].filter((k) => k !== "workspace");
  return { error: `Unknown parameter(s) for ${tool}: ${unknown.join(", ")}. ${valid.length > 0 ? `Valid: ${valid.join(", ")}` : "It takes no parameters besides workspace"}. Nothing was done.` };
}
function checkArguments(server, shapes) {
  const handlers = server.server._requestHandlers;
  const original = handlers?.get("tools/call");
  if (handlers == null || original == null) return;
  handlers.set("tools/call", async (req, extra) => {
    const known = shapes.get(req?.params?.name);
    const args = req?.params?.arguments;
    if (known == null || args == null || typeof args !== "object" || Array.isArray(args)) return await original(req, extra);
    const res = normalizeArguments(req.params.name, args, known);
    if ("error" in res) return { isError: true, content: [{ type: "text", text: res.error }] };
    return await original({ ...req, params: { ...req.params, arguments: res.args } }, extra);
  });
}
function slimToolList(server) {
  const handlers = server.server._requestHandlers;
  const original = handlers?.get("tools/list");
  if (handlers == null || original == null) return;
  handlers.set("tools/list", async (req, extra) => {
    const result = await original(req, extra);
    for (const tool of result?.tools ?? []) {
      if (tool.inputSchema != null) delete tool.inputSchema.$schema;
      stripLimits(tool.inputSchema);
      if (tool.execution?.taskSupport === "forbidden" && Object.keys(tool.execution).length === 1) delete tool.execution;
    }
    return result;
  });
}
