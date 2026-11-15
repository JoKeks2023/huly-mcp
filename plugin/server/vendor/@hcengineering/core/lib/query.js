"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var query_exports = {};
__export(query_exports, {
  checkMixinKey: () => checkMixinKey,
  findProperty: () => findProperty,
  matchQuery: () => matchQuery,
  resultSort: () => resultSort
});
module.exports = __toCommonJS(query_exports);
var import_component = __toESM(require("./component.js"));
var import_objvalue = require("./objvalue.js");
var import_predicate = require("./predicate.js");
function findProperty(objects, propertyKey, value) {
  if ((0, import_predicate.isPredicate)(value)) {
    const preds = (0, import_predicate.createPredicates)(value, propertyKey);
    for (const pred of preds) {
      objects = pred(objects);
    }
    return objects;
  }
  const result = [];
  for (const object of objects) {
    const val = (0, import_objvalue.getObjectValue)(propertyKey, object);
    if (val === value || val == null && value == null || isArrayValueCheck(val, value)) {
      result.push(object);
    }
  }
  return result;
}
__name(findProperty, "findProperty");
function isArrayValueCheck(val, value) {
  return Array.isArray(val) && !Array.isArray(value) && val.includes(value);
}
__name(isArrayValueCheck, "isArrayValueCheck");
function getEnumValue(key, _class, hierarchy, obj, _enum) {
  const tkey = checkMixinKey(key, _class, hierarchy);
  const value = (0, import_objvalue.getObjectValue)(tkey, obj);
  const index = _enum.enumValues.findIndex((p) => p === value);
  return index === -1 ? _enum.enumValues.length : index;
}
__name(getEnumValue, "getEnumValue");
function resultSort(result, sortOptions, _class, hierarchy, modelDb) {
  const enums = getEnums(_class, sortOptions, hierarchy, modelDb);
  const sortFunc = /* @__PURE__ */ __name((a, b) => {
    for (const key in sortOptions) {
      const _enum = enums[key];
      const aValue = _enum !== void 0 ? getEnumValue(key, _class, hierarchy, a, _enum) : getValue(key, a, _class, hierarchy);
      const bValue = _enum !== void 0 ? getEnumValue(key, _class, hierarchy, b, _enum) : getValue(key, b, _class, hierarchy);
      const result2 = getSortingResult(aValue, bValue, sortOptions[key]);
      if (result2 !== 0) return result2;
    }
    return 0;
  }, "sortFunc");
  result.sort(sortFunc);
}
__name(resultSort, "resultSort");
function mapSortingValue(order, val) {
  if (typeof order !== "object") {
    return val;
  }
  for (const r of order.cases) {
    if (typeof r.query === "object") {
      const q = r.query;
      if (q.$in?.includes(val) ?? false) {
        return r.index;
      }
      if (q.$nin !== void 0 && !q.$nin.includes(val)) {
        return r.index;
      }
      if (q.$ne !== void 0 && q.$ne !== val) {
        return r.index;
      }
    }
    if (r.query === val) {
      return r.index;
    }
  }
}
__name(mapSortingValue, "mapSortingValue");
function getSortingResult(aValue, bValue, order) {
  let res = 0;
  if (typeof aValue === "undefined") {
    return typeof bValue === "undefined" ? 0 : -1;
  }
  if (typeof bValue === "undefined") {
    return 1;
  }
  const orderOrder = typeof order === "object" ? order.order : order;
  if (Array.isArray(aValue) && Array.isArray(bValue)) {
    res = (aValue.map((it) => mapSortingValue(order, it)).sort((a, b) => (a - b) * orderOrder)[0] ?? 0) - (bValue.map((it) => mapSortingValue(order, it)).sort((a, b) => (a - b) * orderOrder)[0] ?? 0);
  } else {
    const aaValue = mapSortingValue(order, aValue);
    const bbValue = mapSortingValue(order, bValue);
    res = typeof aaValue === "string" ? aaValue.localeCompare(bbValue) : aaValue - bbValue;
  }
  return res * orderOrder;
}
__name(getSortingResult, "getSortingResult");
function getEnums(_class, sortOptions, hierarchy, modelDb) {
  const res = {};
  for (const key in sortOptions) {
    const attr = hierarchy.findAttribute(_class, key);
    if (attr !== void 0) {
      if (attr !== void 0) {
        if (attr.type._class === import_component.default.class.EnumOf) {
          const ref = attr.type.of;
          const enu = modelDb.findAllSync(import_component.default.class.Enum, { _id: ref });
          res[key] = enu[0];
        }
      }
    }
  }
  return res;
}
__name(getEnums, "getEnums");
function getValue(key, obj, _class, hierarchy) {
  const tkey = checkMixinKey(key, _class, hierarchy);
  let value = (0, import_objvalue.getObjectValue)(tkey, obj);
  if (typeof value === "object" && !Array.isArray(value)) {
    value = JSON.stringify(value);
  }
  return value;
}
__name(getValue, "getValue");
function matchQuery(docs, query, clazz, hierarchy, skipLookup = false) {
  const baseClass = hierarchy.getBaseClass(clazz);
  let result = docs.filter((r) => hierarchy.isDerived(r._class, baseClass));
  if (baseClass !== clazz) {
    result = docs.filter((r) => hierarchy.hasMixin(r, clazz));
  }
  for (const key in query) {
    if (skipLookup && key.startsWith("$lookup.")) {
      continue;
    }
    const value = query[key];
    const tkey = checkMixinKey(key, clazz, hierarchy);
    result = findProperty(result, tkey, value);
    if (result.length === 0) {
      break;
    }
  }
  return result;
}
__name(matchQuery, "matchQuery");
function checkMixinKey(key, clazz, hierarchy) {
  if (!key.includes(".")) {
    try {
      const attr = hierarchy.findAttribute(clazz, key);
      if (attr !== void 0 && hierarchy.isMixin(attr.attributeOf)) {
        key = attr.attributeOf + "." + key;
      }
    } catch (err) {
    }
  }
  return key;
}
__name(checkMixinKey, "checkMixinKey");
//# sourceMappingURL=query.js.map
