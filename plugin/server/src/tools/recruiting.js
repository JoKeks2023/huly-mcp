var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var recruiting_exports = {};
__export(recruiting_exports, {
  R: () => R,
  createApplication: () => createApplication,
  createCandidate: () => createCandidate,
  createVacancy: () => createVacancy,
  deleteApplication: () => deleteApplication,
  listApplications: () => listApplications,
  listCandidates: () => listCandidates,
  listVacancies: () => listVacancies,
  updateApplication: () => updateApplication,
  updateVacancy: () => updateVacancy
});
module.exports = __toCommonJS(recruiting_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
var import_tasks = require("../utils/tasks.js");
const R = {
  Vacancy: "recruit:class:Vacancy",
  Applicant: "recruit:class:Applicant",
  Candidate: "recruit:mixin:Candidate",
  DefaultType: "recruit:template:DefaultVacancy",
  Person: "contact:class:Person",
  Contacts: "contact:space:Contacts"
};
async function findVacancy(client, ref) {
  return await (0, import_tasks.findNamed)(client, R.Vacancy, ref, "Vacancy");
}
async function findApplication(client, identifier) {
  const app = await client.findOne(R.Applicant, { identifier: identifier.trim().toUpperCase() });
  if (app == null) throw new Error(`Application '${identifier}' not found (ids look like APP-12).`);
  return app;
}
const listVacancies = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const vacancies = await client.findAll(R.Vacancy, args.includeArchived === true ? {} : { archived: false });
  if (vacancies.length === 0) return "No vacancies.";
  const apps = await client.findAll(R.Applicant, { space: { $in: vacancies.map((v) => v._id) } });
  const lines = [];
  for (const v of vacancies) {
    const company = v.company != null ? (0, import_tasks.contactName)(await client.findOne("contact:class:Organization", { _id: v.company })) : void 0;
    const mine = apps.filter((a) => a.space === v._id);
    const wf = await (0, import_tasks.workflowOf)(client, v).catch(() => void 0);
    const byStatus = /* @__PURE__ */ new Map();
    for (const a of mine) {
      const n = wf != null ? (0, import_tasks.statusName)(wf, a.status) : "?";
      byStatus.set(n, (byStatus.get(n) ?? 0) + 1);
    }
    const extras = [company, v.location, v.dueTo != null ? `due ${(0, import_format.formatDate)(v.dueTo)}` : void 0, v.archived === true ? "archived" : void 0].filter((x) => x != null && x !== "");
    lines.push(`- **${String(v.name)}**${extras.length > 0 ? ` (${extras.join(", ")})` : ""} \u2014 ${mine.length} application(s)${byStatus.size > 0 ? `: ${[...byStatus].map(([s, n]) => `${n} ${s}`).join(", ")}` : ""} \u2014 \`${String(v._id)}\``);
  }
  return `## Vacancies (${vacancies.length})

${lines.join("\n")}`;
});
const createVacancy = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const existing = await client.findAll(R.Vacancy, {});
  if (existing.some((v) => String(v.name).toLowerCase() === args.name.trim().toLowerCase())) throw new Error(`A vacancy named '${args.name}' already exists.`);
  const type = await client.findOne("task:class:ProjectType", { _id: R.DefaultType });
  if (type == null) throw new Error("Recruiting is not set up in this workspace (no default vacancy type).");
  const company = args.company != null ? (await (0, import_tasks.findContact)(client, args.company, "contact:class:Organization"))._id : void 0;
  const me = await (0, import_people.currentAccountUuid)(client);
  const id = (0, import_core.generateId)();
  const number = await (0, import_tasks.nextNumber)(client, R.Vacancy);
  await client.createDoc(R.Vacancy, "core:space:Space", {
    name: args.name.trim(),
    description: args.description ?? "",
    fullDescription: null,
    private: false,
    archived: false,
    number,
    company,
    location: args.location,
    dueTo: args.dueDate != null ? (0, import_tasks.parseDay)(args.dueDate, "dueDate") : void 0,
    members: [me],
    owners: [me],
    autoJoin: type.autoJoin ?? false,
    type: R.DefaultType,
    attachments: 0,
    comments: 0
  }, id);
  await client.createMixin(id, R.Vacancy, "core:space:Space", type.targetClass, {});
  return `\u2705 Vacancy **${args.name}** created \u2014 \`${id}\``;
});
const updateVacancy = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const v = await findVacancy(client, args.vacancy);
  const update = {};
  if (args.name != null) update.name = args.name.trim();
  if (args.description !== void 0) update.description = args.description ?? "";
  if (args.location !== void 0) update.location = args.location ?? "";
  if (args.dueDate !== void 0) update.dueTo = args.dueDate != null ? (0, import_tasks.parseDay)(args.dueDate, "dueDate") : null;
  if (args.archived != null) update.archived = args.archived;
  if (Object.keys(update).length === 0) throw new Error("Nothing to change.");
  await client.updateDoc(R.Vacancy, v.space, v._id, update);
  return `\u2705 Vacancy **${String(update.name ?? v.name)}** updated: ${Object.keys(update).join(", ")}.`;
});
const listCandidates = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  let people = await client.findAll(R.Candidate, {});
  if (args.query != null) {
    const q = args.query.toLowerCase();
    people = people.filter((p) => (0, import_people.formatPersonName)(p.name).toLowerCase().includes(q) || String(p[R.Candidate]?.title ?? "").toLowerCase().includes(q));
  }
  const limit = args.limit ?? 50;
  if (people.length === 0) return "No candidates.";
  const lines = people.slice(0, limit).map((p) => {
    const c = p[R.Candidate] ?? {};
    const where = [c.onsite === true ? "onsite" : void 0, c.remote === true ? "remote" : void 0, p.city].filter((x) => x != null && x !== "");
    return `- **${(0, import_people.formatPersonName)(p.name)}**${c.title != null && c.title !== "" ? ` \u2014 ${String(c.title)}` : ""}${where.length > 0 ? ` (${where.join(", ")})` : ""} \xB7 ${Number(c.applications ?? 0)} application(s) \u2014 \`${String(p._id)}\``;
  });
  return `## Candidates (${people.length})

${lines.join("\n")}${people.length > limit ? `
\u2026 ${people.length - limit} more` : ""}`;
});
const createCandidate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const name = `${args.lastName.trim()},${args.firstName.trim()}`;
  const dup = await client.findAll(R.Person, { name });
  if (dup.length > 0) throw new Error(`A person named ${args.firstName} ${args.lastName} already exists (\`${String(dup[0]._id)}\`) \u2014 use create_application with that name.`);
  const id = (0, import_core.generateId)();
  await client.createDoc(R.Person, R.Contacts, { name, city: args.city ?? "", channels: 0, avatarType: "color" }, id);
  await client.createMixin(id, R.Person, R.Contacts, R.Candidate, { title: args.title ?? "", onsite: args.onsite ?? false, remote: args.remote ?? false, skills: 0 });
  if (args.email != null) await client.addCollection("contact:class:Channel", R.Contacts, id, R.Person, "channels", { value: args.email.trim(), provider: "contact:channelProvider:Email" });
  return `\u2705 Candidate **${args.firstName} ${args.lastName}** created \u2014 \`${id}\``;
});
const listApplications = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const query = {};
  let vacancies;
  if (args.vacancy != null) {
    const v = await findVacancy(client, args.vacancy);
    vacancies = [v];
    query.space = v._id;
  } else vacancies = await client.findAll(R.Vacancy, {});
  const apps = await client.findAll(R.Applicant, query, { sort: { modifiedOn: import_core.SortingOrder.Descending }, limit: args.limit ?? 50 });
  if (apps.length === 0) return "No applications.";
  const names = await (0, import_people.peopleNames)(client);
  const persons = await client.findAll(R.Person, { _id: { $in: [...new Set(apps.map((a) => a.attachedTo))] } });
  const wfs = /* @__PURE__ */ new Map();
  for (const v of vacancies) wfs.set(v._id, await (0, import_tasks.workflowOf)(client, v).catch(() => void 0));
  const rows = apps.map((a) => {
    const v = vacancies.find((x) => x._id === a.space);
    const wf = wfs.get(a.space);
    return { a, status: wf != null ? (0, import_tasks.statusName)(wf, a.status) : "?", v };
  }).filter((r) => args.status == null || r.status.toLowerCase() === args.status.toLowerCase());
  const lines = rows.map(({ a, status, v }) => `- **${String(a.identifier)}** ${(0, import_tasks.contactName)(persons.find((p) => p._id === a.attachedTo))} \u2192 ${String(v?.name ?? "?")} [${status}]${a.assignee != null ? ` \xB7 ${names.get(a.assignee) ?? "?"}` : ""} \xB7 ${(0, import_format.formatDate)(a.modifiedOn)}`);
  return `## Applications (${rows.length})

${lines.join("\n") || "_(none with that status)_"}`;
});
const createApplication = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const vacancy = await findVacancy(client, args.vacancy);
  const person = await (0, import_tasks.findContact)(client, args.candidate, R.Person);
  const wf = await (0, import_tasks.workflowOf)(client, vacancy);
  const status = (0, import_tasks.pickStatus)(wf, args.status);
  const assignee = args.assignee != null ? (await (0, import_people.findPerson)(client, args.assignee))._id : null;
  const existing = await client.findOne(R.Applicant, { space: vacancy._id, attachedTo: person._id });
  if (existing != null) throw new Error(`${(0, import_tasks.contactName)(person)} already applied to ${String(vacancy.name)} (${String(existing.identifier)}).`);
  if (person[R.Candidate] == null) await client.createMixin(person._id, person._class, person.space, R.Candidate, {});
  const number = await (0, import_tasks.nextNumber)(client, R.Applicant);
  const identifier = `APP-${number}`;
  await client.addCollection(R.Applicant, vacancy._id, person._id, R.Candidate, "applications", {
    status,
    number,
    identifier,
    rank: "",
    kind: wf.kind,
    assignee,
    startDate: null,
    dueDate: null,
    isDone: false
  });
  return `\u2705 **${identifier}**: ${(0, import_tasks.contactName)(person)} \u2192 ${String(vacancy.name)} [${(0, import_tasks.statusName)(wf, status)}]`;
});
const updateApplication = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const app = await findApplication(client, args.identifier);
  const update = {};
  const done = [];
  if (args.status != null) {
    const vacancy = await client.findOne(R.Vacancy, { _id: app.space });
    const wf = await (0, import_tasks.workflowOf)(client, vacancy);
    update.status = (0, import_tasks.pickStatus)(wf, args.status);
    done.push(`status \u2192 ${(0, import_tasks.statusName)(wf, update.status)}`);
  }
  if (args.assignee !== void 0) {
    update.assignee = args.assignee != null ? (await (0, import_people.findPerson)(client, args.assignee))._id : null;
    done.push(args.assignee != null ? `assignee \u2192 ${args.assignee}` : "unassigned");
  }
  if (Object.keys(update).length === 0) throw new Error("Nothing to change.");
  await client.updateDoc(R.Applicant, app.space, app._id, update);
  return `\u2705 **${String(app.identifier)}**: ${done.join(", ")}.`;
});
const deleteApplication = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const app = await findApplication(client, args.identifier);
  await client.removeCollection(R.Applicant, app.space, app._id, app.attachedTo, app.attachedToClass, app.collection ?? "applications");
  return `\u{1F5D1}\uFE0F Application **${String(app.identifier)}** deleted.`;
});
