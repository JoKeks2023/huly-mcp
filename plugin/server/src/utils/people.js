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
var people_exports = {};
__export(people_exports, {
  currentAccountUuid: () => currentAccountUuid,
  currentPerson: () => currentPerson,
  findPerson: () => findPerson,
  formatPersonName: () => formatPersonName,
  listPeople: () => listPeople,
  peopleNames: () => peopleNames,
  socialIdNames: () => socialIdNames
});
module.exports = __toCommonJS(people_exports);
var import_contact = __toESM(require("../../vendor/@hcengineering/contact/lib/index.js"));
function formatPersonName(raw) {
  if (raw == null) return "";
  const [last, first] = raw.split(",", 2);
  if (first === void 0) return raw.trim();
  return `${first.trim()} ${last.trim()}`.trim();
}
async function listPeople(client) {
  let docs = await client.findAll(import_contact.default.mixin.Employee, {});
  if (docs.length === 0) docs = await client.findAll(import_contact.default.class.Person, {});
  return docs.map((d) => ({ _id: d._id, rawName: d.name ?? "", name: formatPersonName(d.name) }));
}
async function peopleNames(client) {
  return new Map((await listPeople(client)).map((p) => [p._id, p.name]));
}
async function findPerson(client, query) {
  const q = query.trim().toLowerCase();
  const people = await listPeople(client);
  const exact = people.filter((p) => p.name.toLowerCase() === q || p.rawName.toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const partial = people.filter((p) => p.name.toLowerCase().includes(q) || p.rawName.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) throw new Error(`Member '${query}' not found.`);
  throw new Error(`Member '${query}' is ambiguous: ${partial.map((p) => p.name).join(", ")}.`);
}
async function currentPerson(client) {
  const identity = await client.findOne(import_contact.default.class.SocialIdentity, { _id: client.user });
  const personId = identity?.attachedTo;
  if (personId == null) throw new Error("Could not identify current user.");
  const person = await client.findOne(import_contact.default.class.Person, { _id: personId });
  return { _id: personId, rawName: person?.name ?? "", name: formatPersonName(person?.name), uuid: person?.personUuid };
}
async function socialIdNames(client, ids) {
  if (ids.length === 0) return /* @__PURE__ */ new Map();
  const identities = await client.findAll(import_contact.default.class.SocialIdentity, { _id: { $in: ids } });
  const names = await peopleNames(client);
  return new Map(identities.map((i) => [i._id, names.get(i.attachedTo) ?? (i.type === "github" && typeof i.value === "string" ? `${i.value} (GitHub)` : "Unknown")]));
}
async function currentAccountUuid(client) {
  const me = await currentPerson(client);
  if (me.uuid == null) throw new Error("Could not determine the account of the current user.");
  return me.uuid;
}
