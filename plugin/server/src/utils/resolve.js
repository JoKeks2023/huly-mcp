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
var resolve_exports = {};
__export(resolve_exports, {
  labelOf: () => labelOf,
  loadLabel: () => loadLabel,
  loadLabels: () => loadLabels,
  resolveObject: () => resolveObject
});
module.exports = __toCommonJS(resolve_exports);
var import_task = __toESM(require("../../vendor/@hcengineering/task/lib/index.js"));
var import_format = require("./format.js");
const TASK_ID = /^[A-Z][A-Z0-9]*-\d+$/;
function labelOf(doc) {
  if (doc == null) return "(deleted)";
  const title = doc.title ?? doc.name ?? doc.label;
  if (doc.identifier != null && title != null) return `${doc.identifier}: ${title}`;
  if (title != null && title !== "") return String(title);
  if (typeof doc.message === "string") return (0, import_format.markupToText)(doc.message).slice(0, 80);
  return String(doc._id);
}
async function loadLabel(client, _class, _id) {
  try {
    const doc = await client.findOne(_class, { _id });
    return labelOf(doc);
  } catch {
    return String(_id);
  }
}
async function loadLabels(client, refs) {
  const byClass = /* @__PURE__ */ new Map();
  for (const r of refs) byClass.set(r._class, (byClass.get(r._class) ?? /* @__PURE__ */ new Set()).add(r._id));
  const out = /* @__PURE__ */ new Map();
  await Promise.all([...byClass].map(async ([cls, ids]) => {
    let docs = [];
    try {
      docs = await client.findAll(cls, { _id: { $in: [...ids] } });
    } catch {
    }
    const found = new Map(docs.map((d) => [String(d._id), d]));
    for (const id of ids) out.set(`${cls}:${id}`, found.has(id) ? labelOf(found.get(id)) : "(deleted)");
  }));
  return out;
}
async function resolveObject(client, ref) {
  if (TASK_ID.test(ref)) {
    const doc2 = await client.findOne(import_task.default.class.Task, { identifier: ref });
    if (doc2 == null) throw new Error(`'${ref}' not found.`);
    return { _id: doc2._id, _class: doc2._class, space: doc2.space, label: labelOf(doc2), doc: doc2 };
  }
  const ctx = await client.findOne("notification:class:DocNotifyContext", { objectId: ref });
  const msg = ctx == null ? await client.findOne("activity:class:ActivityMessage", { attachedTo: ref }) : void 0;
  const _class = ctx?.objectClass ?? msg?.attachedToClass;
  if (_class == null) throw new Error(`Object '${ref}' not found (pass an issue id like PROJ-12 or an id from another tool).`);
  const doc = await client.findOne(_class, { _id: ref });
  return { _id: ref, _class, space: doc?.space ?? ctx?.objectSpace, label: labelOf(doc), doc };
}
