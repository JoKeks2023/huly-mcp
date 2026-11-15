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
var documents_exports = {};
__export(documents_exports, {
  addDocumentComment: () => addDocumentComment,
  createDocument: () => createDocument,
  createTeamspace: () => createTeamspace,
  deleteDocument: () => deleteDocument,
  getDocument: () => getDocument,
  linkDocument: () => linkDocument,
  listDocumentComments: () => listDocumentComments,
  listDocuments: () => listDocuments,
  listTeamspaces: () => listTeamspaces,
  updateDocument: () => updateDocument
});
module.exports = __toCommonJS(documents_exports);
var import_document = __toESM(require("../../vendor/@hcengineering/document/lib/index.js"));
var import_core = __toESM(require("../../vendor/@hcengineering/core/lib/index.js"));
var import_document2 = require("../../vendor/@hcengineering/document/lib/index.js");
var import_rank = require("../../vendor/@hcengineering/rank/lib/index.js");
var import_chunter = __toESM(require("../../vendor/@hcengineering/chunter/lib/index.js"));
var import_people = require("../utils/people.js");
var import_format = require("../utils/format.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_markdown = require("../utils/markdown.js");
var import_storage = require("../utils/storage.js");
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_content = require("../utils/content.js");
const listTeamspaces = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const teamspaces = await client.findAll(import_document.default.class.Teamspace, {});
  if (teamspaces.length === 0) return "No teamspaces found in this workspace.";
  const lines = teamspaces.map(
    (t) => `- **${t.name}** (id: \`${t._id}\`)${t.description != null && t.description !== "" ? `
  ${t.description}` : ""}`
  );
  return `## Teamspaces (${teamspaces.length})

${lines.join("\n")}`;
});
const createTeamspace = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const teamspaceId = (0, import_core.generateId)();
  const me = await (0, import_people.currentAccountUuid)(client);
  await client.createDoc(
    import_document.default.class.Teamspace,
    import_core.default.space.Space,
    {
      name: args.name,
      description: args.description ?? "",
      private: args.isPrivate ?? false,
      members: [me],
      owners: [me],
      autoJoin: false,
      archived: false,
      icon: void 0,
      color: void 0,
      type: import_document.default.spaceType.DefaultTeamspaceType
    },
    teamspaceId
  );
  return `\u2705 Teamspace **"${args.name}"** created (id: \`${teamspaceId}\`).`;
});
const listDocuments = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const docs = await client.findAll(
    import_document.default.class.Document,
    { space: args.teamspaceId },
    { sort: { rank: import_core.SortingOrder.Ascending }, limit: 100 }
  );
  if (docs.length === 0) return "No documents found in this teamspace.";
  const noParentId = import_document.default.ids.NoParent;
  const ids = new Set(docs.map((d) => String(d._id)));
  const byParent = /* @__PURE__ */ new Map();
  for (const d of docs) {
    const p = d.parent != null && String(d.parent) !== noParentId && ids.has(String(d.parent)) ? String(d.parent) : noParentId;
    byParent.set(p, [...byParent.get(p) ?? [], d]);
  }
  const lines = [];
  const walk = (parent, depth) => {
    for (const d of byParent.get(parent) ?? []) {
      lines.push(`${"  ".repeat(depth)}- **${d.title}** (id: \`${d._id}\`)${d.comments > 0 ? ` \xB7 ${d.comments} comment(s)` : ""}`);
      if (depth < 20) walk(String(d._id), depth + 1);
    }
  };
  walk(noParentId, 0);
  return `## Documents (${docs.length})

${lines.join("\n")}`;
});
const getDocument = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const doc = await client.findOne(import_document.default.class.Document, { _id: args.documentId });
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`);
  const teamspace = await client.findOne(import_document.default.class.Teamspace, { _id: doc.space });
  const lines = [
    `## ${doc.title}`,
    `**ID:** \`${doc._id}\``,
    `**Teamspace:** ${teamspace?.name ?? doc.space}`,
    `**Comments:** ${doc.comments ?? 0}`,
    `**Attachments:** ${doc.attachments ?? 0}`,
    `**Snapshots:** ${doc.snapshots ?? 0}`
  ];
  if (doc.content != null) {
    const frontUrl = process.env.HULY_FRONT_URL;
    if (frontUrl != null && frontUrl !== "") {
      const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(args.workspace);
      const contentUrl = `${frontUrl}/files?file=${encodeURIComponent(doc.content)}&workspace=${workspaceUuid}`;
      lines.push(`
**Content:** Available at blob ref \`${doc.content}\``);
      lines.push(`**Content URL:** ${contentUrl} _(requires a workspace token as Bearer header)_`);
      try {
        const res = await (0, import_content.fetchBlob)(contentUrl, wsToken);
        if (res.ok) {
          const text = await res.text();
          try {
            const parsed = JSON.parse(text);
            const extracted = (0, import_markdown.extractText)(parsed);
            if (extracted.length > 0) {
              lines.push(`
**Content:**
${extracted}`);
            }
          } catch {
            lines.push(`
**Content (raw):**
${text.substring(0, 2e3)}`);
          }
        }
      } catch {
        lines.push(`_(Set HULY_FRONT_URL env var to fetch content)_`);
      }
    } else {
      lines.push(`
**Content blob ref:** \`${doc.content}\``);
      lines.push(`_(Set HULY_FRONT_URL env var to fetch document content, e.g. https://front.huly.app)_`);
    }
  } else {
    lines.push("\n**Content:** _(empty document)_");
  }
  return lines.join("\n");
});
const createDocument = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const teamspace = await client.findOne(import_document.default.class.Teamspace, { _id: args.teamspaceId });
  if (teamspace == null) throw new Error(`Teamspace '${args.teamspaceId}' not found.`);
  const noParent = import_document.default.ids.NoParent;
  const parentId = args.parentId != null ? args.parentId : noParent;
  const rank = (0, import_rank.makeRank)(await (0, import_document2.getFirstRank)(client, teamspace._id, parentId), void 0);
  const docId = (0, import_core.generateId)();
  await client.createDoc(
    import_document.default.class.Document,
    teamspace._id,
    {
      title: args.title,
      content: null,
      parent: parentId,
      rank,
      icon: null,
      color: void 0,
      snapshots: 0,
      attachments: 0,
      comments: 0,
      labels: 0,
      references: 0,
      embeddings: 0
    },
    docId
  );
  return `\u2705 Document **"${args.title}"** created (id: \`${docId}\`) in teamspace "${teamspace.name}".
Write its content with update_document.`;
});
const deleteDocument = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const doc = await client.findOne(import_document.default.class.Document, { _id: args.documentId });
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`);
  await client.removeDoc(import_document.default.class.Document, doc.space, doc._id);
  return `\u2705 Document **"${doc.title}"** (\`${doc._id}\`) deleted.`;
});
async function descendants(client, root) {
  const out = [];
  let level = [root._id];
  while (level.length > 0) {
    const kids = await client.findAll(import_document.default.class.Document, { parent: { $in: level } });
    out.push(...kids);
    level = kids.map((k) => k._id);
  }
  return out;
}
const updateDocument = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const doc = await client.findOne(import_document.default.class.Document, { _id: args.documentId });
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`);
  if (args.markdown == null && args.title == null && args.parentId === void 0 && args.teamspaceId == null) {
    throw new Error("Nothing to change: pass markdown, title, parentId or teamspaceId.");
  }
  const done = [];
  const moving = args.parentId !== void 0 || args.teamspaceId != null;
  let move;
  let subtree = [];
  if (moving) {
    const noParent = import_document.default.ids.NoParent;
    let parent;
    if (args.parentId != null) {
      parent = await client.findOne(import_document.default.class.Document, { _id: args.parentId });
      if (parent == null) throw new Error(`Parent document '${args.parentId}' not found.`);
    }
    const space = parent?.space ?? args.teamspaceId ?? doc.space;
    if (args.teamspaceId != null && parent != null && parent.space !== args.teamspaceId) throw new Error("parentId is in a different teamspace than teamspaceId.");
    if (space !== doc.space && await client.findOne(import_document.default.class.Teamspace, { _id: space }) == null) throw new Error(`Teamspace '${String(space)}' not found.`);
    subtree = await descendants(client, doc);
    if (parent != null && (parent._id === doc._id || subtree.some((d) => d._id === parent._id))) throw new Error("A document cannot be moved under itself or one of its children.");
    const parentId = parent?._id ?? (args.parentId === null || args.teamspaceId != null ? noParent : doc.parent);
    move = { space, parent: parentId, rank: (0, import_rank.makeRank)(await (0, import_document2.getFirstRank)(client, space, parentId), void 0) };
  }
  if (args.markdown != null) {
    const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(args.workspace);
    const uploadedId = await (0, import_storage.uploadMarkupBlob)(wsToken, workspaceUuid, `${args.documentId}-content-${Date.now()}`, JSON.stringify((0, import_markdown.markdownToProseMirror)(args.markdown)));
    await client.updateDoc(import_document.default.class.Document, doc.space, doc._id, { content: uploadedId });
    done.push("content replaced");
  }
  if (args.title != null && args.title !== doc.title) {
    await client.updateDoc(import_document.default.class.Document, doc.space, doc._id, { title: args.title });
    done.push(`renamed to "${args.title}"`);
  }
  if (move != null) {
    await client.updateDoc(import_document.default.class.Document, doc.space, doc._id, move);
    if (move.space !== doc.space) for (const d of subtree) await client.updateDoc(import_document.default.class.Document, d.space, d._id, { space: move.space });
    done.push(`moved${move.space !== doc.space ? ` to another teamspace (with ${subtree.length} sub-document(s))` : ""}${String(move.parent) === import_document.default.ids.NoParent ? " to top level" : " under the new parent"}`);
  }
  return `\u2705 Document **"${args.title ?? doc.title}"**: ${done.join(", ") || "no change"}.`;
});
const listDocumentComments = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const doc = await client.findOne(import_document.default.class.Document, { _id: args.documentId });
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`);
  const comments = await client.findAll(import_chunter.default.class.ChatMessage, { attachedTo: doc._id }, { sort: { createdOn: import_core.SortingOrder.Ascending }, limit: args.limit });
  if (comments.length === 0) return `No comments on "${doc.title}".`;
  const names = await (0, import_people.socialIdNames)(client, [...new Set(comments.map((c) => c.createdBy).filter((x) => x != null))]);
  const lines = comments.map((c) => `- **${names.get(c.createdBy) ?? "Unknown"}** (${new Date(c.createdOn ?? 0).toISOString().slice(0, 16).replace("T", " ")}) \u2014 \`${c._id}\`
  ${(0, import_format.markupToText)(c.message).replace(/\n/g, "\n  ")}`);
  return `## Comments on "${doc.title}" (${comments.length})

${lines.join("\n")}`;
});
const addDocumentComment = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const doc = await client.findOne(import_document.default.class.Document, { _id: args.documentId });
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`);
  await client.addCollection(import_chunter.default.class.ChatMessage, doc.space, doc._id, import_document.default.class.Document, "comments", { message: args.message });
  return `\u2705 Comment added to "${doc.title}".`;
});
const linkDocument = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const doc = await client.findOne(import_document.default.class.Document, { _id: args.documentId });
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`);
  const existing = issue.relations ?? [];
  if (existing.some((r) => r._id === doc._id)) {
    return `\u2139\uFE0F Document **"${doc.title}"** is already linked to **${args.identifier}**.`;
  }
  await client.updateDoc(import_tracker.default.class.Issue, issue.space, issue._id, {
    relations: [...existing, { _id: doc._id, _class: doc._class }]
  });
  return `\u2705 Document **"${doc.title}"** linked to **${args.identifier}** \u2014 visible in the Relations panel.`;
});
