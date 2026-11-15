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
var labels_exports = {};
__export(labels_exports, {
  findByLabel: () => findByLabel
});
module.exports = __toCommonJS(labels_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
const KIND = {
  component: { cls: import_tracker.default.class.Component, what: "Component" },
  milestone: { cls: import_tracker.default.class.Milestone, what: "Milestone" }
};
async function findByLabel(client, kind, space, label, projectKey) {
  const { cls, what } = KIND[kind];
  const all = await client.findAll(cls, { space });
  const q = label.trim().toLowerCase();
  const where = projectKey != null ? ` in project ${projectKey}` : " in this project";
  const exact = all.filter((d) => String(d.label).toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) throw new Error(`${what} name '${label}' is ambiguous${where} (${exact.length} with that name).`);
  const partial = q.length >= 2 ? all.filter((d) => String(d.label).toLowerCase().includes(q)) : [];
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) throw new Error(`${what} '${label}' matches several${where}: ${partial.map((d) => d.label).join(", ")}. Use the full name.`);
  const names = all.map((d) => d.label).slice(0, 20);
  throw new Error(`${what} '${label}' not found${where}. ${names.length > 0 ? `Available: ${names.join(", ")}.` : `The project has no ${kind}s yet.`}`);
}
