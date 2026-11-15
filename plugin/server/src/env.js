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
var env_exports = {};
__export(env_exports, {
  normalizeEnv: () => normalizeEnv
});
module.exports = __toCommonJS(env_exports);
const OPTION = "CLAUDE_PLUGIN_OPTION_";
const unset = (v) => v == null || v.trim() === "" || /^\$\{[^}]*\}$/.test(v.trim());
function normalizeEnv(env = process.env) {
  let plugin = false;
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(`${OPTION}HULY_`)) continue;
    plugin = true;
    const target = key.slice(OPTION.length);
    if (!unset(value) && unset(env[target])) env[target] = value;
  }
  if (plugin && unset(env.HULY_ANNOTATIONS)) env.HULY_ANNOTATIONS = "1";
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("HULY_") || value == null) continue;
    const v = value.trim();
    if (unset(v)) delete env[key];
    else if (v !== value) env[key] = v;
  }
}
