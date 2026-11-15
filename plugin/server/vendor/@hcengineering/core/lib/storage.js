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
var storage_exports = {};
__export(storage_exports, {
  SortingOrder: () => SortingOrder,
  shouldShowArchived: () => shouldShowArchived
});
module.exports = __toCommonJS(storage_exports);
var SortingOrder = /* @__PURE__ */ ((SortingOrder2) => {
  SortingOrder2[SortingOrder2["Ascending"] = 1] = "Ascending";
  SortingOrder2[SortingOrder2["Descending"] = -1] = "Descending";
  return SortingOrder2;
})(SortingOrder || {});
function shouldShowArchived(query, options) {
  if (options?.showArchived !== void 0) {
    return options.showArchived;
  }
  if (query._id !== void 0 && typeof query._id === "string") {
    return true;
  }
  if (query.space !== void 0 && typeof query.space === "string") {
    return true;
  }
  return false;
}
__name(shouldShowArchived, "shouldShowArchived");
//# sourceMappingURL=storage.js.map
