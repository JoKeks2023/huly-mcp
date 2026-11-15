"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var index_exports = {};
__export(index_exports, {
  configUserAccountUuid: () => import_component2.configUserAccountUuid,
  coreId: () => import_component2.coreId,
  default: () => index_default,
  readOnlyGuestAccountUuid: () => import_component2.readOnlyGuestAccountUuid,
  systemAccount: () => import_component2.systemAccount,
  systemAccountEmail: () => import_component2.systemAccountEmail,
  systemAccountUuid: () => import_component2.systemAccountUuid
});
module.exports = __toCommonJS(index_exports);
var import_component = __toESM(require("./component.js"));
__reExport(index_exports, require("./classes.js"), module.exports);
__reExport(index_exports, require("./client.js"), module.exports);
__reExport(index_exports, require("./collaboration.js"), module.exports);
var import_component2 = require("./component.js");
__reExport(index_exports, require("./hierarchy.js"), module.exports);
__reExport(index_exports, require("../../measurements/lib/index.js"), module.exports);
__reExport(index_exports, require("./memdb.js"), module.exports);
__reExport(index_exports, require("./objvalue.js"), module.exports);
__reExport(index_exports, require("./operations.js"), module.exports);
__reExport(index_exports, require("./operator.js"), module.exports);
__reExport(index_exports, require("./query.js"), module.exports);
__reExport(index_exports, require("./server.js"), module.exports);
__reExport(index_exports, require("./storage.js"), module.exports);
__reExport(index_exports, require("./tx.js"), module.exports);
__reExport(index_exports, require("./utils.js"), module.exports);
__reExport(index_exports, require("./backup.js"), module.exports);
__reExport(index_exports, require("./status.js"), module.exports);
__reExport(index_exports, require("./clone.js"), module.exports);
__reExport(index_exports, require("./common.js"), module.exports);
__reExport(index_exports, require("./time.js"), module.exports);
__reExport(index_exports, require("./benchmark.js"), module.exports);
__reExport(index_exports, require("./collaborators.js"), module.exports);
__reExport(index_exports, require("./versioning.js"), module.exports);
var index_default = import_component.default;
//# sourceMappingURL=index.js.map
