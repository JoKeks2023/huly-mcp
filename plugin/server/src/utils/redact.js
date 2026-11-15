var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var redact_exports = {};
__export(redact_exports, {
  redactSecrets: () => redactSecrets,
  routeConsoleToStderr: () => routeConsoleToStderr
});
module.exports = __toCommonJS(redact_exports);
const JWT = /eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g;
function redactSecrets(value) {
  if (typeof value === "string") return value.replace(JWT, "***");
  if (value instanceof Error) {
    const copy = new Error(redactSecrets(value.message));
    copy.stack = value.stack != null ? redactSecrets(value.stack) : void 0;
    return copy;
  }
  return value;
}
function routeConsoleToStderr() {
  const write = console.error.bind(console);
  const log = (...args) => {
    write(...args.map(redactSecrets));
  };
  console.log = console.info = console.debug = console.warn = console.error = log;
}
