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
var objvalue_exports = {};
__export(objvalue_exports, {
  getObjectValue: () => getObjectValue,
  setObjectValue: () => setObjectValue
});
module.exports = __toCommonJS(objvalue_exports);
var import_platform = require("../../platform/lib/index.js");
var import_clone = require("./clone.js");
var import_component = __toESM(require("./component.js"));
function getObjectValue(key, doc) {
  if (key.length === 0) {
    return doc;
  }
  key = key.split("\\$").join("$");
  const dots = key.split(".");
  let pos = 0;
  let value = doc;
  for (const d of dots) {
    if (Array.isArray(value) && isNestedArrayQuery(value, d)) {
      return getNestedArrayValue(value, dots.slice(pos).join("."));
    }
    value = value?.[d];
    pos++;
  }
  return value;
}
__name(getObjectValue, "getObjectValue");
function setObjectValue(key, doc, newValue) {
  if (key.length === 0) {
    return;
  }
  key = key.split("\\$").join("$");
  let dots = key.split(".");
  const last = dots[dots.length - 1];
  dots = dots.slice(0, -1);
  let value = doc;
  for (const d of dots) {
    if (Array.isArray(value) && isNestedArrayQuery(value, d)) {
      throw new import_platform.PlatformError(new import_platform.Status(import_platform.Severity.ERROR, import_component.default.status.ObjectNotFound, { _id: "dots" }));
    }
    const lvalue = value?.[d];
    if (lvalue === void 0) {
      value[d] = {};
      value = value?.[d];
    } else {
      value = lvalue;
    }
  }
  value[last] = (0, import_clone.clone)(newValue);
  return value;
}
__name(setObjectValue, "setObjectValue");
function isNestedArrayQuery(value, d) {
  return Number.isNaN(Number.parseInt(d)) && value?.[d] === void 0;
}
__name(isNestedArrayQuery, "isNestedArrayQuery");
function getNestedArrayValue(value, name) {
  const result = [];
  for (const v of value) {
    result.push(...arrayOrValue(getObjectValue(name, v)));
  }
  return result;
}
__name(getNestedArrayValue, "getNestedArrayValue");
function arrayOrValue(vv) {
  return Array.isArray(vv) ? vv : [vv];
}
__name(arrayOrValue, "arrayOrValue");
//# sourceMappingURL=objvalue.js.map
