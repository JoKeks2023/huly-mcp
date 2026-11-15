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
var contacts_exports = {};
__export(contacts_exports, {
  addContactChannel: () => addContactChannel,
  createPerson: () => createPerson,
  getPerson: () => getPerson,
  listPersons: () => listPersons,
  removeContactChannel: () => removeContactChannel,
  updatePerson: () => updatePerson
});
module.exports = __toCommonJS(contacts_exports);
var import_contact = __toESM(require("../../vendor/@hcengineering/contact/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_people = require("../utils/people.js");
const provider = (name) => `contact:channelProvider:${name}`;
const providerName = (id) => String(id).split(":").pop() ?? id;
function splitName(raw) {
  const [last, first] = (raw ?? "").split(",", 2);
  return first === void 0 ? { first: last.trim(), last: "" } : { first: first.trim(), last: last.trim() };
}
async function findAnyPerson(client, ref) {
  const byId = await client.findOne(import_contact.default.class.Person, { _id: ref });
  if (byId != null) return byId;
  const q = ref.trim().toLowerCase();
  const persons = await client.findAll(import_contact.default.class.Person, {});
  const exact = persons.filter((p) => (0, import_people.formatPersonName)(p.name).toLowerCase() === q || String(p.name ?? "").toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const partial = persons.filter((p) => (0, import_people.formatPersonName)(p.name).toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) throw new Error(`Person '${ref}' not found.`);
  throw new Error(`Person '${ref}' is ambiguous: ${partial.map((p) => `${(0, import_people.formatPersonName)(p.name)} (\`${p._id}\`)`).join(", ")}.`);
}
function isEmployee(client, person) {
  try {
    return client.getHierarchy().hasMixin(person, import_contact.default.mixin.Employee);
  } catch {
    return person[import_contact.default.mixin.Employee] != null;
  }
}
const listPersons = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  let persons = await client.findAll(import_contact.default.class.Person, {});
  if (args.employeesOnly) persons = persons.filter((p) => isEmployee(client, p));
  if (args.query != null) persons = persons.filter((p) => (0, import_people.formatPersonName)(p.name).toLowerCase().includes(args.query.toLowerCase()));
  persons.sort((a, b) => (0, import_people.formatPersonName)(a.name).localeCompare((0, import_people.formatPersonName)(b.name)));
  const total = persons.length;
  persons = persons.slice(0, args.limit);
  if (persons.length === 0) return "No persons found.";
  const channels = await client.findAll(import_contact.default.class.Channel, { attachedTo: { $in: persons.map((p) => p._id) } });
  const lines = persons.map((p) => {
    const ch = channels.filter((c) => c.attachedTo === p._id).map((c) => `${providerName(c.provider)}: ${c.value}`);
    return `- **${(0, import_people.formatPersonName)(p.name)}**${isEmployee(client, p) ? " (member)" : ""}${p.city != null && p.city !== "" ? ` \xB7 ${p.city}` : ""}${ch.length > 0 ? ` \xB7 ${ch.join(", ")}` : ""} \u2014 \`${p._id}\``;
  });
  return `## Persons (${total})

${lines.join("\n")}${total > persons.length ? `

_${total - persons.length} more (raise limit)._` : ""}`;
});
const getPerson = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const p = await findAnyPerson(client, args.person);
  const channels = await client.findAll(import_contact.default.class.Channel, { attachedTo: p._id });
  const memberships = await client.findAll(import_contact.default.class.Member, { contact: p._id });
  const orgs = [];
  for (const m of memberships) {
    const org = await client.findOne(import_contact.default.class.Organization, { _id: m.attachedTo });
    if (org != null) orgs.push(org.name);
  }
  return [
    `## ${(0, import_people.formatPersonName)(p.name)}`,
    `**Id:** \`${p._id}\``,
    `**Workspace member:** ${isEmployee(client, p) ? "yes" : "no"}`,
    p.city != null && p.city !== "" ? `**City:** ${p.city}` : null,
    `**Contact channels:** ${channels.length > 0 ? channels.map((c) => `${providerName(c.provider)}: ${c.value}`).join(", ") : "none"}`,
    `**Organizations:** ${orgs.length > 0 ? orgs.join(", ") : "none"}`
  ].filter(Boolean).join("\n");
});
const createPerson = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const name = `${args.lastName},${args.firstName}`;
  const display = (0, import_people.formatPersonName)(name);
  const existing = (await client.findAll(import_contact.default.class.Person, {})).filter((p) => (0, import_people.formatPersonName)(p.name).toLowerCase() === display.toLowerCase());
  if (existing.length > 0) return `\u2139\uFE0F **${display}** already exists (id: \`${existing[0]._id}\`).`;
  const id = (0, import_core.generateId)();
  await client.createDoc(import_contact.default.class.Person, import_contact.default.space.Contacts, { name, city: args.city ?? "", avatarType: "color" }, id);
  for (const ch of args.channels ?? []) {
    await client.addCollection(import_contact.default.class.Channel, import_contact.default.space.Contacts, id, import_contact.default.class.Person, "channels", { provider: provider(ch.provider), value: ch.value });
  }
  return `\u2705 Person **${display}** created (id: \`${id}\`)${(args.channels ?? []).length > 0 ? ` with ${args.channels.length} contact channel(s)` : ""}.`;
});
const updatePerson = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const p = await findAnyPerson(client, args.person);
  const updates = {};
  if (args.firstName !== void 0 || args.lastName !== void 0) {
    const cur = splitName(p.name);
    updates.name = `${args.lastName ?? cur.last},${args.firstName ?? cur.first}`;
  }
  if (args.city !== void 0) updates.city = args.city;
  if (Object.keys(updates).length === 0) return `Nothing to update for **${(0, import_people.formatPersonName)(p.name)}**.`;
  await client.updateDoc(import_contact.default.class.Person, p.space, p._id, updates);
  return `\u2705 **${(0, import_people.formatPersonName)(updates.name ?? p.name)}** updated (${Object.keys(updates).join(", ")}).`;
});
const addContactChannel = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const p = await findAnyPerson(client, args.person);
  const existing = await client.findOne(import_contact.default.class.Channel, { attachedTo: p._id, provider: provider(args.provider), value: args.value });
  if (existing != null) return `\u2139\uFE0F ${(0, import_people.formatPersonName)(p.name)} already has ${args.provider}: ${args.value}.`;
  await client.addCollection(import_contact.default.class.Channel, p.space, p._id, p._class, "channels", { provider: provider(args.provider), value: args.value });
  return `\u2705 Added ${args.provider} **${args.value}** to ${(0, import_people.formatPersonName)(p.name)}.`;
});
const removeContactChannel = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const p = await findAnyPerson(client, args.person);
  const ch = await client.findOne(import_contact.default.class.Channel, { attachedTo: p._id, provider: provider(args.provider), value: args.value });
  if (ch == null) return `${(0, import_people.formatPersonName)(p.name)} has no ${args.provider} "${args.value}".`;
  await client.removeCollection(import_contact.default.class.Channel, ch.space, ch._id, p._id, ch.attachedToClass, "channels");
  return `\u2705 Removed ${args.provider} **${args.value}** from ${(0, import_people.formatPersonName)(p.name)}.`;
});
