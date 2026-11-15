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
var profiles_exports = {};
__export(profiles_exports, {
  ProfileSchema: () => ProfileSchema,
  loadProfiles: () => loadProfiles
});
module.exports = __toCommonJS(profiles_exports);
var import_node_fs = require("node:fs");
var import_zod = require("../vendor/zod/index.cjs");
const ProfileSchema = import_zod.z.strictObject({
  email: import_zod.z.string().min(3).optional(),
  password: import_zod.z.string().min(1).optional(),
  token: import_zod.z.string().min(10).optional(),
  workspace: import_zod.z.string().min(1).optional().describe("Pin one workspace"),
  toolsets: import_zod.z.string().min(1).optional().describe("Like HULY_TOOLSETS"),
  authToken: import_zod.z.string().min(16).optional().describe("Bearer token clients must send"),
  public: import_zod.z.boolean().optional().describe("No bearer token (protect the path elsewhere)")
});
const NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const ENV_FIELDS = [
  ["AUTH_TOKEN", "authToken"],
  ["PASSWORD", "password"],
  ["EMAIL", "email"],
  ["TOKEN", "token"],
  ["WORKSPACE", "workspace"],
  ["TOOLSETS", "toolsets"],
  ["PUBLIC", "public"]
];
function profilesFromVars(env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("MCP_PROFILE_") || value == null || value.trim() === "") continue;
    const rest = key.slice("MCP_PROFILE_".length);
    const field = ENV_FIELDS.find(([suffix]) => rest.endsWith(`_${suffix}`) && rest.length > suffix.length + 1);
    if (field == null) throw new Error(`${key}: unknown field \u2014 use MCP_PROFILE_<NAME>_${ENV_FIELDS.map(([s]) => s).join("|")}.`);
    const name = rest.slice(0, rest.length - field[0].length - 1).toLowerCase();
    const v = value.trim();
    if (field[1] === "public") {
      if (!["true", "1", "yes", "false", "0", "no"].includes(v.toLowerCase())) throw new Error(`${key}: use true or false.`);
      if (["false", "0", "no"].includes(v.toLowerCase())) continue;
    }
    ;
    (out[name] ??= {})[field[1]] = field[1] === "public" ? true : v;
  }
  return out;
}
function loadProfiles(env, read = (p) => (0, import_node_fs.readFileSync)(p, "utf8")) {
  const file = (env.MCP_PROFILES_FILE ?? "").trim();
  const inline = (env.MCP_PROFILES ?? "").trim();
  if (file !== "" && inline !== "") throw new Error("Set MCP_PROFILES_FILE or MCP_PROFILES, not both.");
  let raw = {};
  if (file !== "" || inline !== "") {
    try {
      raw = JSON.parse(file !== "" ? read(file) : inline);
    } catch (e) {
      throw new Error(`${file !== "" ? `MCP_PROFILES_FILE (${file})` : "MCP_PROFILES"} is not valid JSON: ${e.message}`);
    }
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) throw new Error('Profiles must be a JSON object: { "name": { "email": \u2026, "password": \u2026, "authToken": \u2026 } }.');
  }
  const fromVars = profilesFromVars(env);
  for (const name of Object.keys(fromVars)) {
    if (Object.hasOwn(raw, name)) throw new Error(`Profile '${name}' is defined twice (MCP_PROFILE_${name.toUpperCase()}_* and the JSON) \u2014 keep one.`);
  }
  const out = /* @__PURE__ */ new Map();
  for (const [name, value] of Object.entries({ ...raw, ...fromVars })) {
    if (!NAME.test(name)) throw new Error(`Profile name '${name}': use lowercase letters, digits, - and _ (it becomes the path /${name}/mcp).`);
    const parsed = ProfileSchema.safeParse(value);
    if (!parsed.success) throw new Error(`Profile '${name}': ${parsed.error.issues.map((i) => `${i.path.join(".") || "value"} ${i.message}`).join("; ")}.`);
    const p = parsed.data;
    if (p.token == null && (p.email == null || p.password == null)) throw new Error(`Profile '${name}': give "token", or "email" and "password".`);
    if (p.authToken == null && p.public !== true) throw new Error(`Profile '${name}': set "authToken" (at least 16 characters) \u2014 or "public": true if the path is protected elsewhere (e.g. Cloudflare Access).`);
    if (p.authToken != null && p.public === true) throw new Error(`Profile '${name}': "authToken" and "public": true exclude each other.`);
    out.set(name, p);
  }
  return out;
}
