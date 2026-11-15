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
var operator_exports = {};
__export(operator_exports, {
  _getOperator: () => _getOperator,
  isOperator: () => isOperator
});
module.exports = __toCommonJS(operator_exports);
var import_analytics = require("../../analytics/lib/index.js");
function $push(document, keyval) {
  const doc = document;
  for (const key in keyval) {
    if (doc[key] === void 0) {
      doc[key] = [];
    }
    const kvk = keyval[key];
    if (typeof kvk === "object" && kvk != null) {
      const arr = doc[key];
      const desc = kvk;
      if ("$each" in desc) {
        if (arr != null && Array.isArray(arr)) {
          arr.splice(desc.$position ?? 0, 0, ...desc.$each);
        }
      } else {
        arr.push(kvk);
      }
    } else {
      if (doc[key] === null || doc[key] === void 0) {
        doc[key] = [kvk];
      } else {
        if (Array.isArray(doc[key])) {
          doc[key].push(kvk);
        } else {
          import_analytics.Analytics.handleError(new Error(`invalid array value: ${JSON.stringify(doc[key])} `));
          doc[key] = [kvk];
        }
      }
    }
  }
}
__name($push, "$push");
function $pull(document, keyval) {
  const doc = document;
  for (const key in keyval) {
    if (doc[key] === void 0) {
      doc[key] = [];
    }
    if (!Array.isArray(doc[key])) {
      import_analytics.Analytics.handleError(new Error(`$pull operation on non-array field: ${key}, value: ${JSON.stringify(doc[key])}`));
      doc[key] = [];
      continue;
    }
    const arr = doc[key];
    const kvk = keyval[key];
    if (typeof kvk === "object" && kvk !== null) {
      const { $in } = kvk;
      doc[key] = (arr ?? []).filter((val) => {
        if ($in !== void 0) {
          return !$in.includes(val);
        } else {
          for (const [kk, kv] of Object.entries(kvk)) {
            if (val[kk] !== kv) {
              return true;
            }
          }
          return false;
        }
      });
    } else {
      doc[key] = (arr ?? []).filter((val) => val !== kvk);
    }
  }
}
__name($pull, "$pull");
function matchArrayElement(docs, query) {
  let result = [...docs];
  for (const key in query) {
    const value = query[key];
    const tresult = [];
    for (const object of result) {
      const val = object[key];
      if (val === value) {
        tresult.push(object);
      }
    }
    result = tresult;
    if (tresult.length === 0) {
      break;
    }
  }
  return result;
}
__name(matchArrayElement, "matchArrayElement");
function $update(document, keyval) {
  const doc = document;
  for (const key in keyval) {
    if (doc[key] === void 0) {
      doc[key] = [];
    }
    if (!Array.isArray(doc[key])) {
      import_analytics.Analytics.handleError(
        new Error(`$update operation on non-array field: ${key}, value: ${JSON.stringify(doc[key])}`)
      );
      doc[key] = [];
      continue;
    }
    const val = keyval[key];
    if (typeof val === "object") {
      const arr = doc[key];
      const desc = val;
      for (const m of matchArrayElement(arr, desc.$query)) {
        for (const [k, v] of Object.entries(desc.$update)) {
          m[k] = v;
        }
      }
    }
  }
}
__name($update, "$update");
function $inc(document, keyval) {
  const doc = document;
  for (const key in keyval) {
    const cur = doc[key] ?? 0;
    if (typeof cur !== "number" || isNaN(cur)) {
      import_analytics.Analytics.handleError(
        new Error(`$inc operation on non-numeric field: ${key}, value: ${JSON.stringify(doc[key])}`)
      );
      doc[key] = keyval[key];
      continue;
    }
    const increment = keyval[key];
    if (typeof increment !== "number" || isNaN(increment)) {
      import_analytics.Analytics.handleError(
        new Error(`$inc operation with invalid increment: ${key}, increment: ${JSON.stringify(increment)}`)
      );
      continue;
    }
    doc[key] = cur + increment;
  }
}
__name($inc, "$inc");
function $unset(document, keyval) {
  const doc = document;
  for (const key in keyval) {
    if (doc[key] !== void 0) {
      delete doc[key];
    }
  }
}
__name($unset, "$unset");
function $rename(document, keyval) {
  const doc = document;
  for (const key in keyval) {
    if (doc[key] !== void 0) {
      doc[keyval[key]] = doc[key];
      delete doc[key];
    }
  }
}
__name($rename, "$rename");
const operators = {
  $push,
  $pull,
  $update,
  $inc,
  $unset,
  $rename
};
function isOperator(o) {
  if (o === null || typeof o !== "object") {
    return false;
  }
  const keys = Object.keys(o);
  return keys.length > 0 && keys.every((key) => key.startsWith("$"));
}
__name(isOperator, "isOperator");
function _getOperator(name) {
  const operator = operators[name];
  if (operator === void 0) throw new Error("unknown operator: " + name);
  return operator;
}
__name(_getOperator, "_getOperator");
//# sourceMappingURL=operator.js.map
