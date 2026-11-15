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
var fields_exports = {};
__export(fields_exports, {
  createCustomField: () => createCustomField,
  listCustomFields: () => listCustomFields,
  setCustomFields: () => setCustomFields
});
module.exports = __toCommonJS(fields_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_classes = require("../utils/classes.js");
var import_resolve = require("../utils/resolve.js");
var import_attributes = require("../utils/attributes.js");
async function resolveOwner(client, target) {
  const h = client.getHierarchy();
  const t = target.trim();
  if (t.toLowerCase() === "issue") return { id: import_tracker.default.class.Issue, label: "all issues" };
  if (/^[A-Z][A-Z0-9]*$/.test(t)) {
    const project = await client.findOne(import_tracker.default.class.Project, { identifier: t });
    if (project != null) {
      const projectType = await client.findOne("task:class:ProjectType", { _id: project.type });
      const taskTypes = await client.findAll("task:class:TaskType", { _id: { $in: projectType?.tasks ?? [] } });
      const issueType = taskTypes.find((tt) => tt.ofClass === import_tracker.default.class.Issue && tt._id !== "tracker:taskTypes:Issue") ?? taskTypes.find((tt) => tt.ofClass === import_tracker.default.class.Issue);
      if (issueType?.targetClass == null) throw new Error(`Project ${t} has no issue task type.`);
      return { id: issueType.targetClass, label: `issues of project type "${String(projectType?.name ?? project.type)}" (${t})` };
    }
  }
  try {
    const c = h.getClass(t);
    return { id: c._id, label: (0, import_attributes.labelText)(c.label) };
  } catch {
  }
  const cards = h.getDescendants(import_classes.C.Card).map((id) => h.getClass(id)).filter((c) => (0, import_attributes.labelText)(c.label).toLowerCase() === t.toLowerCase());
  if (cards.length === 1) return { id: cards[0]._id, label: `card ${cards[0].kind === 2 ? "tag" : "type"} ${(0, import_attributes.labelText)(cards[0].label)}` };
  if (cards.length > 1) throw new Error(`'${target}' matches several card types: ${cards.map((c) => c._id).join(", ")}.`);
  throw new Error(`Unknown target '${target}'. Use "issue", a project key, a card type/tag name or a class id.`);
}
async function resolveDoc(client, ref) {
  const card = /^[A-Z][A-Z0-9]*-\d+$/.test(ref) ? void 0 : await client.findOne(import_classes.C.Card, { _id: ref });
  if (card != null) return card;
  const obj = await (0, import_resolve.resolveObject)(client, ref);
  if (obj.doc == null) throw new Error(`'${ref}' not found.`);
  return obj.doc;
}
const typeName = (a) => {
  const c = String(a.type?._class ?? "");
  if (c === "core:class:EnumOf") return "enum";
  if (c === "core:class:RefTo") return `ref \u2192 ${String(a.type?.to)}`;
  return c.replace(/^core:class:Type/, "").toLowerCase() || c;
};
const listCustomFields = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  if (args.object != null) {
    const doc = await resolveDoc(client, args.object);
    const fields = await (0, import_attributes.fieldsOf)(client, doc);
    if (fields.length === 0) return `No custom fields on this ${(0, import_attributes.labelText)(client.getHierarchy().getClass(doc._class).label)}.`;
    return `## Custom fields

${fields.map((f) => `- **${f.label}** (${typeName(f.attr)}): ${(0, import_attributes.showValue)(f, (0, import_attributes.valueOf)(doc, f))}`).join("\n")}`;
  }
  const owner = await resolveOwner(client, args.target ?? "issue");
  const attrs = await (0, import_attributes.fieldsDefinedOn)(client, owner.id);
  if (attrs.length === 0) return `No custom fields on ${owner.label}.`;
  const enums = /* @__PURE__ */ new Map();
  for (const a of attrs) {
    if (a.type?._class === "core:class:EnumOf") enums.set(a._id, (await client.findOne(import_classes.C.Enum, { _id: a.type.of }))?.enumValues ?? []);
  }
  return `## Custom fields on ${owner.label} (${attrs.length})

${attrs.map((a) => `- **${(0, import_attributes.labelText)(a.label)}** (${typeName(a)}${enums.has(a._id) ? `: ${enums.get(a._id).join(", ")}` : ""}) \u2014 \`${String(a.name)}\``).join("\n")}`;
});
const createCustomField = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const owner = await resolveOwner(client, args.target);
  const existing = await (0, import_attributes.fieldsDefinedOn)(client, owner.id);
  const same = existing.find((a) => (0, import_attributes.labelText)(a.label).toLowerCase() === args.label.toLowerCase());
  if (same != null) return `\u2139\uFE0F Field **${args.label}** already exists on ${owner.label} \u2014 \`${String(same.name)}\`.`;
  const type = await (0, import_attributes.makeType)(client, args.type, { enumValues: args.enumValues, enumName: args.label, refClass: args.refClass });
  const name = "custom" + (0, import_core.generateId)();
  await client.createDoc(import_classes.C.Attribute, "core:space:Model", {
    attributeOf: owner.id,
    name,
    label: (0, import_attributes.embeddedLabel)(args.label),
    isCustom: true,
    type,
    defaultValue: null,
    readonly: false,
    automationOnly: false,
    required: false
  });
  return `\u2705 Field **${args.label}** (${args.type}) added to ${owner.label} \u2014 \`${name}\`.`;
});
const setCustomFields = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  if (Object.keys(args.fields).length === 0) throw new Error("Nothing to set: fields is empty.");
  const doc = await resolveDoc(client, args.object);
  const fields = await (0, import_attributes.fieldsOf)(client, doc);
  const values = [];
  for (const [key, raw] of Object.entries(args.fields)) {
    const field = (0, import_attributes.findField)(fields, key);
    values.push({ field, value: await (0, import_attributes.coerceValue)(client, field, raw) });
  }
  await (0, import_attributes.writeFields)(client, doc, values);
  return `\u2705 Set ${values.map((v) => `**${String(v.field.label)}** = ${(0, import_attributes.showValue)(v.field, v.value)}`).join(", ")}.`;
});
