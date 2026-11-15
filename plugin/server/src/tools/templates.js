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
var templates_exports = {};
__export(templates_exports, {
  createIssueFromTemplate: () => createIssueFromTemplate,
  createIssueTemplate: () => createIssueTemplate,
  deleteIssueTemplate: () => deleteIssueTemplate,
  getIssueTemplate: () => getIssueTemplate,
  listIssueTemplates: () => listIssueTemplates,
  updateIssueTemplate: () => updateIssueTemplate
});
module.exports = __toCommonJS(templates_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_tags = __toESM(require("../../vendor/@hcengineering/tags/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
var import_issues = require("./issues.js");
var import_labels = require("./labels.js");
var import_agent = require("./agent.js");
const PRIORITY = { NoPriority: import_tracker.IssuePriority.NoPriority, Urgent: import_tracker.IssuePriority.Urgent, High: import_tracker.IssuePriority.High, Medium: import_tracker.IssuePriority.Medium, Low: import_tracker.IssuePriority.Low };
const PRIORITY_NAME = Object.fromEntries(Object.entries(PRIORITY).map(([k, v]) => [v, k]));
async function findProject(client, identifier) {
  const project = await client.findOne(import_tracker.default.class.Project, { identifier });
  if (project == null) throw new Error(`Project '${identifier}' not found.`);
  return project;
}
async function byLabel(client, _class, project, label, what) {
  if (label == null) return null;
  const all = await client.findAll(_class, { space: project._id });
  const hit = all.find((x) => String(x.label).toLowerCase() === label.toLowerCase());
  if (hit == null) throw new Error(`${what} '${label}' not found in ${String(project.identifier)}. Available: ${all.map((x) => x.label).join(", ") || "none"}.`);
  return hit._id;
}
async function labelIds(client, names2) {
  const out = [];
  for (const name of names2 ?? []) {
    const tag = await client.findOne(import_tags.default.class.TagElement, { targetClass: import_tracker.default.class.Issue, title: name });
    if (tag == null) throw new Error(`Label '${name}' not found (create it first with create_label).`);
    out.push(tag._id);
  }
  return out;
}
async function findTemplate(client, ref, projectIdentifier) {
  const byId = await client.findOne(import_tracker.default.class.IssueTemplate, { _id: ref });
  if (byId != null) return byId;
  const query = {};
  if (projectIdentifier != null) query.space = (await findProject(client, projectIdentifier))._id;
  const all = await client.findAll(import_tracker.default.class.IssueTemplate, query);
  const hits = all.filter((t) => String(t.title).toLowerCase() === ref.toLowerCase());
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw new Error(`Template '${ref}' exists in several projects \u2014 pass projectIdentifier.`);
  throw new Error(`Template '${ref}' not found.`);
}
async function templateData(client, project, t) {
  return {
    title: t.title.trim(),
    description: (0, import_format.textToMarkup)(t.description ?? ""),
    priority: PRIORITY[t.priority ?? "NoPriority"],
    assignee: t.assignee != null ? (await (0, import_people.findPerson)(client, t.assignee))._id : null,
    component: await byLabel(client, import_tracker.default.class.Component, project, t.componentLabel, "Component"),
    milestone: await byLabel(client, import_tracker.default.class.Milestone, project, t.milestoneLabel, "Milestone"),
    estimation: t.estimation ?? 0,
    labels: await labelIds(client, t.labels)
  };
}
async function names(client, t, people) {
  const component = t.component != null ? (await client.findOne(import_tracker.default.class.Component, { _id: t.component }))?.label : void 0;
  const milestone = t.milestone != null ? (await client.findOne(import_tracker.default.class.Milestone, { _id: t.milestone }))?.label : void 0;
  const labels = (t.labels ?? []).length > 0 ? await client.findAll(import_tags.default.class.TagElement, { _id: { $in: t.labels } }) : [];
  return { assignee: t.assignee != null ? people.get(t.assignee) : void 0, component, milestone, labels: labels.map((l) => l.title) };
}
function describe(t, n) {
  const bits = [(0, import_format.priorityLabel)(t.priority)];
  if (n.assignee != null) bits.push(`@${n.assignee}`);
  if (n.component != null) bits.push(`component ${n.component}`);
  if (n.milestone != null) bits.push(`milestone ${n.milestone}`);
  if ((t.estimation ?? 0) > 0) bits.push(`${String(t.estimation)}d`);
  if (n.labels.length > 0) bits.push(`labels ${n.labels.join(", ")}`);
  return bits.join(" \xB7 ");
}
const listIssueTemplates = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const query = {};
  if (args.projectIdentifier != null) query.space = (await findProject(client, args.projectIdentifier))._id;
  const templates = await client.findAll(import_tracker.default.class.IssueTemplate, query);
  if (templates.length === 0) return "No issue templates.";
  const projects = await client.findAll(import_tracker.default.class.Project, {});
  const key = new Map(projects.map((p) => [p._id, p.identifier]));
  return `## Issue templates (${templates.length})

${templates.map((t) => `- **${String(t.title)}** [${String(key.get(t.space) ?? "?")}]${(t.children ?? []).length > 0 ? ` \xB7 ${String(t.children.length)} sub-issue(s)` : ""} \u2014 \`${String(t._id)}\``).join("\n")}`;
});
const getIssueTemplate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const t = await findTemplate(client, args.template, args.projectIdentifier);
  const people = await (0, import_people.peopleNames)(client);
  const lines = [`## Template: ${String(t.title)}`, "", describe(t, await names(client, t, people)), `**Id:** \`${String(t._id)}\``];
  const desc = (0, import_format.markupToText)(t.description);
  if (desc !== "") lines.push("", "### Description", desc);
  if ((t.children ?? []).length > 0) {
    lines.push("", `### Sub-issues (${String(t.children.length)})`);
    for (const c of t.children) lines.push(`- **${String(c.title)}** \u2014 ${describe(c, await names(client, c, people))}`);
  }
  return lines.join("\n");
});
const createIssueTemplate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.projectIdentifier);
  const existing = await client.findOne(import_tracker.default.class.IssueTemplate, { space: project._id, title: args.title.trim() });
  if (existing != null) return `\u2139\uFE0F Template **${args.title}** already exists in ${args.projectIdentifier} \u2014 \`${String(existing._id)}\`.`;
  const data = await templateData(client, project, args);
  const children = [];
  for (const c of args.children ?? []) children.push({ id: (0, import_core.generateId)(), ...await templateData(client, project, c) });
  const id = await client.createDoc(import_tracker.default.class.IssueTemplate, project._id, { ...data, children, comments: 0, attachments: 0, relations: [] });
  return `\u2705 Template **${args.title}** created in ${args.projectIdentifier}${children.length > 0 ? ` with ${children.length} sub-issue(s)` : ""} \u2014 \`${String(id)}\`.`;
});
const updateIssueTemplate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const t = await findTemplate(client, args.template, args.projectIdentifier);
  const project = await client.findOne(import_tracker.default.class.Project, { _id: t.space });
  const update = {};
  if (args.title != null) update.title = args.title.trim();
  if (args.description != null) update.description = (0, import_format.textToMarkup)(args.description);
  if (args.priority != null) update.priority = PRIORITY[args.priority];
  if (args.assignee !== void 0) update.assignee = args.assignee != null ? (await (0, import_people.findPerson)(client, args.assignee))._id : null;
  if (args.componentLabel !== void 0) update.component = await byLabel(client, import_tracker.default.class.Component, project, args.componentLabel, "Component");
  if (args.milestoneLabel !== void 0) update.milestone = await byLabel(client, import_tracker.default.class.Milestone, project, args.milestoneLabel, "Milestone");
  if (args.estimation != null) update.estimation = args.estimation;
  if (args.labels != null) update.labels = await labelIds(client, args.labels);
  if (args.children != null) {
    const children = [];
    for (const c of args.children) children.push({ id: (0, import_core.generateId)(), ...await templateData(client, project, c) });
    update.children = children;
  }
  if (Object.keys(update).length === 0) throw new Error("Nothing to change.");
  await client.updateDoc(import_tracker.default.class.IssueTemplate, t.space, t._id, update);
  return `\u2705 Template **${String(update.title ?? t.title)}** updated: ${Object.keys(update).join(", ")}.`;
});
const deleteIssueTemplate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const t = await findTemplate(client, args.template, args.projectIdentifier);
  await client.removeDoc(import_tracker.default.class.IssueTemplate, t.space, t._id);
  return `\u2705 Template **${String(t.title)}** deleted.`;
});
const text = (r) => r.content[0].text;
const createIssueFromTemplate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const t = await findTemplate(client, args.template, args.projectIdentifier);
  const project = await client.findOne(import_tracker.default.class.Project, { _id: t.space });
  const people = await (0, import_people.peopleNames)(client);
  const top = await names(client, t, people);
  const title = args.title ?? String(t.title);
  const description = (0, import_format.markupToText)(t.description);
  const ws = args.workspace;
  let id;
  let childIds = [];
  if ((t.children ?? []).length > 0) {
    const kids = [];
    for (const c of t.children) {
      const n = await names(client, c, people);
      kids.push({ title: String(c.title), description: (0, import_format.markupToText)(c.description) || void 0, priority: PRIORITY_NAME[c.priority], assignee: n.assignee, componentLabel: n.component, milestoneLabel: n.milestone, labels: n.labels });
    }
    const out = text(await (0, import_agent.createIssueTree)({ workspace: ws, projectIdentifier: project.identifier, epic: { title, description: description || void 0, priority: PRIORITY_NAME[t.priority], labels: top.labels }, children: kids, skipDuplicates: false, dryRun: false }));
    const m = /under \*\*([A-Z][A-Z0-9]*-\d+)\*\*/.exec(out);
    if (m == null) throw new Error(`Unexpected result while creating the issue tree: ${out}`);
    id = m[1];
    childIds = [...out.matchAll(/^- ([A-Z][A-Z0-9]*-\d+):/gm)].map((x) => x[1]);
  } else {
    const out = text(await (0, import_issues.createIssue)({ workspace: ws, projectIdentifier: project.identifier, title, description: description || void 0, priority: PRIORITY_NAME[t.priority] ?? "NoPriority" }));
    const m = /\*\*([A-Z][A-Z0-9]*-\d+)\*\*/.exec(out);
    if (m == null) throw new Error(`Unexpected result while creating the issue: ${out}`);
    id = m[1];
    for (const l of top.labels) await (0, import_labels.addLabel)({ workspace: ws, identifier: id, labelName: l });
  }
  const fields = {};
  if (top.assignee != null) fields.assignee = top.assignee;
  if (top.component != null) fields.componentLabel = top.component;
  if (top.milestone != null) fields.milestoneLabel = top.milestone;
  if (Object.keys(fields).length > 0) await (0, import_issues.updateIssue)({ workspace: ws, identifier: id, ...fields });
  const estimates = [[id, t.estimation ?? 0], ...childIds.map((cid, i) => [cid, t.children[i]?.estimation ?? 0])];
  for (const [iid, est] of estimates) {
    if (est <= 0) continue;
    const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: iid });
    if (issue != null) await client.updateDoc(import_tracker.default.class.Issue, issue.space, issue._id, { estimation: est });
  }
  return `\u2705 Created **${id}** "${title}" from template "${String(t.title)}"${(t.children ?? []).length > 0 ? ` with ${String(t.children.length)} sub-issue(s)` : ""}.`;
});
