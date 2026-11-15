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
var comments_exports = {};
__export(comments_exports, {
  addComment: () => addComment,
  deleteComment: () => deleteComment,
  listComments: () => listComments,
  updateComment: () => updateComment
});
module.exports = __toCommonJS(comments_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_chunter = __toESM(require("../../vendor/@hcengineering/chunter/lib/index.js"));
var import_people = require("../utils/people.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
const addComment = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  await client.addCollection(
    import_chunter.default.class.ChatMessage,
    issue.space,
    issue._id,
    import_tracker.default.class.Issue,
    "comments",
    { message: args.message }
  );
  return `\u2705 Comment added to **${args.identifier}**.`;
});
const listComments = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const newest = await client.findAll(
    import_chunter.default.class.ChatMessage,
    { attachedTo: issue._id },
    { limit: args.limit, sort: { createdOn: import_core.SortingOrder.Descending }, total: true }
  );
  const total = newest.total ?? newest.length;
  const comments = [...newest].sort((a, b) => (a.createdOn ?? 0) - (b.createdOn ?? 0));
  if (comments.length === 0) return `No comments found on **${args.identifier}**.`;
  const commentsWithAuthors = comments.filter((c) => c.createdBy != null);
  const authorIds = [...new Set(commentsWithAuthors.map((c) => c.createdBy))];
  const memberMap = await (0, import_people.socialIdNames)(client, authorIds);
  const lines = commentsWithAuthors.map((comment) => {
    const author = memberMap.get(comment.createdBy) ?? "Unknown";
    const date = (0, import_format.formatDate)(comment.createdOn);
    const raw = comment.message ?? "";
    const message = args.full === true ? raw : (0, import_format.clip)(raw, 1500, "list_comments full: true");
    return `**${author}** @ ${date} (id: \`${comment._id}\`):
> ${message.split("\n").join("\n> ")}`;
  });
  const count = total > comments.length ? `newest ${comments.length} of ${total}` : String(comments.length);
  return `## Comments on ${args.identifier} (${count})

${lines.join("\n\n")}`;
});
const deleteComment = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const comment = await client.findOne(import_chunter.default.class.ChatMessage, {
    _id: args.commentId,
    attachedTo: issue._id
  });
  if (comment == null) throw new Error(`Comment '${args.commentId}' not found on ${args.identifier}.`);
  await client.removeCollection(
    import_chunter.default.class.ChatMessage,
    issue.space,
    comment._id,
    issue._id,
    import_tracker.default.class.Issue,
    "comments"
  );
  return `\u2705 Comment \`${args.commentId}\` deleted from **${args.identifier}**.`;
});
const updateComment = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const comment = await client.findOne(import_chunter.default.class.ChatMessage, {
    _id: args.commentId,
    attachedTo: issue._id
  });
  if (comment == null) throw new Error(`Comment '${args.commentId}' not found on ${args.identifier}.`);
  await client.updateCollection(
    import_chunter.default.class.ChatMessage,
    issue.space,
    comment._id,
    issue._id,
    import_tracker.default.class.Issue,
    "comments",
    { message: args.message, editedOn: Date.now() }
  );
  return `\u2705 Comment \`${args.commentId}\` on **${args.identifier}** updated.`;
});
