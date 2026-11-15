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
var workspaces_exports = {};
__export(workspaces_exports, {
  listWorkspaces: () => listWorkspaces
});
module.exports = __toCommonJS(workspaces_exports);
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
const listWorkspaces = (0, import_errors.wrapToolHandler)(async () => {
  const workspaces = await (0, import_connection.listWorkspaces)();
  if (workspaces.length === 0) return "No Huly workspaces are accessible with these credentials.";
  const lines = workspaces.map((w) => {
    const flags = [
      w.isDisabled === true ? "disabled" : null,
      w.mode != null && w.mode !== "active" ? `mode: ${w.mode}` : null
    ].filter(Boolean);
    return `- **${w.name}** \u2014 slug: \`${w.url}\` \u2014 id: \`${w.uuid}\`${flags.length > 0 ? ` (${flags.join(", ")})` : ""}`;
  });
  return `## Workspaces (${workspaces.length})

${lines.join("\n")}

Pass the slug (or name/id) as \`workspace\` to other tools.`;
});
