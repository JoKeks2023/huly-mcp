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
var activity_exports = {};
__export(activity_exports, {
  getActivity: () => getActivity
});
module.exports = __toCommonJS(activity_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_classes = require("../utils/classes.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
var import_resolve = require("../utils/resolve.js");
const when = (ts) => new Date(ts).toISOString().slice(0, 16).replace("T", " ");
async function describeValue(client, attrClass, value) {
  if (value == null) return "\u2014";
  if (typeof value === "string" && attrClass != null && attrClass.includes(":class:") && !attrClass.startsWith("core:class:Type")) {
    const label = await (0, import_resolve.loadLabel)(client, attrClass, value);
    return label === value ? value : label.replace(/^[A-Z]+-\d+: /, "");
  }
  if (typeof value === "number" && value > 1e12) return when(value);
  if (typeof value === "string") return (0, import_format.markupToText)(value).slice(0, 80);
  return JSON.stringify(value).slice(0, 80);
}
const getActivity = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const obj = await (0, import_resolve.resolveObject)(client, args.object);
  const messages = await client.findAll(import_classes.C.ActivityMessage, { attachedTo: obj._id }, { sort: { createdOn: import_core.SortingOrder.Descending }, limit: args.limit });
  if (messages.length === 0) return `No activity for ${obj.label}.`;
  messages.reverse();
  const who = await (0, import_people.socialIdNames)(client, [...new Set(messages.map((m) => m.createdBy).filter((x) => x != null))]);
  const lines = [];
  for (const m of messages) {
    const by = who.get(m.createdBy) ?? "System";
    let what;
    if (m._class === import_classes.C.DocUpdateMessage) {
      const u = m.attributeUpdates;
      if (m.action === "create") what = "created";
      else if (m.action === "remove") what = `removed ${String(m.objectClass ?? "").split(":").pop() ?? ""}`;
      else if (u != null) {
        const set = await Promise.all((u.set ?? []).map(async (v) => await describeValue(client, u.attrClass, v)));
        const added = await Promise.all((u.added ?? []).map(async (v) => await describeValue(client, u.attrClass, v)));
        const removed = await Promise.all((u.removed ?? []).map(async (v) => await describeValue(client, u.attrClass, v)));
        what = `${u.attrKey}: ${[set.length > 0 ? `\u2192 ${set.join(", ")}` : "", added.length > 0 ? `+ ${added.join(", ")}` : "", removed.length > 0 ? `\u2212 ${removed.join(", ")}` : ""].filter(Boolean).join(" ") || "changed"}`;
      } else what = `updated ${String(m.objectClass ?? "").split(":").pop() ?? ""}`;
    } else if (typeof m.message === "string") {
      what = `\u{1F4AC} ${(0, import_format.markupToText)(m.message).slice(0, 200)}${(m.replies ?? 0) > 0 ? ` (${m.replies} replies)` : ""} \`${m._id}\``;
    } else {
      what = String(m._class).split(":").pop() ?? "activity";
    }
    lines.push(`- ${when(m.createdOn)} **${by}** ${what}`);
  }
  return `## Activity of ${obj.label} (last ${messages.length})

${lines.join("\n")}`;
});
