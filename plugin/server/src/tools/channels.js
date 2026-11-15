var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var channels_exports = {};
__export(channels_exports, {
  addReaction: () => addReaction,
  createChannel: () => createChannel,
  deleteMessage: () => deleteMessage,
  listChannels: () => listChannels,
  listMessages: () => listMessages,
  listThread: () => listThread,
  pinMessage: () => pinMessage,
  removeReaction: () => removeReaction,
  replyToMessage: () => replyToMessage,
  sendMessage: () => sendMessage,
  startDirectMessage: () => startDirectMessage,
  updateMessage: () => updateMessage
});
module.exports = __toCommonJS(channels_exports);
var import_chunter = __toESM(require("../../vendor/@hcengineering/chunter/lib/index.js"));
var import_contact = __toESM(require("../../vendor/@hcengineering/contact/lib/index.js"));
var import_core = __toESM(require("../../vendor/@hcengineering/core/lib/index.js"));
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
var import_classes = require("../utils/classes.js");
const listChannels = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const query = {};
  if (!args.includeArchived) query.archived = false;
  const channels = await client.findAll(import_chunter.default.class.Channel, query);
  if (channels.length === 0) return "No channels found in this workspace.";
  const lines = channels.map(
    (c) => `- **#${c.name}** (id: \`${c._id}\`)${c.topic != null && c.topic !== "" ? ` \u2014 ${c.topic}` : ""}${c.private === true ? " \u{1F512}" : ""} \u2014 ${c.messages ?? 0} messages`
  );
  return `## Channels (${channels.length})

${lines.join("\n")}`;
});
const createChannel = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const existing = await client.findOne(import_chunter.default.class.Channel, { name: args.name });
  if (existing != null) return `\u2139\uFE0F Channel **#${args.name}** already exists (id: \`${existing._id}\`).`;
  const channelId = (0, import_core.generateId)();
  const me = await (0, import_people.currentAccountUuid)(client);
  await client.createDoc(
    import_chunter.default.class.Channel,
    import_core.default.space.Space,
    {
      name: args.name,
      topic: args.topic ?? "",
      description: args.topic ?? "",
      private: args.isPrivate,
      members: [me],
      owners: [me],
      autoJoin: false,
      archived: false,
      messages: 0
    },
    channelId
  );
  return `\u2705 Channel **#${args.name}** created (id: \`${channelId}\`).`;
});
const startDirectMessage = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const persons = await client.findAll(import_contact.default.class.Person, {});
  const match = persons.find((p) => (p.name ?? "").toLowerCase().includes(args.member.toLowerCase()));
  if (match == null || match.personUuid == null) throw new Error(`Member '${args.member}' not found.`);
  const targetAccount = match.personUuid;
  const matchName = match.name;
  const selfAccount = await (0, import_people.currentAccountUuid)(client);
  const existingDms = await client.findAll(import_chunter.default.class.DirectMessage, {});
  const existing = existingDms.find((dm) => {
    const dmMembers = dm.members ?? [];
    return dmMembers.length === 2 && dmMembers.includes(String(targetAccount)) && dmMembers.includes(String(selfAccount));
  });
  if (existing != null) return `\u2139\uFE0F Direct message with **${matchName}** already exists (id: \`${existing._id}\`).`;
  const dmId = (0, import_core.generateId)();
  await client.createDoc(
    import_chunter.default.class.DirectMessage,
    import_core.default.space.Space,
    {
      name: "",
      description: "",
      private: true,
      members: [selfAccount, targetAccount],
      owners: [selfAccount, targetAccount],
      autoJoin: false,
      archived: false,
      messages: 0
    },
    dmId
  );
  return `\u2705 Direct message with **${matchName}** started (id: \`${dmId}\`).`;
});
async function resolveChatSpace(client, spaceId) {
  const channel = await client.findOne(import_chunter.default.class.Channel, { _id: spaceId });
  if (channel != null) return { space: channel, spaceClass: import_chunter.default.class.Channel };
  const dm = await client.findOne(import_chunter.default.class.DirectMessage, { _id: spaceId });
  if (dm != null) return { space: dm, spaceClass: import_chunter.default.class.DirectMessage };
  throw new Error(`Channel or direct message '${spaceId}' not found.`);
}
const sendMessage = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const { space, spaceClass } = await resolveChatSpace(client, args.spaceId);
  await client.addCollection(
    import_chunter.default.class.ChatMessage,
    space._id,
    space._id,
    spaceClass,
    "messages",
    { message: args.message }
  );
  return `\u2705 Message sent to \`${args.spaceId}\`.`;
});
const listMessages = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const { space } = await resolveChatSpace(client, args.spaceId);
  const messages = await client.findAll(
    import_chunter.default.class.ChatMessage,
    { attachedTo: space._id },
    { limit: args.limit, sort: { createdOn: import_core.SortingOrder.Ascending } }
  );
  if (messages.length === 0) return "No messages found in this channel.";
  const who = await (0, import_people.socialIdNames)(client, [...new Set(messages.map((m) => m.createdBy).filter((x) => x != null))]);
  const lines = messages.map((m) => {
    const extras = [
      (m.replies ?? 0) > 0 ? `${m.replies} replies` : "",
      (m.reactions ?? 0) > 0 ? `${m.reactions} reactions` : "",
      m.isPinned === true ? "pinned" : ""
    ].filter(Boolean).join(", ");
    return `**[${(0, import_format.formatDate)(m.createdOn)}] ${who.get(m.createdBy) ?? ""}** ${(0, import_format.markupToText)(m.message)}${extras !== "" ? ` _(${extras})_` : ""} \u2014 \`${m._id}\``;
  });
  return `## Messages (${messages.length})

${lines.join("\n")}`;
});
async function findMessage(client, messageId) {
  const msg = await client.findOne(import_classes.C.ActivityMessage, { _id: messageId });
  if (msg == null) throw new Error(`Message '${messageId}' not found.`);
  return msg;
}
const listThread = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const parent = await findMessage(client, args.messageId);
  const replies = await client.findAll(import_classes.C.ThreadMessage, { attachedTo: parent._id }, { sort: { createdOn: import_core.SortingOrder.Ascending }, limit: args.limit });
  const who = await (0, import_people.socialIdNames)(client, [...new Set([parent, ...replies].map((m) => m.createdBy).filter((x) => x != null))]);
  const line = (m) => `**[${(0, import_format.formatDate)(m.createdOn)}] ${who.get(m.createdBy) ?? ""}** ${(0, import_format.markupToText)(m.message)} \u2014 \`${m._id}\``;
  return `## Thread

${line(parent)}

${replies.length === 0 ? "_No replies._" : replies.map((r) => `> ${line(r)}`).join("\n")}`;
});
const replyToMessage = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const parent = await findMessage(client, args.messageId);
  const root = parent._class === import_classes.C.ThreadMessage ? await findMessage(client, parent.attachedTo) : parent;
  const id = (0, import_core.generateId)();
  await client.addCollection(import_classes.C.ThreadMessage, root.space, root._id, root._class, "replies", {
    message: args.message,
    attachments: 0,
    objectId: root.attachedTo,
    objectClass: root.attachedToClass
  }, id);
  return `\u2705 Reply posted (id: \`${id}\`).`;
});
const updateMessage = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const msg = await findMessage(client, args.messageId);
  if (typeof msg.message !== "string") throw new Error(`'${args.messageId}' is not a text message.`);
  await client.updateCollection(msg._class, msg.space, msg._id, msg.attachedTo, msg.attachedToClass, msg.collection, { message: args.message, editedOn: Date.now() });
  return "\u2705 Message updated.";
});
const deleteMessage = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const msg = await findMessage(client, args.messageId);
  if (typeof msg.message !== "string") throw new Error(`'${args.messageId}' is not a text message.`);
  await client.removeCollection(msg._class, msg.space, msg._id, msg.attachedTo, msg.attachedToClass, msg.collection);
  return "\u{1F5D1}\uFE0F Message deleted.";
});
const addReaction = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const msg = await findMessage(client, args.messageId);
  const existing = await client.findOne(import_classes.C.Reaction, { attachedTo: msg._id, emoji: args.emoji, createBy: client.user });
  if (existing != null) return `You already reacted with ${args.emoji}.`;
  await client.addCollection(import_classes.C.Reaction, msg.space, msg._id, msg._class, "reactions", { emoji: args.emoji, createBy: client.user });
  return `\u2705 Reacted with ${args.emoji}.`;
});
const removeReaction = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const msg = await findMessage(client, args.messageId);
  const existing = await client.findOne(import_classes.C.Reaction, { attachedTo: msg._id, emoji: args.emoji, createBy: client.user });
  if (existing == null) return `You have no ${args.emoji} reaction on this message.`;
  await client.removeCollection(import_classes.C.Reaction, existing.space, existing._id, msg._id, msg._class, "reactions");
  return `\u2705 Removed ${args.emoji}.`;
});
const pinMessage = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const msg = await findMessage(client, args.messageId);
  await client.updateCollection(msg._class, msg.space, msg._id, msg.attachedTo, msg.attachedToClass, msg.collection, { isPinned: args.pinned });
  return args.pinned ? "\u{1F4CC} Message pinned." : "Message unpinned.";
});
