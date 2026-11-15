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
var log_time_exports = {};
__export(log_time_exports, {
  listTimeReports: () => listTimeReports,
  logTime: () => logTime,
  timesheet: () => timesheet,
  weekStart: () => weekStart
});
module.exports = __toCommonJS(log_time_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_people = require("../utils/people.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
const logTime = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const me = await (0, import_people.currentPerson)(client);
  const now = (/* @__PURE__ */ new Date()).getTime();
  const valueInHours = args.hours;
  await client.addCollection(
    import_tracker.default.class.TimeSpendReport,
    issue.space,
    issue._id,
    import_tracker.default.class.Issue,
    "reports",
    {
      employee: me._id,
      date: now,
      value: valueInHours,
      description: args.description ?? ""
    },
    (0, import_core.generateId)()
  );
  return `\u2705 Logged **${args.hours}h** on **${args.identifier}**${args.description ? ` \u2014 "${args.description}"` : ""}`;
});
const listTimeReports = (0, import_errors.wrapToolHandler)(async (args) => {
  if (args.identifier == null === (args.projectIdentifier == null)) {
    throw new Error("Pass exactly one of identifier (issue) or projectIdentifier.");
  }
  const client = await (0, import_connection.getConnection)(args.workspace);
  const query = {};
  let scope;
  if (args.identifier != null) {
    const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
    if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
    query.attachedTo = issue._id;
    scope = args.identifier;
  } else {
    const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
    if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
    query.space = project._id;
    scope = args.projectIdentifier;
  }
  const nameOf = await (0, import_people.peopleNames)(client);
  if (args.member != null) query.employee = (await (0, import_people.findPerson)(client, args.member))._id;
  const parse = (v, end) => {
    if (v == null) return void 0;
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new Error(`Invalid date: '${v}'`);
    return end && /^\d{4}-\d{2}-\d{2}$/.test(v) ? d.getTime() + 864e5 - 1 : d.getTime();
  };
  const from = parse(args.from, false);
  const to = parse(args.to, true);
  const all = await client.findAll(import_tracker.default.class.TimeSpendReport, query);
  const reports = all.filter((r) => (from == null || (r.date ?? 0) >= from) && (to == null || (r.date ?? 0) <= to)).sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
  if (reports.length === 0) return `No time reports found for ${scope}.`;
  const issueIds = [...new Set(reports.map((r) => r.attachedTo))];
  const issues = await client.findAll(import_tracker.default.class.Issue, { _id: { $in: issueIds } });
  const issueId = new Map(issues.map((i) => [i._id, i.identifier]));
  const totalHours = reports.reduce((sum, r) => sum + (r.value ?? 0), 0);
  const byMember = /* @__PURE__ */ new Map();
  for (const r of reports) {
    const who = r.employee != null ? nameOf.get(r.employee) ?? String(r.employee) : "Unknown";
    byMember.set(who, (byMember.get(who) ?? 0) + (r.value ?? 0));
  }
  const shown = reports.slice(0, args.limit);
  const lines = shown.map((r) => {
    const who = r.employee != null ? nameOf.get(r.employee) ?? String(r.employee) : "Unknown";
    const note = r.description !== "" ? ` \u2014 ${r.description}` : "";
    return `- ${(0, import_format.formatDate)(r.date)} **${r.value}h** ${issueId.get(r.attachedTo) ?? ""} (${who})${note}`;
  });
  const perMember = [...byMember.entries()].map(([who, h]) => `${who}: ${Math.round(h * 100) / 100}h`).join(", ");
  return [
    `## Time reports for ${scope}`,
    `**Total:** ${Math.round(totalHours * 100) / 100}h in ${reports.length} report(s) \u2014 ${perMember}`,
    "",
    ...lines,
    reports.length > shown.length ? `
_${reports.length - shown.length} more not shown (raise limit)._` : ""
  ].filter((l, i, a) => !(l === "" && i === a.length - 1)).join("\n");
});
const DAY_MS = 864e5;
const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function weekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const back = (d.getDay() + 6) % 7;
  return d.getTime() - back * DAY_MS;
}
const timesheet = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const ref = args.week != null ? new Date(args.week) : /* @__PURE__ */ new Date();
  if (isNaN(ref.getTime())) throw new Error(`Invalid date: '${args.week}'`);
  const start = weekStart(ref);
  const days = Array.from({ length: 7 }, (_, i) => start + i * DAY_MS);
  const end = start + 7 * DAY_MS - 1;
  const nameOf = await (0, import_people.peopleNames)(client);
  const query = {};
  let who = "everyone";
  if (args.everyone !== true) {
    const person = args.member != null ? await (0, import_people.findPerson)(client, args.member) : await (0, import_people.currentPerson)(client);
    query.employee = person._id;
    who = person.name;
  }
  const reports = (await client.findAll(import_tracker.default.class.TimeSpendReport, query)).filter((r) => (r.date ?? 0) >= start && (r.date ?? 0) <= end);
  const issues = reports.length > 0 ? await client.findAll(import_tracker.default.class.Issue, { _id: { $in: [...new Set(reports.map((r) => r.attachedTo))] } }) : [];
  const projects = await client.findAll(import_tracker.default.class.Project, {});
  const projectOf = new Map(issues.map((i) => [i._id, projects.find((p) => p._id === i.space)?.identifier ?? "?"]));
  const dayOf = (t) => Math.floor((t - start) / DAY_MS);
  const ymd = (t) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const label = (t) => `${WEEKDAY[(new Date(t).getDay() + 6) % 7]} ${ymd(t).slice(5)}`;
  const rowKey = (r) => args.everyone === true ? nameOf.get(r.employee) ?? "?" : projectOf.get(r.attachedTo) ?? "?";
  const rows = /* @__PURE__ */ new Map();
  for (const r of reports) {
    const d = dayOf(r.date ?? 0);
    if (d < 0 || d > 6) continue;
    const row = rows.get(rowKey(r)) ?? Array(7).fill(0);
    row[d] += r.value ?? 0;
    rows.set(rowKey(r), row);
  }
  const fmt = (h) => h === 0 ? "\xB7" : String(Math.round(h * 100) / 100);
  const totals = Array(7).fill(0).map((_, d) => [...rows.values()].reduce((s, row) => s + row[d], 0));
  const header = `| ${args.everyone === true ? "Person" : "Project"} | ${days.map(label).join(" | ")} | \u03A3 |`;
  const lines = [header, `|---|${days.map(() => "--:").join("|")}|--:|`];
  for (const [key, row] of [...rows.entries()].sort((a, b) => a[0].localeCompare(b[0]))) lines.push(`| ${key} | ${row.map(fmt).join(" | ")} | **${fmt(row.reduce((s, h) => s + h, 0))}** |`);
  lines.push(`| **Total** | ${totals.map((h) => `**${fmt(h)}**`).join(" | ")} | **${fmt(totals.reduce((s, h) => s + h, 0))}** |`);
  const expected = args.hoursPerDay ?? 8;
  const today = Date.now();
  const gaps = args.everyone === true || reports.length === 0 ? [] : days.slice(0, 5).map((t, d) => ({ t, h: totals[d] })).filter((x) => x.t <= today && x.h < expected).map((x) => `${label(x.t)} (${fmt(x.h) === "\xB7" ? "0" : fmt(x.h)}h of ${expected}h)`);
  return [
    `## Timesheet ${ymd(start)} \u2013 ${ymd(start + 6 * DAY_MS)} \u2014 ${who}`,
    "",
    ...lines,
    ...gaps.length > 0 ? ["", `**Gaps:** ${gaps.join(", ")} \u2014 log_time to fill them.`] : [],
    ...reports.length === 0 ? ["", "_No time logged this week._"] : []
  ].join("\n");
});
