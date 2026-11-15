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
var utils_exports = {};
__export(utils_exports, {
  getDirectChannel: () => getDirectChannel
});
module.exports = __toCommonJS(utils_exports);
var import_fast_equals = require("../../../fast-equals/dist/cjs/index.cjs");
var import_core = __toESM(require("../../core/lib/index.js"));
var import__ = __toESM(require("./index.js"));
async function getDirectChannel(client, me, employeeAccount) {
  const accIds = [me, employeeAccount].sort();
  const existingDms = await client.findAll(import__.default.class.DirectMessage, {});
  for (const dm of existingDms) {
    if ((0, import_fast_equals.deepEqual)(dm.members, accIds)) {
      return dm._id;
    }
  }
  return await client.createDoc(import__.default.class.DirectMessage, import_core.default.space.Space, {
    name: "",
    description: "",
    private: true,
    archived: false,
    members: accIds
  });
}
__name(getDirectChannel, "getDirectChannel");
//# sourceMappingURL=utils.js.map
