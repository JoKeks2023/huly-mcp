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
var attachments_exports = {};
__export(attachments_exports, {
  attachFile: () => attachFile,
  deleteAttachment: () => deleteAttachment,
  listAttachments: () => listAttachments
});
module.exports = __toCommonJS(attachments_exports);
var import_attachment = __toESM(require("../../vendor/@hcengineering/attachment/lib/index.js"));
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_storage = require("../utils/storage.js");
var import_format = require("../utils/format.js");
function base64ToBlob(base64, mimeType) {
  const binary = Buffer.from(base64, "base64");
  return new Blob([binary], { type: mimeType });
}
const attachFile = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const blob = base64ToBlob(args.contentBase64, args.mimeType);
  const blobId = `${issue._id}-attachment-${Date.now()}-${args.filename}`;
  const uploaded = await (0, import_storage.uploadBlob)(wsToken, workspaceUuid, blobId, blob);
  const attachmentId = (0, import_core.generateId)();
  await client.addCollection(
    import_attachment.default.class.Attachment,
    issue.space,
    issue._id,
    import_tracker.default.class.Issue,
    "attachments",
    {
      name: args.filename,
      file: uploaded.id,
      size: uploaded.size,
      type: args.mimeType,
      lastModified: Date.now()
    },
    attachmentId
  );
  return `\u2705 File **"${args.filename}"** (${uploaded.size} bytes) attached to **${args.identifier}** (attachment id: \`${attachmentId}\`).`;
});
const listAttachments = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const attachments = await client.findAll(import_attachment.default.class.Attachment, { attachedTo: issue._id });
  if (attachments.length === 0) return `No attachments found on **${args.identifier}**.`;
  const lines = attachments.map(
    (a) => `- **${a.name}** (id: \`${a._id}\`, ${a.size} bytes, ${a.type}) \u2014 added ${(0, import_format.formatDate)(a.modifiedOn)}`
  );
  return `## Attachments on ${args.identifier} (${attachments.length})

${lines.join("\n")}`;
});
const deleteAttachment = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const att = await client.findOne(import_attachment.default.class.Attachment, { _id: args.attachmentId });
  if (att == null) throw new Error(`Attachment '${args.attachmentId}' not found.`);
  await client.removeCollection(
    import_attachment.default.class.Attachment,
    issue.space,
    att._id,
    issue._id,
    import_tracker.default.class.Issue,
    "attachments"
  );
  await (0, import_storage.deleteBlob)(wsToken, workspaceUuid, String(att.file));
  return `\u2705 Attachment **"${att.name}"** deleted from **${args.identifier}**.`;
});
