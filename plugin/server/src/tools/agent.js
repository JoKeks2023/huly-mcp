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
var agent_exports = {};
__export(agent_exports, {
  CLAIM_LABEL: () => CLAIM_LABEL,
  branchName: () => branchName,
  changesSince: () => changesSince,
  claimIssue: () => claimIssue,
  claimState: () => claimState,
  createIssueTree: () => createIssueTree,
  findProjectForRepo: () => findProjectForRepo,
  findPullRequest: () => findPullRequest,
  finishWork: () => finishWork,
  getIssueContext: () => getIssueContext,
  issueContext: () => issueContext,
  issuesFromDocument: () => issuesFromDocument,
  issuesFromMeeting: () => issuesFromMeeting,
  parseSince: () => parseSince,
  releaseIssue: () => releaseIssue,
  repoSlug: () => repoSlug,
  startWork: () => startWork
});
module.exports = __toCommonJS(agent_exports);
var import_statuses = require("../utils/statuses.js");
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
var import_content = require("../utils/content.js");
var import_spec = require("../utils/spec.js");
var import_meeting = require("../utils/meeting.js");
var import_documents = require("./documents.js");
var import_classes = require("../utils/classes.js");
var import_issues = require("./issues.js");
var import_comments = require("./comments.js");
var import_relations = require("./relations.js");
var import_labels = require("./labels.js");
const text = (r) => r.content[0]?.text ?? "";
const PR_STATE = ["open", "closed", "merged"];
const CLAIM_LABEL = "agent:working";
const CLAIM_RE = /\[huly-(claim|release) agent=(\S+?)(?: until=(\S+?))?\]/;
async function findIssue(client, identifier) {
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier });
  if (issue == null) throw new Error(`Issue '${identifier}' not found.`);
  return issue;
}
async function findStatus(client, issue, name) {
  const project = await client.findOne(import_tracker.default.class.Project, { _id: issue.space });
  return await (0, import_statuses.resolveIssueStatus)(client, project, issue.kind, name);
}
function branchName(identifier, title) {
  const slug = title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").split("-").slice(0, 6).join("-");
  return `${identifier.toLowerCase()}${slug !== "" ? "-" + slug : ""}`;
}
async function issueContext(workspace, identifier, commentLimit = 20) {
  const client = await (0, import_connection.getConnection)(workspace);
  const issue = await findIssue(client, identifier);
  const [status, milestone, component, labels, names] = await Promise.all([
    client.findOne(import_tracker.default.class.IssueStatus, { _id: issue.status }),
    issue.milestone != null ? client.findOne(import_tracker.default.class.Milestone, { _id: issue.milestone }) : void 0,
    issue.component != null ? client.findOne(import_tracker.default.class.Component, { _id: issue.component }) : void 0,
    client.findAll("tags:class:TagReference", { attachedTo: issue._id }),
    (0, import_people.peopleNames)(client)
  ]);
  const refs = async (list) => {
    const out = [];
    for (const r of list ?? []) {
      const other = await client.findOne(r._class ?? import_tracker.default.class.Issue, { _id: r._id });
      if (other == null) continue;
      out.push(other.identifier != null ? `${other.identifier}: ${other.title}` : `${String(other.title ?? other.name ?? r._id)} (${String(r._class).split(":").pop() ?? ""} \`${String(r._id)}\`)`);
    }
    return out;
  };
  const blockedBy = await refs(issue.blockedBy);
  const related = await refs(issue.relations);
  const sameProject = await client.findAll(import_tracker.default.class.Issue, { space: issue.space }, { projection: { identifier: 1, title: 1, blockedBy: 1 } });
  const blocking = sameProject.filter((i) => (i.blockedBy ?? []).some((b) => b._id === issue._id));
  const lines = [
    `## ${issue.identifier}: ${issue.title}`,
    `**Status:** ${status?.name ?? "?"} \xB7 **Priority:** ${(0, import_format.priorityLabel)(issue.priority)} \xB7 **Assignee:** ${issue.assignee != null ? names.get(issue.assignee) ?? "unknown" : "unassigned"}`,
    `**Component:** ${component?.label ?? "\u2014"} \xB7 **Milestone:** ${milestone?.label ?? "\u2014"} \xB7 **Due:** ${(0, import_format.formatDate)(issue.dueDate)}`,
    `**Labels:** ${labels.length > 0 ? labels.map((l) => l.title).join(", ") : "\u2014"}`,
    `**Parent chain:** ${(issue.parents ?? []).length > 0 ? [...issue.parents].reverse().map((p) => `${p.identifier} ${p.parentTitle}`).join(" \u203A ") : "\u2014"}`,
    `**Suggested branch:** \`${branchName(issue.identifier, issue.title)}\``
  ];
  if (blockedBy.length > 0) lines.push(`**Blocked by:** ${blockedBy.join("; ")}`);
  if (blocking.length > 0) lines.push(`**Blocks:** ${blocking.map((b) => `${b.identifier}: ${b.title}`).join("; ")}`);
  if (related.length > 0) lines.push(`**Related:** ${related.join("; ")}`);
  const description = await (0, import_content.readMarkup)(workspace, issue.description);
  lines.push("", "### Description", description !== "" ? description : "_(none)_");
  if ((issue.subIssues ?? 0) > 0) {
    lines.push("", "### Sub-issues", text(await (0, import_issues.listSubIssues)({ workspace, identifier, depth: 2 })).split("\n").slice(1).join("\n").trim());
  }
  const prs = await client.findAll(import_classes.C.PullRequest, { attachedTo: issue._id }, { sort: { modifiedOn: import_core.SortingOrder.Descending } });
  if (prs.length > 0) {
    lines.push("", "### Pull requests");
    for (const pr of prs) {
      const gh = pr[import_classes.IDS.GithubIssueMixin] ?? {};
      lines.push(`- ${pr.identifier} [${PR_STATE[pr.state] ?? pr.state}] ${pr.title} \u2014 #${gh.githubNumber ?? "?"} ${gh.url ?? ""}`);
    }
  }
  if ((issue.comments ?? 0) > 0) {
    const comments = text(await (0, import_comments.listComments)({ workspace, identifier, limit: commentLimit }));
    lines.push("", "### Comments", comments.split("\n").slice(2).join("\n").trim());
  }
  return lines.join("\n");
}
const getIssueContext = (0, import_errors.wrapToolHandler)(async (args) => {
  return await issueContext(args.workspace, args.identifier, args.commentLimit);
});
const startWork = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await findIssue(client, args.identifier);
  const status = await findStatus(client, issue, args.statusName);
  const update = {};
  if (issue.status !== status._id) update.status = status._id;
  let me;
  if (args.assignToMe) {
    const person = await (0, import_people.currentPerson)(client);
    me = person.name;
    if (issue.assignee !== person._id) update.assignee = person._id;
  }
  if (Object.keys(update).length > 0) await client.update(issue, update);
  let claim = "";
  if (args.claimAs != null) claim = "\n" + text(await claimIssue({ workspace: args.workspace, identifier: args.identifier, agent: args.claimAs, minutes: 120, force: false }));
  const head = `\u25B6\uFE0F Started **${args.identifier}** \u2014 status ${status.name}${me != null ? `, assigned to ${me}` : ""}.${claim}`;
  return `${head}

${await issueContext(args.workspace, args.identifier)}`;
});
async function findPullRequest(client, project, ref) {
  if (/^[A-Z][A-Z0-9]*-\d+$/.test(ref)) {
    const pr = await client.findOne(import_classes.C.PullRequest, { identifier: ref });
    if (pr == null) throw new Error(`Pull request '${ref}' not found.`);
    return pr;
  }
  const url = /^https?:\/\//.test(ref) ? ref.replace(/\/$/, "") : void 0;
  const number = url == null ? Number(ref.replace(/^#/, "")) : Number(/\/pull\/(\d+)/.exec(url)?.[1]);
  const prs = await client.findAll(import_classes.C.PullRequest, { space: project });
  const hits = prs.filter((pr) => {
    const gh = pr[import_classes.IDS.GithubIssueMixin] ?? {};
    return url != null ? String(gh.url ?? "").replace(/\/$/, "") === url : gh.githubNumber === number;
  });
  if (hits.length === 0) throw new Error(`Pull request '${ref}' not synced to this project yet (GitHub sync can take a minute).`);
  if (hits.length > 1) throw new Error(`Pull request '${ref}' is ambiguous here \u2014 pass its URL or Huly id.`);
  return hits[0];
}
const finishWork = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await findIssue(client, args.identifier);
  const done = [];
  const notes = [];
  let pr;
  if (args.pullRequest != null) {
    try {
      pr = await findPullRequest(client, issue.space, args.pullRequest);
    } catch (e) {
      notes.push(`${e.message} The link is in the comment; run finish_work again later to put the PR under ${args.identifier}.`);
    }
  }
  const prLine = args.pullRequest != null && !args.summary.includes(args.pullRequest) ? `

Pull request: ${args.pullRequest}` : "";
  await (0, import_comments.addComment)({ workspace: args.workspace, identifier: args.identifier, message: `\u{1F916} **Work summary**

${args.summary}${prLine}` });
  done.push("summary comment added");
  if (pr != null) {
    if (pr.attachedTo === issue._id) {
      done.push(`${pr.identifier} already under ${args.identifier}`);
    } else {
      await (0, import_relations.setParent)({ workspace: args.workspace, identifier: pr.identifier, parentIdentifier: args.identifier });
      done.push(`${pr.identifier} linked as sub-issue`);
    }
  }
  if (args.statusName != null) {
    try {
      const status = await findStatus(client, issue, args.statusName);
      if (issue.status !== status._id) await client.update(issue, { status: status._id });
      done.push(`status \u2192 ${status.name}`);
    } catch (e) {
      notes.push(e.message);
    }
  }
  const labels = await client.findAll("tags:class:TagReference", { attachedTo: issue._id });
  if (labels.some((l) => l.title === CLAIM_LABEL)) {
    const agent = claimState(await claimComments(client, issue))?.agent ?? "agent";
    await releaseIssue({ workspace: args.workspace, identifier: args.identifier, agent });
    done.push("claim released");
  }
  return `\u2705 Finished **${args.identifier}**: ${done.join(", ")}.${notes.length > 0 ? `
\u26A0\uFE0F ${notes.join(" ")}` : ""}`;
});
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const createIssueTree = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
  if (args.epic == null && args.epicIdentifier == null) throw new Error("Pass epic (new) or epicIdentifier (existing).");
  if (args.epic != null && args.epicIdentifier != null) throw new Error("Pass either epic or epicIdentifier, not both.");
  const existing = await client.findAll(import_tracker.default.class.Issue, { space: project._id });
  const byTitle = new Map(existing.map((i) => [norm(i.title), i.identifier]));
  const byIdentifier = new Map(existing.map((i) => [i.identifier, i]));
  const epicExisting = args.epicIdentifier != null ? (await findIssue(client, args.epicIdentifier)).identifier : void 0;
  const otherParent = (id, epic) => {
    const direct = byIdentifier.get(id)?.parents?.at(-1)?.identifier;
    return direct != null && direct !== epic ? direct : void 0;
  };
  const epicDup = args.epic != null ? byTitle.get(norm(args.epic.title)) : void 0;
  for (const [i, child] of args.children.entries()) {
    for (const ref of child.blockedBy ?? []) {
      const m = /^#(\d+)$/.exec(ref);
      if (m != null && (Number(m[1]) < 1 || Number(m[1]) > args.children.length || Number(m[1]) === i + 1)) throw new Error(`children[${i}].blockedBy '${ref}' must point to another child (#1\u2013#${args.children.length}).`);
    }
  }
  const plan = [];
  const ep = args.epic;
  const epicExtras = ep == null ? [] : [ep.componentLabel ?? args.componentLabel, ep.milestoneLabel ?? args.milestoneLabel, ep.assignee, ep.statusName, ...ep.labels ?? []].filter((x) => x != null);
  plan.push(epicExisting != null ? `Epic: existing **${epicExisting}**` : epicDup != null && args.skipDuplicates ? `Epic: "${args.epic.title}" \u2192 reuse existing **${epicDup}** (same title)` : `Epic: create "${args.epic.title}"${epicExtras.length > 0 ? ` \xB7 ${epicExtras.join(", ")}` : ""}`);
  args.children.forEach((c, i) => {
    const dup = byTitle.get(norm(c.title));
    const extras = [c.componentLabel ?? args.componentLabel, c.milestoneLabel ?? args.milestoneLabel, c.assignee, c.statusName, ...c.labels ?? []].filter((x) => x != null);
    const blockers = (c.blockedBy ?? []).length > 0 ? ` \xB7 blocked by ${(c.blockedBy ?? []).join(", ")}` : "";
    const kept = dup != null ? otherParent(dup, epicExisting ?? epicDup) : void 0;
    const reuse = `"${c.title}" \u2192 reuse existing **${dup ?? ""}**${kept != null ? ` (stays under ${kept})` : ""}`;
    plan.push(`#${i + 1} ${dup != null && args.skipDuplicates ? reuse : `create "${c.title}"`}${extras.length > 0 ? ` \xB7 ${extras.join(", ")}` : ""}${blockers}`);
  });
  if (args.dryRun) return `\u{1F50D} Dry run in ${args.projectIdentifier}:
${plan.map((p) => `- ${p}`).join("\n")}
Run again with dryRun=false to create.`;
  const ws = args.workspace;
  const create = async (title, description, priority, f = {}) => {
    const out = text(await (0, import_issues.createIssue)({ workspace: ws, projectIdentifier: args.projectIdentifier, title, description, priority: priority ?? "NoPriority", componentLabel: f.componentLabel, milestoneLabel: f.milestoneLabel, assignee: f.assignee, statusName: f.statusName }));
    const id = /\*\*([A-Z][A-Z0-9]*-\d+)\*\*/.exec(out)?.[1];
    if (id == null) throw new Error(`Could not read new issue id from: ${out}`);
    return id;
  };
  const decorate = async (id, c) => {
    for (const label of c.labels ?? []) await (0, import_labels.addLabel)({ workspace: ws, identifier: id, labelName: label });
  };
  const created = [];
  let epicId = epicExisting;
  if (epicId == null) {
    if (epicDup != null && args.skipDuplicates) epicId = epicDup;
    else {
      const e = args.epic;
      epicId = await create(e.title, e.description, e.priority, { componentLabel: e.componentLabel ?? args.componentLabel, milestoneLabel: e.milestoneLabel ?? args.milestoneLabel, assignee: e.assignee, statusName: e.statusName });
      await decorate(epicId, { labels: args.epic.labels });
      created.push(`${epicId} (epic)`);
    }
  }
  const ids = [];
  const notes = [];
  for (const c of args.children) {
    const dup = byTitle.get(norm(c.title));
    if (dup != null && args.skipDuplicates) {
      ids.push(dup);
      const kept = otherParent(dup, epicId);
      if (kept != null) notes.push(`${dup} stays under ${kept}`);
      else if (byIdentifier.get(dup)?.parents?.at(-1)?.identifier !== epicId) await (0, import_relations.setParent)({ workspace: ws, identifier: dup, parentIdentifier: epicId });
      continue;
    }
    const id = await create(c.title, c.description, c.priority, { componentLabel: c.componentLabel ?? args.componentLabel, milestoneLabel: c.milestoneLabel ?? args.milestoneLabel, assignee: c.assignee, statusName: c.statusName });
    await decorate(id, c);
    await (0, import_relations.setParent)({ workspace: ws, identifier: id, parentIdentifier: epicId });
    created.push(id);
    ids.push(id);
  }
  for (const [i, c] of args.children.entries()) {
    for (const ref of c.blockedBy ?? []) {
      const m = /^#(\d+)$/.exec(ref);
      await (0, import_relations.addBlockedBy)({ workspace: ws, identifier: ids[i], blockedBy: m != null ? ids[Number(m[1]) - 1] : ref });
    }
  }
  const reused = args.children.length - (created.length - (created[0]?.endsWith("(epic)") === true ? 1 : 0));
  return `\u2705 Issue tree under **${epicId}**: created ${created.length > 0 ? created.join(", ") : "nothing"}${reused > 0 ? `; ${reused} existing reused` : ""}${notes.length > 0 ? ` (${notes.join("; ")})` : ""}.
${args.children.map((c, i) => `- ${ids[i]}: ${c.title}`).join("\n")}`;
});
async function findDocumentWithContent(client, ref) {
  const DOC = "document:class:Document";
  let doc = await client.findOne(DOC, { _id: ref });
  if (doc == null) {
    const hits = (await client.findAll(DOC, {})).filter((d) => String(d.title).trim().toLowerCase() === ref.trim().toLowerCase());
    if (hits.length > 1) throw new Error(`Several documents are titled '${ref}' \u2014 pass the id (list_documents): ${hits.map((d) => d._id).join(", ")}.`);
    doc = hits[0];
  }
  if (doc == null) throw new Error(`Document '${ref}' not found (id or exact title).`);
  if (doc.content == null || doc.content === "") throw new Error(`Document "${doc.title}" is empty.`);
  return doc;
}
const issuesFromDocument = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const doc = await findDocumentWithContent(client, args.document);
  const plan = (0, import_spec.planFromMarkup)(await (0, import_content.readMarkupJson)(args.workspace, doc.content));
  if (plan.tasks.length === 0) {
    throw new Error(`No ${plan.source === "checklist" ? "open checklist items (all checked)" : "checklist items or sections"} in "${doc.title}". Read it with get_document and pass your own children to create_issue_tree.`);
  }
  if (plan.tasks.length > 50) throw new Error(`"${doc.title}" yields ${plan.tasks.length} issues (max 50). Split the document or use create_issue_tree.`);
  const tree = text(await createIssueTree({
    workspace: args.workspace,
    projectIdentifier: args.projectIdentifier,
    epic: args.epicIdentifier == null ? { title: args.epicTitle ?? String(doc.title), description: `Spec: ${String(doc.title)}` } : void 0,
    epicIdentifier: args.epicIdentifier,
    children: plan.tasks,
    componentLabel: args.componentLabel,
    milestoneLabel: args.milestoneLabel,
    skipDuplicates: args.skipDuplicates,
    dryRun: args.dryRun
  }));
  const from = plan.source === "checklist" ? "open checklist items" : "sections";
  const head = `\u{1F4C4} "${String(doc.title)}" \u2192 ${plan.tasks.length} issue(s) from ${from}${plan.skippedDone > 0 ? ` (${plan.skippedDone} checked item(s) skipped)` : ""}.`;
  if (args.dryRun) return `${head}
${tree}
Not the right split? Use create_issue_tree with your own children.`;
  const epicId = /under \*\*([A-Z][A-Z0-9]*-\d+)\*\*/.exec(tree)?.[1];
  const link = epicId != null ? text(await (0, import_documents.linkDocument)({ workspace: args.workspace, identifier: epicId, documentId: String(doc._id) })) : "\u26A0\uFE0F Could not read the epic id; document not linked.";
  return `${head}
${tree}
${link}`;
});
const issuesFromMeeting = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const doc = await findDocumentWithContent(client, args.document);
  const plan = (0, import_meeting.actionsFromMarkup)(await (0, import_content.readMarkupJson)(args.workspace, doc.content));
  if (plan.tasks.length === 0) {
    throw new Error(`No open action items in "${doc.title}"${plan.skippedDone > 0 ? ` (${plan.skippedDone} checked)` : ""}. Recognised: open checkboxes, lines starting with "TODO:"/"Action:", list items under a heading like "Action items" or "Next steps".`);
  }
  if (plan.tasks.length > 50) throw new Error(`"${doc.title}" has ${plan.tasks.length} action items (max 50).`);
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
  const existing = await client.findAll(import_tracker.default.class.Issue, { space: project._id });
  const byTitle = new Map(existing.map((i) => [norm(i.title), i.identifier]));
  const people = /* @__PURE__ */ new Map();
  for (const name of new Set(plan.tasks.map((t) => t.assignee).filter((a) => a != null))) {
    try {
      people.set(name, { name: (await (0, import_people.findPerson)(client, name)).name });
    } catch (e) {
      people.set(name, { problem: e instanceof Error ? e.message : String(e) });
    }
  }
  const who = (t) => t.assignee != null ? people.get(t.assignee)?.name : void 0;
  const describe = (t) => {
    const p = t.assignee != null ? people.get(t.assignee) : void 0;
    return [p?.name, p?.problem != null ? `\u26A0\uFE0F ${p.problem} \u2192 unassigned` : void 0, t.dueDate != null ? `due ${t.dueDate}` : void 0].filter((x) => x != null).join(" \xB7 ");
  };
  const head = `\u{1F4DD} "${String(doc.title)}" \u2192 ${plan.tasks.length} action item(s)${plan.skippedDone > 0 ? ` (${plan.skippedDone} checked skipped)` : ""}.`;
  if (args.dryRun) {
    const lines = plan.tasks.map((t, i) => {
      const dup = byTitle.get(norm(t.title));
      const extra = describe(t);
      return `- #${i + 1} ${dup != null && args.skipDuplicates ? `"${t.title}" \u2192 exists as **${dup}**, skipped` : `create "${t.title}"`}${extra !== "" ? ` \xB7 ${extra}` : ""}`;
    });
    const fields = [args.componentLabel, args.milestoneLabel].filter((x) => x != null);
    return `${head}
\u{1F50D} Dry run in ${args.projectIdentifier}${fields.length > 0 ? ` (${fields.join(", ")})` : ""}:
${lines.join("\n")}
Run again with dryRun=false to create; each new issue is linked to the document.`;
  }
  const out = [];
  for (const t of plan.tasks) {
    const dup = byTitle.get(norm(t.title));
    if (dup != null && args.skipDuplicates) {
      out.push(`- ${dup}: ${t.title} (exists, skipped)`);
      continue;
    }
    const res = text(await (0, import_issues.createIssue)({ workspace: args.workspace, projectIdentifier: args.projectIdentifier, title: t.title, description: t.description, priority: "NoPriority", dueDate: t.dueDate, assignee: who(t), componentLabel: args.componentLabel, milestoneLabel: args.milestoneLabel }));
    const id = /\*\*([A-Z][A-Z0-9]*-\d+)\*\*/.exec(res)?.[1];
    if (id == null) throw new Error(`Could not read new issue id from: ${res}`);
    await (0, import_documents.linkDocument)({ workspace: args.workspace, identifier: id, documentId: String(doc._id) });
    byTitle.set(norm(t.title), id);
    const extra = describe(t);
    out.push(`- ${id}: ${t.title}${extra !== "" ? ` \xB7 ${extra}` : ""}`);
  }
  return `${head}
\u2705 Created in ${args.projectIdentifier}, linked to the document:
${out.join("\n")}`;
});
function parseSince(value, now = Date.now()) {
  const rel = /^(\d+)\s*([mhd])$/i.exec(value.trim());
  if (rel != null) return now - Number(rel[1]) * { m: 6e4, h: 36e5, d: 864e5 }[rel[2].toLowerCase()];
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) throw new Error(`Cannot read since='${value}'. Use ISO (2026-11-01, 2026-11-01T08:00) or relative (90m, 24h, 7d).`);
  return ts;
}
const changesSince = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const since = parseSince(args.since);
  const query = { modifiedOn: { $gte: since } };
  if (args.projectIdentifiers != null && args.projectIdentifiers.length > 0) {
    const projects = await client.findAll(import_tracker.default.class.Project, { identifier: { $in: args.projectIdentifiers } });
    const missing = args.projectIdentifiers.filter((p) => !projects.some((x) => x.identifier === p));
    if (missing.length > 0) throw new Error(`Project(s) not found: ${missing.join(", ")}.`);
    query.space = { $in: projects.map((p) => p._id) };
  }
  const issues = await client.findAll(import_tracker.default.class.Issue, query, { sort: { modifiedOn: import_core.SortingOrder.Descending }, limit: args.limit });
  if (issues.length === 0) return `No issue changes since ${new Date(since).toISOString()}.`;
  const ids = issues.map((i) => i._id);
  const [updates, comments, statuses] = await Promise.all([
    client.findAll("activity:class:DocUpdateMessage", { attachedTo: { $in: ids }, createdOn: { $gte: since } }),
    client.findAll("chunter:class:ChatMessage", { attachedTo: { $in: ids }, createdOn: { $gte: since } }),
    client.findAll(import_tracker.default.class.IssueStatus, {})
  ]);
  const authors = await (0, import_people.socialIdNames)(client, [...new Set([...updates, ...comments].map((m) => m.createdBy).filter((x) => x != null))]);
  const statusName = new Map(statuses.map((s) => [s._id, s.name]));
  const rows = issues.map((issue) => {
    const ups = updates.filter((u) => u.attachedTo === issue._id);
    const cs = comments.filter((c) => c.attachedTo === issue._id);
    const isNew = issue.createdOn >= since;
    const fields = isNew ? [] : [...new Set(ups.map((u) => u.attributeUpdates?.attrKey).filter((k) => k != null && k !== "rank").map((k) => k === "attachedTo" ? "parent" : k))];
    const who = [...new Set([...ups, ...cs].map((m) => authors.get(m.createdBy)).filter((n) => n != null))];
    const parts = [
      isNew ? "new" : void 0,
      fields.length > 0 ? `changed ${fields.join(", ")}` : void 0,
      cs.length > 0 ? `+${cs.length} comment(s)` : void 0
    ].filter((p) => p != null);
    return { issue, who, what: parts.length > 0 ? parts.join(" \xB7 ") : "updated" };
  });
  const everyone = [...new Set(rows.flatMap((r) => r.who))];
  const single = everyone.length === 1 && rows.every((r) => r.who.length === 1);
  const lines = rows.map(({ issue, who, what }) => {
    const kind = issue._class === import_classes.C.PullRequest ? "PR " : "";
    return `- ${kind}**${issue.identifier}** [${statusName.get(issue.status) ?? "?"}] ${issue.title} \u2014 ${what}${!single && who.length > 0 ? ` (by ${who.join(", ")})` : ""} \xB7 ${(0, import_format.formatDate)(issue.modifiedOn)}`;
  });
  return `## Changes since ${new Date(since).toISOString()} (${issues.length}${issues.length === args.limit ? "+" : ""})${single ? `, all by ${everyone[0]}` : ""}

${lines.join("\n")}`;
});
async function claimComments(client, issue) {
  const comments = await client.findAll("chunter:class:ChatMessage", { attachedTo: issue._id }, { sort: { createdOn: import_core.SortingOrder.Descending }, limit: 50 });
  return comments.filter((c) => CLAIM_RE.test(String(c.message ?? "")));
}
function claimState(markers, now = Date.now()) {
  const latest = markers[0];
  if (latest == null) return void 0;
  const m = CLAIM_RE.exec(String(latest.message));
  if (m[1] !== "claim") return void 0;
  const until = Date.parse(m[3] ?? "");
  if (Number.isNaN(until) || until < now) return void 0;
  return { agent: m[2], until };
}
const agentName = (agent) => (agent ?? process.env.HULY_AGENT_NAME ?? "claude").replace(/\s+/g, "-");
const claimIssue = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await findIssue(client, args.identifier);
  const agent = agentName(args.agent);
  const active = claimState(await claimComments(client, issue));
  if (active != null && active.agent !== agent && !args.force) {
    throw new Error(`${args.identifier} is claimed by '${active.agent}' until ${new Date(active.until).toISOString()}. Pick another issue or pass force=true.`);
  }
  const until = new Date(Date.now() + args.minutes * 6e4).toISOString();
  await (0, import_comments.addComment)({ workspace: args.workspace, identifier: args.identifier, message: `\u{1F916} Claimed by **${agent}** until ${until} [huly-claim agent=${agent} until=${until}]` });
  await (0, import_labels.addLabel)({ workspace: args.workspace, identifier: args.identifier, labelName: CLAIM_LABEL });
  return `\u{1F512} **${args.identifier}** claimed by ${agent} until ${until}.`;
});
const releaseIssue = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await findIssue(client, args.identifier);
  const agent = agentName(args.agent);
  await (0, import_comments.addComment)({ workspace: args.workspace, identifier: args.identifier, message: `\u{1F916} Released by **${agent}** [huly-release agent=${agent}]` });
  const labels = await client.findAll("tags:class:TagReference", { attachedTo: issue._id });
  if (labels.some((l) => l.title === CLAIM_LABEL)) await (0, import_labels.removeLabel)({ workspace: args.workspace, identifier: args.identifier, labelName: CLAIM_LABEL });
  return `\u{1F513} **${args.identifier}** released by ${agent}.`;
});
function repoSlug(value) {
  const v = value.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const m = /github\.com[:/]([^/]+\/[^/]+)$/i.exec(v);
  return (m?.[1] ?? v).toLowerCase();
}
const findProjectForRepo = (0, import_errors.wrapToolHandler)(async (args) => {
  const slug = repoSlug(args.repository);
  if (!/^[^/\s]+\/[^/\s]+$/.test(slug)) throw new Error(`'${args.repository}' is not a GitHub repository (owner/name, URL or git remote).`);
  const targets = args.workspace != null ? [{ url: args.workspace, name: args.workspace }] : await (0, import_connection.listWorkspaces)();
  const hits = [];
  for (const ws of targets) {
    let client;
    try {
      client = await (0, import_connection.getConnection)(ws.url);
    } catch {
      continue;
    }
    const repos = (await client.findAll("github:class:GithubIntegrationRepository", {})).filter((r) => String(r.resourcePath ?? "").toLowerCase() === slug);
    if (repos.length === 0) continue;
    const repoIds = new Set(repos.map((r) => r._id));
    const projects = (await client.findAll(import_tracker.default.class.Project, {})).filter((p) => (p[import_classes.IDS.GithubProject]?.repositories ?? []).some((id) => repoIds.has(id)));
    for (const p of projects) hits.push(`- workspace \`${ws.url}\` \xB7 project **${p.identifier}** (${p.name})`);
  }
  if (hits.length === 0) return `No Huly project is linked to GitHub repository ${slug}. (Link it in Huly \u2192 Settings \u2192 GitHub, or pass workspace and project explicitly.)`;
  return `## Huly project(s) for ${slug}

${hits.join("\n")}`;
});
