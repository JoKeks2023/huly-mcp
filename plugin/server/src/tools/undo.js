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
var undo_exports = {};
__export(undo_exports, {
  undoChanges: () => undoChanges
});
module.exports = __toCommonJS(undo_exports);
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_undo = require("../utils/undo.js");
const time = (ts) => new Date(ts).toISOString().slice(11, 16);
const VERB = { created: "delete", changed: "restore", deleted: "re-create" };
function describeStep(s) {
  if (s.kind === "changed") return `restore ${(s.fields ?? []).join(", ")} on ${s.target.label}`;
  return `${VERB[s.kind]} ${s.target.label}`;
}
function planLines(entry) {
  const seen = /* @__PURE__ */ new Map();
  for (const s of [...entry.steps].reverse()) {
    const key = `${s.kind}:${s.target._id}`;
    if (!seen.has(key)) seen.set(key, describeStep(s));
  }
  const lines = [...seen.values()];
  return lines.length > 6 ? [...lines.slice(0, 5), `\u2026 ${lines.length - 5} more`] : lines;
}
const sameWorkspace = (a, b) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
async function applyStep(client, s) {
  const exists = async () => await client.findOne(s.target._class, { _id: s.target._id }).catch(() => void 0) != null;
  switch (s.method) {
    case "removeDoc":
    case "removeCollection":
      if (!await exists()) return "skipped";
      await client[s.method](...s.args);
      return "done";
    case "updateDoc":
    case "updateMixin":
      if (s.method === "updateDoc" && !await exists()) return "skipped";
      await client[s.method](...s.args);
      return "done";
    case "createDoc": {
      if (await exists()) return "skipped";
      const [_class, space, data, id, mixins] = s.args;
      await client.createDoc(_class, space, data, id);
      for (const [mixin, attrs] of Object.entries(mixins ?? {})) await client.createMixin(id, _class, space, mixin, attrs);
      return "done";
    }
    case "addCollection": {
      if (await exists()) return "skipped";
      const [_class, space, attachedTo, attachedToClass, collection, data, id, mixins] = s.args;
      await client.addCollection(_class, space, attachedTo, attachedToClass, collection, data, id);
      for (const [mixin, attrs] of Object.entries(mixins ?? {})) await client.createMixin(id, _class, space, mixin, attrs);
      return "done";
    }
  }
}
const undoChanges = (0, import_errors.wrapToolHandler)(async (args) => {
  const journal = (0, import_undo.journalOf)((0, import_connection.getConnectionManager)());
  const mine = journal.filter((e) => sameWorkspace(e.workspace, args.workspace));
  if (mine.length === 0) return `Nothing to undo in workspace ${args.workspace} \u2014 no changes were made through this server${journal.length > 0 ? " in this workspace" : ""} since it started.`;
  const picked = mine.slice(-args.count).reverse();
  const header = (e, i) => `${i + 1}. ${time(e.at)} UTC \u2014 ${e.tool}${e.failed != null ? " (failed halfway \u2014 undoing the part that was done)" : ""}`;
  if (args.dryRun) {
    const out = picked.map((e, i) => [header(e, i), ...planLines(e).map((l) => `   - ${l}`)].join("\n"));
    return `## Undo \u2014 dry run (${picked.length} of ${mine.length} change(s) in ${args.workspace})

${out.join("\n")}

Run again with dryRun: false to undo. Activity entries and notifications Huly created stay; file contents that were deleted are not restored.`;
  }
  const client = await (0, import_connection.getConnection)(args.workspace);
  const touchedByUs = /* @__PURE__ */ new Set();
  const results = [];
  for (const [i, entry] of picked.entries()) {
    if (!args.force) {
      const changed = [];
      for (const [id, a] of Object.entries(entry.after)) {
        if (touchedByUs.has(id)) continue;
        const now = await client.findOne(a._class, { _id: id }).catch(() => void 0);
        const current = now?.modifiedOn ?? null;
        if (current !== a.modifiedOn) changed.push(entry.steps.find((s) => s.target._id === id)?.target.label ?? id);
      }
      if (changed.length > 0) {
        results.push(`${header(entry, i)}
   \u26A0\uFE0F skipped \u2014 changed since: ${changed.join(", ")} (force: true undoes anyway)`);
        break;
      }
    }
    let done = 0;
    let skipped = 0;
    for (const step of [...entry.steps].reverse()) {
      if (await applyStep(client, step) === "done") done++;
      else skipped++;
      touchedByUs.add(step.target._id);
    }
    journal.splice(journal.indexOf(entry), 1);
    for (const id of new Set(entry.steps.map((s) => s.target._id))) {
      const cls = entry.steps.find((s) => s.target._id === id).target._class;
      const now = await client.findOne(cls, { _id: id }).catch(() => void 0);
      for (const older of journal) if (older.after[id] != null) older.after[id].modifiedOn = now?.modifiedOn ?? null;
    }
    results.push(`${header(entry, i)}
   \u2705 undone (${done} step(s)${skipped > 0 ? `, ${skipped} already in place` : ""}): ${planLines(entry).join("; ")}`);
  }
  return `## Undo in ${args.workspace}

${results.join("\n")}`;
});
