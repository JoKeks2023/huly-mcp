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
var workspace_admin_exports = {};
__export(workspace_admin_exports, {
  ROLES: () => ROLES,
  createInviteLink: () => createInviteLink,
  getWorkspaceSettings: () => getWorkspaceSettings,
  listProjectTypes: () => listProjectTypes,
  sendInvite: () => sendInvite,
  setMemberRole: () => setMemberRole
});
module.exports = __toCommonJS(workspace_admin_exports);
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_people = require("../utils/people.js");
var import_sharing = require("./sharing.js");
const ROLES = { guest: "GUEST", user: "USER", maintainer: "MAINTAINER", owner: "OWNER" };
const ROLE_NAME = { READONLYGUEST: "read-only guest", DocGuest: "document guest", GUEST: "guest", USER: "user", MAINTAINER: "maintainer", OWNER: "owner", ADMIN: "admin" };
function frontUrl() {
  const f = process.env.HULY_FRONT_URL;
  if (f == null || f === "") throw new Error("HULY_FRONT_URL is not set \u2014 needed to build the invite link.");
  return f.replace(/\/$/, "");
}
const createInviteLink = (0, import_errors.wrapToolHandler)(async (args) => {
  const account = await (0, import_connection.getAccountClient)(args.workspace);
  const role = ROLES[args.role ?? "user"];
  const hours = args.expiresHours ?? 48;
  if (args.email != null) {
    const link = await account.createInviteLink(args.email.trim(), role, false, "", "", void 0, hours);
    return `\u{1F517} Personal invite for ${args.email} as ${args.role ?? "user"} (one use, ${hours} h):
${(0, import_sharing.reachableUrl)(link)}
Nothing was sent \u2014 share the link yourself, or use send_invite.`;
  }
  const limit = args.limit ?? 1;
  const id = await account.createInvite(hours * 36e5, args.emailMask ?? "", limit, role);
  const mask = args.emailMask != null && args.emailMask !== "" ? `, only for ${args.emailMask}` : "";
  return `\u{1F517} Invite link as ${args.role ?? "user"} (${limit} use(s), ${hours} h${mask}):
${frontUrl()}/login/join?inviteId=${id}`;
});
const sendInvite = (0, import_errors.wrapToolHandler)(async (args) => {
  const account = await (0, import_connection.getAccountClient)(args.workspace);
  const role = ROLES[args.role ?? "user"];
  await account.sendInvite(args.email.trim(), role);
  return `\u{1F4E7} Invitation e-mail sent to ${args.email} (role ${args.role ?? "user"}).`;
});
async function membersWithNames(workspace) {
  const account = await (0, import_connection.getAccountClient)(workspace);
  const members = await account.getWorkspaceMembers();
  const client = await (0, import_connection.getConnection)(workspace);
  const persons = await client.findAll("contact:class:Person", {});
  const names = new Map(persons.filter((p) => p.personUuid != null).map((p) => [String(p.personUuid), (0, import_people.formatPersonName)(p.name)]));
  return members.map((m) => ({ uuid: String(m.person), role: String(m.role), name: names.get(String(m.person)) ?? "" }));
}
const setMemberRole = (0, import_errors.wrapToolHandler)(async (args) => {
  const members = await membersWithNames(args.workspace);
  const q = args.member.trim().toLowerCase();
  const exact = members.filter((m) => m.uuid === args.member.trim() || m.name.toLowerCase() === q);
  const hits = exact.length > 0 ? exact : members.filter((m) => m.name.toLowerCase().includes(q));
  if (hits.length === 0) throw new Error(`Member '${args.member}' not found. Members: ${members.map((m) => m.name || m.uuid).join(", ")}.`);
  if (hits.length > 1) throw new Error(`Member '${args.member}' is ambiguous: ${hits.map((m) => m.name || m.uuid).join(", ")}.`);
  const target = hits[0];
  const role = ROLES[args.role];
  if (target.role === role) return `${target.name || target.uuid} already has role ${args.role}.`;
  const account = await (0, import_connection.getAccountClient)(args.workspace);
  await account.updateWorkspaceRole(target.uuid, role);
  return `\u2705 ${target.name || target.uuid}: ${ROLE_NAME[target.role] ?? target.role} \u2192 ${args.role}.`;
});
const getWorkspaceSettings = (0, import_errors.wrapToolHandler)(async (args) => {
  const conn = await (0, import_connection.getWorkspace)(args.workspace);
  const client = conn.client;
  const [members, invite, integrations, setting] = await Promise.all([
    membersWithNames(args.workspace),
    client.findOne("setting:class:InviteSettings", {}),
    client.findAll("setting:class:Integration", {}),
    client.findOne("setting:class:WorkspaceSetting", {})
  ]);
  const me = await (0, import_people.currentAccountUuid)(client).catch(() => void 0);
  const byRole = /* @__PURE__ */ new Map();
  for (const m of members) byRole.set(m.role, (byRole.get(m.role) ?? 0) + 1);
  const myRole = members.find((m) => m.uuid === me)?.role;
  const lines = [
    `## Workspace ${conn.workspace.name}`,
    `- Slug: \`${conn.workspace.url}\` \xB7 id \`${conn.workspace.uuid}\``,
    `- Your role: ${myRole != null ? ROLE_NAME[myRole] ?? myRole : "unknown"}`,
    `- Members: ${members.length} (${[...byRole].map(([r, n]) => `${n} ${ROLE_NAME[r] ?? r}`).join(", ")})`,
    `- Custom logo: ${setting?.icon != null ? "yes" : "no"}`,
    `- Invite defaults: ${invite != null ? `expire after ${invite.expirationTime} h, limit ${invite.limit}${invite.emailMask != null && invite.emailMask !== "" ? `, e-mail mask ${invite.emailMask}` : ""}${invite.enabled === false ? ", invites disabled" : ""}` : "Huly defaults"}`
  ];
  if (integrations.length > 0) {
    lines.push(`- Integrations: ${integrations.map((i) => `${String(i.type).split(":").pop() ?? i.type}${i.disabled === true ? " (disabled)" : ""}${i.value != null && i.value !== "" ? ` \u2014 ${String(i.value)}` : ""}`).join("; ")}`);
  } else lines.push("- Integrations: none");
  return lines.join("\n");
});
const label = (v) => {
  const s = String(v ?? "");
  return s.includes(":") ? s.split(":").pop() ?? s : s;
};
const listProjectTypes = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const [types, taskTypes, statuses, projects] = await Promise.all([
    client.findAll("task:class:ProjectType", {}),
    client.findAll("task:class:TaskType", {}),
    client.findAll("core:class:Status", {}),
    client.findAll("task:class:Project", {})
  ]);
  const statusById = new Map(statuses.map((s) => [s._id, s]));
  const out = [`## Project types (${types.length})`];
  for (const t of types) {
    const used = projects.filter((p) => p.type === t._id).map((p) => p.identifier ?? p.name);
    out.push("", `### ${t.name} \u2014 ${label(t.descriptor).replace(/Type$/, "")}${t.classic === true ? " (classic)" : ""} \`${t._id}\``);
    out.push(`Used by: ${used.length > 0 ? used.join(", ") : "\u2014"}`);
    for (const tt of taskTypes.filter((x) => x.parent === t._id)) {
      const flow = (tt.statuses ?? []).map((id) => {
        const s = statusById.get(id);
        return s != null ? `${s.name} (${label(s.category)})` : id;
      });
      out.push(`- **${tt.name}** (${label(tt.ofClass)}): ${flow.join(" \u2192 ") || "no statuses"}`);
    }
  }
  return out.join("\n");
});
