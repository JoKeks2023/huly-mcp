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
var testing_exports = {};
__export(testing_exports, {
  CASE_PRIORITIES: () => CASE_PRIORITIES,
  CASE_STATUSES: () => CASE_STATUSES,
  CASE_TYPES: () => CASE_TYPES,
  RESULT_STATUSES: () => RESULT_STATUSES,
  TM: () => TM,
  createTestCase: () => createTestCase,
  createTestPlan: () => createTestPlan,
  createTestProject: () => createTestProject,
  createTestRun: () => createTestRun,
  createTestSuite: () => createTestSuite,
  deleteTestCase: () => deleteTestCase,
  deleteTestPlan: () => deleteTestPlan,
  deleteTestRun: () => deleteTestRun,
  deleteTestSuite: () => deleteTestSuite,
  findDoc: () => findDoc,
  findProject: () => findProject,
  findSuite: () => findSuite,
  getTestCase: () => getTestCase,
  getTestRun: () => getTestRun,
  idx: () => idx,
  listTestCases: () => listTestCases,
  listTestPlans: () => listTestPlans,
  listTestProjects: () => listTestProjects,
  listTestRuns: () => listTestRuns,
  name: () => name,
  setTestResult: () => setTestResult,
  updateTestCase: () => updateTestCase,
  updateTestRun: () => updateTestRun,
  updateTestSuite: () => updateTestSuite
});
module.exports = __toCommonJS(testing_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_content = require("../utils/content.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
const TM = {
  Project: "testManagement:class:TestProject",
  Suite: "testManagement:class:TestSuite",
  Case: "testManagement:class:TestCase",
  Plan: "testManagement:class:TestPlan",
  PlanItem: "testManagement:class:TestPlanItem",
  Run: "testManagement:class:TestRun",
  Result: "testManagement:class:TestResult",
  NoParent: "testManagement:ids:NoParent",
  SpaceType: "testManagement:spaceType:DefaultProject",
  TypeMixin: "testManagement:mixin:DefaultProjectTypeData"
};
const CASE_TYPES = ["Functional", "Performance", "Regression", "Security", "Smoke", "Usability"];
const CASE_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const CASE_STATUSES = ["Draft", "ReadyForReview", "FixReviewComments", "Approved", "Rejected"];
const RESULT_STATUSES = ["Untested", "Blocked", "Passed", "Failed"];
const idx = (list, v) => list.indexOf(v);
const name = (list, i) => (i != null ? list[i] : void 0) ?? "\u2014";
async function findProject(client, ref) {
  const all = await client.findAll(TM.Project, {});
  const hits = all.filter((p) => p._id === ref || String(p.name).toLowerCase() === ref.toLowerCase());
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw new Error(`Test project '${ref}' is ambiguous: ${hits.map((p) => p._id).join(", ")}.`);
  throw new Error(`Test project '${ref}' not found. Available: ${all.map((p) => p.name).join(", ") || "none"}.`);
}
async function findSuite(client, project, ref) {
  const suites = await client.findAll(TM.Suite, { space: project._id });
  const hits = suites.filter((s) => s._id === ref || String(s.name).toLowerCase() === ref.toLowerCase());
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw new Error(`Suite '${ref}' is ambiguous \u2014 use its id: ${hits.map((s) => s._id).join(", ")}.`);
  throw new Error(`Suite '${ref}' not found in ${String(project.name)}.`);
}
async function findDoc(client, _class, id, what) {
  const doc = await client.findOne(_class, { _id: id });
  if (doc == null) throw new Error(`${what} '${id}' not found.`);
  return doc;
}
const listTestProjects = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const projects = await client.findAll(TM.Project, { archived: false });
  if (projects.length === 0) return "No test projects.";
  const lines = [];
  for (const p of projects) {
    const cases = await client.findAll(TM.Case, { space: p._id }, { limit: 1, total: true });
    const runs = await client.findAll(TM.Run, { space: p._id }, { limit: 1, total: true });
    lines.push(`- **${String(p.name)}** \u2014 ${String(cases.total ?? cases.length)} case(s), ${String(runs.total ?? runs.length)} run(s) \u2014 \`${String(p._id)}\``);
  }
  return `## Test projects (${projects.length})

${lines.join("\n")}`;
});
const createTestProject = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const existing = await client.findAll(TM.Project, {});
  const same = existing.find((p) => String(p.name).toLowerCase() === args.name.toLowerCase());
  if (same != null) return `\u2139\uFE0F Test project **${String(same.name)}** already exists \u2014 \`${String(same._id)}\`.`;
  const me = await (0, import_people.currentAccountUuid)(client);
  const id = await client.createDoc(TM.Project, "core:space:Space", {
    name: args.name,
    description: args.description ?? "",
    private: args.isPrivate,
    members: [me],
    owners: [me],
    archived: false,
    type: TM.SpaceType
  });
  await client.createMixin(id, TM.Project, "core:space:Space", TM.TypeMixin, {});
  return `\u2705 Test project **${args.name}** created \u2014 \`${String(id)}\`.`;
});
const listTestCases = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.project);
  const suites = await client.findAll(TM.Suite, { space: project._id }, { sort: { name: import_core.SortingOrder.Ascending } });
  const query = { space: project._id };
  if (args.status != null) query.status = idx(CASE_STATUSES, args.status);
  const cases = await client.findAll(TM.Case, query, { sort: { name: import_core.SortingOrder.Ascending } });
  const people = await (0, import_people.peopleNames)(client);
  const root = args.suite != null ? (await findSuite(client, project, args.suite))._id : TM.NoParent;
  const lines = [];
  const walk = (parent, depth) => {
    for (const s of suites.filter((x) => x.parent === parent)) {
      lines.push(`${"  ".repeat(depth)}- \u{1F4C2} **${String(s.name)}** \u2014 \`${String(s._id)}\``);
      for (const c of cases.filter((x) => x.attachedTo === s._id)) {
        const who = c.assignee != null ? ` \xB7 @${people.get(c.assignee) ?? "?"}` : "";
        lines.push(`${"  ".repeat(depth + 1)}- ${String(c.name)} [${name(CASE_TYPES, c.type)}, ${name(CASE_PRIORITIES, c.priority)}, ${name(CASE_STATUSES, c.status)}]${who} \u2014 \`${String(c._id)}\``);
      }
      if (depth < 20) walk(s._id, depth + 1);
    }
  };
  if (args.suite != null) {
    const s = suites.find((x) => x._id === root);
    lines.push(`- \u{1F4C2} **${String(s.name)}** \u2014 \`${String(s._id)}\``);
    for (const c of cases.filter((x) => x.attachedTo === root)) lines.push(`  - ${String(c.name)} [${name(CASE_TYPES, c.type)}, ${name(CASE_PRIORITIES, c.priority)}, ${name(CASE_STATUSES, c.status)}] \u2014 \`${String(c._id)}\``);
    walk(root, 1);
  } else walk(root, 0);
  if (lines.length === 0) return `No suites in ${String(project.name)} yet \u2014 create one with create_test_suite.`;
  return `## ${String(project.name)}: ${cases.length} case(s)

${lines.join("\n")}`;
});
const createTestSuite = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.project);
  const parent = args.parent != null ? await findSuite(client, project, args.parent) : void 0;
  const id = await client.createDoc(TM.Suite, project._id, { name: args.name, description: args.description ?? "", parent: parent?._id ?? TM.NoParent });
  return `\u2705 Suite **${args.name}** created${parent != null ? ` in "${String(parent.name)}"` : ""} \u2014 \`${String(id)}\`.`;
});
const getTestCase = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const c = await findDoc(client, TM.Case, args.caseId, "Test case");
  const suite = await client.findOne(TM.Suite, { _id: c.attachedTo });
  const people = await (0, import_people.peopleNames)(client);
  const results = await client.findAll(TM.Result, { testCase: c._id }, { sort: { modifiedOn: import_core.SortingOrder.Descending }, limit: 5 });
  const lines = [
    `## ${String(c.name)}`,
    "",
    `**Suite:** ${String(suite?.name ?? "\u2014")} \xB7 **Type:** ${name(CASE_TYPES, c.type)} \xB7 **Priority:** ${name(CASE_PRIORITIES, c.priority)} \xB7 **Status:** ${name(CASE_STATUSES, c.status)}`,
    `**Assignee:** ${c.assignee != null ? people.get(c.assignee) ?? "?" : "\u2014"} \xB7 **Id:** \`${String(c._id)}\``,
    "",
    "### Steps / description",
    await (0, import_content.readMarkup)(args.workspace, c.description) || "_(empty)_"
  ];
  if (results.length > 0) {
    lines.push("", "### Latest results");
    for (const r of results) {
      const run = await client.findOne(TM.Run, { _id: r.attachedTo });
      lines.push(`- ${name(RESULT_STATUSES, r.status)} in run "${String(run?.name ?? "?")}" (${(0, import_format.formatDate)(r.modifiedOn)})`);
    }
  }
  return lines.join("\n");
});
const createTestCase = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.project);
  const suite = await findSuite(client, project, args.suite);
  const assignee = args.assignee != null ? (await (0, import_people.findPerson)(client, args.assignee))._id : null;
  const id = await client.addCollection(TM.Case, project._id, suite._id, TM.Suite, "testCases", {
    name: args.name,
    description: args.description != null && args.description !== "" ? await (0, import_content.writeMarkup)(args.workspace, "testcase", args.description) : null,
    type: idx(CASE_TYPES, args.type ?? "Functional"),
    priority: idx(CASE_PRIORITIES, args.priority ?? "Medium"),
    status: idx(CASE_STATUSES, args.status ?? "Draft"),
    assignee,
    attachments: 0
  });
  return `\u2705 Test case **${args.name}** created in "${String(suite.name)}" \u2014 \`${String(id)}\`.`;
});
const updateTestCase = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const c = await findDoc(client, TM.Case, args.caseId, "Test case");
  const update = {};
  if (args.name != null) update.name = args.name;
  if (args.description != null) update.description = await (0, import_content.writeMarkup)(args.workspace, "testcase", args.description);
  if (args.type != null) update.type = idx(CASE_TYPES, args.type);
  if (args.priority != null) update.priority = idx(CASE_PRIORITIES, args.priority);
  if (args.status != null) update.status = idx(CASE_STATUSES, args.status);
  if (args.assignee !== void 0) update.assignee = args.assignee != null ? (await (0, import_people.findPerson)(client, args.assignee))._id : null;
  if (Object.keys(update).length === 0) throw new Error("Nothing to change.");
  await client.updateCollection(TM.Case, c.space, c._id, c.attachedTo, TM.Suite, "testCases", update);
  return `\u2705 Test case **${String(args.name ?? c.name)}** updated: ${Object.keys(update).join(", ")}.`;
});
const deleteTestCase = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const c = await findDoc(client, TM.Case, args.caseId, "Test case");
  await client.removeCollection(TM.Case, c.space, c._id, c.attachedTo, TM.Suite, "testCases");
  return `\u2705 Test case **${String(c.name)}** deleted.`;
});
async function selectCases(client, project, caseIds, suites) {
  const out = /* @__PURE__ */ new Map();
  for (const id of caseIds ?? []) {
    const c = await findDoc(client, TM.Case, id, "Test case");
    if (c.space !== project._id) throw new Error(`Test case '${id}' belongs to another project.`);
    out.set(c._id, c);
  }
  if ((suites ?? []).length > 0) {
    const all = await client.findAll(TM.Suite, { space: project._id });
    let level = await Promise.all((suites ?? []).map(async (s) => (await findSuite(client, project, s))._id));
    const ids = new Set(level);
    while (level.length > 0) {
      level = all.filter((s) => level.includes(s.parent) && !ids.has(s._id)).map((s) => s._id);
      for (const l of level) ids.add(l);
    }
    const cases = await client.findAll(TM.Case, { space: project._id, attachedTo: { $in: [...ids] } });
    for (const c of cases) out.set(c._id, c);
  }
  return [...out.values()];
}
const listTestPlans = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.project);
  const plans = await client.findAll(TM.Plan, { space: project._id });
  if (plans.length === 0) return `No test plans in ${String(project.name)}.`;
  const lines = [];
  for (const p of plans) {
    const items = await client.findAll(TM.PlanItem, { attachedTo: p._id });
    lines.push(`- **${String(p.name)}** \u2014 ${items.length} case(s) \u2014 \`${String(p._id)}\``);
  }
  return `## Test plans in ${String(project.name)} (${plans.length})

${lines.join("\n")}`;
});
const createTestPlan = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.project);
  const cases = await selectCases(client, project, args.caseIds, args.suites);
  if (cases.length === 0) throw new Error("No test cases selected (caseIds or suites).");
  const ops = client.apply?.() ?? client;
  const id = await ops.createDoc(TM.Plan, project._id, { name: args.name, description: null });
  for (const c of cases) {
    await ops.addCollection(TM.PlanItem, project._id, id, TM.Plan, "items", { testCase: c._id, testSuite: c.attachedTo, assignee: c.assignee ?? null });
  }
  if (ops !== client) await ops.commit();
  return `\u2705 Test plan **${args.name}** with ${cases.length} case(s) \u2014 \`${String(id)}\`.`;
});
const createTestRun = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.project);
  let cases = await selectCases(client, project, args.caseIds, args.suites);
  if (args.plan != null) {
    const plans = await client.findAll(TM.Plan, { space: project._id });
    const plan = plans.find((p) => p._id === args.plan || String(p.name).toLowerCase() === args.plan.toLowerCase());
    if (plan == null) throw new Error(`Test plan '${args.plan}' not found.`);
    const items = await client.findAll(TM.PlanItem, { attachedTo: plan._id });
    const fromPlan = await Promise.all(items.map(async (i) => await client.findOne(TM.Case, { _id: i.testCase })));
    cases = [...new Map([...cases, ...fromPlan.filter((c) => c != null)].map((c) => [c._id, c])).values()];
  }
  if (cases.length === 0) throw new Error("No test cases selected (plan, suites or caseIds).");
  const dueDate = args.dueDate != null ? new Date(args.dueDate).getTime() : void 0;
  if (dueDate != null && Number.isNaN(dueDate)) throw new Error(`Invalid dueDate '${args.dueDate}'.`);
  const ops = client.apply?.() ?? client;
  const id = await ops.createDoc(TM.Run, project._id, { name: args.name, description: null, ...dueDate != null ? { dueDate } : {} });
  for (const c of cases) {
    await ops.addCollection(TM.Result, project._id, id, TM.Run, "results", { name: c.name, testCase: c._id, testSuite: c.attachedTo, description: null, status: idx(RESULT_STATUSES, "Untested"), assignee: c.assignee ?? null });
  }
  if (ops !== client) await ops.commit();
  return `\u2705 Test run **${args.name}** started with ${cases.length} case(s) \u2014 \`${String(id)}\`. Record results with set_test_result.`;
});
const listTestRuns = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.project);
  const runs = await client.findAll(TM.Run, { space: project._id }, { sort: { modifiedOn: import_core.SortingOrder.Descending }, limit: args.limit });
  if (runs.length === 0) return `No test runs in ${String(project.name)}.`;
  const lines = [];
  for (const r of runs) {
    const results = await client.findAll(TM.Result, { attachedTo: r._id });
    const counts = RESULT_STATUSES.map((s, i) => [s, results.filter((x) => (x.status ?? 0) === i).length]).filter(([, n]) => n > 0);
    lines.push(`- **${String(r.name)}** \u2014 ${counts.map(([s, n]) => `${n} ${s}`).join(", ") || "empty"}${r.dueDate != null ? ` \xB7 due ${(0, import_format.formatDate)(r.dueDate)}` : ""} \u2014 \`${String(r._id)}\``);
  }
  return `## Test runs in ${String(project.name)} (${runs.length})

${lines.join("\n")}`;
});
const getTestRun = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const run = await findDoc(client, TM.Run, args.runId, "Test run");
  const results = await client.findAll(TM.Result, { attachedTo: run._id });
  const people = await (0, import_people.peopleNames)(client);
  const lines = results.sort((a, b) => String(a.name).localeCompare(String(b.name))).map((r) => `- ${name(RESULT_STATUSES, r.status ?? 0)} \u2014 **${String(r.name)}**${r.assignee != null ? ` \xB7 @${people.get(r.assignee) ?? "?"}` : ""} \u2014 \`${String(r._id)}\``);
  const done = results.filter((r) => (r.status ?? 0) !== 0).length;
  return `## Run: ${String(run.name)} (${done}/${results.length} tested)

${lines.join("\n")}`;
});
const setTestResult = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  let result = await client.findOne(TM.Result, { _id: args.result });
  if (result == null && args.runId != null) {
    const all = await client.findAll(TM.Result, { attachedTo: args.runId });
    const hits = all.filter((r) => r.testCase === args.result || String(r.name).toLowerCase() === args.result.toLowerCase());
    if (hits.length > 1) throw new Error(`'${args.result}' matches several results in this run \u2014 use the result id.`);
    result = hits[0];
  }
  if (result == null) throw new Error(`Test result '${args.result}' not found (pass a result id, or runId plus case id/name).`);
  const update = { status: idx(RESULT_STATUSES, args.status) };
  if (args.comment != null) update.description = await (0, import_content.writeMarkup)(args.workspace, "testresult", args.comment);
  if (args.assignee !== void 0) update.assignee = args.assignee != null ? (await (0, import_people.findPerson)(client, args.assignee))._id : null;
  await client.updateCollection(TM.Result, result.space, result._id, result.attachedTo, TM.Run, "results", update);
  return `\u2705 **${String(result.name)}**: ${args.status}${args.comment != null ? " (with comment)" : ""}.`;
});
const updateTestSuite = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.project);
  const suite = await findSuite(client, project, args.suite);
  const update = {};
  if (args.name != null) update.name = args.name;
  if (args.description != null) update.description = args.description;
  if (args.parent !== void 0) {
    if (args.parent == null) update.parent = TM.NoParent;
    else {
      const parent = await findSuite(client, project, args.parent);
      const all = await client.findAll(TM.Suite, { space: project._id });
      for (let p = parent; p != null; p = all.find((s) => s._id === p.parent)) {
        if (p._id === suite._id) throw new Error("A suite cannot move into itself or one of its sub-suites.");
      }
      update.parent = parent._id;
    }
  }
  if (Object.keys(update).length === 0) throw new Error("Nothing to change.");
  await client.updateDoc(TM.Suite, suite.space, suite._id, update);
  return `\u2705 Suite **${String(args.name ?? suite.name)}** updated: ${Object.keys(update).join(", ")}.`;
});
const deleteTestSuite = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.project);
  const suite = await findSuite(client, project, args.suite);
  const all = await client.findAll(TM.Suite, { space: project._id });
  const ids = [suite._id];
  for (let i = 0; i < ids.length; i++) ids.push(...all.filter((s) => s.parent === ids[i]).map((s) => s._id));
  const cases = await client.findAll(TM.Case, { space: project._id, attachedTo: { $in: ids } });
  if ((ids.length > 1 || cases.length > 0) && args.recursive !== true) throw new Error(`Suite '${String(suite.name)}' holds ${ids.length - 1} sub-suite(s) and ${cases.length} case(s) \u2014 pass recursive: true to delete them too.`);
  for (const c of cases) await client.removeCollection(TM.Case, c.space, c._id, c.attachedTo, TM.Suite, "testCases");
  for (const id of ids.reverse()) await client.removeDoc(TM.Suite, project._id, id);
  return `\u{1F5D1}\uFE0F Suite **${String(suite.name)}** deleted${ids.length > 1 || cases.length > 0 ? ` with ${ids.length - 1} sub-suite(s) and ${cases.length} case(s)` : ""}.`;
});
const updateTestRun = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const run = await findDoc(client, TM.Run, args.runId, "Test run");
  const update = {};
  if (args.name != null) update.name = args.name;
  if (args.dueDate !== void 0) {
    const t = args.dueDate != null ? new Date(args.dueDate).getTime() : null;
    if (t != null && Number.isNaN(t)) throw new Error(`Invalid dueDate '${String(args.dueDate)}'.`);
    update.dueDate = t;
  }
  if (args.description != null) update.description = await (0, import_content.writeMarkup)(args.workspace, "testrun", args.description);
  if (Object.keys(update).length === 0) throw new Error("Nothing to change.");
  await client.updateDoc(TM.Run, run.space, run._id, update);
  return `\u2705 Run **${String(args.name ?? run.name)}** updated: ${Object.keys(update).join(", ")}.`;
});
const deleteTestRun = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const run = await findDoc(client, TM.Run, args.runId, "Test run");
  const results = await client.findAll(TM.Result, { attachedTo: run._id });
  for (const r of results) await client.removeCollection(TM.Result, r.space, r._id, run._id, TM.Run, "results");
  await client.removeDoc(TM.Run, run.space, run._id);
  return `\u{1F5D1}\uFE0F Run **${String(run.name)}** deleted with ${results.length} result(s).`;
});
const deleteTestPlan = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await findProject(client, args.project);
  const plans = await client.findAll(TM.Plan, { space: project._id });
  const plan = plans.find((p) => p._id === args.plan || String(p.name).toLowerCase() === args.plan.toLowerCase());
  if (plan == null) throw new Error(`Test plan '${args.plan}' not found.`);
  const items = await client.findAll(TM.PlanItem, { attachedTo: plan._id });
  for (const i of items) await client.removeCollection(TM.PlanItem, i.space, i._id, plan._id, TM.Plan, "items");
  await client.removeDoc(TM.Plan, plan.space, plan._id);
  return `\u{1F5D1}\uFE0F Test plan **${String(plan.name)}** deleted (${items.length} item(s); runs made from it stay).`;
});
