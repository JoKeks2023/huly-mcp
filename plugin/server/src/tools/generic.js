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
var generic_exports = {};
__export(generic_exports, {
  describeClass: () => describeClass,
  genericCreate: () => genericCreate,
  genericDelete: () => genericDelete,
  genericUpdate: () => genericUpdate,
  listClasses: () => listClasses,
  queryDocuments: () => queryDocuments
});
module.exports = __toCommonJS(generic_exports);
var import_core = __toESM(require("../../vendor/@hcengineering/core/lib/index.js"));
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
const SECRET_KEY = /token|secret|password|credential|api[-_]?key|private[-_]?key|access[-_]?key/i;
const BLOCKED_READ_DOMAINS = /* @__PURE__ */ new Set(["tx"]);
const BLOCKED_WRITE_DOMAINS = /* @__PURE__ */ new Set(["model", "tx"]);
const BLOCKED_WRITE_CLASSES = [
  import_core.default.class.Space,
  // projects, teamspaces, channels…: use the dedicated tools
  "contact:class:SocialIdentity",
  "setting:class:Integration",
  "github:class:GithubAuthentication",
  "github:class:GithubIntegration"
];
function hierarchyOf(client) {
  return client.getHierarchy();
}
function getClass(client, className) {
  const h = hierarchyOf(client);
  try {
    return h.getClass(className);
  } catch {
    throw new Error(`Unknown class '${className}'. Use list_classes to find class names.`);
  }
}
function domainOf(client, className) {
  try {
    return hierarchyOf(client).findDomain(className);
  } catch {
    return void 0;
  }
}
function typeName(attr) {
  const t = attr.type ?? {};
  const base = String(t._class ?? "").split(":").pop() ?? "?";
  if (t.to != null) return `${base} \u2192 ${t.to}`;
  if (t.of != null) return `${base}<${typeof t.of === "string" ? t.of : String(t.of._class ?? "").split(":").pop() ?? "?"}>`;
  return base;
}
function redact(value, depth = 0) {
  if (value == null || depth > 4) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) ? "[redacted]" : redact(v, depth + 1)]));
  }
  if (typeof value === "string" && value.length > 300) return value.slice(0, 300) + "\u2026";
  return value;
}
function assertWritable(client, className) {
  const cls = getClass(client, className);
  const h = hierarchyOf(client);
  const domain = domainOf(client, className);
  if (domain == null || BLOCKED_WRITE_DOMAINS.has(domain)) throw new Error(`'${className}' (domain ${domain ?? "none"}) cannot be written generically.`);
  for (const blocked of BLOCKED_WRITE_CLASSES) {
    if (className === blocked || h.isDerived(className, blocked)) throw new Error(`'${className}' cannot be written generically \u2014 use the dedicated tools.`);
  }
  return cls;
}
function assertKnownAttributes(client, className, attributes) {
  const known = hierarchyOf(client).getAllAttributes(className);
  const unknown = Object.keys(attributes).filter((k) => !known.has(k) && !k.includes(":") && !k.startsWith("$"));
  if (unknown.length > 0) throw new Error(`Unknown attribute(s) for ${className}: ${unknown.join(", ")}. See describe_class.`);
  const system = Object.keys(attributes).filter((k) => ["_id", "_class", "modifiedOn", "modifiedBy", "createdBy", "createdOn"].includes(k));
  if (system.length > 0) throw new Error(`System attribute(s) cannot be set: ${system.join(", ")}.`);
}
const isAttached = (client, className) => hierarchyOf(client).isDerived(className, import_core.default.class.AttachedDoc);
const listClasses = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const h = hierarchyOf(client);
  const rows = [];
  for (const id of h.getDescendants(import_core.default.class.Doc)) {
    const cls = h.getClass(id);
    if (cls.kind !== 0) continue;
    const domain = domainOf(client, id);
    if (domain == null || domain === "model" || BLOCKED_READ_DOMAINS.has(domain)) continue;
    if (args.module != null && id.split(":")[0] !== args.module) continue;
    let count = "";
    if (args.withCounts) {
      try {
        count = ` \u2014 ${(await client.findAll(id, {}, { limit: 1, total: true })).total} doc(s)`;
      } catch {
        count = " \u2014 ?";
      }
    }
    rows.push(`- \`${id}\`${count}`);
  }
  if (rows.length === 0) return `No classes${args.module != null ? ` in module '${args.module}'` : ""}.`;
  return `## Classes (${rows.length})

${rows.sort().join("\n")}`;
});
const describeClass = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const cls = getClass(client, args.className);
  const h = hierarchyOf(client);
  const attrs = [...h.getAllAttributes(args.className).entries()].filter(([k]) => !["_id", "_class", "modifiedOn", "modifiedBy", "createdBy", "createdOn"].includes(k)).map(([k, a]) => `- \`${k}\`: ${typeName(a)}${a.hidden === true ? " (hidden)" : ""}`);
  let writable = "yes (generic_create/update/delete, dry run by default)";
  try {
    assertWritable(client, args.className);
  } catch (e) {
    writable = `no \u2014 ${e.message}`;
  }
  return [
    `## ${args.className}`,
    `**Extends:** ${cls.extends ?? "\u2014"} \xB7 **Domain:** ${domainOf(client, args.className) ?? "\u2014"} \xB7 **Attached doc:** ${isAttached(client, args.className) ? "yes (needs attachTo)" : "no"}`,
    `**Writable:** ${writable}`,
    "",
    "**Attributes:**",
    ...attrs
  ].join("\n");
});
const queryDocuments = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  getClass(client, args.className);
  const domain = domainOf(client, args.className);
  if (domain != null && BLOCKED_READ_DOMAINS.has(domain)) throw new Error(`'${args.className}' cannot be queried.`);
  const docs = await client.findAll(args.className, args.query ?? {}, { limit: args.limit });
  if (docs.length === 0) return `No ${args.className} documents match.`;
  const shaped = docs.map((d) => {
    const picked = args.fields != null ? Object.fromEntries(["_id", ...args.fields].map((f) => [f, d[f]])) : d;
    return redact(Object.fromEntries(Object.entries(picked).filter(([, v]) => v !== null && v !== void 0)));
  });
  return `## ${args.className} (${docs.length}${docs.length === args.limit ? "+" : ""})

\`\`\`json
${JSON.stringify(shaped, null, 1)}
\`\`\``;
});
const genericCreate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  assertWritable(client, args.className);
  assertKnownAttributes(client, args.className, args.attributes);
  const attached = isAttached(client, args.className);
  if (attached && args.attachTo == null) throw new Error(`${args.className} is an attached document \u2014 pass attachTo { id, className, collection }.`);
  if (!attached && args.attachTo != null) throw new Error(`${args.className} is not an attached document \u2014 omit attachTo.`);
  if (args.attachTo != null) {
    const parent = await client.findOne(args.attachTo.className, { _id: args.attachTo.id });
    if (parent == null) throw new Error(`attachTo: ${args.attachTo.className} '${args.attachTo.id}' not found.`);
  }
  const plan = `${args.className} in space \`${args.space}\`${args.attachTo != null ? `, attached to ${args.attachTo.className} \`${args.attachTo.id}\` (${args.attachTo.collection})` : ""}
