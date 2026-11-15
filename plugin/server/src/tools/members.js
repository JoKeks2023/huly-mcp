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
var members_exports = {};
__export(members_exports, {
  listMembers: () => listMembers
});
module.exports = __toCommonJS(members_exports);
var import_contact = __toESM(require("../../vendor/@hcengineering/contact/lib/index.js"));
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_people = require("../utils/people.js");
const listMembers = (0, import_errors.wrapToolHandler)(async (args) => {
  const accountClient = await (0, import_connection.getAccountClient)(args.workspace);
  const members = await accountClient.getWorkspaceMembers();
  if (members.length === 0) return "No members found in this workspace.";
  let nameByUuid = /* @__PURE__ */ new Map();
  try {
    const client = await (0, import_connection.getConnection)(args.workspace);
    const persons = await client.findAll(import_contact.default.class.Person, {});
    nameByUuid = new Map(persons.filter((p) => p.personUuid != null).map((p) => [String(p.personUuid), (0, import_people.formatPersonName)(p.name)]));
  } catch {
  }
  const lines = members.map((m) => {
    const role = String(m.role ?? "member");
    const name = nameByUuid.get(String(m.person));
    return `- ${name != null && name !== "" ? `**${name}** ` : ""}\`${m.person}\` \u2014 role: **${role}**`;
  });
  return `## Workspace Members (${members.length})

${lines.join("\n")}`;
});
