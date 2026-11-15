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
var projects_exports = {};
__export(projects_exports, {
  createProject: () => createProject,
  getProject: () => getProject,
  listProjects: () => listProjects,
  updateProject: () => updateProject
});
module.exports = __toCommonJS(projects_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_core = __toESM(require("../../vendor/@hcengineering/core/lib/index.js"));
var import_task = __toESM(require("../../vendor/@hcengineering/task/lib/index.js"));
var import_core2 = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_people = require("../utils/people.js");
const listProjects = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const projects = await client.findAll(import_tracker.default.class.Project, {});
  if (projects.length === 0) return "No projects found in this workspace.";
  const lines = projects.map(
    (p) => `- **${p.identifier}** \u2014 ${p.name ?? "(no name)"}${p.description != null && p.description !== "" ? `
  ${p.description}` : ""}`
  );
  return `## Projects (${projects.length})

${lines.join("\n")}`;
});
const getProject = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.identifier });
  if (project == null) throw new Error(`Project '${args.identifier}' not found.`);
  const statuses = await client.findAll(import_tracker.default.class.IssueStatus, {});
  const statusList = statuses.map((s) => `  - ${s.name}`).join("\n");
  return [
    `## Project: ${project.identifier}`,
    `**Name:** ${project.name ?? "(no name)"}`,
    project.description != null && project.description !== "" ? `**Description:** ${project.description}` : null,
    `**Issues created:** ${project.sequence}`,
    `
**Statuses:**
${statusList}`
  ].filter(Boolean).join("\n");
});
const createProject = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const existing = await client.findOne(import_tracker.default.class.Project, { identifier: args.identifier });
  if (existing != null) throw new Error(`A project with identifier '${args.identifier}' already exists.`);
  const projectType = await client.findOne(import_task.default.class.ProjectType, {
    _id: import_tracker.default.ids.ClassingProjectType
  }) ?? await client.findOne(import_task.default.class.ProjectType, {});
  if (projectType == null) throw new Error("Could not find a ProjectType. Ensure the Huly Tracker is set up.");
  const projectId = (0, import_core2.generateId)();
  await client.createDoc(
    import_tracker.default.class.Project,
    import_core.default.space.Space,
    {
      name: args.name,
      description: args.description ?? "",
      identifier: args.identifier,
      sequence: 0,
      defaultAssignee: void 0,
      defaultTimeReportDay: "CurrentWorkDay",
      defaultIssueStatus: void 0,
      type: projectType._id,
      members: [await (0, import_people.currentAccountUuid)(client)],
      archived: false,
      private: false
    },
    projectId
  );
  return `\u2705 Project **${args.identifier}** ("${args.name}") created successfully.
Note: default statuses are set up automatically by the platform.`;
});
const updateProject = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.identifier });
  if (project == null) throw new Error(`Project '${args.identifier}' not found.`);
  const updates = {};
  if (args.name !== void 0) updates.name = args.name;
  if (args.description !== void 0) updates.description = args.description;
  if (args.defaultAssignee !== void 0) {
    if (args.defaultAssignee === null) updates.defaultAssignee = null;
    else {
      updates.defaultAssignee = (await (0, import_people.findPerson)(client, args.defaultAssignee))._id;
    }
  }
  if (args.defaultStatus !== void 0) {
    const status = await client.findOne(import_tracker.default.class.IssueStatus, { name: args.defaultStatus });
    if (status == null) throw new Error(`Status '${args.defaultStatus}' not found.`);
    updates.defaultIssueStatus = status._id;
  }
  if (Object.keys(updates).length === 0) return `Nothing to update for project **${args.identifier}**.`;
  await client.updateDoc(import_tracker.default.class.Project, project.space, project._id, updates);
  return `\u2705 Project **${args.identifier}** updated (${Object.keys(updates).join(", ")}).`;
});
