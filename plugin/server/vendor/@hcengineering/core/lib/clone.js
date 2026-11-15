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
var clone_exports = {};
__export(clone_exports, {
  clone: () => clone,
  getTypeOf: () => getTypeOf
});
module.exports = __toCommonJS(clone_exports);
const se = typeof Symbol !== "undefined";
const ste = se && typeof Symbol.toStringTag !== "undefined";
function getTypeOf(obj) {
  const typeofObj = typeof obj;
  if (typeofObj !== "object") {
    return typeofObj;
  }
  if (obj === null) {
    return "null";
  }
  if (Array.isArray(obj) && (!ste || !(Symbol.toStringTag in obj))) {
    return "Array";
  }
  let stringTag;
  if (ste) {
    try {
      stringTag = obj[Symbol.toStringTag];
    } catch {
      stringTag = void 0;
    }
  }
  if (typeof stringTag === "string") {
    return stringTag;
  }
  const objPrototype = Object.getPrototypeOf(obj);
  if (objPrototype === RegExp.prototype) {
    return "RegExp";
  }
  if (objPrototype === Date.prototype) {
    return "Date";
  }
  if (objPrototype === null) {
    return "Object";
  }
  try {
    return {}.toString.call(obj).slice(8, -1);
  } catch {
    return "Object";
  }
}
__name(getTypeOf, "getTypeOf");
function clone(obj, as, needAs, depth) {
  if (typeof obj === "undefined") {
    return void 0;
  }
  if (typeof obj === "function") {
    return obj;
  }
  if (depth === 0) {
    return obj;
  }
  depth = depth === void 0 ? depth : depth - 1;
  const typeOf = getTypeOf(obj);
  if (typeOf === "Date") {
    return new Date(obj.getTime());
  } else if (typeOf === "Array" || typeOf === "Object") {
    const isArray = Array.isArray(obj);
    const result = isArray ? [] : Object.assign({}, obj);
    for (const key in obj) {
      const value = obj[key];
      const type = getTypeOf(value);
      if (type === "Array") {
        result[key] = clone(value, as, needAs, depth);
      } else if (type === "Object") {
        const valClone = clone(value, as, needAs, depth);
        result[key] = valClone;
      } else if (type === "Date") {
        result[key] = new Date(value.getTime());
      } else {
        if (isArray) {
          result[key] = value;
        }
      }
    }
    if (typeOf === "Object") {
      const m = needAs?.(obj);
      return m !== void 0 && as !== void 0 ? as(result, m) : result;
    }
    return result;
  } else {
    return obj;
  }
}
__name(clone, "clone");
//# sourceMappingURL=clone.js.map
