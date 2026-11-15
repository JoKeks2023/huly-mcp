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
var crm_exports = {};
__export(crm_exports, {
  L: () => L,
  createLead: () => createLead,
  deleteLead: () => deleteLead,
  listCustomers: () => listCustomers,
  listLeads: () => listLeads,
  updateLead: () => updateLead
});
module.exports = __toCommonJS(crm_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
var import_tasks = require("../utils/tasks.js");
const L = {
  Funnel: "lead:class:Funnel",
  Lead: "lead:class:Lead",
  Customer: "lead:mixin:Customer",
  DefaultFunnel: "lead:space:DefaultFunnel",
  Contacts: "contact:space:Contacts"
};
async function findFunnel(client, ref) {
  if (ref != null) return await (0, import_tasks.findNamed)(client, L.Funnel, ref, "Funnel");
  const funnels = await client.findAll(L.Funnel, { archived: false });
  if (funnels.length === 0) throw new Error("No funnel in this workspace \u2014 is the CRM module enabled?");
  return funnels.find((f) => f._id === L.DefaultFunnel) ?? funnels[0];
}
async function findLead(client, identifier) {
  const lead = await client.findOne(L.Lead, { identifier: identifier.trim().toUpperCase() });
  if (lead == null) throw new Error(`Lead '${identifier}' not found (ids look like LEAD-12).`);
  return lead;
}
const listLeads = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const funnels = args.funnel != null ? [await findFunnel(client, args.funnel)] : await client.findAll(L.Funnel, {});
  const leads = await client.findAll(L.Lead, { space: { $in: funnels.map((f) => f._id) } }, { sort: { modifiedOn: import_core.SortingOrder.Descending }, limit: args.limit ?? 50 });
  const head = `## Leads (${leads.length}) \u2014 funnel(s): ${funnels.map((f) => f.name).join(", ") || "none"}`;
  if (leads.length === 0) return `${head}

No leads.`;
  const names = await (0, import_people.peopleNames)(client);
  const customers = await client.findAll("contact:class:Contact", { _id: { $in: [...new Set(leads.map((l) => l.attachedTo))] } });
  const wfs = /* @__PURE__ */ new Map();
  for (const f of funnels) wfs.set(f._id, await (0, import_tasks.workflowOf)(client, f).catch(() => void 0));
  const rows = leads.map((l) => ({ l, status: wfs.get(l.space) != null ? (0, import_tasks.statusName)(wfs.get(l.space), l.status) : "?" })).filter((r) => args.status == null || r.status.toLowerCase() === args.status.toLowerCase());
  const lines = rows.map(({ l, status }) => `- **${String(l.identifier)}** ${String(l.title)} \u2014 ${(0, import_tasks.contactName)(customers.find((c) => c._id === l.attachedTo))} [${status}]${l.assignee != null ? ` \xB7 ${names.get(l.assignee) ?? "?"}` : ""} \xB7 ${(0, import_format.formatDate)(l.modifiedOn)}`);
  return `${head}

${lines.join("\n") || "_(none with that status)_"}`;
});
const listCustomers = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const customers = await client.findAll(L.Customer, {});
  if (customers.length === 0) return "No customers.";
  const lines = customers.map((c) => `- **${(0, import_tasks.contactName)(c)}** (${c._class === "contact:class:Organization" ? "organization" : "person"}) \xB7 ${Number(c[L.Customer]?.leads ?? 0)} lead(s) \u2014 \`${String(c._id)}\``);
  return `## Customers (${customers.length})

${lines.join("\n")}`;
});
const createLead = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const funnel = await findFunnel(client, args.funnel);
  const wf = await (0, import_tasks.workflowOf)(client, funnel);
  const status = (0, import_tasks.pickStatus)(wf, args.status);
  const assignee = args.assignee != null ? (await (0, import_people.findPerson)(client, args.assignee))._id : null;
  let customer;
  let created = "";
  if (args.newCustomer != null) {
    const cls = args.newCustomer === "organization" ? "contact:class:Organization" : "contact:class:Person";
    const name = args.newCustomer === "organization" ? args.customer.trim() : (() => {
      const [first, ...rest] = args.customer.trim().split(/\s+/);
      return `${rest.join(" ")},${first}`;
    })();
    const dup = await client.findAll(cls, { name });
    if (dup.length > 0) throw new Error(`'${args.customer}' already exists \u2014 leave out newCustomer to use it.`);
    const id = (0, import_core.generateId)();
    await client.createDoc(cls, L.Contacts, { name, city: "", avatarType: "color", ...cls === "contact:class:Organization" ? { description: null } : {} }, id);
    customer = { _id: id, _class: cls, space: L.Contacts, name };
    created = ` (new ${args.newCustomer})`;
  } else customer = await (0, import_tasks.findContact)(client, args.customer);
  if (customer[L.Customer] == null) await client.createMixin(customer._id, customer._class, customer.space, L.Customer, { customerDescription: null });
  const number = await (0, import_tasks.nextNumber)(client, L.Lead);
  const identifier = `LEAD-${number}`;
  await client.addCollection(L.Lead, funnel._id, customer._id, L.Customer, "leads", {
    status,
    number,
    identifier,
    title: args.title.trim(),
    kind: wf.kind,
    rank: "",
    assignee,
    startDate: null,
    dueDate: null
  });
  return `\u2705 **${identifier}** ${args.title} \u2014 ${(0, import_tasks.contactName)(customer)}${created} [${(0, import_tasks.statusName)(wf, status)}] in ${String(funnel.name)}`;
});
const updateLead = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const lead = await findLead(client, args.identifier);
  const update = {};
  const done = [];
  if (args.title != null) {
    update.title = args.title.trim();
    done.push("title");
  }
  if (args.status != null) {
    const wf = await (0, import_tasks.workflowOf)(client, await client.findOne(L.Funnel, { _id: lead.space }));
    update.status = (0, import_tasks.pickStatus)(wf, args.status);
    done.push(`status \u2192 ${(0, import_tasks.statusName)(wf, update.status)}`);
  }
  if (args.assignee !== void 0) {
    update.assignee = args.assignee != null ? (await (0, import_people.findPerson)(client, args.assignee))._id : null;
    done.push(args.assignee != null ? `assignee \u2192 ${args.assignee}` : "unassigned");
  }
  if (Object.keys(update).length === 0) throw new Error("Nothing to change.");
  await client.updateDoc(L.Lead, lead.space, lead._id, update);
  return `\u2705 **${String(lead.identifier)}**: ${done.join(", ")}.`;
});
const deleteLead = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const lead = await findLead(client, args.identifier);
  await client.removeCollection(L.Lead, lead.space, lead._id, lead.attachedTo, lead.attachedToClass, lead.collection ?? "leads");
  return `\u{1F5D1}\uFE0F Lead **${String(lead.identifier)}** deleted.`;
});
