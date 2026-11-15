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
var node_globals_exports = {};
__export(node_globals_exports, {
  hideWebStorage: () => hideWebStorage
});
module.exports = __toCommonJS(node_globals_exports);
function hideWebStorage(g = globalThis) {
  for (const name of ["sessionStorage", "localStorage"]) {
    if (typeof g.window !== "undefined") return;
    try {
      Object.defineProperty(g, name, { value: void 0, configurable: true, writable: true, enumerable: false });
    } catch {
    }
  }
}
hideWebStorage();
