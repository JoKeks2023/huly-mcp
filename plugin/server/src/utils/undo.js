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
var undo_exports = {};
__export(undo_exports, {
  addEntry: () => addEntry,
  dataOf: () => dataOf,
  isCounterOnly: () => isCounterOnly,
  isRecording: () => isRecording,
  journalOf: () => journalOf,
  labelOf: () => labelOf,
  recordChanges: () => recordChanges,
  recordingClient: () => recordingClient,
  restoreUpdate: () => restoreUpdate,
  touchedFields: () => touchedFields
});
module.exports = __toCommonJS(undo_exports);
var import_node_async_hooks = require("node:async_hooks");
const recording = new import_node_async_hooks.AsyncLocalStorage();
const journals = /* @__PURE__ */ new WeakMap();
const MAX_ENTRIES = 50;
let nextId = 1;
function journalOf(owner) {
  let j = journals.get(owner);
  if (j == null) {
    j = [];
    journals.set(owner, j);
  }
  return j;
}
function isRecording() {
  return recording.getStore() != null;
}
const SYSTEM = /* @__PURE__ */ new Set(["_id", "_class", "space", "modifiedOn", "modifiedBy", "createdOn", "createdBy", "attachedTo", "attachedToClass", "collection", "%hash%"]);
const isMixinKey = (k) => k.includes(":mixin:");
function labelOf(doc, fallback) {
  if (doc == null) return fallback;
  if (typeof doc.identifier === "string") return doc.title != null ? `${doc.identifier}: ${String(doc.title)}` : doc.identifier;
  const name = doc.title ?? doc.name ?? doc.label ?? (typeof doc.message === "string" ? doc.message.slice(0, 40) : void 0);
  return name != null ? String(name) : fallback;
}
function isCounterOnly(ops) {
  const keys = Object.keys(ops ?? {});
  return keys.length > 0 && keys.every((k) => k === "$inc");
}
function touchedFields(ops) {
  const out = /* @__PURE__ */ new Set();
  for (const [k, v] of Object.entries(ops ?? {})) {
    if (k.startsWith("$")) {
      if (v != null && typeof v === "object") for (const f of Object.keys(v)) out.add(f);
    } else out.add(k);
  }
  return [...out];
}
function restoreUpdate(before, fields) {
  const out = {};
  for (const f of fields) out[f] = before?.[f] === void 0 ? null : before[f];
  return out;
}
function dataOf(doc) {
  const data = {};
  const mixins = {};
  for (const [k, v] of Object.entries(doc ?? {})) {
    if (SYSTEM.has(k)) continue;
    if (isMixinKey(k) && v != null && typeof v === "object") mixins[k] = v;
    else data[k] = v;
  }
  return { data, mixins };
}
function recordingClient(client) {
  const rec = recording.getStore();
  if (rec == null) return client;
  const c = client;
  const find = async (_class, _id) => await c.findOne(_class, { _id }).catch(() => void 0);
  const note = (step) => {
    rec.steps.push(step);
  };
  const wrap = (target) => new Proxy(target, {
    get(t, prop, receiver) {
      const orig = Reflect.get(t, prop, receiver);
      if (typeof orig !== "function") return orig;
      switch (prop) {
        case "createDoc":
          return async (_class, space, attrs, id, ...rest) => {
            const ref = await orig.call(t, _class, space, attrs, id, ...rest);
            note({ kind: "created", method: "removeDoc", args: [_class, space, ref], target: { _class, _id: ref, label: labelOf(attrs, ref) } });
            return ref;
          };
        case "addCollection":
          return async (_class, space, attachedTo, attachedToClass, collection, attrs, id, ...rest) => {
            const ref = await orig.call(t, _class, space, attachedTo, attachedToClass, collection, attrs, id, ...rest);
            note({ kind: "created", method: "removeCollection", args: [_class, space, ref, attachedTo, attachedToClass, collection], target: { _class, _id: ref, label: labelOf(attrs, ref) } });
            return ref;
          };
        case "updateDoc":
          return async (_class, space, objectId, ops, ...rest) => {
            if (isCounterOnly(ops)) return await orig.call(t, _class, space, objectId, ops, ...rest);
            const before = await find(_class, objectId);
            const fields = touchedFields(ops);
            const res = await orig.call(t, _class, space, objectId, ops, ...rest);
            note({ kind: "changed", method: "updateDoc", args: [_class, space, objectId, restoreUpdate(before, fields)], target: { _class, _id: objectId, label: labelOf(before, objectId) }, fields });
            return res;
          };
        case "updateCollection":
          return async (_class, space, objectId, attachedTo, attachedToClass, collection, ops, ...rest) => {
            const before = await find(_class, objectId);
            const fields = touchedFields(ops);
            const res = await orig.call(t, _class, space, objectId, attachedTo, attachedToClass, collection, ops, ...rest);
            note({ kind: "changed", method: "updateDoc", args: [_class, space, objectId, restoreUpdate(before, fields)], target: { _class, _id: objectId, label: labelOf(before, objectId) }, fields });
            return res;
          };
        case "update":
          return async (doc, ops, ...rest) => {
            if (isCounterOnly(ops)) return await orig.call(t, doc, ops, ...rest);
            const before = await find(doc._class, doc._id) ?? doc;
            const fields = touchedFields(ops);
            const res = await orig.call(t, doc, ops, ...rest);
            note({ kind: "changed", method: "updateDoc", args: [doc._class, before.space ?? doc.space, doc._id, restoreUpdate(before, fields)], target: { _class: doc._class, _id: doc._id, label: labelOf(before, doc._id) }, fields });
            return res;
          };
        case "removeDoc":
          return async (_class, space, objectId, ...rest) => {
            const before = await find(_class, objectId);
            const res = await orig.call(t, _class, space, objectId, ...rest);
            if (before != null) {
              const { data, mixins } = dataOf(before);
              note({ kind: "deleted", method: "createDoc", args: [before._class, before.space, data, objectId, mixins], target: { _class: before._class, _id: objectId, label: labelOf(before, objectId) } });
            }
            return res;
          };
        case "removeCollection":
          return async (_class, space, objectId, attachedTo, attachedToClass, collection, ...rest) => {
            const before = await find(_class, objectId);
            const res = await orig.call(t, _class, space, objectId, attachedTo, attachedToClass, collection, ...rest);
            if (before != null) {
              const { data, mixins } = dataOf(before);
              note({ kind: "deleted", method: "addCollection", args: [before._class, before.space, attachedTo, attachedToClass, collection, data, objectId, mixins], target: { _class: before._class, _id: objectId, label: labelOf(before, objectId) } });
            }
            return res;
          };
        case "remove":
          return async (doc, ...rest) => {
            const before = await find(doc._class, doc._id) ?? doc;
            const res = await orig.call(t, doc, ...rest);
            const { data, mixins } = dataOf(before);
            if (before.attachedTo != null && before.collection != null) {
              note({ kind: "deleted", method: "addCollection", args: [before._class, before.space, before.attachedTo, before.attachedToClass, before.collection, data, doc._id, mixins], target: { _class: before._class, _id: doc._id, label: labelOf(before, doc._id) } });
            } else {
              note({ kind: "deleted", method: "createDoc", args: [before._class, before.space, data, doc._id, mixins], target: { _class: before._class, _id: doc._id, label: labelOf(before, doc._id) } });
            }
            return res;
          };
        case "createMixin":
        case "updateMixin":
          return async (objectId, objectClass, objectSpace, mixin, attrs, ...rest) => {
            const before = await find(objectClass, objectId);
            const fields = touchedFields(attrs);
            const res = await orig.call(t, objectId, objectClass, objectSpace, mixin, attrs, ...rest);
            note({ kind: "changed", method: "updateMixin", args: [objectId, objectClass, objectSpace, mixin, restoreUpdate(before?.[mixin], fields)], target: { _class: objectClass, _id: objectId, label: labelOf(before, objectId) }, fields: fields.map((f) => `${mixin.split(":").pop() ?? mixin}.${f}`) });
            return res;
          };
        case "apply":
          return (...args) => wrap(orig.apply(t, args));
        default:
          return orig.bind(t);
      }
    }
  });
  return wrap(c);
}
async function recordChanges(fn) {
  const rec = { steps: [] };
  return await recording.run(rec, async () => {
    try {
      return { result: await fn(), steps: rec.steps };
    } catch (error) {
      return { error, steps: rec.steps };
    }
  });
}
function addEntry(owner, entry) {
  const journal = journalOf(owner);
  const full = { ...entry, id: nextId++ };
  journal.push(full);
  if (journal.length > MAX_ENTRIES) journal.splice(0, journal.length - MAX_ENTRIES);
  return full;
}
