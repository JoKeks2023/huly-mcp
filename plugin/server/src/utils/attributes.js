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
var attributes_exports = {};
__export(attributes_exports, {
  FIELD_TYPES: () => FIELD_TYPES,
  coerceValue: () => coerceValue,
  embeddedLabel: () => embeddedLabel,
  fieldsDefinedOn: () => fieldsDefinedOn,
  fieldsOf: () => fieldsOf,
  findField: () => findField,
  labelText: () => labelText,
  makeType: () => makeType,
  showValue: () => showValue,
  valueOf: () => valueOf,
  writeFields: () => writeFields
});
module.exports = __toCommonJS(attributes_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_classes = require("./classes.js");
const FIELD_TYPES = ["string", "number", "boolean", "date", "markup", "enum", "ref"];
const TYPE_CLASS = {
  string: "core:class:TypeString",
  number: "core:class:TypeNumber",
  boolean: "core:class:TypeBoolean",
  date: "core:class:TypeDate",
  markup: "core:class:TypeMarkup"
};
function labelText(label) {
  const s = String(label ?? "");
  if (s.startsWith("embedded:embedded:")) return s.slice("embedded:embedded:".length);
  return s.includes(":") ? s.split(":").pop() ?? s : s;
}
const embeddedLabel = (text) => `embedded:embedded:${text}`;
async function mixinsOf(client, doc) {
  const h = client.getHierarchy();
  const out = /* @__PURE__ */ new Set();
  for (const [key, value] of Object.entries(doc)) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) continue;
    try {
      if (h.isMixin(key)) out.add(key);
    } catch {
    }
  }
  if (doc.kind != null) {
    const taskType = await client.findOne("task:class:TaskType", { _id: doc.kind });
    if (taskType?.targetClass != null) out.add(taskType.targetClass);
  }
  return [...out];
}
async function fieldsOf(client, doc) {
  const h = client.getHierarchy();
  const owners = [doc._class, ...await mixinsOf(client, doc)];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const owner of owners) {
    let attrs;
    try {
      attrs = h.getAllAttributes(owner);
    } catch {
      continue;
    }
    for (const a of attrs.values()) {
      if (a.isCustom !== true || seen.has(a.name)) continue;
      seen.add(a.name);
      const ownerIsMixin = (() => {
        try {
          return h.isMixin(a.attributeOf);
        } catch {
          return false;
        }
      })();
      out.push({ name: a.name, label: labelText(a.label), typeClass: a.type?._class, of: a.type?.of, to: a.type?.to, owner: a.attributeOf, ownerIsMixin, attr: a });
    }
  }
  return out;
}
async function fieldsDefinedOn(client, owner) {
  return await client.findAll(import_classes.C.Attribute, { attributeOf: owner, isCustom: true });
}
function findField(fields, key) {
  const k = key.trim().toLowerCase();
  const hits = fields.filter((f) => f.label.toLowerCase() === k || f.name.toLowerCase() === k);
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw new Error(`Field '${key}' is ambiguous: ${hits.map((f) => `${f.label} (${f.name})`).join(", ")}.`);
  throw new Error(`Field '${key}' not found. Available: ${fields.map((f) => f.label).join(", ") || "none"}.`);
}
async function coerceValue(client, field, value) {
  if (value === null) return null;
  switch (field.typeClass) {
    case "core:class:TypeString":
    case "core:class:TypeMarkup":
    case "core:class:TypeHyperlink":
      return String(value);
    case "core:class:TypeNumber": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n)) throw new Error(`Field '${field.label}' expects a number, got '${String(value)}'.`);
      return n;
    }
    case "core:class:TypeBoolean":
      if (typeof value === "boolean") return value;
      if (/^(true|yes|1)$/i.test(String(value))) return true;
      if (/^(false|no|0)$/i.test(String(value))) return false;
      throw new Error(`Field '${field.label}' expects true/false.`);
    case "core:class:TypeDate": {
      const t = typeof value === "number" ? value : new Date(String(value)).getTime();
      if (Number.isNaN(t)) throw new Error(`Field '${field.label}' expects a date (YYYY-MM-DD).`);
      return t;
    }
    case "core:class:EnumOf": {
      const e = await client.findOne(import_classes.C.Enum, { _id: field.of });
      const allowed = e?.enumValues ?? [];
      const hit = allowed.find((v) => v.toLowerCase() === String(value).toLowerCase());
      if (hit == null) throw new Error(`Field '${field.label}' must be one of: ${allowed.join(", ")}.`);
      return hit;
    }
    case "core:class:RefTo":
      return String(value);
    default:
      throw new Error(`Field '${field.label}' has type ${field.typeClass}, which cannot be set here.`);
  }
}
function showValue(field, value) {
  if (value == null || value === "") return "\u2014";
  if (field.typeClass === "core:class:TypeDate" && typeof value === "number") return new Date(value).toISOString().slice(0, 10);
  return Array.isArray(value) ? value.join(", ") : String(value);
}
function valueOf(doc, field) {
  return field.ownerIsMixin ? doc[field.owner]?.[field.name] : doc[field.name];
}
async function writeFields(client, doc, values) {
  const plain = {};
  const byMixin = /* @__PURE__ */ new Map();
  for (const { field, value } of values) {
    if (field.ownerIsMixin) byMixin.set(field.owner, { ...byMixin.get(field.owner) ?? {}, [field.name]: value });
    else plain[field.name] = value;
  }
  if (Object.keys(plain).length > 0) await client.updateDoc(doc._class, doc.space, doc._id, plain);
  for (const [mixin, data] of byMixin) await client.updateMixin(doc._id, doc._class, doc.space, mixin, data);
}
async function makeType(client, type, opts) {
  if (type === "enum") {
    const values = (opts.enumValues ?? []).map((v) => v.trim()).filter((v) => v !== "");
    if (values.length === 0) throw new Error("enumValues is required for type enum.");
    const enumId = (0, import_core.generateId)();
    await client.createDoc(import_classes.C.Enum, "core:space:Model", { name: opts.enumName ?? "Enum", enumValues: [...new Set(values)] }, enumId);
    return { _class: "core:class:EnumOf", of: enumId, label: "core:string:Enum" };
  }
  if (type === "ref") {
    if (opts.refClass == null) throw new Error("refClass is required for type ref (e.g. contact:mixin:Employee).");
    return { _class: "core:class:RefTo", to: opts.refClass, label: "core:string:Ref" };
  }
  return { _class: TYPE_CLASS[type] };
}
