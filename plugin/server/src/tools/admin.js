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
var admin_exports = {};
__export(admin_exports, {
  API_READ: () => API_READ,
  API_WRITE: () => API_WRITE,
  createWorkspace: () => createWorkspace,
  getMyProfile: () => getMyProfile,
  hulyApi: () => hulyApi,
  listModules: () => listModules,
  setModule: () => setModule,
  setupWorkspace: () => setupWorkspace,
  updateMyProfile: () => updateMyProfile,
  updateWorkspaceSettings: () => updateWorkspaceSettings
});
module.exports = __toCommonJS(admin_exports);
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_redact = require("../utils/redact.js");
var import_projects = require("./projects.js");
var import_components = require("./components.js");
var import_milestones = require("./milestones.js");
var import_documents = require("./documents.js");
var import_statuses = require("./statuses.js");
async function configurableModules(client) {
  const all = await client.findAll("core:class:PluginConfiguration", {});
  return all.filter((c) => c.hidden !== true && c.system !== true).sort((a, b) => String(a.pluginId).localeCompare(String(b.pluginId)));
}
const listModules = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const mods = await configurableModules(client);
  const on = mods.filter((m) => m.enabled !== false);
  const off = mods.filter((m) => m.enabled === false);
  const fmt = (m) => `\`${String(m.pluginId)}\`${m.beta === true ? " (beta)" : ""}`;
  return `## Modules

**On (${on.length}):** ${on.map(fmt).join(", ")}

**Off (${off.length}):** ${off.map(fmt).join(", ") || "\u2014"}

Switch with set_module.`;
});
const setModule = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const mods = await configurableModules(client);
  const m = mods.find((x) => String(x.pluginId).toLowerCase() === args.module.trim().toLowerCase());
  if (m == null) throw new Error(`Module '${args.module}' not found. Available: ${mods.map((x) => x.pluginId).join(", ")}.`);
  if (m.enabled !== false === args.enabled) return `\`${String(m.pluginId)}\` is already ${args.enabled ? "on" : "off"}.`;
  await client.update(m, { enabled: args.enabled });
  return `\u2705 Module \`${String(m.pluginId)}\` switched ${args.enabled ? "on" : "off"} for everyone in the workspace${m.beta === true ? " (beta module)" : ""}.`;
});
const updateWorkspaceSettings = (0, import_errors.wrapToolHandler)(async (args) => {
  const account = await (0, import_connection.getAccountClient)(args.workspace);
  const done = [];
  if (args.name != null) {
    await account.updateWorkspaceName(args.name.trim());
    done.push(`name \u2192 ${args.name.trim()}`);
  }
  if (args.readOnlyGuests != null) {
    await account.updateAllowReadOnlyGuests(args.readOnlyGuests);
    done.push(`read-only guests ${args.readOnlyGuests ? "allowed" : "not allowed"}`);
  }
  if (args.guestSignUp != null) {
    await account.updateAllowGuestSignUp(args.guestSignUp);
    done.push(`guest sign-up ${args.guestSignUp ? "allowed" : "not allowed"}`);
  }
  if (args.passwordAgingDays != null) {
    await account.updatePasswordAgingRule(args.passwordAgingDays);
    done.push(args.passwordAgingDays > 0 ? `passwords expire after ${args.passwordAgingDays} days` : "password expiry off");
  }
  if (done.length === 0) throw new Error("Nothing to change: pass name, readOnlyGuests, guestSignUp or passwordAgingDays.");
  return `\u2705 Workspace updated: ${done.join("; ")}.`;
});
const getMyProfile = (0, import_errors.wrapToolHandler)(async (args) => {
  const account = await (0, import_connection.getAccountClient)(args.workspace);
  const [person, profile, ids] = await Promise.all([account.getPerson(), account.getUserProfile().catch(() => null), account.getSocialIds().catch(() => [])]);
  const lines = [`## ${[person?.firstName, person?.lastName].filter(Boolean).join(" ") || "Your profile"}`];
  if (profile != null) {
    for (const [k, label] of [["bio", "Bio"], ["city", "City"], ["country", "Country"], ["website", "Website"]]) if (profile[k] != null && profile[k] !== "") lines.push(`- **${label}:** ${String(profile[k])}`);
    for (const [k, v] of Object.entries(profile.socialLinks ?? {})) lines.push(`- **${k}:** ${String(v)}`);
    lines.push(`- **Public profile:** ${profile.isPublic === true ? "yes" : "no"}`);
  }
  const socials = ids.filter((s) => s.isDeleted !== true).map((s) => `${String(s.type)}: ${String(s.displayValue ?? s.value)}${s.verifiedOn != null ? "" : " (unverified)"}`);
  if (socials.length > 0) lines.push("", "**Logins and identities:**", ...socials.map((s) => `- ${s}`));
  return lines.join("\n");
});
const updateMyProfile = (0, import_errors.wrapToolHandler)(async (args) => {
  const account = await (0, import_connection.getAccountClient)(args.workspace);
  const done = [];
  if (args.firstName != null || args.lastName != null) {
    const person = await account.getPerson();
    await account.changeUsername(args.firstName ?? person.firstName ?? "", args.lastName ?? person.lastName ?? "");
    done.push("name");
  }
  const profile = {};
  for (const k of ["bio", "city", "country", "website", "socialLinks", "isPublic"]) if (args[k] !== void 0) profile[k] = args[k];
  if (Object.keys(profile).length > 0) {
    await account.setMyProfile(profile);
    done.push(...Object.keys(profile));
  }
  if (done.length === 0) throw new Error("Nothing to change: pass firstName, lastName, bio, city, country, website, socialLinks or isPublic.");
  return `\u2705 Profile updated \u2014 changed: ${done.join(", ")}.`;
});
const createWorkspace = (0, import_errors.wrapToolHandler)(async (args) => {
  const account = await (0, import_connection.getAccountClient)();
  const info = await account.createWorkspace(args.name.trim(), args.region);
  return `\u2705 Workspace **${args.name.trim()}** created${info?.workspaceUrl != null ? ` (slug \`${String(info.workspaceUrl)}\`)` : ""}. Huly sets it up in the background \u2014 it can take a minute before tools can use it. You are its owner.`;
});
const API_READ = ["getProviders", "getUserWorkspaces", "getWorkspaceInfo", "getWorkspacesInfo", "getRegionInfo", "getPerson", "getPersonInfo", "getSocialIds", "getWorkspaceMembers", "getUserProfile", "getInviteInfo", "isReadOnlyGuest", "getMailboxOptions", "getMailboxes", "listIntegrations", "getIntegration", "findPersonBySocialKey", "findPersonBySocialId", "findSocialIdBySocialKey", "findFullSocialIdBySocialKey", "findFullSocialIds", "getAccountInfo", "checkPasswordAging", "canMergeSpecifiedPersons"];
const API_WRITE = ["updateWorkspaceName", "updateAllowReadOnlyGuests", "updateAllowGuestSignUp", "updatePasswordAgingRule", "changeUsername", "setMyProfile", "sendInvite", "resendInvite", "createInvite", "createInviteLink", "createAccessLink", "updateWorkspaceRole", "createWorkspace", "createMailbox", "deleteMailbox", "updateSocialId"];
const hulyApi = (0, import_errors.wrapToolHandler)(async (args) => {
  const method = args.method.trim();
  const params = args.params ?? [];
  const isRead = API_READ.includes(method);
  const isWrite = API_WRITE.includes(method);
  if (!isRead && !isWrite) {
    throw new Error(`Method '${method}' is not available here. Read: ${API_READ.join(", ")}. Write: ${API_WRITE.join(", ")}. (Deleting workspaces/accounts, logins, passwords and secrets are deliberately excluded.)`);
  }
  if (isWrite && args.dryRun !== false) {
    return `Dry run \u2014 would call account service \`${method}(${params.map((p) => JSON.stringify(p)).join(", ")})\`. Run again with dryRun: false to do it.`;
  }
  const account = await (0, import_connection.getAccountClient)(args.workspace);
  if (typeof account[method] !== "function") throw new Error(`This Huly version's account service has no method '${method}'.`);
  const result = await account[method](...params);
  const text = result === void 0 ? "(no result)" : JSON.stringify((0, import_redact.redactSecrets)(result), null, 2);
  return `\`${method}\`${isWrite ? " done" : ""}:

\`\`\`json
${text.length > 2e4 ? `${text.slice(0, 2e4)}
\u2026 (${text.length} chars, shortened)` : text}
\`\`\``;
});
const ok = (r) => String(r?.content?.[0]?.text ?? "").split("\n")[0];
const setupWorkspace = (0, import_errors.wrapToolHandler)(async (args) => {
  const ws = args.workspace;
  const plan = [];
  for (const m of args.modules?.enable ?? []) plan.push(`module ${m} on`);
  for (const m of args.modules?.disable ?? []) plan.push(`module ${m} off`);
  for (const s of args.statuses ?? []) plan.push(`issue status "${s.name}" (${s.category})${s.projectIdentifier != null ? ` for ${s.projectIdentifier}'s workflow` : ""}`);
  for (const p of args.projects ?? []) {
    plan.push(`project ${p.identifier} "${p.name}"`);
    for (const c of p.components ?? []) plan.push(`  component "${c.label}"`);
    for (const m of p.milestones ?? []) plan.push(`  milestone "${m.label}" \u2192 ${m.targetDate}`);
  }
  for (const t of args.teamspaces ?? []) plan.push(`teamspace "${t.name}"`);
  if (plan.length === 0) throw new Error("Empty template: pass modules, statuses, projects or teamspaces.");
  if (args.dryRun !== false) return `## Plan for ${ws} (dry run)

${plan.map((l) => `- ${l}`).join("\n")}

Run again with dryRun: false. Existing projects, components, milestones and statuses are reused, not duplicated.`;
  const log = [];
  const step = async (label, fn) => {
    try {
      log.push(`- ${label}: ${ok(await fn())}`);
    } catch (e) {
      log.push(`- ${label}: \u26A0\uFE0F ${e.message.replace(/^Huly MCP: /, "")}`);
    }
  };
  for (const m of args.modules?.enable ?? []) await step(`module ${m}`, async () => await setModule({ workspace: ws, module: m, enabled: true }));
  for (const m of args.modules?.disable ?? []) await step(`module ${m}`, async () => await setModule({ workspace: ws, module: m, enabled: false }));
  const client = await (0, import_connection.getConnection)(ws);
  const exists = (what) => ({ content: [{ text: `exists, reused (${what})` }] });
  for (const p of args.projects ?? []) {
    await step(`project ${p.identifier}`, async () => await client.findOne("tracker:class:Project", { identifier: p.identifier }) != null ? exists("project") : await (0, import_projects.createProject)({ workspace: ws, identifier: p.identifier, name: p.name, description: p.description }));
  }
  for (const s of args.statuses ?? []) {
    await step(`status ${s.name}`, async () => await (0, import_statuses.createIssueStatus)({ workspace: ws, name: s.name, category: s.category, projectIdentifier: s.projectIdentifier ?? args.projects?.[0]?.identifier }));
  }
  for (const p of args.projects ?? []) {
    const project = await client.findOne("tracker:class:Project", { identifier: p.identifier });
    const labels = async (cls) => new Set(project == null ? [] : (await client.findAll(cls, { space: project._id })).map((d) => String(d.label).toLowerCase()));
    const comps = await labels("tracker:class:Component");
    const miles = await labels("tracker:class:Milestone");
    for (const c of p.components ?? []) await step(`${p.identifier} component ${c.label}`, async () => comps.has(c.label.toLowerCase()) ? exists("component") : await (0, import_components.createComponent)({ workspace: ws, projectIdentifier: p.identifier, label: c.label, description: c.description }));
    for (const m of p.milestones ?? []) await step(`${p.identifier} milestone ${m.label}`, async () => miles.has(m.label.toLowerCase()) ? exists("milestone") : await (0, import_milestones.createMilestone)({ workspace: ws, projectIdentifier: p.identifier, label: m.label, targetDate: m.targetDate, status: "Planned" }));
  }
  const spaces = new Set((await client.findAll("document:class:Teamspace", {})).map((t) => String(t.name).toLowerCase()));
  for (const t of args.teamspaces ?? []) await step(`teamspace ${t.name}`, async () => spaces.has(t.name.toLowerCase()) ? exists("teamspace") : await (0, import_documents.createTeamspace)({ workspace: ws, name: t.name, description: t.description, isPrivate: false }));
  return `## ${ws} set up

${log.join("\n")}`;
});
