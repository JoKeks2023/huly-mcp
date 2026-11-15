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
var organizations_exports = {};
__export(organizations_exports, {
  createOrganization: () => createOrganization,
  getOrganization: () => getOrganization,
  listOrganizations: () => listOrganizations,
  updateOrganization: () => updateOrganization
});
module.exports = __toCommonJS(organizations_exports);
var import_contact = __toESM(require("../../vendor/@hcengineering/contact/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_markdown = require("../utils/markdown.js");
var import_storage = require("../utils/storage.js");
var import_content = require("../utils/content.js");
const listOrganizations = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const orgs = await client.findAll(import_contact.default.class.Organization, {});
  if (orgs.length === 0) return "No organizations found in this workspace.";
  const lines = orgs.map((o) => `- **${o.name}** (id: \`${o._id}\`)${o.city != null && o.city !== "" ? ` \u2014 ${o.city}` : ""}`);
  return `## Organizations (${orgs.length})

${lines.join("\n")}`;
});
const getOrganization = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const org = await client.findOne(import_contact.default.class.Organization, { _id: args.organizationId });
  if (org == null) throw new Error(`Organization '${args.organizationId}' not found.`);
  const lines = [`## ${org.name}`, `**ID:** \`${org._id}\``];
  if (org.city != null && org.city !== "") lines.push(`**City:** ${org.city}`);
  lines.push(`**Members linked:** ${org.members ?? 0}`);
  if (org.description != null) {
    const frontUrl = process.env.HULY_FRONT_URL;
    if (frontUrl != null && frontUrl !== "") {
      const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(args.workspace);
      const blobUrl = `${frontUrl}/files?file=${encodeURIComponent(org.description)}&workspace=${workspaceUuid}`;
      try {
        const res = await (0, import_content.fetchBlob)(blobUrl, wsToken);
        if (res.ok) {
          const text = await res.text();
          try {
            const extracted = (0, import_markdown.extractText)(JSON.parse(text));
            if (extracted.length > 0) lines.push(`
**Description:**
${extracted}`);
          } catch {
            lines.push(`
**Description (raw):**
${text.substring(0, 2e3)}`);
          }
        }
      } catch {
        lines.push("\n**Description:** _(fetch failed)_");
      }
    } else {
      lines.push(`
**Description blob ref:** \`${org.description}\``);
    }
  }
  return lines.join("\n");
});
const createOrganization = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const existing = await client.findOne(import_contact.default.class.Organization, { name: args.name });
  if (existing != null) return `\u2139\uFE0F Organization **"${args.name}"** already exists (id: \`${existing._id}\`).`;
  const orgId = (0, import_core.generateId)();
  await client.createDoc(
    import_contact.default.class.Organization,
    import_contact.default.space.Contacts,
    {
      name: args.name,
      city: args.city ?? "",
      description: null,
      members: 0,
      avatar: null
    },
    orgId
  );
  return `\u2705 Organization **"${args.name}"** created (id: \`${orgId}\`).`;
});
const updateOrganization = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(args.workspace);
  const org = await client.findOne(import_contact.default.class.Organization, { _id: args.organizationId });
  if (org == null) throw new Error(`Organization '${args.organizationId}' not found.`);
  const update = {};
  if (args.name != null) update.name = args.name;
  if (args.city != null) update.city = args.city;
  if (args.description != null) {
    const prosemirror = (0, import_markdown.markdownToProseMirror)(args.description);
    update.description = await (0, import_storage.uploadMarkupBlob)(wsToken, workspaceUuid, `${org._id}-description-${Date.now()}`, JSON.stringify(prosemirror));
  }
  if (Object.keys(update).length === 0) throw new Error("Nothing to change: pass name, city or description.");
  await client.updateDoc(import_contact.default.class.Organization, org.space, org._id, update);
  return `\u2705 Organization **"${String(args.name ?? org.name)}"** updated \u2014 changed: ${Object.keys(update).join(", ")}.`;
});
