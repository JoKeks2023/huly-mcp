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
  allowedIssueStatuses: () => allowedIssueStatuses,
  resolveIssueStatus: () => resolveIssueStatus
});
module.exports = __toCommonJS(statuses_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
async function allowedIssueStatuses(client, project, kind) {
  const all = await client.findAll(import_tracker.default.class.IssueStatus, {});
  const type = project?.type != null ? await client.findOne("task:class:ProjectType", { _id: project.type }) : void 0;
  const entries = type?.statuses ?? [];
  if (entries.length === 0) return all;
  const ids = new Set(entries.filter((e) => kind == null || e.taskType == null || e.taskType === kind).map((e) => e._id));
  const allowed = all.filter((s) => ids.has(s._id));
  return allowed.length > 0 ? allowed : all;
}
async function resolveIssueStatus(client, project, kind, name) {
  const allowed = await allowedIssueStatuses(client, project, kind);
  const hit = allowed.find((s) => String(s.name).toLowerCase() === name.trim().toLowerCase());
  if (hit != null) return hit;
  const elsewhere = (await client.findAll(import_tracker.default.class.IssueStatus, {})).some((s) => String(s.name).toLowerCase() === name.trim().toLowerCase());
  const names = [...new Set(allowed.map((s) => s.name))].join(", ");
  throw new Error(elsewhere ? `Status '${name}' is not used for issues in ${String(project?.identifier ?? "this project")} (it belongs to another task type, e.g. pull requests). Available: ${names}.` : `Status '${name}' not found. Available: ${names}.`);
}
