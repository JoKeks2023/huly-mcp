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
var ident_exports = {};
__export(ident_exports, {
  _parseId: () => _parseId
});
module.exports = __toCommonJS(ident_exports);
var import_status = require("./status.js");
var import_platform = __toESM(require("./platform.js"));
function _parseId(id) {
  const path = id.split(import_platform._ID_SEPARATOR);
  if (path.length < 3) {
    throw new import_status.PlatformError(new import_status.Status(import_status.Severity.ERROR, import_platform.default.status.InvalidId, { id }));
  }
  return {
    component: path[0],
    kind: path[1],
    name: path.slice(2).join(import_platform._ID_SEPARATOR)
  };
}
__name(_parseId, "_parseId");
//# sourceMappingURL=ident.js.map
