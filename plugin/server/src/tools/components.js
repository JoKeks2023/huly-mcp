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
var components_exports = {};
__export(components_exports, {
  createComponent: () => createComponent,
  deleteComponent: () => deleteComponent,
  listComponents: () => listComponents,
  updateComponent: () => updateComponent
});
module.exports = __toCommonJS(components_exports);
var import_labels = require("../utils/labels.js");
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
async function findProject(client, identifier) {
  const project = await client.findOne(import_tracker.default.class.Project, { identifier });
  if (project == null) throw new Error(`Project '${identifier}' not found.`);
  return project;
}
async function findComponent(client, project, label) {
  return await (0, import_labels.findByLabel)(client, "component", project._id, label, project.identifier);
}
async function findMemberRef(client, name) {
  return (await (0, import_people.findPerson)(client, name))._id;
}
const listComponents = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
  const components = await client.findAll(import_tracker.default.class.Component, { space: project._id });
  if (components.length === 0) return `No components found in project ${args.projectIdentifier}.`;
  const leadMap = await (0, import_people.peopleNames)(client);
  const lines = components.map((c) => {
    const lead = c.lead != null ? ` \u2014 Lead: ${leadMap.get(c.lead) ?? c.lead}` : "";
    const text = (0, import_format.markupToText)(c.description);
    const desc = text !== "" ? `
  ${text}` : "";
    return `- **${c.label}** (id: \`${c._id}\`)${lead}${desc}`;
  });
  return `## Components in ${args.projectIdentifier} (${components.length})

${lines.join("\n")}`;
});
const createComponent = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
  const leadRef = args.lead != null ? await findMemberRef(client, args.lead) : null;
  await client.createDoc(
    import_tracker.default.class.Component,
    project._id,
    {
      label: args.label,
      description: args.description,
      lead: leadRef,
      comments: 0
    },
    (0, import_core.generateId)()
  );
  return `Component **${args.label}** created in project ${args.projectIdentifier}.`;
});
const updateComponent = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.projectIdentifier);
  const component = await findComponent(client, project, args.label);
  const updates = {};
  if (args.newLabel !== void 0 && args.newLabel !== component.label) {
    const clash = await client.findOne(import_tracker.default.class.Component, { space: project._id, label: args.newLabel });
    if (clash != null) throw new Error(`A component named '${args.newLabel}' already exists in project ${args.projectIdentifier}.`);
    updates.label = args.newLabel;
  }
  if (args.description !== void 0) updates.description = (0, import_format.textToMarkup)(args.description);
  if (args.lead !== void 0) updates.lead = args.lead === null ? null : await findMemberRef(client, args.lead);
  if (Object.keys(updates).length === 0) return `Nothing to update for component **${component.label}**.`;
  await client.updateDoc(import_tracker.default.class.Component, project._id, component._id, updates);
  const changed = Object.keys(updates).map((k) => k === "label" ? "name" : k).join(", ");
  return `\u2705 Component **${updates.label ?? component.label}** updated (${changed}).`;
});
const deleteComponent = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.projectIdentifier);
  const component = await findComponent(client, project, args.label);
  let target = null;
  if (args.moveIssuesTo !== void 0) {
    const dest = await findComponent(client, project, args.moveIssuesTo);
    if (dest._id === component._id) throw new Error("moveIssuesTo must name a different component.");
    target = dest._id;
  }
  const issues = await client.findAll(import_tracker.default.class.Issue, { space: project._id, component: component._id });
  for (const issue of issues) {
    await client.updateDoc(import_tracker.default.class.Issue, issue.space, issue._id, { component: target });
  }
  await client.removeDoc(import_tracker.default.class.Component, project._id, component._id);
  const effect = issues.length === 0 ? "No issues were assigned to it." : target != null ? `${issues.length} issue(s) moved to **${args.moveIssuesTo}**.` : `${issues.length} issue(s) no longer have a component.`;
  return `\u{1F5D1}\uFE0F Component **${component.label}** deleted from ${args.projectIdentifier}. ${effect}`;
});
