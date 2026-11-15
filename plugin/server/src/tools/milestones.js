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
var milestones_exports = {};
__export(milestones_exports, {
  createMilestone: () => createMilestone,
  deleteMilestone: () => deleteMilestone,
  getMilestone: () => getMilestone,
  listMilestones: () => listMilestones,
  updateMilestone: () => updateMilestone
});
module.exports = __toCommonJS(milestones_exports);
var import_labels = require("../utils/labels.js");
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_task = __toESM(require("../../vendor/@hcengineering/task/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
async function findProject(client, identifier) {
  const project = await client.findOne(import_tracker.default.class.Project, { identifier });
  if (project == null) throw new Error(`Project '${identifier}' not found.`);
  return project;
}
async function findMilestone(client, project, label) {
  return await (0, import_labels.findByLabel)(client, "milestone", project._id, label, project.identifier);
}
function parseDate(value) {
  const ts = new Date(value).getTime();
  if (isNaN(ts)) throw new Error(`Invalid date: '${value}'`);
  return ts;
}
const listMilestones = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.projectIdentifier);
  const milestones = await client.findAll(import_tracker.default.class.Milestone, { space: project._id });
  if (milestones.length === 0) return `No milestones found in project ${args.projectIdentifier}.`;
  const lines = milestones.map((m) => {
    const status = import_format.MILESTONE_STATUS_LABELS[m.status] ?? "Unknown";
    const target = (0, import_format.formatDate)(m.targetDate);
    return `- **${m.label}** [${status}] \u2014 Target: ${target}`;
  });
  return `## Milestones in ${args.projectIdentifier} (${milestones.length})

${lines.join("\n")}`;
});
const MILESTONE_STATUS_MAP = {
  Planned: import_tracker.MilestoneStatus.Planned,
  InProgress: import_tracker.MilestoneStatus.InProgress,
  Completed: import_tracker.MilestoneStatus.Completed,
  Canceled: import_tracker.MilestoneStatus.Canceled
};
const createMilestone = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.projectIdentifier);
  const targetDate = parseDate(args.targetDate);
  const status = MILESTONE_STATUS_MAP[args.status] ?? import_tracker.MilestoneStatus.Planned;
  await client.createDoc(
    import_tracker.default.class.Milestone,
    project._id,
    {
      label: args.label,
      targetDate,
      status,
      comments: 0
    },
    (0, import_core.generateId)()
  );
  return `Milestone **${args.label}** created in project ${args.projectIdentifier} with target date ${args.targetDate}.`;
});
const getMilestone = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.projectIdentifier);
  const milestone = await findMilestone(client, project, args.label);
  const issues = await client.findAll(import_tracker.default.class.Issue, { space: project._id, milestone: milestone._id });
  const statuses = await client.findAll(import_tracker.default.class.IssueStatus, {});
  const categoryById = new Map(statuses.map((s) => [s._id, s.category]));
  const isDone = (cat) => cat === import_task.default.statusCategory.Won;
  const isCanceled = (cat) => cat === import_task.default.statusCategory.Lost;
  const done = issues.filter((i) => isDone(categoryById.get(i.status))).length;
  const canceled = issues.filter((i) => isCanceled(categoryById.get(i.status))).length;
  const open = issues.length - done - canceled;
  const status = import_format.MILESTONE_STATUS_LABELS[milestone.status] ?? "Unknown";
  const description = (0, import_format.markupToText)(milestone.description);
  const openIssues = issues.filter((i) => {
    const c = categoryById.get(i.status);
    return !isDone(c) && !isCanceled(c);
  }).map((i) => `- ${i.identifier}: ${i.title}`);
  return [
    `## Milestone ${milestone.label} (${args.projectIdentifier})`,
    "",
    `**Status:** ${status}`,
    `**Target date:** ${(0, import_format.formatDate)(milestone.targetDate)}`,
    `**Progress:** ${done}/${issues.length - canceled} done (${open} open, ${canceled} canceled)`,
    description !== "" ? `
**Description:**
${description}` : "",
    openIssues.length > 0 ? `
**Open issues:**
${openIssues.join("\n")}` : ""
  ].filter((l) => l !== "").join("\n");
});
const updateMilestone = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.projectIdentifier);
  const milestone = await findMilestone(client, project, args.label);
  const updates = {};
  if (args.newLabel !== void 0 && args.newLabel !== milestone.label) {
    const clash = await client.findOne(import_tracker.default.class.Milestone, { space: project._id, label: args.newLabel });
    if (clash != null) throw new Error(`A milestone named '${args.newLabel}' already exists in project ${args.projectIdentifier}.`);
    updates.label = args.newLabel;
  }
  if (args.targetDate !== void 0) updates.targetDate = parseDate(args.targetDate);
  if (args.status !== void 0) updates.status = MILESTONE_STATUS_MAP[args.status];
  if (args.description !== void 0) updates.description = (0, import_format.textToMarkup)(args.description);
  if (Object.keys(updates).length === 0) return `Nothing to update for milestone **${milestone.label}**.`;
  await client.updateDoc(import_tracker.default.class.Milestone, project._id, milestone._id, updates);
  const changed = Object.keys(updates).map((k) => k === "label" ? "name" : k).join(", ");
  return `\u2705 Milestone **${updates.label ?? milestone.label}** updated (${changed}).`;
});
const deleteMilestone = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.projectIdentifier);
  const milestone = await findMilestone(client, project, args.label);
  let target = null;
  if (args.moveIssuesTo !== void 0) {
    const dest = await findMilestone(client, project, args.moveIssuesTo);
    if (dest._id === milestone._id) throw new Error("moveIssuesTo must name a different milestone.");
    target = dest._id;
  }
  const issues = await client.findAll(import_tracker.default.class.Issue, { space: project._id, milestone: milestone._id });
  for (const issue of issues) {
    await client.updateDoc(import_tracker.default.class.Issue, issue.space, issue._id, { milestone: target });
  }
  await client.removeDoc(import_tracker.default.class.Milestone, project._id, milestone._id);
  const effect = issues.length === 0 ? "No issues were assigned to it." : target != null ? `${issues.length} issue(s) moved to **${args.moveIssuesTo}**.` : `${issues.length} issue(s) no longer have a milestone.`;
  return `\u{1F5D1}\uFE0F Milestone **${milestone.label}** deleted from ${args.projectIdentifier}. ${effect}`;
});
