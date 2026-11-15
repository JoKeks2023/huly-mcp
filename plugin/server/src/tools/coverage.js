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
var coverage_exports = {};
__export(coverage_exports, {
  linkTestCase: () => linkTestCase,
  releaseCheck: () => releaseCheck,
  testCoverage: () => testCoverage
});
module.exports = __toCommonJS(coverage_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_task = __toESM(require("../../vendor/@hcengineering/task/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_labels = require("../utils/labels.js");
var import_classes = require("../utils/classes.js");
var import_testing = require("./testing.js");
const caseIdsOf = (issue) => (issue.relations ?? []).filter((r) => r._class === import_testing.TM.Case).map((r) => String(r._id));
async function coverageData(client, projectIdentifier, milestoneLabel) {
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: projectIdentifier });
  if (project == null) throw new Error(`Project '${projectIdentifier}' not found.`);
  const milestone = milestoneLabel != null ? await (0, import_labels.findByLabel)(client, "milestone", project._id, milestoneLabel, projectIdentifier) : void 0;
  const issues = await client.findAll(import_tracker.default.class.Issue, { space: project._id, ...milestone != null ? { milestone: milestone._id } : {} }, { sort: { rank: import_core.SortingOrder.Ascending } });
  const statuses = await client.findAll(import_tracker.default.class.IssueStatus, {});
  const closed = new Set(statuses.filter((s) => s.category === import_task.default.statusCategory.Won || s.category === import_task.default.statusCategory.Lost).map((s) => String(s._id)));
  const ids = [...new Set(issues.flatMap(caseIdsOf))];
  const cases = new Map((ids.length > 0 ? await client.findAll(import_testing.TM.Case, { _id: { $in: ids } }) : []).map((c) => [String(c._id), c]));
  const results = ids.length > 0 ? await client.findAll(import_testing.TM.Result, { testCase: { $in: ids } }, { sort: { modifiedOn: import_core.SortingOrder.Descending } }) : [];
  const latest = /* @__PURE__ */ new Map();
  for (const r of results) if (!latest.has(String(r.testCase))) latest.set(String(r.testCase), r);
  return { project, milestone, issues, statusName: new Map(statuses.map((s) => [String(s._id), s.name])), closed, cases, latest };
}
const resultName = (r) => r == null ? "never run" : import_testing.RESULT_STATUSES[r.status] ?? String(r.status);
const mark = (r) => r == null ? "\u26AA" : r.status === 2 ? "\u2705" : r.status === 3 ? "\u274C" : r.status === 1 ? "\u26D4" : "\u26AA";
const testCoverage = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const d = await coverageData(client, args.projectIdentifier, args.milestoneLabel);
  const scope = d.issues.filter((i) => args.onlyOpen !== true || !d.closed.has(String(i.status)));
  if (scope.length === 0) return `No issues in ${args.projectIdentifier}${d.milestone != null ? ` / ${String(d.milestone.label)}` : ""}.`;
  const covered = scope.filter((i) => caseIdsOf(i).some((id) => d.cases.has(id)));
  const uncovered = scope.filter((i) => !covered.includes(i));
  const caseStates = covered.flatMap((i) => caseIdsOf(i).filter((id) => d.cases.has(id)).map((id) => d.latest.get(id)));
  const failing = caseStates.filter((r) => r?.status === 3).length;
  const never = caseStates.filter((r) => r == null).length;
  const out = [
    `## Test coverage \u2014 ${args.projectIdentifier}${d.milestone != null ? ` / ${String(d.milestone.label)}` : ""}`,
    `${covered.length}/${scope.length} issues have test cases \xB7 ${failing} failing \xB7 ${never} never run`
  ];
  if (uncovered.length > 0) {
    out.push("", `### Without test cases (${uncovered.length})`);
    for (const i of uncovered.slice(0, 40)) out.push(`- **${String(i.identifier)}** ${String(i.title)} \u2014 ${d.statusName.get(String(i.status)) ?? "?"}`);
    if (uncovered.length > 40) out.push(`- \u2026 ${uncovered.length - 40} more`);
  }
  if (covered.length > 0) {
    out.push("", `### Covered (${covered.length})`);
    for (const i of covered) {
      const parts = caseIdsOf(i).filter((id) => d.cases.has(id)).map((id) => {
        const r = d.latest.get(id);
        return `${mark(r)} ${String(d.cases.get(id).name)} (${resultName(r)}${r != null ? `, ${(0, import_format.formatDate)(r.modifiedOn)}` : ""})`;
      });
      out.push(`- **${String(i.identifier)}** ${String(i.title)} \u2014 ${parts.join(" \xB7 ")}`);
    }
  }
  out.push("", "_Link a case: link_test_case. Run them: create_test_run._");
  return out.join("\n");
});
const linkTestCase = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  let tc = await client.findOne(import_testing.TM.Case, { _id: args.testCase });
  if (tc == null) {
    const named = (await client.findAll(import_testing.TM.Case, {})).filter((c) => String(c.name).toLowerCase() === args.testCase.trim().toLowerCase());
    if (named.length > 1) throw new Error(`Test case name '${args.testCase}' is ambiguous (${named.length} cases) \u2014 pass its id (list_test_cases).`);
    tc = named[0];
  }
  if (tc == null) throw new Error(`Test case '${args.testCase}' not found (id or exact name; list_test_cases).`);
  if (caseIdsOf(issue).includes(String(tc._id))) return `**${args.identifier}** is already linked to "${String(tc.name)}".`;
  await client.updateDoc(import_tracker.default.class.Issue, issue.space, issue._id, { relations: [...issue.relations ?? [], { _id: tc._id, _class: import_testing.TM.Case }] });
  return `\u2705 **${args.identifier}** \u2194 test case "${String(tc.name)}" (in the issue's Related list).`;
});
const releaseCheck = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const d = await coverageData(client, args.projectIdentifier, args.milestoneLabel);
  const ms = d.milestone;
  const open = d.issues.filter((i) => !d.closed.has(String(i.status)));
  const done = d.issues.length - open.length;
  const blockerIds = [...new Set(open.flatMap((i) => (i.blockedBy ?? []).map((b) => String(b._id))))];
  const blockers = new Map((blockerIds.length > 0 ? await client.findAll(import_tracker.default.class.Issue, { _id: { $in: blockerIds } }) : []).map((b) => [String(b._id), b]));
  const blocked = open.map((i) => ({ i, by: (i.blockedBy ?? []).map((b) => blockers.get(String(b._id))).filter((b) => b != null && !d.closed.has(String(b.status))) })).filter((x) => x.by.length > 0);
  const prs = d.issues.length > 0 ? await client.findAll(import_classes.C.PullRequest, { attachedTo: { $in: d.issues.map((i) => i._id) } }) : [];
  const openPrs = prs.filter((p) => p.state === 0 || p.state === "open");
  const doneIssues = d.issues.filter((i) => d.closed.has(String(i.status)));
  const untested = doneIssues.filter((i) => !caseIdsOf(i).some((id) => d.cases.has(id)));
  const caseRows = [...new Set(d.issues.flatMap(caseIdsOf))].filter((id) => d.cases.has(id)).map((id) => ({ c: d.cases.get(id), r: d.latest.get(id) }));
  const failing = caseRows.filter((x) => x.r?.status === 3);
  const blockedTests = caseRows.filter((x) => x.r?.status === 1);
  const neverRun = caseRows.filter((x) => x.r == null);
  const overdue = ms?.targetDate != null && ms.targetDate < Date.now() && ms.status !== 2;
  const reasons = [];
  if (open.length > 0) reasons.push(`${open.length} open issue(s)`);
  if (blocked.length > 0) reasons.push(`${blocked.length} blocked`);
  if (openPrs.length > 0) reasons.push(`${openPrs.length} open PR(s)`);
  if (failing.length > 0) reasons.push(`${failing.length} failing test(s)`);
  if (blockedTests.length > 0) reasons.push(`${blockedTests.length} blocked test(s)`);
  const warnings = [];
  if (untested.length > 0) warnings.push(`${untested.length} done issue(s) without test cases`);
  if (neverRun.length > 0) warnings.push(`${neverRun.length} linked test case(s) never run`);
  if (overdue) warnings.push(`target date ${(0, import_format.formatDate)(ms.targetDate)} has passed`);
  const out = [
    `## Release check \u2014 ${args.projectIdentifier} / ${String(ms?.label ?? args.milestoneLabel)}`,
    reasons.length === 0 ? `**\u2705 Ready**${warnings.length > 0 ? ` \u2014 but ${warnings.join(", ")}` : ""}` : `**\u274C Not ready:** ${reasons.join(", ")}${warnings.length > 0 ? ` \xB7 also ${warnings.join(", ")}` : ""}`,
    `${done}/${d.issues.length} issues done${ms?.targetDate != null ? ` \xB7 target ${(0, import_format.formatDate)(ms.targetDate)}` : ""}`
  ];
  const list = (title, rows) => {
    if (rows.length > 0) out.push("", `### ${title} (${rows.length})`, ...rows.slice(0, 25), ...rows.length > 25 ? [`- \u2026 ${rows.length - 25} more`] : []);
  };
  list("Open issues", open.map((i) => `- **${String(i.identifier)}** ${String(i.title)} \u2014 ${d.statusName.get(String(i.status)) ?? "?"}`));
  list("Blocked", blocked.map((x) => `- **${String(x.i.identifier)}** waits for ${x.by.map((b) => String(b.identifier)).join(", ")}`));
  list("Open PRs", openPrs.map((p) => `- **${String(p.identifier)}** ${String(p.title)}`));
  list("Failing tests", failing.map((x) => `- \u274C ${String(x.c.name)} (${(0, import_format.formatDate)(x.r.modifiedOn)})`));
  list("Blocked tests", blockedTests.map((x) => `- \u26D4 ${String(x.c.name)}`));
  list("Done without test cases", untested.map((i) => `- **${String(i.identifier)}** ${String(i.title)}`));
  out.push("", "_Release notes: release_notes. Coverage details: test_coverage._");
  return out.join("\n");
});
