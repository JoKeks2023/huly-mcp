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
var common_exports = {};
__export(common_exports, {
  flipSet: () => flipSet,
  groupByArray: () => groupByArray,
  groupByArrayAsync: () => groupByArrayAsync
});
module.exports = __toCommonJS(common_exports);
function groupByArray(array, keyProvider) {
  const result = /* @__PURE__ */ new Map();
  array.forEach((item) => {
    const key = keyProvider(item);
    if (!result.has(key)) {
      result.set(key, [item]);
    } else {
      result.get(key)?.push(item);
    }
  });
  return result;
}
__name(groupByArray, "groupByArray");
async function groupByArrayAsync(array, keyProvider) {
  const result = /* @__PURE__ */ new Map();
  for (const item of array) {
    const key = await keyProvider(item);
    if (!result.has(key)) {
      result.set(key, [item]);
    } else {
      result.get(key)?.push(item);
    }
  }
  return result;
}
__name(groupByArrayAsync, "groupByArrayAsync");
function flipSet(set, item) {
  if (set.has(item)) {
    set.delete(item);
  } else {
    set.add(item);
  }
  return set;
}
__name(flipSet, "flipSet");
//# sourceMappingURL=common.js.map
