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
var overview_exports = {};
__export(overview_exports, {
  dayStart: () => dayStart,
  lastWorkingDay: () => lastWorkingDay,
  myDay: () => myDay,
  myDayText: () => myDayText,
  plain: () => plain,
  projectReport: () => projectReport,
  releaseNotes: () => releaseNotes,
  standup: () => standup,
  triageInbox: () => triageInbox
});
module.exports = __toCommonJS(overview_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_task = __toESM(require("../../vendor/@hcengineering/task/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_classes = require("../utils/classes.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
var import_agent = require("./agent.js");
var import_resolve = require("../utils/resolve.js");
const DAY = 864e5;
const day = (ts) => new Date(ts).toISOString().slice(0, 10);
const hm = (ts) => new Date(ts).toISOString().slice(11, 16);
function dayStart(date) {
  if (date == null) return Date.parse((/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  const t = Date.parse(date.slice(0, 10));
  if (Number.isNaN(t)) throw new Error(`date must be YYYY-MM-DD, got '${date}'.`);
  return t;
}
const due = (ts, from) => {
  if (ts == null) return "";
  if (ts < from) return ` \xB7 \u26A0\uFE0F overdue (${day(ts)})`;
  if (ts < from + DAY) return " \xB7 due today";
  return ` \xB7 due ${day(ts)}`;
};
const myDay = (0, import_errors.wrapToolHandler)(async (args) => await myDayText(await (0, import_connection.getConnection)(args.workspace), args.date, args.limit ?? 10));
async function myDayText(client, date, limit) {
  const from = dayStart(date);
  const to = from + DAY - 1;
  const [me, uuid] = await Promise.all([(0, import_people.currentPerson)(client), (0, import_people.currentAccountUuid)(client)]);
  const [events, todos, issues, prs, unread] = await Promise.all([
    client.findAll(import_classes.C.Event, { date: { $lte: to }, dueDate: { $gte: from } }, { sort: { date: import_core.SortingOrder.Ascending } }),
    client.findAll(import_classes.C.ToDo, { user: me._id, doneOn: null }, { sort: { rank: import_core.SortingOrder.Ascending } }),
    client.findAll(import_tracker.default.class.Issue, { assignee: me._id }),
    client.findAll(import_classes.C.PullRequest, { state: 0 }),
    client.findAll(import_classes.C.InboxNotification, { user: uuid, isViewed: false, archived: false }, { sort: { createdOn: import_core.SortingOrder.Descending }, limit: 500 })
  ]);
  const out = [`# My day \u2014 ${day(from)} (times UTC)`];
  const mine = events.filter((e) => (e.participants ?? []).includes(me._id) || String(e.calendar ?? "").startsWith(uuid) || e.user === me._id);
  out.push("", `## Calendar (${mine.length})`);
  if (mine.length === 0) out.push("Nothing scheduled.");
  for (const e of mine.slice(0, limit)) {
    const when = e.allDay === true ? "all day" : `${hm(Math.max(e.date, from))}\u2013${hm(Math.min(e.dueDate, to))}`;
    const slot = e._class === import_classes.C.WorkSlot ? ` \xB7 work slot for ${await (0, import_resolve.loadLabel)(client, e.attachedToClass, e.attachedTo)}` : "";
    out.push(`- ${when} **${String(e.title)}**${e.location != null && e.location !== "" ? ` \xB7 \u{1F4CD} ${String(e.location)}` : ""}${slot}`);
  }
  const urgency = (t) => t.dueDate == null ? 2 : t.dueDate <= to ? 0 : 1;
  const sortedTodos = [...todos].sort((a, b) => urgency(a) - urgency(b));
  const dueNow = todos.filter((t) => t.dueDate != null && t.dueDate <= to).length;
  out.push("", `## To-dos (${todos.length} open${dueNow > 0 ? `, ${dueNow} due by today` : ""})`);
  if (todos.length === 0) out.push("No open to-dos.");
  for (const t of sortedTodos.slice(0, limit)) {
    const prio = t.priority != null && t.priority !== import_classes.TODO_PRIORITY.NoPriority ? ` \xB7 ${String(import_classes.TODO_PRIORITY_LABEL[t.priority] ?? t.priority)}` : "";
    out.push(`- [ ] **${String(t.title)}**${prio}${due(t.dueDate, from)} \u2014 \`${String(t._id)}\``);
  }
  const statuses = issues.length > 0 ? await client.findAll("core:class:Status", { _id: { $in: [...new Set(issues.map((i) => i.status))] } }) : [];
  const st = new Map(statuses.map((s) => [s._id, s]));
  const closed = /* @__PURE__ */ new Set([import_task.default.statusCategory.Won, import_task.default.statusCategory.Lost]);
  const open = issues.filter((i) => i._class !== import_classes.C.PullRequest && !closed.has(st.get(i.status)?.category));
  const active = (i) => st.get(i.status)?.category === import_task.default.statusCategory.Active ? 0 : 1;
  open.sort((a, b) => active(a) - active(b) || (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || (a.priority || 9) - (b.priority || 9));
  out.push("", `## My issues (${open.length} open, ${open.filter((i) => active(i) === 0).length} in progress)`);
  if (open.length === 0) out.push("No open issues assigned to you.");
  for (const i of open.slice(0, limit)) {
    const prio = i.priority != null && i.priority !== 0 ? ` \xB7 ${(0, import_format.priorityLabel)(i.priority)}` : "";
    out.push(`- **${String(i.identifier)}** ${String(i.title)} \u2014 ${String(st.get(i.status)?.name ?? "?")}${prio}${due(i.dueDate, from)}`);
  }
  const DECISION = ["changes requested", "approved", "review required"];
  const toReview = prs.filter((p) => (p.reviewers ?? []).includes(me._id));
  const own = prs.filter((p) => p.assignee === me._id && !toReview.includes(p));
  out.push("", `## Reviews (${toReview.length} for you, ${own.length} of yours open)`);
  if (toReview.length + own.length === 0) out.push("No open pull requests for you.");
  for (const p of toReview.slice(0, limit)) out.push(`- \u{1F440} **${String(p.identifier)}** ${String(p.title)}${p.draft === true ? " \xB7 draft" : ""}`);
  for (const p of own.slice(0, limit)) out.push(`- **${String(p.identifier)}** ${String(p.title)} \xB7 ${p.reviewDecision != null ? DECISION[p.reviewDecision] ?? p.reviewDecision : "no review yet"}${p.draft === true ? " \xB7 draft" : ""}`);
  const groups = /* @__PURE__ */ new Map();
  for (const n of unread) groups.set(n.docNotifyContext, [...groups.get(n.docNotifyContext) ?? [], n]);
  out.push("", `## Inbox (${unread.length}${unread.length === 500 ? "+" : ""} unread on ${groups.size} item(s))`);
  if (unread.length === 0) out.push("Inbox zero.");
  const ctxs = groups.size > 0 ? await client.findAll(import_classes.C.DocNotifyContext, { _id: { $in: [...groups.keys()].slice(0, limit) } }) : [];
  const shown = [...groups.entries()].slice(0, limit).map(([ctxId, notes]) => {
    const ctx = ctxs.find((c) => c._id === ctxId);
    return { notes, cls: ctx?.objectClass ?? notes[0].objectClass, id: ctx?.objectId ?? notes[0].objectId };
  });
  const labels = await (0, import_resolve.loadLabels)(client, shown.filter((x) => x.cls != null).map((x) => ({ _class: x.cls, _id: x.id })));
  for (const x of shown) out.push(`- **${x.cls != null ? labels.get(`${String(x.cls)}:${String(x.id)}`) ?? String(x.id) : "(unknown)"}** \u2014 ${x.notes.length} unread`);
  if (unread.length > 0) out.push(`_${groups.size > limit ? `${groups.size - limit} more. ` : ""}Work through them: triage_inbox._`);
  return out.join("\n");
}
const pct = (part, total) => total === 0 ? "\u2014" : `${Math.round(100 * part / total)}%`;
const projectReport = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
  const since = (0, import_agent.parseSince)(args.since ?? "7d");
  const now = Date.now();
  const all = await client.findAll(import_tracker.default.class.Issue, { space: project._id });
  const issues = all.filter((i) => i._class !== import_classes.C.PullRequest);
  const prs = all.filter((i) => i._class === import_classes.C.PullRequest);
  const ids = issues.map((i) => i._id);
  const [statuses, milestones, reports, statusMsgs] = await Promise.all([
    client.findAll("core:class:Status", { _id: { $in: [...new Set(all.map((i) => i.status))] } }),
    client.findAll(import_tracker.default.class.Milestone, { space: project._id }),
    ids.length > 0 ? client.findAll(import_tracker.default.class.TimeSpendReport, { attachedTo: { $in: ids } }) : [],
    ids.length > 0 ? client.findAll(import_classes.C.DocUpdateMessage, { attachedTo: { $in: ids }, createdOn: { $gte: since } }) : []
  ]);
  const names = await (0, import_people.peopleNames)(client);
  const st = new Map(statuses.map((s) => [s._id, s]));
  const cat = (i) => st.get(i.status)?.category;
  const won = (i) => cat(i) === import_task.default.statusCategory.Won;
  const isOpen = (i) => !won(i) && cat(i) !== import_task.default.statusCategory.Lost;
  const who = (i) => i.assignee != null ? ` \xB7 ${names.get(i.assignee) ?? "?"}` : "";
  const line = (i, extra = "") => `- **${String(i.identifier)}** ${String(i.title)}${extra}${who(i)}`;
  const statusChanged = new Set(statusMsgs.filter((m) => m.attributeUpdates?.attrKey === "status").map((m) => m.attachedTo));
  const done = issues.filter((i) => won(i) && statusChanged.has(i._id));
  const created = issues.filter((i) => (i.createdOn ?? 0) >= since);
  const open = issues.filter(isOpen);
  const active = open.filter((i) => cat(i) === import_task.default.statusCategory.Active);
  const openIds = new Set(open.map((i) => i._id));
  const blocked = open.filter((i) => (i.blockedBy ?? []).some((b) => openIds.has(b._id ?? b)));
  const overdue = open.filter((i) => i.dueDate != null && i.dueDate < now);
  const stale = active.filter((i) => (i.modifiedOn ?? 0) < since);
  const merged = prs.filter((p) => p.state === 2 && (p.mergedAt ?? p.modifiedOn ?? 0) >= since);
  const openPrs = prs.filter((p) => p.state === 0);
  const time = reports.filter((r) => (r.date ?? 0) >= since);
  const hours = time.reduce((s, r) => s + (r.value ?? 0), 0);
  const L = 15;
  const section = (title, list, render = (i) => line(i)) => {
    if (list.length === 0) return;
    out.push("", `## ${title} (${list.length})`, ...list.slice(0, L).map(render));
    if (list.length > L) out.push(`_\u2026${list.length - L} more_`);
  };
  const out = [
    `# ${String(project.name)} (${String(project.identifier)}) \u2014 ${day(since)} to ${day(now)}`,
    "",
    `**${done.length} done \xB7 ${created.length} new \xB7 ${open.length} open (${active.length} in progress) \xB7 ${blocked.length} blocked \xB7 ${overdue.length} overdue \xB7 ${merged.length} PRs merged \xB7 ${Math.round(hours * 10) / 10}h logged**`
  ];
  section("Done", done);
  section("New", created, (i) => line(i, ` \u2014 ${String(st.get(i.status)?.name ?? "?")}`));
  section("In progress", active, (i) => line(i, stale.includes(i) ? " \xB7 \u26A0\uFE0F no change in this period" : ""));
  section("Blocked", blocked, (i) => line(i, ` \u2014 by ${i.blockedBy.map((b) => String(all.find((x) => x._id === (b._id ?? b))?.identifier ?? "?")).join(", ")}`));
  section("Overdue", overdue, (i) => line(i, ` \u2014 due ${day(i.dueDate)}`));
  section("Pull requests merged", merged);
  section("Pull requests open", openPrs, (p) => line(p, p.reviewDecision != null ? ` \xB7 ${["changes requested", "approved", "review required"][p.reviewDecision] ?? ""}` : ""));
  const ms = milestones.filter((m) => m.status !== 2 && m.status !== 3).sort((a, b) => (a.targetDate ?? Infinity) - (b.targetDate ?? Infinity));
  section("Milestones", ms, (m) => {
    const of = issues.filter((i) => i.milestone === m._id);
    const late = m.targetDate != null && m.targetDate < now ? " \u26A0\uFE0F past target" : "";
    return `- **${String(m.label)}** \u2014 ${of.filter(won).length}/${of.length} done (${pct(of.filter(won).length, of.length)})${m.targetDate != null ? `, target ${day(m.targetDate)}${late}` : ""}`;
  });
  if (time.length > 0) {
    const per = /* @__PURE__ */ new Map();
    for (const r of time) {
      const n = names.get(r.employee) ?? "?";
      per.set(n, (per.get(n) ?? 0) + (r.value ?? 0));
    }
    out.push("", "## Time logged", ...[...per].sort((a, b) => b[1] - a[1]).map(([n, h]) => `- ${n}: ${Math.round(h * 10) / 10}h`));
  }
  return out.join("\n");
});
function lastWorkingDay(now = Date.now()) {
  const today = dayStart(new Date(now).toISOString());
  const dow = new Date(today).getUTCDay();
  const back = dow === 1 ? 3 : dow === 0 ? 2 : 1;
  return today - back * DAY;
}
const sections = (md) => new Map(md.split(/\n(?=## )/).filter((s) => s.startsWith("## ")).map((s) => [s.split("\n")[0].replace(/^## | \(.*$/g, ""), s.trim()]));
const standup = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const since = args.since != null ? (0, import_agent.parseSince)(args.since) : lastWorkingDay();
  const me = await (0, import_people.currentPerson)(client);
  const idents = await client.findAll("contact:class:SocialIdentity", { attachedTo: me._id });
  const mine = [.../* @__PURE__ */ new Set([client.user, ...idents.map((i) => i._id)])];
  const [updates, comments, reports, doneTodos] = await Promise.all([
    client.findAll(import_classes.C.DocUpdateMessage, { createdBy: { $in: mine }, createdOn: { $gte: since } }, { limit: 1e3, sort: { createdOn: import_core.SortingOrder.Descending } }),
    client.findAll("chunter:class:ChatMessage", { createdBy: { $in: mine }, createdOn: { $gte: since }, attachedToClass: { $in: [import_tracker.default.class.Issue, import_classes.C.PullRequest] } }, { limit: 200 }),
    client.findAll(import_tracker.default.class.TimeSpendReport, { employee: me._id, date: { $gte: since } }),
    client.findAll(import_classes.C.ToDo, { user: me._id, doneOn: { $gte: since } })
  ]);
  const per = /* @__PURE__ */ new Map();
  const entry = (id) => per.get(id) ?? per.set(id, { created: false, status: [], fields: /* @__PURE__ */ new Set(), comments: 0, hours: 0 }).get(id);
  const statusIds = /* @__PURE__ */ new Set();
  updates.sort((a, b) => (a.createdOn ?? 0) - (b.createdOn ?? 0));
  for (const u of updates) {
    if (u.objectClass != null && u.objectClass !== import_tracker.default.class.Issue && u.objectClass !== import_classes.C.PullRequest && u.attachedToClass !== import_tracker.default.class.Issue) continue;
    const e = entry(u.attachedTo);
    if (u.action === "create") e.created = true;
    else if (u.attributeUpdates?.attrKey === "status") {
      for (const s of u.attributeUpdates.set ?? []) {
        e.status.push(s);
        statusIds.add(s);
      }
    } else if (u.attributeUpdates?.attrKey != null && !["rank", "subIssues", "comments", "reports", "reportedTime", "remainingTime", "modifiedOn"].includes(u.attributeUpdates.attrKey)) e.fields.add(u.attributeUpdates.attrKey === "attachedTo" ? "parent" : u.attributeUpdates.attrKey);
  }
  for (const c of comments) entry(c.attachedTo).comments++;
  for (const r of reports) entry(r.attachedTo).hours += r.value ?? 0;
  const issues = per.size > 0 ? await client.findAll(import_tracker.default.class.Issue, { _id: { $in: [...per.keys()] } }) : [];
  const stNames = new Map((statusIds.size > 0 ? await client.findAll("core:class:Status", { _id: { $in: [...statusIds] } }) : []).map((s) => [s._id, s.name]));
  const out = [`# Standup \u2014 since ${new Date(since).toISOString().slice(0, 16).replace("T", " ")} UTC`, "", "## Done / worked on"];
  if (updates.length === 1e3) out.push("_Very busy period: only the latest 1000 changes are counted._");
  const weight = (i) => {
    const e = per.get(i._id);
    return e.status.length > 0 || e.created ? 0 : e.comments > 0 || e.hours > 0 ? 1 : 2;
  };
  issues.sort((a, b) => weight(a) - weight(b));
  const did = issues.slice(0, 15).map((i) => {
    const e = per.get(i._id);
    const parts = [
      e.created ? "created" : void 0,
      e.status.length > 0 ? `\u2192 ${e.status.map((s) => stNames.get(s) ?? "?").filter((n, k, a) => k === 0 || n !== a[k - 1]).join(" \u2192 ")}` : void 0,
      e.fields.size > 0 ? `changed ${[...e.fields].join(", ")}` : void 0,
      e.comments > 0 ? `${e.comments} comment(s)` : void 0,
      e.hours > 0 ? `${Math.round(e.hours * 10) / 10}h` : void 0
    ].filter((p) => p != null);
    return `- **${String(i.identifier)}** ${String(i.title)} \u2014 ${parts.join(" \xB7 ")}`;
  });
  if (issues.length > 15) did.push(`_\u2026${issues.length - 15} more issues touched \u2014 changes_since for all._`);
  for (const t of doneTodos) did.push(`- [x] ${String(t.title)}`);
  out.push(...did.length > 0 ? did : ["Nothing recorded in Huly."]);
  const day2 = sections(await myDayText(client, void 0, 5));
  out.push("", "## Today");
  for (const key of ["Calendar", "To-dos", "My issues"]) {
    const s = day2.get(key);
    if (s != null) out.push(s.replace(/^## /, "### "));
  }
  const blocked = await myBlockedIssues(client, me._id);
  out.push("", "## Blockers", ...blocked.length > 0 ? blocked : ["None in Huly."]);
  return out.join("\n");
});
async function myBlockedIssues(client, me) {
  const mineOpen = (await client.findAll(import_tracker.default.class.Issue, { assignee: me })).filter((i) => (i.blockedBy ?? []).length > 0);
  if (mineOpen.length === 0) return [];
  const blockerIds = [...new Set(mineOpen.flatMap((i) => i.blockedBy.map((b) => b._id ?? b)))];
  const [blockers, statuses] = await Promise.all([
    client.findAll(import_tracker.default.class.Issue, { _id: { $in: blockerIds } }),
    client.findAll("core:class:Status", {})
  ]);
  const closed = new Set(statuses.filter((s) => s.category === import_task.default.statusCategory.Won || s.category === import_task.default.statusCategory.Lost).map((s) => s._id));
  const out = [];
  for (const i of mineOpen) {
    if (closed.has(i.status)) continue;
    const open = i.blockedBy.map((b) => blockers.find((x) => x._id === (b._id ?? b))).filter((b) => b != null && !closed.has(b.status));
    if (open.length > 0) out.push(`- **${String(i.identifier)}** ${String(i.title)} \u2014 waits for ${open.map((b) => `${String(b.identifier)}`).join(", ")}`);
  }
  return out;
}
const plain = (markup) => (0, import_format.markupToText)(markup).replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const triageInbox = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const uuid = await (0, import_people.currentAccountUuid)(client);
  const limit = args.limit ?? 10;
  const unread = await client.findAll(import_classes.C.InboxNotification, { user: uuid, isViewed: false, archived: false }, { sort: { createdOn: import_core.SortingOrder.Descending }, limit: 500 });
  if (unread.length === 0) return "Inbox zero \u2014 nothing unread.";
  const groups = /* @__PURE__ */ new Map();
  for (const n of unread) groups.set(n.docNotifyContext, [...groups.get(n.docNotifyContext) ?? [], n]);
  const ctxIds = [...groups.keys()].slice(0, limit);
  const ctxs = await client.findAll(import_classes.C.DocNotifyContext, { _id: { $in: ctxIds } });
  const statuses = new Map((await client.findAll("core:class:Status", {})).map((s) => [s._id, s.name]));
  const names = await (0, import_people.peopleNames)(client);
  const seen = /* @__PURE__ */ new Map();
  const out = [`# Inbox triage \u2014 ${unread.length}${unread.length === 500 ? "+" : ""} unread on ${groups.size} item(s)${groups.size > limit ? `, newest ${limit} shown` : ""}`];
  for (const ctxId of ctxIds) {
    const notes = groups.get(ctxId);
    const ctx = ctxs.find((c) => c._id === ctxId);
    const objectId = ctx?.objectId ?? notes[0].objectId;
    const objectClass = ctx?.objectClass ?? notes[0].objectClass;
    const since = ctx?.lastViewedTimestamp ?? Math.min(...notes.map((n) => n.createdOn ?? Date.now())) - 1;
    const [doc, found] = await Promise.all([
      objectClass != null ? client.findOne(objectClass, { _id: objectId }) : void 0,
      client.findAll(import_classes.C.ActivityMessage, { attachedTo: objectId, createdOn: { $gt: since } }, { sort: { createdOn: import_core.SortingOrder.Descending }, limit: 50 })
    ]);
    const msgs = found.filter((m) => (m.createdOn ?? 0) > since).sort((a, b) => (b.createdOn ?? 0) - (a.createdOn ?? 0));
    const label = doc != null ? (0, import_resolve.labelOf)(doc) : objectClass != null ? await (0, import_resolve.loadLabel)(client, objectClass, objectId) : "(unknown)";
    const state = doc?.status != null ? ` \u2014 ${String(statuses.get(doc.status) ?? "?")}${doc.assignee != null ? ` \xB7 ${names.get(doc.assignee) ?? "?"}` : ""}` : "";
    out.push("", `## ${label}${state} (${notes.length} unread)`);
    const who = await (0, import_people.socialIdNames)(client, [...new Set(msgs.map((m) => m.createdBy).filter((x) => x != null))]);
    const h = client.getHierarchy();
    const comments = msgs.filter((m) => typeof m.message === "string" && (m._class === "chunter:class:ChatMessage" || h.isDerived(m._class, "chunter:class:ChatMessage")));
    const fields = [...new Set(msgs.filter((m) => m._class === import_classes.C.DocUpdateMessage).map((m) => m.action === "create" ? "created" : m.attributeUpdates?.attrKey === "attachedTo" ? "parent" : m.attributeUpdates?.attrKey).filter((k) => k != null && !["rank", "subIssues", "comments", "modifiedOn"].includes(k)))];
    if (fields.length > 0) out.push(`- changed: ${fields.join(", ")}`);
    for (const m of comments.slice(0, 3).reverse()) {
      const text = plain(m.message);
      const author = who.get(m.createdBy) ?? "?";
      const key = `${author}\0${text.slice(0, 160)}`;
      const first = seen.get(key);
      if (first != null) {
        first.count++;
        out.push(`- \u{1F4AC} **${author}**: _same comment as on ${first.where}_`);
        continue;
      }
      seen.set(key, { line: out.length, where: label.split(/[:\s]/)[0], count: 1 });
      out.push(`- \u{1F4AC} **${author}**: ${(0, import_format.clip)(text, 200, "list_comments")}`);
    }
    if (comments.length > 3) out.push(`- _${comments.length - 3} older new comment(s)_`);
    if (fields.length === 0 && comments.length === 0) out.push("- (no details recorded)");
  }
  for (const f of seen.values()) if (f.count > 1) out[f.line] += ` _(same on ${f.count} items)_`;
  out.push("", "_Done with an item? mark_notifications_read with its id (e.g. PROJ-12)._");
  return out.join("\n");
});
const FIX = /\b(bug|fix|fixes|fixed|hotfix|regression|crash|security|fehler|bugfix|absturz|stürzt|behoben|reparier\w*|sicherheit)\b/i;
const releaseNotes = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
  const milestones = await client.findAll(import_tracker.default.class.Milestone, { space: project._id });
  const ms = milestones.find((m) => String(m.label).toLowerCase() === args.milestoneLabel.trim().toLowerCase());
  if (ms == null) throw new Error(`Milestone '${args.milestoneLabel}' not found. Milestones: ${milestones.map((m) => m.label).join(", ") || "none"}.`);
  const all = await client.findAll(import_tracker.default.class.Issue, { space: project._id, milestone: ms._id });
  const issues = all.filter((i) => i._class !== import_classes.C.PullRequest);
  const ids = issues.map((i) => i._id);
  const [statuses, labels, prs] = await Promise.all([
    client.findAll("core:class:Status", {}),
    ids.length > 0 ? client.findAll("tags:class:TagReference", { attachedTo: { $in: ids } }) : [],
    ids.length > 0 ? client.findAll(import_classes.C.PullRequest, { attachedTo: { $in: ids } }) : []
  ]);
  const cat = new Map(statuses.map((s) => [s._id, s.category]));
  const done = issues.filter((i) => cat.get(i.status) === import_task.default.statusCategory.Won && (i.subIssues ?? 0) === 0);
  const open = issues.filter((i) => cat.get(i.status) !== import_task.default.statusCategory.Won && cat.get(i.status) !== import_task.default.statusCategory.Lost);
  const isFix = (i) => FIX.test(String(i.title)) || labels.some((l) => l.attachedTo === i._id && FIX.test(String(l.title)));
  const pr = (i) => {
    const nums = prs.filter((p) => p.attachedTo === i._id && p.state === 2).map((p) => `#${String(p["github:mixin:GithubIssue"]?.githubNumber ?? p.identifier)}`);
    return nums.length > 0 ? ` (${nums.join(", ")})` : "";
  };
  const line = (i) => `- ${String(i.title)} \u2014 ${String(i.identifier)}${pr(i)}`;
  const out = [`# ${String(ms.label)}${ms.targetDate != null ? ` \u2014 ${day(ms.targetDate)}` : ""}`];
  const features = done.filter((i) => !isFix(i));
  const fixes = done.filter(isFix);
  if (features.length > 0) out.push("", "## New and changed", ...features.map(line));
  if (fixes.length > 0) out.push("", "## Fixes", ...fixes.map(line));
  if (done.length === 0) out.push("", "Nothing done in this milestone yet.");
  if (open.length > 0) out.push("", `## Still open (${open.length}) \u2014 not part of the notes`, ...open.slice(0, 15).map((i) => `- ${String(i.identifier)} ${String(i.title)}`));
  return out.join("\n");
});
