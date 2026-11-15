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
var issues_exports = {};
__export(issues_exports, {
  bulkUpdateIssues: () => bulkUpdateIssues,
  createIssue: () => createIssue,
  deleteIssue: () => deleteIssue,
  getIssue: () => getIssue,
  listIssues: () => listIssues,
  listSubIssues: () => listSubIssues,
  moveIssue: () => moveIssue,
  updateIssue: () => updateIssue
});
module.exports = __toCommonJS(issues_exports);
var import_labels = require("../utils/labels.js");
var import_statuses = require("../utils/statuses.js");
var import_relations = require("./relations.js");
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_tags = __toESM(require("../../vendor/@hcengineering/tags/lib/index.js"));
var import_task = __toESM(require("../../vendor/@hcengineering/task/lib/index.js"));
var import_core = __toESM(require("../../vendor/@hcengineering/core/lib/index.js"));
var import_rank = require("../../vendor/@hcengineering/rank/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_markdown = require("../utils/markdown.js");
var import_storage = require("../utils/storage.js");
var import_people = require("../utils/people.js");
var import_content = require("../utils/content.js");
async function findMemberId(client, name) {
  return (await (0, import_people.findPerson)(client, name))._id;
}
const listIssues = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
  const query = { space: project._id };
  const statuses = await client.findAll(import_tracker.default.class.IssueStatus, {});
  const statusMap = new Map(statuses.map((s) => [s._id, s.name]));
  const scope = args.status ?? "open";
  if (scope === "open") {
    query.status = { $in: statuses.filter((s) => s.category !== import_task.default.statusCategory.Won && s.category !== import_task.default.statusCategory.Lost).map((s) => s._id) };
  } else if (scope !== "all") {
    const status = statuses.find((s) => s.name.toLowerCase() === scope.toLowerCase());
    if (status == null) throw new Error(`Status '${scope}' not found. Use a status name (${[...new Set(statuses.map((x) => x.name))].join(", ")}), "open" or "all".${/block/i.test(scope) ? " Blocked is not a status: pass blocked: true." : ""}`);
    query.status = status._id;
  }
  if (args.priority != null) {
    query.priority = import_tracker.IssuePriority[args.priority];
  }
  if (args.milestoneLabel !== void 0) {
    if (args.milestoneLabel === null) query.milestone = null;
    else {
      query.milestone = (await (0, import_labels.findByLabel)(client, "milestone", project._id, args.milestoneLabel, args.projectIdentifier))._id;
    }
  }
  if (args.componentLabel !== void 0) {
    if (args.componentLabel === null) query.component = null;
    else {
      query.component = (await (0, import_labels.findByLabel)(client, "component", project._id, args.componentLabel, args.projectIdentifier))._id;
    }
  }
  if (args.assignee !== void 0) {
    query.assignee = args.assignee === null ? null : await findMemberId(client, args.assignee);
  }
  if (args.parentIdentifier !== void 0) {
    if (args.parentIdentifier === null) query.attachedTo = import_tracker.default.ids.NoParent;
    else {
      const parent = await client.findOne(import_tracker.default.class.Issue, { identifier: args.parentIdentifier });
      if (parent == null) throw new Error(`Issue '${args.parentIdentifier}' not found.`);
      query.attachedTo = parent._id;
    }
  }
  if (args.title != null) {
    query.title = { $like: `%${args.title.replace(/[%_\\]/g, (c) => `\\${c}`)}%` };
  }
  if (args.due === "overdue") query.dueDate = { $lt: Date.now() };
  else if (args.due === "set") query.dueDate = { $ne: null };
  else if (args.due === "none") query.dueDate = null;
  if (args.labelName != null) {
    const label = await client.findOne(import_tags.default.class.TagElement, { targetClass: import_tracker.default.class.Issue, title: args.labelName });
    if (label == null) throw new Error(`Label '${args.labelName}' not found.`);
    const refs = await client.findAll(import_tags.default.class.TagReference, { tag: label._id });
    query._id = { $in: refs.map((r) => r.attachedTo) };
  }
  const offset = args.offset ?? 0;
  let found;
  let total;
  if (args.blocked === true) {
    const candidates = (await client.findAll(import_tracker.default.class.Issue, query, { sort: { modifiedOn: import_core.SortingOrder.Descending } })).filter((i) => (i.blockedBy ?? []).length > 0);
    const blockerIds = [...new Set(candidates.flatMap((i) => (i.blockedBy ?? []).map((b) => b._id)))];
    const closed = new Set(statuses.filter((x) => x.category === import_task.default.statusCategory.Won || x.category === import_task.default.statusCategory.Lost).map((x) => x._id));
    const openBlockers = new Set((blockerIds.length > 0 ? await client.findAll(import_tracker.default.class.Issue, { _id: { $in: blockerIds } }) : []).filter((b) => !closed.has(b.status)).map((b) => b._id));
    const blocked = candidates.filter((i) => (i.blockedBy ?? []).some((b) => openBlockers.has(b._id)));
    total = blocked.length;
    found = blocked.slice(0, args.limit + offset);
  } else {
    found = await client.findAll(
      import_tracker.default.class.Issue,
      query,
      { limit: args.limit + offset, sort: { modifiedOn: import_core.SortingOrder.Descending }, total: true }
    );
    total = found.total ?? found.length;
  }
  const issues = found.slice(offset);
  const what = `${args.blocked === true ? "blocked " : ""}${scope === "open" ? "open issues" : scope === "all" ? "issues" : `issues in status ${scope}`}`;
  if (issues.length === 0) return `No ${what} in project ${args.projectIdentifier}${offset > 0 ? ` after offset ${offset}` : ""}.${scope === "open" ? ' (status: "all" includes done ones.)' : ""}`;
  const lines = issues.map((issue) => {
    const statusName = statusMap.get(issue.status) ?? "Unknown";
    const prio = issue.priority !== import_tracker.IssuePriority.NoPriority ? ` \xB7 ${(0, import_format.priorityLabel)(issue.priority)}` : "";
    const due = issue.dueDate != null ? ` \xB7 due ${(0, import_format.formatDate)(issue.dueDate)}` : "";
    return `- **${issue.identifier}** ${issue.title} \u2014 ${statusName}${prio}${due}`;
  });
  const shown = total > issues.length ? `${offset + 1}\u2013${offset + issues.length} of ${total}` : String(total);
  const more = offset + issues.length < total ? `

_More: offset ${offset + issues.length}._` : "";
  return `## ${what[0].toUpperCase()}${what.slice(1)} in ${args.projectIdentifier} (${shown})

${lines.join("\n")}${more}`;
});
const getIssue = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const status = await client.findOne(import_tracker.default.class.IssueStatus, { _id: issue.status });
  const milestone = issue.milestone != null ? await client.findOne(import_tracker.default.class.Milestone, { _id: issue.milestone }) : void 0;
  const component = issue.component != null ? await client.findOne(import_tracker.default.class.Component, { _id: issue.component }) : void 0;
  const assignee = issue.assignee != null ? (await (0, import_people.peopleNames)(client)).get(issue.assignee) ?? String(issue.assignee) : "Unassigned";
  const labelRefs = await client.findAll(import_tags.default.class.TagReference, { attachedTo: issue._id });
  const refIds = async (list) => {
    if (list == null || list.length === 0) return "None";
    const names = [];
    for (const r of list) {
      if (r._class != null && r._class !== import_tracker.default.class.Issue) {
        const doc = await client.findOne(r._class, { _id: r._id });
        const kind = String(r._class).split(":").pop()?.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase() ?? "doc";
        names.push(`${kind} "${String(doc?.name ?? doc?.title ?? "?")}" \`${String(r._id)}\``);
        continue;
      }
      const other = await client.findOne(import_tracker.default.class.Issue, { _id: r._id });
      names.push(other?.identifier ?? String(r._id));
    }
    return names.join(", ");
  };
  const blockedBy = await refIds(issue.blockedBy);
  const related = await refIds(issue.relations);
  const fieldsOut = [
    ["Status", status?.name ?? "Unknown"],
    ["Priority", (0, import_format.priorityLabel)(issue.priority)],
    ["Assignee", issue.assignee != null ? assignee : void 0],
    ["Milestone", milestone?.label],
    ["Component", component?.label],
    ["Labels", labelRefs.length > 0 ? labelRefs.map((l) => l.title).join(", ") : void 0],
    ["Parent", issue.parents?.[0] != null ? `${issue.parents[0].identifier} \u2014 ${issue.parents[0].parentTitle}` : void 0],
    ["Blocked by", blockedBy !== "None" ? blockedBy : void 0],
    ["Related", related !== "None" ? related : void 0],
    ["Due date", issue.dueDate != null ? (0, import_format.formatDate)(issue.dueDate) : void 0],
    ["Comments", (issue.comments ?? 0) > 0 ? String(issue.comments) : void 0],
    ["Sub-issues", (issue.subIssues ?? 0) > 0 ? String(issue.subIssues) : void 0],
    ["Estimation", issue.estimation > 0 ? `${issue.estimation}h` : void 0],
    ["Reported time", issue.reportedTime > 0 ? `${issue.reportedTime}h` : void 0]
  ];
  const lines = [
    `## ${issue.identifier}: ${issue.title}`,
    fieldsOut.filter(([, v]) => v != null).map(([k, v]) => `**${k}:** ${v}`).join(" \xB7 ")
  ];
  if (issue.description != null) {
    const frontUrl = process.env.HULY_FRONT_URL;
    if (frontUrl != null && frontUrl !== "") {
      const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(args.workspace);
      const blobUrl = `${frontUrl}/files?file=${encodeURIComponent(issue.description)}&workspace=${workspaceUuid}`;
      try {
        const res = await (0, import_content.fetchBlob)(blobUrl, wsToken);
        if (res.ok) {
          const text = await res.text();
          try {
            const extracted = (0, import_markdown.extractText)(JSON.parse(text));
            if (extracted.length > 0) lines.push(`
**Description:**
${extracted}`);
          } catch {
            lines.push(`
**Description (raw):**
${text.substring(0, 2e3)}`);
          }
        }
      } catch {
        lines.push(`
**Description:** _(fetch failed \u2014 blob ref \`${issue.description}\`)_`);
      }
    } else {
      lines.push(`
**Description blob ref:** \`${issue.description}\``);
      lines.push("_(Set HULY_FRONT_URL env var to fetch description content)_");
    }
  }
  return lines.join("\n");
});
const createIssue = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
  const kind = await client.findOne(import_task.default.class.TaskType, project.type != null ? { parent: project.type } : {});
  if (kind == null) throw new Error("Could not find a TaskType for this project.");
  const statuses = await (0, import_statuses.allowedIssueStatuses)(client, project, kind._id);
  const chosen = args.statusName != null ? await (0, import_statuses.resolveIssueStatus)(client, project, kind._id, args.statusName) : void 0;
  const fields = await resolveFieldUpdates(client, { space: project._id }, {
    assignee: args.assignee,
    componentLabel: args.componentLabel,
    milestoneLabel: args.milestoneLabel
  });
  const parent = args.parentIdentifier != null ? await client.findOne(import_tracker.default.class.Issue, { identifier: args.parentIdentifier }) : void 0;
  if (args.parentIdentifier != null && parent == null) throw new Error(`Parent issue '${args.parentIdentifier}' not found.`);
  const incResult = await client.updateDoc(
    import_tracker.default.class.Project,
    project.space,
    project._id,
    { $inc: { sequence: 1 } },
    true
  );
  const issueNumber = incResult?.object?.sequence ?? project.sequence + 1;
  const identifier = `${project.identifier}-${issueNumber}`;
  const status = chosen != null ? chosen : project.defaultIssueStatus != null ? statuses.find((s) => s._id === project.defaultIssueStatus) ?? statuses[0] : statuses[0];
  if (status == null) throw new Error(`No statuses found in project '${args.projectIdentifier}'.`);
  const lastIssue = await client.findOne(
    import_tracker.default.class.Issue,
    { space: project._id },
    { sort: { rank: import_core.SortingOrder.Descending } }
  );
  const rank = (0, import_rank.makeRank)(lastIssue?.rank, void 0);
  const issueId = (0, import_core.generateId)();
  let descriptionBlobId = null;
  if (args.description != null && args.description !== "") {
    const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(args.workspace);
    const prosemirror = (0, import_markdown.markdownToProseMirror)(args.description);
    descriptionBlobId = await (0, import_storage.uploadMarkupBlob)(
      wsToken,
      workspaceUuid,
      `${issueId}-description-${Date.now()}`,
      JSON.stringify(prosemirror)
    );
  }
  await client.addCollection(
    import_tracker.default.class.Issue,
    project._id,
    import_tracker.default.ids.NoParent,
    import_tracker.default.class.Issue,
    "subIssues",
    {
      title: args.title,
      description: descriptionBlobId,
      status: status._id,
      priority: import_tracker.IssuePriority[args.priority],
      number: issueNumber,
      identifier,
      rank,
      kind: kind._id,
      comments: 0,
      subIssues: 0,
      dueDate: args.dueDate != null ? new Date(args.dueDate).getTime() : null,
      assignee: fields.assignee ?? null,
      component: fields.component ?? null,
      milestone: fields.milestone ?? null,
      parents: [],
      remainingTime: 0,
      estimation: 0,
      reportedTime: 0,
      reports: 0,
      childInfo: [],
      relations: []
    },
    issueId
  );
  if (parent != null) {
    const created = await client.findOne(import_tracker.default.class.Issue, { _id: issueId });
    if (created != null) await (0, import_relations.linkToParent)(client, created, parent);
  }
  const extra = [parent != null ? `Sub-issue of ${parent.identifier}` : "", args.assignee != null ? `Assignee: ${args.assignee}` : "", args.componentLabel != null ? `Component: ${args.componentLabel}` : "", args.milestoneLabel != null ? `Milestone: ${args.milestoneLabel}` : ""].filter((x) => x !== "");
  const hints = [];
  if (args.componentLabel == null) {
    const comps = await client.findAll(import_tracker.default.class.Component, { space: project._id });
    if (comps.length > 0) hints.push(`No component set \u2014 ${args.projectIdentifier} has: ${comps.map((c) => c.label).slice(0, 12).join(", ")} (update_issue componentLabel).`);
  }
  if (args.milestoneLabel == null) {
    const open = (await client.findAll(import_tracker.default.class.Milestone, { space: project._id })).filter((m) => m.status === 0 || m.status === 1);
    if (open.length > 0) hints.push(`No milestone set \u2014 open: ${open.map((m) => m.label).slice(0, 8).join(", ")}.`);
  }
  return `\u2705 Created **${identifier}**: ${args.title}
Status: ${status.name} | Priority: ${(0, import_format.priorityLabel)(import_tracker.IssuePriority[args.priority])}${extra.length > 0 ? ` | ${extra.join(" | ")}` : ""}${hints.length > 0 ? `
${hints.join("\n")}` : ""}`;
});
const deleteIssue = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  await client.removeCollection(
    import_tracker.default.class.Issue,
    issue.space,
    issue._id,
    issue.attachedTo,
    issue.attachedToClass,
    issue.collection
  );
  return `\u2705 Deleted **${args.identifier}**: ${issue.title}`;
});
async function resolveFieldUpdates(client, issue, args) {
  const updates = {};
  if (args.statusName != null) {
    const project = await client.findOne(import_tracker.default.class.Project, { _id: issue.space });
    updates.status = (await (0, import_statuses.resolveIssueStatus)(client, project, issue.kind, args.statusName))._id;
  }
  if (args.priority != null) {
    updates.priority = import_tracker.IssuePriority[args.priority];
  }
  if (args.dueDate !== void 0) {
    if (args.dueDate != null && isNaN(new Date(args.dueDate).getTime())) throw new Error(`Invalid date: '${args.dueDate}'`);
    updates.dueDate = args.dueDate != null ? new Date(args.dueDate).getTime() : null;
  }
  if (args.assignee !== void 0) {
    if (args.assignee === null) {
      updates.assignee = null;
    } else {
      updates.assignee = await findMemberId(client, args.assignee);
    }
  }
  if (args.componentLabel !== void 0) {
    if (args.componentLabel === null) {
      updates.component = null;
    } else {
      updates.component = (await (0, import_labels.findByLabel)(client, "component", issue.space, args.componentLabel))._id;
    }
  }
  if (args.milestoneLabel !== void 0) {
    if (args.milestoneLabel === null) {
      updates.milestone = null;
    } else {
      updates.milestone = (await (0, import_labels.findByLabel)(client, "milestone", issue.space, args.milestoneLabel))._id;
    }
  }
  return updates;
}
const updateIssue = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const updates = {};
  if (args.title != null) updates.title = args.title;
  if (args.description != null && args.description !== "") {
    const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(args.workspace);
    const prosemirror = (0, import_markdown.markdownToProseMirror)(args.description);
    const descriptionBlobId = await (0, import_storage.uploadMarkupBlob)(
      wsToken,
      workspaceUuid,
      `${issue._id}-description-${Date.now()}`,
      JSON.stringify(prosemirror)
    );
    updates.description = descriptionBlobId;
  }
  Object.assign(updates, await resolveFieldUpdates(client, issue, args));
  if (Object.keys(updates).length === 0) return `No changes made to ${args.identifier}.`;
  await client.updateDoc(import_tracker.default.class.Issue, issue.space, issue._id, updates);
  const changed = Object.keys(updates).join(", ");
  return `\u2705 Updated **${args.identifier}** \u2014 changed: ${changed}`;
});
const bulkUpdateIssues = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const identifiers = [...new Set(args.identifiers)];
  const planned = [];
  for (const identifier of identifiers) {
    const issue = await client.findOne(import_tracker.default.class.Issue, { identifier });
    if (issue == null) throw new Error(`Issue '${identifier}' not found. Nothing was changed.`);
    planned.push({ issue, updates: await resolveFieldUpdates(client, issue, args) });
  }
  if (planned.every((p) => Object.keys(p.updates).length === 0)) return "No changes requested.";
  for (const { issue, updates } of planned) {
    await client.updateDoc(import_tracker.default.class.Issue, issue.space, issue._id, updates);
  }
  const changed = Object.keys(planned[0].updates).join(", ");
  return `\u2705 Updated ${planned.length} issue(s) \u2014 changed: ${changed}
${planned.map((p) => `- ${p.issue.identifier}`).join("\n")}`;
});
const listSubIssues = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const root = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (root == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const statuses = await client.findAll(import_tracker.default.class.IssueStatus, {});
  const statusById = new Map(statuses.map((s) => [s._id, s]));
  const isDone = (i) => statusById.get(i.status)?.category === import_task.default.statusCategory.Won;
  const isCanceled = (i) => statusById.get(i.status)?.category === import_task.default.statusCategory.Lost;
  const projectIssues = await client.findAll(import_tracker.default.class.Issue, { space: root.space });
  const childrenOf = (id) => projectIssues.filter((i) => i._id !== id && (i.attachedTo === id || i.parents?.[0]?.parentId === id));
  let total = 0;
  let done = 0;
  let canceled = 0;
  const lines = [];
  const walk = (id, level) => {
    for (const child of childrenOf(id)) {
      total++;
      if (isDone(child)) done++;
      if (isCanceled(child)) canceled++;
      const statusName = statusById.get(child.status)?.name ?? "Unknown";
      const mark = isDone(child) ? "x" : isCanceled(child) ? "-" : " ";
      lines.push(`${"  ".repeat(level)}- [${mark}] **${child.identifier}** [${statusName}] ${child.title}`);
      if (level + 1 < args.depth) walk(child._id, level + 1);
    }
  };
  walk(root._id, 0);
  if (total === 0) return `**${root.identifier}** has no sub-issues.`;
  return `## Sub-issues of ${root.identifier}: ${root.title}
**Progress:** ${done}/${total - canceled} done${canceled > 0 ? ` (${canceled} canceled)` : ""}

${lines.join("\n")}`;
});
const moveIssue = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const target = await client.findOne(import_tracker.default.class.Project, { identifier: args.targetProjectIdentifier });
  if (target == null) throw new Error(`Project '${args.targetProjectIdentifier}' not found.`);
  if (target._id === issue.space) throw new Error(`${args.identifier} is already in project ${args.targetProjectIdentifier}.`);
  let statusUpdate = {};
  if (args.statusName != null) {
    const status = await client.findOne(import_tracker.default.class.IssueStatus, { name: args.statusName });
    if (status == null) throw new Error(`Status '${args.statusName}' not found.`);
    statusUpdate = { status: status._id };
  }
  const hierarchy = client.getHierarchy();
  const renamed = [];
  const lastRank = async () => (await client.findOne(import_tracker.default.class.Issue, { space: target._id }, { sort: { rank: import_core.SortingOrder.Descending } }))?.rank;
  const nextNumber = async () => {
    const inc = await client.updateDoc(import_tracker.default.class.Project, import_core.default.space.Space, target._id, { $inc: { sequence: 1 } }, true);
    return inc?.object?.sequence ?? target.sequence + 1;
  };
  const moveDoc = async (doc, extra) => {
    for (const attribute of hierarchy.getAllAttributes(doc._class).values()) {
      if (!hierarchy.isDerived(attribute.type._class, import_core.default.class.Collection)) continue;
      const of = attribute.type.of;
      const attached = await client.findAll(of, { attachedTo: doc._id });
      for (const child of attached) {
        if (hierarchy.isDerived(of, import_tracker.default.class.Issue)) {
          const number2 = await nextNumber();
          renamed.push(`${child.identifier} \u2192 ${target.identifier}-${number2}`);
          await moveDoc(child, { number: number2, identifier: `${target.identifier}-${number2}`, rank: (0, import_rank.makeRank)(await lastRank(), void 0), component: null, milestone: null });
        } else {
          await moveDoc(child, {});
        }
      }
    }
    await client.update(doc, { space: target._id, ...extra });
  };
  const number = await nextNumber();
  const newIdentifier = `${target.identifier}-${number}`;
  renamed.unshift(`${issue.identifier} \u2192 ${newIdentifier}`);
  await moveDoc(issue, { ...statusUpdate, number, identifier: newIdentifier, rank: (0, import_rank.makeRank)(await lastRank(), void 0), component: null, milestone: null });
  return `\u2705 Moved to project **${target.identifier}** (component and milestone cleared):
${renamed.map((r) => `- ${r}`).join("\n")}`;
});
