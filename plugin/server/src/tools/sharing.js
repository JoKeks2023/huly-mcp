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
var sharing_exports = {};
__export(sharing_exports, {
  addCollaborator: () => addCollaborator,
  createPublicLink: () => createPublicLink,
  listCollaborators: () => listCollaborators,
  listPublicLinks: () => listPublicLinks,
  reachableUrl: () => reachableUrl,
  removeCollaborator: () => removeCollaborator,
  revokePublicLink: () => revokePublicLink
});
module.exports = __toCommonJS(sharing_exports);
var import_core = __toESM(require("../../vendor/@hcengineering/core/lib/index.js"));
var import_contact = __toESM(require("../../vendor/@hcengineering/contact/lib/index.js"));
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_resolve = require("../utils/resolve.js");
var import_classes = require("../utils/classes.js");
var import_people = require("../utils/people.js");
async function accountNames(client) {
  const persons = await client.findAll(import_contact.default.class.Person, {});
  return new Map(persons.filter((p) => p.personUuid != null).map((p) => [p.personUuid, (0, import_people.formatPersonName)(p.name)]));
}
async function accountOf(client, member) {
  const person = member == null ? await (0, import_people.currentPerson)(client) : await (0, import_people.findPerson)(client, member);
  const doc = await client.findOne(import_contact.default.class.Person, { _id: person._id });
  if (doc?.personUuid == null) throw new Error(`${person.name} has no Huly account and cannot follow documents.`);
  return { uuid: doc.personUuid, name: person.name };
}
const listCollaborators = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const target = await (0, import_resolve.resolveObject)(client, args.object);
  const rows = await client.findAll(import_classes.C.Collaborator, { attachedTo: target._id });
  if (rows.length === 0) return `Nobody follows ${target.label}.`;
  const names = await accountNames(client);
  return `## Collaborators of ${target.label} (${rows.length})

${rows.map((r) => `- ${names.get(r.collaborator) ?? r.collaborator}`).join("\n")}`;
});
const addCollaborator = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const target = await (0, import_resolve.resolveObject)(client, args.object);
  const who = await accountOf(client, args.member);
  const existing = await client.findOne(import_classes.C.Collaborator, { attachedTo: target._id, collaborator: who.uuid });
  if (existing != null) return `${who.name} already follows ${target.label}.`;
  await client.addCollection(import_classes.C.Collaborator, target.space, target._id, target._class, "collaborators", { collaborator: who.uuid });
  return `\u2705 ${who.name} now follows ${target.label}.`;
});
const removeCollaborator = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const target = await (0, import_resolve.resolveObject)(client, args.object);
  const who = await accountOf(client, args.member);
  const rows = await client.findAll(import_classes.C.Collaborator, { attachedTo: target._id, collaborator: who.uuid });
  if (rows.length === 0) return `${who.name} does not follow ${target.label}.`;
  for (const r of rows) await client.removeCollection(import_classes.C.Collaborator, r.space, r._id, r.attachedTo, r.attachedToClass, r.collection ?? "collaborators");
  return `\u2705 ${who.name} no longer follows ${target.label}.`;
});
function reachableUrl(url, frontUrl = process.env.HULY_FRONT_URL) {
  if (url === "" || frontUrl == null || frontUrl === "") return url;
  try {
    const u = new URL(url);
    if (!["localhost", "127.0.0.1", "0.0.0.0"].includes(u.hostname)) return url;
    const f = new URL(frontUrl);
    return `${f.origin}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}
const sleep = async (ms) => await new Promise((resolve) => setTimeout(resolve, ms));
async function waitForUrl(client, id, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    const link = await client.findOne(import_classes.C.PublicLink, { _id: id });
    if (link?.url != null && link.url !== "") return reachableUrl(link.url);
    await sleep(300);
  }
  return "";
}
function panelComponent(client, _class) {
  try {
    const panel = client.getHierarchy().classHierarchyMixin(_class, "view:mixin:ObjectPanel");
    if (panel?.component != null) return panel.component;
  } catch {
  }
  return "view:component:EditDoc";
}
const createPublicLink = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const target = await (0, import_resolve.resolveObject)(client, args.object);
  const existing = await client.findOne(import_classes.C.PublicLink, { attachedTo: target._id });
  if (existing != null && existing.url !== "") return `Public link for ${target.label} already exists:
${reachableUrl(existing.url)}

Link id: \`${existing._id}\``;
  const component = panelComponent(client, target._class);
  const id = existing?._id ?? await client.createDoc(import_classes.C.PublicLink, import_core.default.space.Workspace, {
    attachedTo: target._id,
    location: { path: [], fragment: encodeURIComponent([component, target._id, target._class, "content"].join("|")) },
    revokable: true,
    restrictions: { readonly: true, disableNavigation: true, disableActions: true, disableComments: true },
    url: ""
  });
  const url = await waitForUrl(client, id);
  if (url === "") return `\u26A0\uFE0F Link for ${target.label} created, but the server has not filled in its URL yet \u2014 run list_public_links in a moment.

Link id: \`${id}\``;
  return `\u2705 Public read-only link for ${target.label}:
${url}

Anyone with this link can read it. Revoke with revoke_public_link (\`${id}\`).`;
});
const listPublicLinks = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const query = {};
  if (args.object != null) query.attachedTo = (await (0, import_resolve.resolveObject)(client, args.object))._id;
  const links = await client.findAll(import_classes.C.PublicLink, query, { limit: args.limit });
  if (links.length === 0) return "No public links.";
  const lines = [];
  for (const l of links) {
    let label = String(l.attachedTo);
    try {
      label = (await (0, import_resolve.resolveObject)(client, String(l.attachedTo))).label;
    } catch {
    }
    lines.push(`- **${label}** \u2014 ${l.url !== "" ? reachableUrl(String(l.url)) : "_(URL pending)_"} \u2014 \`${l._id}\`${l.revokable === false ? " (not revokable)" : ""}`);
  }
  return `## Public links (${links.length})

${lines.join("\n")}`;
});
const revokePublicLink = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const link = await client.findOne(import_classes.C.PublicLink, { _id: args.linkId });
  if (link == null) throw new Error(`Public link '${args.linkId}' not found.`);
  if (link.revokable === false) throw new Error("This link is marked as not revokable in Huly.");
  await client.removeDoc(import_classes.C.PublicLink, link.space, link._id);
  return `\u2705 Public link \`${args.linkId}\` revoked \u2014 its URL no longer works.`;
});
