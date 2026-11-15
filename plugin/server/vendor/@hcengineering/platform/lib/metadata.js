"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
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
var metadata_exports = {};
__export(metadata_exports, {
  getMetadata: () => getMetadata,
  loadMetadata: () => loadMetadata,
  setMetadata: () => setMetadata
});
module.exports = __toCommonJS(metadata_exports);
const metadata = /* @__PURE__ */ new Map();
function getMetadata(id) {
  return metadata.get(id);
}
__name(getMetadata, "getMetadata");
function setMetadata(id, value) {
  metadata.set(id, value);
}
__name(setMetadata, "setMetadata");
function loadMetadata(ids, data) {
  for (const key in ids) {
    const id = ids[key];
    const resource = data[key];
    if (resource === void 0) {
      throw new Error(`no metadata provided, key: ${key}, id: ${String(id)}`);
    }
    metadata.set(id, resource);
  }
}
__name(loadMetadata, "loadMetadata");
//# sourceMappingURL=metadata.js.map
