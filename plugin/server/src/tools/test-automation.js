var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var test_automation_exports = {};
__export(test_automation_exports, {
  createIssueFromTestResult: () => createIssueFromTestResult,
  createTestCases: () => createTestCases,
  getTestReport: () => getTestReport,
  importJUnit: () => importJUnit,
  importTestResults: () => importTestResults
});
module.exports = __toCommonJS(test_automation_exports);
var import_promises = require("node:fs/promises");
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_content = require("../utils/content.js");
var import_people = require("../utils/people.js");
var import_junit = require("../utils/junit.js");
var import_testing = require("./testing.js");
var import_issues = require("./issues.js");
const MAX_DETAILS = 4e3;
const UNTESTED = 0;
const BLOCKED = 1;
const PASSED = 2;
const FAILED = 3;
const resultComment = (c) => {
  if (c.status === "passed") return void 0;
  const parts = [c.status === "skipped" ? `Skipped${c.message != null ? `: ${c.message}` : ""}` : `**${c.message ?? "Failed"}**`];
  if (c.details != null) parts.push("```\n" + (c.details.length > MAX_DETAILS ? c.details.slice(0, MAX_DETAILS) + "\n\u2026 (truncated)" : c.details) + "\n```");
  if (c.time != null) parts.push(`Duration: ${c.time.toFixed(2)} s`);
  return parts.join("\n\n");
};
async function importJUnit(o) {
  const cases = (0, import_junit.parseJUnit)(o.xml);
  if (cases.length === 0) throw new Error("The report contains no test cases.");
  const client = await (0, import_connection.getConnection)(o.workspace);
  const project = await (0, import_testing.findProject)(client, o.project);
  const parent = o.parentSuite != null ? await (0, import_testing.findSuite)(client, project, o.parentSuite) : void 0;
  const parentId = parent?._id ?? import_testing.TM.NoParent;
  const create = o.createMissing !== false;
  const suites = await client.findAll(import_testing.TM.Suite, { space: project._id, parent: parentId });
  const existing = await client.findAll(import_testing.TM.Case, { space: project._id });
  const suiteIds = /* @__PURE__ */ new Map();
  for (const sName of new Set(cases.map((c) => c.suite))) suiteIds.set(sName, suites.find((s) => String(s.name).toLowerCase() === sName.toLowerCase())?._id);
  const plan = cases.map((c) => {
    const sid = suiteIds.get(c.suite);
    const hit = sid != null ? existing.find((x) => x.attachedTo === sid && String(x.name).toLowerCase() === c.name.toLowerCase()) : void 0;
    return { c, caseId: hit?._id, isNew: hit == null };
  });
  const missing = plan.filter((p) => p.isNew);
  const newSuites = [...suiteIds].filter(([, id]) => id == null).map(([s]) => s);
  const count = (s) => cases.filter((c) => c.status === s).length;
  const summary = { text: "", passed: count("passed"), failed: count("failed"), skipped: count("skipped"), created: create ? missing.length : 0, unmatched: create ? 0 : missing.length };
  const runName = o.runName ?? `CI ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " ")}`;
  const head = `${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`;
  if (o.dryRun === true) {
    summary.text = [
      `Dry run: would create run **${runName}** in ${String(project.name)} \u2014 ${head}.`,
      create ? `Would create ${newSuites.length} suite(s) and ${missing.length} case(s).` : `${missing.length} case(s) have no match and would be left out (createMissing: false).`,
      "Nothing was changed."
    ].join("\n");
    return summary;
  }
  if (!create && missing.length === cases.length) throw new Error(`None of the ${cases.length} test(s) match a case in ${String(project.name)} \u2014 import with createMissing: true.`);
  for (const s of newSuites) {
    if (!create) continue;
    suiteIds.set(s, await client.createDoc(import_testing.TM.Suite, project._id, { name: s, description: "", parent: parentId }));
  }
  if (create) {
    for (const p of missing) {
      const sid = suiteIds.get(p.c.suite);
      p.caseId = await client.addCollection(import_testing.TM.Case, project._id, sid, import_testing.TM.Suite, "testCases", {
        name: p.c.name,
        description: null,
        type: (0, import_testing.idx)(import_testing.CASE_TYPES, "Regression"),
        priority: (0, import_testing.idx)(import_testing.CASE_PRIORITIES, "Medium"),
        status: 3,
        assignee: null,
        attachments: 0
      });
    }
  }
  const runId = await client.createDoc(import_testing.TM.Run, project._id, { name: runName, description: null });
  for (const p of plan) {
    if (p.caseId == null) continue;
    const comment = resultComment(p.c);
    await client.addCollection(import_testing.TM.Result, project._id, runId, import_testing.TM.Run, "results", {
      name: p.c.name,
      testCase: p.caseId,
      testSuite: suiteIds.get(p.c.suite),
      description: comment != null ? await (0, import_content.writeMarkup)(o.workspace, `testresult-${(0, import_core.generateId)()}`, comment) : null,
      status: p.c.status === "passed" ? PASSED : p.c.status === "failed" ? FAILED : UNTESTED,
      assignee: null
    });
  }
  summary.runId = runId;
  const failed = cases.filter((c) => c.status === "failed").slice(0, 15).map((c) => `- \u274C ${c.suite} \u203A ${c.name}${c.message != null ? ` \u2014 ${c.message.slice(0, 160)}` : ""}`);
  summary.text = [
    `\u2705 Run **${runName}** imported into ${String(project.name)} \u2014 ${head} \u2014 \`${runId}\``,
    create && missing.length > 0 ? `Created ${newSuites.length} suite(s) and ${missing.length} new case(s).` : "",
    !create && missing.length > 0 ? `\u26A0\uFE0F ${missing.length} test(s) without a matching case were left out.` : "",
    failed.length > 0 ? `
### Failed
${failed.join("\n")}${summary.failed > 15 ? `
\u2026 ${summary.failed - 15} more` : ""}` : ""
  ].filter((x) => x !== "").join("\n");
  return summary;
}
const importTestResults = (0, import_errors.wrapToolHandler)(async (args) => {
  if (args.xml == null === (args.file == null)) throw new Error("Pass either xml (the report) or file (a path on the machine running this server).");
  const xml = args.xml ?? await (0, import_promises.readFile)(args.file, "utf8");
  return (await importJUnit({ workspace: args.workspace, project: args.project, xml, runName: args.runName, parentSuite: args.parentSuite, createMissing: args.createMissing, dryRun: args.dryRun })).text;
});
const SYMBOL = ["\xB7", "\u26D4", "\u2705", "\u274C"];
const getTestReport = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await (0, import_testing.findProject)(client, args.project);
  const runs = (await client.findAll(import_testing.TM.Run, { space: project._id }, { sort: { createdOn: import_core.SortingOrder.Descending }, limit: args.runs ?? 10 })).sort((a, b) => Number(a.createdOn ?? 0) - Number(b.createdOn ?? 0));
  const cases = await client.findAll(import_testing.TM.Case, { space: project._id });
  const suites = await client.findAll(import_testing.TM.Suite, { space: project._id });
  if (cases.length === 0) return `No test cases in ${String(project.name)}.`;
  const results = runs.length > 0 ? await client.findAll(import_testing.TM.Result, { attachedTo: { $in: runs.map((r) => r._id) } }) : [];
  const history = /* @__PURE__ */ new Map();
  for (const r of runs) {
    for (const res of results.filter((x) => x.attachedTo === r._id)) {
      const h = history.get(res.testCase) ?? [];
      h.push(res.status ?? UNTESTED);
      history.set(res.testCase, h);
    }
  }
  const suiteName = (id) => String(suites.find((s) => s._id === id)?.name ?? "?");
  const label = (c) => `${suiteName(c.attachedTo)} \u203A ${String(c.name)}`;
  const tested = (h) => (h ?? []).filter((s) => s === PASSED || s === FAILED);
  const switches = (h) => h.slice(1).filter((s, i) => s !== h[i]).length;
  const latest = (c) => tested(history.get(c._id)).at(-1);
  const failing = cases.filter((c) => latest(c) === FAILED);
  const flaky = cases.filter((c) => switches(tested(history.get(c._id))) >= 2);
  const never = cases.filter((c) => tested(history.get(c._id)).length === 0);
  const blocked = cases.filter((c) => (history.get(c._id) ?? []).at(-1) === BLOCKED);
  const withLatest = cases.filter((c) => latest(c) != null);
  const rate = withLatest.length > 0 ? Math.round(100 * withLatest.filter((c) => latest(c) === PASSED).length / withLatest.length) : void 0;
  const line = (c) => `- ${label(c)} ${(history.get(c._id) ?? []).map((s) => SYMBOL[s] ?? "?").join("")} \u2014 \`${String(c._id)}\``;
  const max = args.limit ?? 25;
  const section = (title, list) => list.length === 0 ? [] : ["", `### ${title} (${list.length})`, ...list.slice(0, max).map(line), ...list.length > max ? [`\u2026 ${list.length - max} more`] : []];
  const bySuite = suites.map((s) => {
    const mine = cases.filter((c) => c.attachedTo === s._id);
    if (mine.length === 0) return void 0;
    const p = mine.filter((c) => latest(c) === PASSED).length;
    const f = mine.filter((c) => latest(c) === FAILED).length;
    return `| ${String(s.name)} | ${mine.length} | ${p} | ${f} | ${mine.length - p - f} |`;
  }).filter((x) => x != null);
  return [
    `## Test report: ${String(project.name)}`,
    `${cases.length} case(s) \xB7 last ${runs.length} run(s)${runs.length > 0 ? ` (${String(runs[0].name)} \u2192 ${String(runs.at(-1).name)})` : ""} \xB7 pass rate of latest results: ${rate != null ? `${rate}%` : "\u2014"}`,
    "History oldest \u2192 newest: \u2705 passed \u274C failed \u26D4 blocked \xB7 untested",
    ...section("Failing now", failing),
    ...section("Flaky (flipped between pass and fail at least twice)", flaky),
    ...section("Blocked in the latest run", blocked),
    ...section("Never run in these runs", never),
    ...bySuite.length > 0 ? ["", "### By suite (latest result)", "| Suite | Cases | Passed | Failed | Not run |", "|---|---|---|---|---|", ...bySuite] : []
  ].join("\n");
});
const createIssueFromTestResult = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const result = await (0, import_testing.findDoc)(client, import_testing.TM.Result, args.result, "Test result");
  const testCase = await client.findOne(import_testing.TM.Case, { _id: result.testCase });
  const run = await client.findOne(import_testing.TM.Run, { _id: result.attachedTo });
  const steps = testCase != null ? await (0, import_content.readMarkup)(args.workspace, testCase.description) : "";
  const outcome = await (0, import_content.readMarkup)(args.workspace, result.description);
  const description = [
    `Test **${String(result.name)}** ${(0, import_testing.name)(import_testing.RESULT_STATUSES, result.status ?? UNTESTED).toLowerCase()} in run "${String(run?.name ?? "?")}".`,
    steps.trim() !== "" ? `## Steps

${steps}` : "",
    outcome.trim() !== "" ? `## Result

${outcome}` : "",
    args.notes != null ? `## Notes

${args.notes}` : ""
  ].filter((x) => x !== "").join("\n\n");
  const created = (await (0, import_issues.createIssue)({ workspace: args.workspace, projectIdentifier: args.projectIdentifier, title: args.title ?? `Test failed: ${String(result.name)}`, description, priority: args.priority ?? "High" })).content[0].text;
  const identifier = /\*\*([A-Z0-9]+-\d+)\*\*/.exec(created)?.[1];
  if (identifier == null) throw new Error(`Issue created, but its identifier could not be read: ${created}`);
  const extra = [];
  if (args.componentLabel != null || args.milestoneLabel != null || args.assignee != null) {
    await (0, import_issues.updateIssue)({ workspace: args.workspace, identifier, componentLabel: args.componentLabel, milestoneLabel: args.milestoneLabel, assignee: args.assignee });
    extra.push(...[args.componentLabel != null ? `component ${args.componentLabel}` : "", args.milestoneLabel != null ? `milestone ${args.milestoneLabel}` : "", args.assignee != null ? `assignee ${args.assignee}` : ""].filter((x) => x !== ""));
  }
  const issue = await client.findOne("tracker:class:Issue", { identifier });
  if (issue != null && testCase != null) {
    await client.updateDoc("tracker:class:Issue", issue.space, issue._id, { relations: [...issue.relations ?? [], { _id: testCase._id, _class: import_testing.TM.Case }] });
  }
  await client.addCollection("chunter:class:ChatMessage", result.space, result._id, import_testing.TM.Result, "comments", { message: `Bug filed: ${identifier}` });
  return `\u2705 **${identifier}** filed from test result "${String(result.name)}"${extra.length > 0 ? ` (${extra.join(", ")})` : ""}; related to the test case, and the result has a comment pointing to it.`;
});
const createTestCases = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await (0, import_testing.findProject)(client, args.project);
  let suite;
  try {
    suite = await (0, import_testing.findSuite)(client, project, args.suite);
  } catch (e) {
    if (args.createSuite !== true) throw e;
    const parent = args.parentSuite != null ? await (0, import_testing.findSuite)(client, project, args.parentSuite) : void 0;
    suite = { _id: await client.createDoc(import_testing.TM.Suite, project._id, { name: args.suite, description: "", parent: parent?._id ?? import_testing.TM.NoParent }), name: args.suite };
  }
  const existing = await client.findAll(import_testing.TM.Case, { space: project._id, attachedTo: suite._id });
  const seen = new Set(existing.map((c) => String(c.name).toLowerCase()));
  const made = [];
  const skipped = [];
  for (const c of args.cases) {
    if (seen.has(c.name.toLowerCase())) {
      skipped.push(c.name);
      continue;
    }
    seen.add(c.name.toLowerCase());
    const assignee = c.assignee != null ? (await (0, import_people.findPerson)(client, c.assignee))._id : null;
    await client.addCollection(import_testing.TM.Case, project._id, suite._id, import_testing.TM.Suite, "testCases", {
      name: c.name,
      description: c.description != null && c.description !== "" ? await (0, import_content.writeMarkup)(args.workspace, `testcase-${(0, import_core.generateId)()}`, c.description) : null,
      type: (0, import_testing.idx)(import_testing.CASE_TYPES, c.type ?? "Functional"),
      priority: (0, import_testing.idx)(import_testing.CASE_PRIORITIES, c.priority ?? "Medium"),
      status: 0,
      assignee,
      attachments: 0
    });
    made.push(c.name);
  }
  return `\u2705 ${made.length} case(s) created in "${String(suite.name)}"${skipped.length > 0 ? `; skipped ${skipped.length} that already exist: ${skipped.slice(0, 10).join(", ")}` : ""}.`;
});
