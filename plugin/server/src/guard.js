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
var guard_exports = {};
__export(guard_exports, {
  assertWriteAllowed: () => assertWriteAllowed,
  audit: () => audit,
  describeCall: () => describeCall,
  elicitationAsker: () => elicitationAsker,
  guard: () => guard,
  isMutation: () => isMutation,
  isRisky: () => isRisky,
  needsConfirmation: () => needsConfirmation,
  parseConfirmMode: () => parseConfirmMode,
  parseWriteProjects: () => parseWriteProjects,
  projectsIn: () => projectsIn,
  toolAnnotations: () => toolAnnotations
});
module.exports = __toCommonJS(guard_exports);
var import_node_fs = require("node:fs");
var import_admin = require("./tools/admin.js");
var import_undo = require("./utils/undo.js");
var import_connection = require("./connection.js");
const TASK_ID = /^([A-Z][A-Z0-9]*)-\d+$/;
const PROJECT_KEYS = /* @__PURE__ */ new Set(["projectIdentifier", "targetProjectIdentifier", "projectIdentifiers"]);
function isMutation(tool) {
  const ws = tool.schema.shape.workspace;
  return ws != null && !ws.isOptional();
}
function projectsIn(args, key = "") {
  const out = /* @__PURE__ */ new Set();
  const visit = (value, k) => {
    if (typeof value === "string") {
      if (PROJECT_KEYS.has(k)) out.add(value.toUpperCase());
      const m = TASK_ID.exec(value);
      if (m != null) out.add(m[1]);
    } else if (Array.isArray(value)) {
      for (const v of value) visit(v, k);
    } else if (value != null && typeof value === "object") {
      for (const [ck, cv] of Object.entries(value)) visit(cv, ck);
    }
  };
  visit(args, key);
  return out;
}
function parseWriteProjects(value) {
  const list = (value ?? "").split(",").map((p) => p.trim().toUpperCase()).filter((p) => p !== "");
  return list.length > 0 ? new Set(list) : void 0;
}
function assertWriteAllowed(tool, args, allowed) {
  if (allowed == null || !isMutation(tool)) return;
  const denied = [...projectsIn(args)].filter((p) => !allowed.has(p));
  if (denied.length > 0) {
    throw new Error(`Huly MCP: ${tool.name} touches project(s) ${denied.join(", ")}, but HULY_WRITE_PROJECTS only allows ${[...allowed].join(", ")}.`);
  }
}
function shorten(value, depth = 0) {
  if (typeof value === "string") return value.length > 200 ? `${value.slice(0, 200)}\u2026 (${value.length} chars)` : value;
  if (Array.isArray(value)) return depth > 3 ? `[${value.length} items]` : value.map((v) => shorten(v, depth + 1));
  if (value != null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, /base64/i.test(k) ? `[${String(v).length} chars]` : shorten(v, depth + 1)]));
  }
  return value;
}
function audit(path, tool, args, outcome) {
  if (path == null || path === "" || !isMutation(tool)) return;
  const entry = { ts: (/* @__PURE__ */ new Date()).toISOString(), tool: tool.name, args: shorten(args), ok: outcome.ok, result: outcome.text.split("\n")[0].slice(0, 300) };
  try {
    (0, import_node_fs.appendFileSync)(path, JSON.stringify(entry) + "\n");
  } catch {
  }
}
const RISKY = /* @__PURE__ */ new Set(["set_module", "update_workspace_settings", "create_workspace", "huly_api", "undo_changes", "bulk_update_issues", "move_issue", "generic_update", "generic_delete", "revoke_public_link", "restore_file_version", "send_invite", "set_member_role", "cancel_execution"]);
function isRisky(name) {
  return name.startsWith("delete_") || RISKY.has(name);
}
function needsConfirmation(name, args) {
  if (name === "huly_api") return args?.dryRun === false && !import_admin.API_READ.includes(String(args?.method ?? ""));
  return isRisky(name) && args?.dryRun !== true;
}
function toolAnnotations(tool) {
  const title = tool.name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  if (!isMutation(tool)) return { title, readOnlyHint: true };
  return { title, destructiveHint: isRisky(tool.name) || /^(remove|revoke)_/.test(tool.name) };
}
function parseConfirmMode(value) {
  const v = (value ?? "auto").trim().toLowerCase();
  if (v === "auto" || v === "off" || v === "strict") return v;
  throw new Error(`HULY_CONFIRM must be auto, off or strict (got '${value ?? ""}').`);
}
function describeCall(tool, args) {
  const parts = Object.entries(args ?? {}).filter(([k, v]) => k !== "workspace" && v != null && k !== "confirm").map(([k, v]) => `${k}: ${JSON.stringify(shorten(v)).slice(0, 160)}`);
  const ws = typeof args?.workspace === "string" ? ` in workspace ${args.workspace}` : "";
  return `Huly: ${tool.name.replace(/_/g, " ")}${ws}?
${parts.join("\n")}`;
}
function elicitationAsker(server) {
  return {
    canAsk: () => server.server.getClientCapabilities()?.elicitation?.form != null,
    ask: async (message) => {
      const res = await server.server.elicitInput({
        mode: "form",
        message,
        requestedSchema: { type: "object", properties: { confirm: { type: "boolean", title: "Yes, do it", default: false } }, required: ["confirm"] }
      });
      return res.action === "accept" && res.content?.confirm === true;
    }
  };
}
async function remember(owner, tool, args, steps, error) {
  const after = {};
  try {
    const client = await (0, import_connection.getConnection)(args?.workspace);
    for (const s of steps) {
      if (after[s.target._id] != null) continue;
      const doc = s.kind === "deleted" ? void 0 : await client.findOne(s.target._class, { _id: s.target._id }).catch(() => void 0);
      after[s.target._id] = { _class: s.target._class, modifiedOn: doc?.modifiedOn ?? null };
    }
  } catch {
  }
  (0, import_undo.addEntry)(owner, { tool: tool.name, workspace: args?.workspace, at: Date.now(), steps, after, failed: error != null ? error.message : void 0 });
}
function guard(tool, env = process.env, asker) {
  const allowed = parseWriteProjects(env.HULY_WRITE_PROJECTS);
  const auditPath = env.HULY_AUDIT_LOG;
  const confirm = parseConfirmMode(env.HULY_CONFIRM);
  return async (args) => {
    assertWriteAllowed(tool, args, allowed);
    if (confirm !== "off" && needsConfirmation(tool.name, args)) {
      const canAsk = asker?.canAsk() === true;
      if (!canAsk && confirm === "strict") {
        audit(auditPath, tool, args, { ok: false, text: "refused: HULY_CONFIRM=strict and the client cannot ask" });
        throw new Error(`Huly MCP: ${tool.name} needs a human confirmation (HULY_CONFIRM=strict), but this client cannot ask. Leave it to a person.`);
      }
      if (canAsk) {
        let yes = false;
        try {
          yes = await asker.ask(describeCall(tool, args));
        } catch (e) {
          audit(auditPath, tool, args, { ok: false, text: `confirmation failed: ${e.message}` });
          throw new Error(`Huly MCP: could not ask for confirmation of ${tool.name} (${e.message}). Nothing was changed.`);
        }
        if (!yes) {
          audit(auditPath, tool, args, { ok: false, text: "declined by the user" });
          return { content: [{ type: "text", text: `Cancelled: the user declined ${tool.name}. Nothing was changed \u2014 do not retry unless they ask.` }] };
        }
      }
    }
    if (isMutation(tool) && tool.name !== "undo_changes") {
      const owner = (0, import_connection.getConnectionManager)();
      const { result, error, steps } = await (0, import_undo.recordChanges)(async () => await tool.handler(args));
      if (steps.length > 0) await remember(owner, tool, args, steps, error);
      if (error != null) {
        audit(auditPath, tool, args, { ok: false, text: error.message });
        throw error;
      }
      audit(auditPath, tool, args, { ok: true, text: result.content[0]?.text ?? "" });
      return result;
    }
    try {
      const result = await tool.handler(args);
      audit(auditPath, tool, args, { ok: true, text: result.content[0]?.text ?? "" });
      return result;
    } catch (e) {
      audit(auditPath, tool, args, { ok: false, text: e.message });
      throw e;
    }
  };
}
