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
var predicate_exports = {};
__export(predicate_exports, {
  createPredicates: () => createPredicates,
  isPredicate: () => isPredicate
});
module.exports = __toCommonJS(predicate_exports);
var import_objvalue = require("./objvalue.js");
var import_utils = require("./utils.js");
var import_fast_equals = require("../../../fast-equals/dist/cjs/index.cjs");
function execPredicate(docs, propertyKey, pred) {
  const result = [];
  for (const doc of docs) {
    const value = (0, import_objvalue.getObjectValue)(propertyKey, doc);
    if (pred(value)) {
      result.push(doc);
    }
  }
  return result;
}
__name(execPredicate, "execPredicate");
const predicates = {
  $in: /* @__PURE__ */ __name((o, propertyKey) => {
    if (!Array.isArray(o)) {
      throw new Error("$in predicate requires array");
    }
    return (docs) => execPredicate(docs, propertyKey, (value) => {
      if (Array.isArray(value)) {
        return o.some((p) => value.includes(p));
      } else {
        return o.some((p) => p == value);
      }
    });
  }, "$in"),
  $all: /* @__PURE__ */ __name((o, propertyKey) => {
    if (!Array.isArray(o)) {
      throw new Error("$all predicate requires array");
    }
    return (docs) => execPredicate(docs, propertyKey, (value) => {
      for (const val of o) {
        if (!value.includes(val)) return false;
      }
      return true;
    });
  }, "$all"),
  $nin: /* @__PURE__ */ __name((o, propertyKey) => {
    if (!Array.isArray(o)) {
      throw new Error("$nin predicate requires array");
    }
    return (docs) => execPredicate(docs, propertyKey, (value) => {
      if (Array.isArray(value)) {
        return !o.some((p) => value.includes(p));
      } else {
        return !o.some((p) => p == value);
      }
    });
  }, "$nin"),
  $like: /* @__PURE__ */ __name((query, propertyKey) => {
    const searchString = query.split("%").map((it) => (0, import_utils.escapeLikeForRegexp)(it)).join(".*");
    const regex = RegExp(`^${searchString}$`, "i");
    return (docs) => execPredicate(docs, propertyKey, (value) => regex.test(value));
  }, "$like"),
  $regex: /* @__PURE__ */ __name((o, propertyKey) => {
    const re = new RegExp(o.$regex, o.$options);
    return (docs) => execPredicate(docs, propertyKey, (value) => value.match(re) !== null);
  }, "$regex"),
  $gt: /* @__PURE__ */ __name((o, propertyKey) => {
    return (docs) => execPredicate(docs, propertyKey, (value) => value > o);
  }, "$gt"),
  $gte: /* @__PURE__ */ __name((o, propertyKey) => {
    return (docs) => execPredicate(docs, propertyKey, (value) => value >= o);
  }, "$gte"),
  $lt: /* @__PURE__ */ __name((o, propertyKey) => {
    return (docs) => execPredicate(docs, propertyKey, (value) => value < o);
  }, "$lt"),
  $lte: /* @__PURE__ */ __name((o, propertyKey) => {
    return (docs) => execPredicate(docs, propertyKey, (value) => value <= o);
  }, "$lte"),
  $exists: /* @__PURE__ */ __name((o, propertyKey) => {
    return (docs) => execPredicate(docs, propertyKey, (value) => value !== void 0 === o);
  }, "$exists"),
  $ne: /* @__PURE__ */ __name((o, propertyKey) => {
    return (docs) => execPredicate(docs, propertyKey, (value) => o != null ? !(0, import_fast_equals.deepEqual)(o, value) : value != null);
  }, "$ne"),
  $size: /* @__PURE__ */ __name((o, propertyKey) => {
    return (docs) => execPredicate(docs, propertyKey, (value) => {
      if (value == null) {
        return false;
      }
      if (!Array.isArray(value)) {
        throw new Error("$size predicate requires array");
      }
      if (typeof o === "number") {
        return value.length === o;
      }
      if (typeof o === "object" && o.$gt !== void 0) {
        return value.length > o.$gt;
      }
      if (typeof o === "object" && o.$gte !== void 0) {
        return value.length >= o.$gte;
      }
      if (typeof o === "object" && o.$lt !== void 0) {
        return value.length < o.$lt;
      }
      if (typeof o === "object" && o.$lte !== void 0) {
        return value.length <= o.$lte;
      }
      return false;
    });
  }, "$size")
};
function isPredicate(o) {
  if (o === null || typeof o !== "object") {
    return false;
  }
  const keys = Object.keys(o);
  return keys.length > 0 && keys.every((key) => key.startsWith("$"));
}
__name(isPredicate, "isPredicate");
function createPredicates(o, propertyKey) {
  const keys = Object.keys(o);
  const result = [];
  for (const key of keys) {
    const factory = predicates[key];
    if (factory === void 0) throw new Error("unknown predicate: " + keys[0]);
    result.push(factory(o[key], propertyKey));
  }
  return result;
}
__name(createPredicates, "createPredicates");
//# sourceMappingURL=predicate.js.map
