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
var tasks_exports = {};
__export(tasks_exports, {
  contactName: () => contactName,
  findContact: () => findContact,
  findNamed: () => findNamed,
  nextNumber: () => nextNumber,
  parseDay: () => parseDay,
  pickStatus: () => pickStatus,
  statusName: () => statusName,
  workflowOf: () => workflowOf
});
module.exports = __toCommonJS(tasks_exports);
var import_people = require("./people.js");
async function nextNumber(client, cls) {
  const seq = await client.findOne("core:class:Sequence", { attachedTo: cls });
  if (seq == null) throw new Error(`No number sequence for ${cls} \u2014 is the module enabled in this workspace?`);
  const res = await client.update(seq, { $inc: { sequence: 1 } }, true);
  return res?.object?.sequence ?? Number(seq.sequence ?? 0) + 1;
}
async function workflowOf(client, space) {
  const type = await client.findOne("task:class:ProjectType", { _id: space.type });
  const kind = type?.tasks?.[0];
  if (kind == null) throw new Error(`'${String(space.name)}' has no task type.`);
  const taskType = await client.findOne("task:class:TaskType", { _id: kind });
  const ids = taskType?.statuses ?? [];
  const docs = await client.findAll("core:class:Status", { _id: { $in: ids } });
  const statuses = ids.map((id) => docs.find((d) => d._id === id)).filter((d) => d != null).map((d) => ({ _id: d._id, name: d.name, category: d.category }));
  return { kind, statuses };
}
function pickStatus(wf, name) {
  if (name == null) {
    if (wf.statuses.length === 0) throw new Error("This workflow has no statuses.");
    return wf.statuses[0]._id;
  }
  const hit = wf.statuses.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  if (hit == null) throw new Error(`Status '${name}' not found. Available: ${wf.statuses.map((s) => s.name).join(", ")}.`);
  return hit._id;
}
const statusName = (wf, id) => wf.statuses.find((s) => s._id === id)?.name ?? "?";
const contactName = (c) => c == null ? "\u2014" : c._class === "contact:class:Organization" ? String(c.name ?? "") : (0, import_people.formatPersonName)(c.name);
async function findContact(client, ref, cls = "contact:class:Contact") {
  const byId = await client.findOne(cls, { _id: ref });
  if (byId != null) return byId;
  const all = await client.findAll(cls, {});
  const q = ref.trim().toLowerCase();
  const exact = all.filter((c) => contactName(c).toLowerCase() === q || String(c.name ?? "").toLowerCase() === q);
  const hits = exact.length > 0 ? exact : all.filter((c) => contactName(c).toLowerCase().includes(q));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) throw new Error(`Contact '${ref}' not found.`);
  throw new Error(`Contact '${ref}' is ambiguous: ${hits.slice(0, 8).map(contactName).join(", ")}.`);
}
async function findNamed(client, cls, ref, what, query = {}) {
  const all = await client.findAll(cls, query);
  const hits = all.filter((d) => d._id === ref || String(d.name ?? d.title ?? "").toLowerCase() === ref.trim().toLowerCase());
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) throw new Error(`${what} '${ref}' not found. Available: ${all.map((d) => d.name ?? d.title).slice(0, 15).join(", ") || "none"}.`);
  throw new Error(`${what} '${ref}' is ambiguous \u2014 pass its id.`);
}
function parseDay(value, field) {
  const t = Date.parse(value);
  if (Number.isNaN(t)) throw new Error(`${field} must be a date (YYYY-MM-DD), got '${value}'.`);
  return t;
}
