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
var status_exports = {};
__export(status_exports, {
  ERROR: () => ERROR,
  OK: () => OK,
  PlatformError: () => PlatformError,
  Severity: () => Severity,
  Status: () => Status,
  UNAUTHORIZED: () => UNAUTHORIZED,
  unknownError: () => unknownError,
  unknownStatus: () => unknownStatus
});
module.exports = __toCommonJS(status_exports);
var import_platform = __toESM(require("./platform.js"));
var Severity = /* @__PURE__ */ ((Severity2) => {
  Severity2["OK"] = "OK";
  Severity2["INFO"] = "INFO";
  Severity2["WARNING"] = "WARNING";
  Severity2["ERROR"] = "ERROR";
  return Severity2;
})(Severity || {});
class Status {
  static {
    __name(this, "Status");
  }
  severity;
  code;
  params;
  constructor(severity, code, params) {
    this.severity = severity;
    this.code = code;
    this.params = params;
  }
}
class PlatformError extends Error {
  static {
    __name(this, "PlatformError");
  }
  status;
  constructor(status) {
    super(`${status.severity}: ${status.code} ${JSON.stringify(status.params)}`);
    this.status = status;
  }
}
const OK = new Status("OK" /* OK */, import_platform.default.status.OK, {});
const ERROR = new Status("ERROR" /* ERROR */, import_platform.default.status.BadError, {});
const UNAUTHORIZED = new Status("ERROR" /* ERROR */, import_platform.default.status.Unauthorized, {});
function unknownStatus(message) {
  return new Status("ERROR" /* ERROR */, import_platform.default.status.UnknownError, { message });
}
__name(unknownStatus, "unknownStatus");
function unknownError(err) {
  if (err instanceof PlatformError) return err.status;
  if (err instanceof Error) return unknownStatus(err.message);
  if (typeof err === "string") return unknownStatus(err);
  return ERROR;
}
__name(unknownError, "unknownError");
//# sourceMappingURL=status.js.map
