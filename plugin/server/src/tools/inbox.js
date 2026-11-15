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
var inbox_exports = {};
__export(inbox_exports, {
  listNotifications: () => listNotifications,
  manageNotifications: () => manageNotifications,
  markNotificationsRead: () => markNotificationsRead
});
module.exports = __toCommonJS(inbox_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_classes = require("../utils/classes.js");
var import_people = require("../utils/people.js");
var import_resolve = require("../utils/resolve.js");
const when = (ts) => ts == null ? "" : new Date(ts).toISOString().slice(0, 16).replace("T", " ");
const listNotifications = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const user = await (0, import_people.currentAccountUuid)(client);
  const query = { user, archived: false };
  if (args.unreadOnly) query.isViewed = false;
  const notes = await client.findAll(import_classes.C.InboxNotification, query, { limit: args.limit, sort: { createdOn: import_core.SortingOrder.Descending } });
  if (notes.length === 0) return args.unreadOnly ? "No unread notifications." : "No notifications.";
  const contexts = await client.findAll(import_classes.C.DocNotifyContext, { _id: { $in: [...new Set(notes.map((n) => n.docNotifyContext))] } });
  const ctxById = new Map(contexts.map((c) => [c._id, c]));
  const groups = /* @__PURE__ */ new Map();
  for (const n of notes) {
    const g = groups.get(n.docNotifyContext) ?? { ctx: ctxById.get(n.docNotifyContext), notes: [] };
    g.notes.push(n);
    groups.set(n.docNotifyContext, g);
  }
  const lines = [];
  for (const { ctx, notes: group } of groups.values()) {
    const objectClass = ctx?.objectClass ?? group[0].objectClass;
    const objectId = ctx?.objectId ?? group[0].objectId;
    const label = objectClass != null ? await (0, import_resolve.loadLabel)(client, objectClass, objectId) : "(unknown)";
    const kind = String(objectClass ?? "").split(":").pop();
    const unread = group.filter((n) => n.isViewed !== true).length;
    lines.push(`- **${label}** (${kind}) \u2014 ${group.length} notification(s)${unread > 0 ? `, ${unread} unread` : ""}, latest ${when(group[0].createdOn)}${args.ids === true ? `
  ids: ${group.map((n) => `\`${n._id}\``).join(", ")}` : ""}`);
  }
  return `## Notifications (${notes.length}${args.unreadOnly ? " unread" : ""})

${lines.join("\n")}`;
});
const markNotificationsRead = (0, import_errors.wrapToolHandler)(async (args) => {
  const modes = [args.object != null, args.notificationIds != null, args.all === true].filter(Boolean).length;
  if (modes !== 1) throw new Error("Pass exactly one of: object, notificationIds, all.");
  const client = await (0, import_connection.getConnection)(args.workspace);
  const user = await (0, import_people.currentAccountUuid)(client);
  const query = { user, isViewed: false };
  if (args.archive) delete query.isViewed;
  let scope = "all notifications";
  if (args.object != null) {
    const obj = await (0, import_resolve.resolveObject)(client, args.object);
    const ctxs = await client.findAll(import_classes.C.DocNotifyContext, { user, objectId: obj._id });
    query.docNotifyContext = { $in: ctxs.map((c) => c._id) };
    scope = obj.label;
  }
  if (args.notificationIds != null) {
    query._id = { $in: args.notificationIds };
    delete query.isViewed;
    scope = `${args.notificationIds.length} notification(s)`;
  }
  if (args.archive) query.archived = false;
  const notes = await client.findAll(import_classes.C.InboxNotification, query);
  const update = args.archive ? { isViewed: true, archived: true } : { isViewed: true };
  for (const n of notes) await client.updateDoc(n._class, n.space, n._id, update);
  const now = Date.now();
  for (const ctxId of new Set(notes.map((n) => n.docNotifyContext))) {
    const ctx = await client.findOne(import_classes.C.DocNotifyContext, { _id: ctxId });
    if (ctx != null) await client.updateDoc(ctx._class, ctx.space, ctx._id, { lastViewedTimestamp: now });
  }
  return `\u2705 ${notes.length} notification(s) ${args.archive ? "archived" : "marked read"} (${scope}).`;
});
const manageNotifications = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const user = await (0, import_people.currentAccountUuid)(client);
  const target = await (0, import_resolve.resolveObject)(client, args.object);
  if (args.action === "follow" || args.action === "unfollow") {
    const rows = await client.findAll(import_classes.C.Collaborator, { attachedTo: target._id, collaborator: user });
    if (args.action === "follow") {
      if (rows.length > 0) return `You already follow ${target.label}.`;
      await client.addCollection(import_classes.C.Collaborator, target.space, target._id, target._class, "collaborators", { collaborator: user });
      return `\u2705 You now follow ${target.label} \u2014 its changes reach your inbox.`;
    }
    if (rows.length === 0) return `You do not follow ${target.label}.`;
    for (const r of rows) await client.removeCollection(import_classes.C.Collaborator, r.space, r._id, r.attachedTo, r.attachedToClass, r.collection ?? "collaborators");
    return `\u2705 You no longer follow ${target.label}.`;
  }
  const ctx = await client.findOne(import_classes.C.DocNotifyContext, { user, objectId: target._id });
  if (ctx == null) throw new Error(`${target.label} is not in your inbox (no notifications for it yet). Nothing was changed.`);
  const set = async (update) => {
    await client.updateDoc(ctx._class, ctx.space, ctx._id, update);
  };
  switch (args.action) {
    case "pin":
      await set({ isPinned: true });
      return `\u2705 Pinned ${target.label} in your inbox.`;
    case "unpin":
      await set({ isPinned: false });
      return `\u2705 Unpinned ${target.label}.`;
    case "hide":
      await set({ hidden: true });
      return `\u2705 Hidden ${target.label} \u2014 it comes back with new activity.`;
    case "unhide":
      await set({ hidden: false });
      return `\u2705 ${target.label} is visible in your inbox again.`;
    case "unarchive": {
      const notes = await client.findAll(import_classes.C.InboxNotification, { user, docNotifyContext: ctx._id, archived: true });
      for (const n of notes) await client.updateDoc(n._class, n.space, n._id, { archived: false });
      return `\u2705 ${notes.length} notification(s) of ${target.label} restored from the archive.`;
    }
    case "unread": {
      const notes = await client.findAll(import_classes.C.InboxNotification, { user, docNotifyContext: ctx._id, archived: false });
      if (notes.length === 0) return `${target.label} has no notifications to mark unread.`;
      for (const n of notes) if (n.isViewed === true) await client.updateDoc(n._class, n.space, n._id, { isViewed: false });
      const oldest = Math.min(...notes.map((n) => n.createdOn ?? Date.now()));
      await set({ lastViewedTimestamp: oldest - 1 });
      return `\u2705 ${target.label} is unread again (${notes.length} notification(s)).`;
    }
  }
  throw new Error(`Unknown action '${args.action}'.`);
});
