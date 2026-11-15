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
var errors_exports = {};
__export(errors_exports, {
  HulyMcpError: () => HulyMcpError,
  wrapToolHandler: () => wrapToolHandler
});
module.exports = __toCommonJS(errors_exports);
class HulyMcpError extends Error {
  constructor(message) {
    super(message);
    this.name = "HulyMcpError";
  }
}
function wrapToolHandler(handler) {
  return async (args) => {
    try {
      const text = await handler(args);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message.startsWith("Huly MCP: ") ? message : `Huly MCP: ${message}`);
    }
  };
}
