var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var statuses_exports = {};
__export(statuses_exports, {
  createIssueStatus: () => createIssueStatus,
  listIssueStatuses: () => listIssueStatuses
});
module.exports = __toCommonJS(statuses_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_task = __toESM(require("../../vendor/@hcengineering/task/lib/index.js"));
var import_core = __toESM(require("../../vendor/@hcengineering/core/lib/index.js"));
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
const CATEGORY_MAP = {
  Backlog: { ref: import_task.default.statusCategory.UnStarted, label: "Backlog" },
  Todo: { ref: import_task.default.statusCategory.ToDo, label: "Todo" },
  InProgress: { ref: import_task.default.statusCategory.Active, label: "In Progress" },
  Done: { ref: import_task.default.statusCategory.Won, label: "Done" },
  Cancelled: { ref: import_task.default.statusCategory.Lost, label: "Cancelled" }
};
const listIssueStatuses = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const statuses = await client.findAll(import_tracker.default.class.IssueStatus, {});
  if (statuses.length === 0) return "No issue statuses found.";
  const byCategory = /* @__PURE__ */ new Map();
  for (const s of statuses) {
    const key = String(s.category ?? "Unknown");
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(s);
  }
  const lines = [];
  for (const [category, group] of byCategory) {
    const shortCategory = category.split(":").pop() ?? category;
    lines.push(`**${shortCategory}:**`);
    for (const s of group) lines.push(`  - ${s.name} (id: \`${s._id}\`)`);
  }
  return `## Issue Statuses (${statuses.length})

${lines.join("\n")}`;
});
const createIssueStatus = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  let types;
  if (args.projectIdentifier != null) {
    const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
    if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
    types = await client.findAll(import_task.default.class.ProjectType, { _id: project.type });
  } else {
    types = (await client.findAll(import_task.default.class.ProjectType, {})).filter((t) => String(t.descriptor ?? "").startsWith("tracker:") || String(t._id).startsWith("tracker:") || (t.statuses ?? []).some((s) => String(s._id).startsWith("tracker:status:")));
  }
  if (types.length === 0) throw new Error("No tracker project type found.");
  const mapped = CATEGORY_MAP[args.category];
  if (mapped == null) throw new Error(`Unknown category '${args.category}'.`);
  let status = (await client.findAll(import_tracker.default.class.IssueStatus, {})).find((s) => String(s.name).toLowerCase() === args.name.trim().toLowerCase());
  const created = status == null;
  if (status == null) {
    const statusId = (0, import_core.generateId)();
    await client.createDoc(import_tracker.default.class.IssueStatus, import_core.default.space.Model, {
      ofAttribute: import_tracker.default.attribute.IssueStatus,
      category: mapped.ref,
      name: args.name.trim(),
      color: args.color != null ? parseInt(args.color.replace("#", ""), 16) : void 0
    }, statusId);
    status = { _id: statusId, name: args.name.trim() };
  }
  const added = [];
  for (const type of types) {
    const issueTypes = (await client.findAll(import_task.default.class.TaskType, { parent: type._id })).filter((t) => t.ofClass === import_tracker.default.class.Issue);
    for (const tt of issueTypes) {
      if ((tt.statuses ?? []).includes(status._id)) continue;
      await client.updateDoc(import_task.default.class.TaskType, tt.space, tt._id, { $push: { statuses: status._id } });
      if (!(type.statuses ?? []).some((e) => e._id === status._id && e.taskType === tt._id)) {
        await client.updateDoc(import_task.default.class.ProjectType, type.space, type._id, { $push: { statuses: { _id: status._id, taskType: tt._id } } });
      }
      added.push(String(type.name ?? type._id));
    }
  }
  const what = created ? `created in the **${mapped.label}** phase` : "already existed";
  return added.length > 0 ? `\u2705 Status **"${String(status.name)}"** ${what}; now usable for issues in: ${[...new Set(added)].join(", ")}.` : `\u2139\uFE0F Status **"${String(status.name)}"** ${what} and is already usable for issues there.`;
});
