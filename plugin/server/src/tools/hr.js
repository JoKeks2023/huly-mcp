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
var hr_exports = {};
__export(hr_exports, {
  HR: () => HR,
  REQUEST_TYPES: () => REQUEST_TYPES,
  createDepartment: () => createDepartment,
  createTimeOff: () => createTimeOff,
  deleteDepartment: () => deleteDepartment,
  deleteTimeOff: () => deleteTimeOff,
  listDepartments: () => listDepartments,
  listTimeOff: () => listTimeOff,
  setDepartment: () => setDepartment,
  toTzDate: () => toTzDate,
  tzText: () => tzText
});
module.exports = __toCommonJS(hr_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
var import_tasks = require("../utils/tasks.js");
const HR = {
  Department: "hr:class:Department",
  Staff: "hr:mixin:Staff",
  Request: "hr:class:Request",
  Head: "hr:ids:Head",
  Space: "core:space:Workspace"
};
const REQUEST_TYPES = {
  vacation: "hr:ids:Vacation",
  sick: "hr:ids:Sick",
  pto: "hr:ids:PTO",
  "pto-half-day": "hr:ids:PTO2",
  overtime: "hr:ids:Overtime",
  "overtime-half-day": "hr:ids:Overtime2",
  remote: "hr:ids:Remote"
};
const TYPE_NAME = new Map(Object.entries(REQUEST_TYPES).map(([k, v]) => [v, k]));
function toTzDate(value, field) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m == null) throw new Error(`${field} must be YYYY-MM-DD, got '${value}'.`);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1) throw new Error(`${field} '${value}' is not a real date.`);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), offset: d.getTimezoneOffset() };
}
const tzText = (t) => t == null ? "?" : `${t.year}-${String(t.month + 1).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
const tzKey = (t) => t.year * 1e4 + t.month * 100 + t.day;
async function findDepartment(client, ref) {
  if (ref.toLowerCase() === "organization" || ref === HR.Head) {
    const head = await client.findOne(HR.Department, { _id: HR.Head });
    if (head != null) return head;
  }
  return await (0, import_tasks.findNamed)(client, HR.Department, ref, "Department");
}
const listDepartments = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const deps = await client.findAll(HR.Department, {});
  if (deps.length === 0) return "No departments (is the HR module enabled?).";
  const names = await (0, import_people.peopleNames)(client);
  const staff = await client.findAll(HR.Staff, {});
  const lines = [];
  const walk = (parent, depth) => {
    for (const d of deps.filter((x) => (x.parent ?? void 0) === parent && x._id !== parent)) {
      const people = staff.filter((s) => s[HR.Staff]?.department === d._id).map((s) => names.get(s._id) ?? "?");
      const lead = d.teamLead != null ? ` \xB7 lead ${names.get(d.teamLead) ?? "?"}` : "";
      lines.push(`${"  ".repeat(depth)}- **${String(d.name)}**${lead} \xB7 ${people.length > 0 ? people.join(", ") : "no members"} \u2014 \`${String(d._id)}\``);
      walk(d._id, depth + 1);
    }
  };
  walk(void 0, 0);
  return `## Departments (${deps.length})

${lines.join("\n")}`;
});
const createDepartment = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const parent = await findDepartment(client, args.parent ?? HR.Head);
  const all = await client.findAll(HR.Department, {});
  if (all.some((d) => String(d.name).toLowerCase() === args.name.trim().toLowerCase())) throw new Error(`Department '${args.name}' already exists.`);
  const teamLead = args.teamLead != null ? (await (0, import_people.findPerson)(client, args.teamLead))._id : null;
  const id = (0, import_core.generateId)();
  await client.createDoc(HR.Department, HR.Space, { name: args.name.trim(), description: "", parent: parent._id, members: [], teamLead, managers: [] }, id);
  return `\u2705 Department **${args.name}** created under ${String(parent.name)} \u2014 \`${id}\``;
});
const deleteDepartment = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const d = await findDepartment(client, args.department);
  if (d._id === HR.Head) throw new Error("The root department cannot be deleted.");
  const children = await client.findAll(HR.Department, { parent: d._id });
  if (children.length > 0) throw new Error(`${String(d.name)} has sub-departments (${children.map((c) => c.name).join(", ")}) \u2014 delete or move them first.`);
  await client.removeDoc(HR.Department, d.space, d._id);
  return `\u{1F5D1}\uFE0F Department **${String(d.name)}** deleted. Its members are moved out by Huly.`;
});
const setDepartment = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const dep = await findDepartment(client, args.department);
  const person = await (0, import_people.findPerson)(client, args.member);
  const doc = await client.findOne("contact:class:Person", { _id: person._id });
  if (doc[HR.Staff] == null) await client.createMixin(doc._id, doc._class, doc.space, HR.Staff, { department: dep._id });
  else if (doc[HR.Staff].department === dep._id) return `${person.name} is already in ${String(dep.name)}.`;
  else await client.updateMixin(doc._id, doc._class, doc.space, HR.Staff, { department: dep._id });
  return `\u2705 ${person.name} \u2192 department ${String(dep.name)}.`;
});
const listTimeOff = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const query = {};
  if (args.member != null) query.attachedTo = (await (0, import_people.findPerson)(client, args.member))._id;
  if (args.department != null) query.department = (await findDepartment(client, args.department))._id;
  let reqs = await client.findAll(HR.Request, query);
  const from = args.from != null ? tzKey(toTzDate(args.from, "from")) : void 0;
  const to = args.to != null ? tzKey(toTzDate(args.to, "to")) : void 0;
  reqs = reqs.filter((r) => (from == null || tzKey(r.tzDueDate) >= from) && (to == null || tzKey(r.tzDate) <= to)).sort((a, b) => tzKey(a.tzDate) - tzKey(b.tzDate));
  if (reqs.length === 0) return "No time-off requests in that range.";
  const names = await (0, import_people.peopleNames)(client);
  const lines = reqs.map((r) => {
    const note = (0, import_format.markupToText)(r.description).trim();
    return `- ${tzText(r.tzDate)}${tzKey(r.tzDate) !== tzKey(r.tzDueDate) ? ` \u2013 ${tzText(r.tzDueDate)}` : ""} \xB7 **${names.get(r.attachedTo) ?? "?"}** \xB7 ${TYPE_NAME.get(r.type) ?? String(r.type)}${note !== "" ? ` \u2014 ${note.slice(0, 120)}` : ""} \u2014 \`${String(r._id)}\``;
  });
  return `## Time off (${reqs.length})

${lines.join("\n")}`;
});
const createTimeOff = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const person = args.member != null ? await (0, import_people.findPerson)(client, args.member) : await (0, import_people.currentPerson)(client);
  const doc = await client.findOne("contact:class:Person", { _id: person._id });
  const department = doc?.[HR.Staff]?.department;
  if (department == null) throw new Error(`${person.name} is not in any department yet \u2014 set_department first.`);
  const start = toTzDate(args.from, "from");
  const end = toTzDate(args.to ?? args.from, "to");
  if (tzKey(end) < tzKey(start)) throw new Error("to is before from.");
  const id = (0, import_core.generateId)();
  await client.addCollection(HR.Request, HR.Space, doc._id, doc._class, "requests", {
    type: REQUEST_TYPES[args.type],
    tzDate: start,
    tzDueDate: end,
    description: (0, import_format.textToMarkup)(args.description ?? ""),
    department
  }, id);
  return `\u2705 ${args.type} for ${person.name}: ${tzText(start)}${tzKey(end) !== tzKey(start) ? ` \u2013 ${tzText(end)}` : ""} \u2014 \`${id}\``;
});
const deleteTimeOff = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const r = await client.findOne(HR.Request, { _id: args.id });
  if (r == null) throw new Error(`Time-off request '${args.id}' not found (ids come from list_time_off).`);
  await client.removeCollection(HR.Request, r.space, r._id, r.attachedTo, r.attachedToClass, r.collection ?? "requests");
  return `\u{1F5D1}\uFE0F Time-off request ${tzText(r.tzDate)} deleted.`;
});