\`\`\`json
${JSON.stringify(args.attributes, null, 1)}
\`\`\``;
  if (args.dryRun) return `\u{1F50D} Dry run \u2014 would create ${plan}
Run again with dryRun=false to apply.`;
  const id = (0, import_core.generateId)();
  if (args.attachTo != null) {
    await client.addCollection(args.className, args.space, args.attachTo.id, args.attachTo.className, args.attachTo.collection, args.attributes, id);
  } else {
    await client.createDoc(args.className, args.space, args.attributes, id);
  }
  return `\u2705 Created ${args.className} \`${id}\`.`;
});
const genericUpdate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  assertWritable(client, args.className);
  assertKnownAttributes(client, args.className, args.attributes);
  const doc = await client.findOne(args.className, { _id: args.id });
  if (doc == null) throw new Error(`${args.className} '${args.id}' not found.`);
  const diff = Object.entries(args.attributes).map(([k, v]) => `- \`${k}\`: ${JSON.stringify(redact(doc[k]))} \u2192 ${JSON.stringify(redact(v))}`);
  if (args.dryRun) return `\u{1F50D} Dry run \u2014 would update ${args.className} \`${args.id}\`:
${diff.join("\n")}
Run again with dryRun=false to apply.`;
  if (isAttached(client, args.className)) {
    await client.updateCollection(doc._class, doc.space, doc._id, doc.attachedTo, doc.attachedToClass, doc.collection, args.attributes);
  } else {
    await client.updateDoc(doc._class, doc.space, doc._id, args.attributes);
  }
  return `\u2705 Updated ${args.className} \`${args.id}\`:
${diff.join("\n")}`;
});
const genericDelete = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  assertWritable(client, args.className);
  const doc = await client.findOne(args.className, { _id: args.id });
  if (doc == null) throw new Error(`${args.className} '${args.id}' not found.`);
  const what = `${args.className} \`${args.id}\` (${String(doc.title ?? doc.name ?? doc.label ?? "").slice(0, 80)})`;
  if (args.dryRun || !args.confirm) {
    return `\u{1F50D} Dry run \u2014 would delete ${what}.
To delete, run again with dryRun=false and confirm=true.`;
  }
  if (isAttached(client, args.className)) {
    await client.removeCollection(doc._class, doc.space, doc._id, doc.attachedTo, doc.attachedToClass, doc.collection);
  } else {
    await client.removeDoc(doc._class, doc.space, doc._id);
  }
  return `\u{1F5D1}\uFE0F Deleted ${what}.`;
});
