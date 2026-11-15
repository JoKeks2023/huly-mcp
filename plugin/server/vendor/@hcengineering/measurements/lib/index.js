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
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var index_exports = {};
__export(index_exports, {
  platformNow: () => platformNow,
  platformNowDiff: () => platformNowDiff
});
module.exports = __toCommonJS(index_exports);
__reExport(index_exports, require("./context.js"), module.exports);
__reExport(index_exports, require("./metrics.js"), module.exports);
const platformNow = /* @__PURE__ */ __name(() => performance.now(), "platformNow");
const platformNowDiff = /* @__PURE__ */ __name((old) => Math.round((performance.now() - old) * 100) / 100, "platformNowDiff");
//# sourceMappingURL=index.js.map
