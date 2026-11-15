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
var diagnostics_exports = {};
__export(diagnostics_exports, {
  checkSetup: () => checkSetup,
  checkSetupReport: () => checkSetupReport,
  hostOf: () => hostOf,
  isNewer: () => isNewer,
  packageVersion: () => packageVersion
});
module.exports = __toCommonJS(diagnostics_exports);
var import_fs = require("fs");
var import_version = require("../version.js");
var import_path = require("path");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
const TIMEOUT_MS = 5e3;
function packageVersion() {
  let dir = __dirname;
  for (let i = 0; i < 4; i++) {
    try {
      const pkg = JSON.parse((0, import_fs.readFileSync)((0, import_path.join)(dir, "package.json"), "utf8"));
      if (pkg.name === "huly-mcp-selfhost") return pkg.version;
    } catch {
    }
    dir = (0, import_path.join)(dir, "..");
  }
  return import_version.VERSION;
}
function hostOf(url) {
  if (url == null || url.trim() === "") return void 0;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "(not a URL)";
  }
}
function isNewer(latest, current) {
  const a = latest.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}
async function latestVersion() {
  try {
    const res = await fetch("https://registry.npmjs.org/huly-mcp-selfhost/latest", { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? (await res.json()).version : void 0;
  } catch {
    return void 0;
  }
}
async function reachable(url) {
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.status < 500 ? "ok" : `HTTP ${res.status}`;
  } catch (e) {
    const err = e;
    return err.name === "TimeoutError" ? `no answer within ${TIMEOUT_MS / 1e3}s` : err.cause?.code ?? err.message;
  }
}
async function checkSetupReport(args, env) {
  const set = (k) => (env[k] ?? "").trim() !== "";
  const lines = [];
  const ok = (t) => {
    lines.push(`\u2705 ${t}`);
  };
  const warn = (t) => {
    lines.push(`\u26A0\uFE0F ${t}`);
  };
  const fail = (t) => {
    lines.push(`\u274C ${t}`);
  };
  const version = packageVersion();
  const [latest, frontStatus] = await Promise.all([
    args.skipVersionCheck === true ? Promise.resolve(void 0) : latestVersion(),
    set("HULY_FRONT_URL") ? reachable(env.HULY_FRONT_URL) : Promise.resolve(void 0)
  ]);
  if (latest != null && isNewer(latest, version)) warn(`Version ${version} \u2014 ${latest} is available (npx -y huly-mcp-selfhost@latest, or update the plugin / Docker image)`);
  else ok(`Version ${version}${latest != null ? " (latest)" : ""}, Node.js ${process.versions.node}`);
  if (Number(process.versions.node.split(".")[0]) < 22) warn(`Node.js ${process.versions.node} is older than the supported 22 \u2014 update Node.js (huly-mcp-selfhost 4 needs 22 or newer)`);
  const session = (0, import_connection.getConnectionManager)().describeAuth();
  const claims = session.token != null ? (0, import_connection.tokenClaims)(session.token) : void 0;
  const auth = session.kind === "token" ? claims?.apiTokenId != null ? "API token" : "token" : session.kind;
  if (auth == null) fail("No credentials: set HULY_TOKEN, or HULY_EMAIL and HULY_PASSWORD (Google/GitHub login: npx huly-mcp-selfhost setup)");
  const accounts = hostOf(session.accountsUrl) ?? "https://account.huly.app (Huly Cloud)";
  lines.push(`\u2139\uFE0F Login: ${auth ?? "\u2014"} \xB7 accounts ${accounts}${set("HULY_TRANSACTOR_URL") ? ` \xB7 transactor ${hostOf(env.HULY_TRANSACTOR_URL) ?? ""}` : ""}`);
  if (claims?.exp != null) {
    const days = Math.floor((claims.exp * 1e3 - Date.now()) / 864e5);
    const date = new Date(claims.exp * 1e3).toISOString().slice(0, 10);
    if (days < 0) fail(`Token expired on ${date}`);
    else if (days < 14) warn(`Token expires on ${date} (in ${days} day(s)) \u2014 create a new one in time`);
    else ok(`Token valid until ${date}`);
  }
  if (auth != null) {
    try {
      const workspaces = await (0, import_connection.listWorkspaces)();
      if (workspaces.length === 0) fail("Logged in, but the account has no workspace");
      else ok(`Logged in \xB7 ${workspaces.length} workspace(s): ${workspaces.slice(0, 8).map((w) => w.url).join(", ")}${workspaces.length > 8 ? ", \u2026" : ""}`);
      const target = args.workspace ?? (workspaces.length === 1 ? workspaces[0].url : void 0);
      if (target != null) {
        const t0 = Date.now();
        await (0, import_connection.getWorkspace)(target);
        ok(`Workspace ${target} connected (${Date.now() - t0} ms)`);
      }
    } catch (e) {
      fail(`Login or connection failed: ${e.message}`);
    }
  }
  if (frontStatus == null) {
    if (set("HULY_ACCOUNTS_URL")) warn("HULY_FRONT_URL is not set \u2014 self-hosted: descriptions, documents and files need it");
  } else if (frontStatus === "ok") ok(`Front service ${hostOf(env.HULY_FRONT_URL) ?? ""} reachable (descriptions, documents, files)`);
  else fail(`Front service ${hostOf(env.HULY_FRONT_URL) ?? ""} not reachable: ${frontStatus}`);
  const opts = [
    session.pinned != null ? `pinned workspace ${session.pinned}` : "all workspaces",
    `toolsets ${set("HULY_TOOLSETS") ? env.HULY_TOOLSETS : "default"}`,
    set("HULY_DYNAMIC_TOOLSETS") ? "load on demand" : null,
    set("HULY_WRITE_PROJECTS") ? `writes only in ${env.HULY_WRITE_PROJECTS}` : null,
    set("HULY_AUDIT_LOG") ? "audit log on" : null,
    set("HULY_ANNOTATIONS") ? "annotations on" : null
  ].filter(Boolean);
  lines.push(`\u2139\uFE0F Settings: ${opts.join(" \xB7 ")}`);
  return `## Setup check

${lines.join("\n")}`;
}
const checkSetup = (0, import_errors.wrapToolHandler)(async (args) => await checkSetupReport(args, process.env));
