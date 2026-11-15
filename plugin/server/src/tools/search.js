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
var search_exports = {};
__export(search_exports, {
  SEARCH_KINDS: () => SEARCH_KINDS,
  searchAll: () => searchAll,
  searchIssues: () => searchIssues
});
module.exports = __toCommonJS(search_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
const searchIssues = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const result = await client.searchFulltext(
    { query: args.query, classes: [import_tracker.default.class.Issue] },
    { limit: args.limit }
  );
  if (result.docs.length === 0) return `No issues found for query: "${args.query}"`;
  const enriched = await Promise.all(
    result.docs.map(async (r) => {
      const issue = await client.findOne(import_tracker.default.class.Issue, { _id: r.id });
      if (issue == null) return null;
      const status = await client.findOne(import_tracker.default.class.IssueStatus, { _id: issue.status });
      return { issue, statusName: status?.name ?? "Unknown" };
    })
  );
  const lines = enriched.filter((e) => e !== null).map((e) => {
    const due = e.issue.dueDate != null ? ` | Due: ${(0, import_format.formatDate)(e.issue.dueDate)}` : "";
    return `- **${e.issue.identifier}** [${e.statusName}] [${(0, import_format.priorityLabel)(e.issue.priority)}]${due}
  ${e.issue.title}`;
  });
  return `## Search results for "${args.query}" (${lines.length})

${lines.join("\n")}`;
});
const SEARCH_KINDS = {
  issue: "tracker:class:Issue",
  document: "document:class:Document",
  message: "chunter:class:ChatMessage",
  card: "card:class:Card",
  file: "drive:class:File",
  person: "contact:class:Person",
  organization: "contact:class:Organization",
  "test-case": "testManagement:class:TestCase",
  attachment: "attachment:class:Attachment"
};
const shortClass = (c) => c.split(":").pop() ?? c;
const searchAll = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const classes = args.kinds?.map((k) => SEARCH_KINDS[k] ?? k);
  const result = await client.searchFulltext({ query: args.query, ...classes != null && classes.length > 0 ? { classes } : {} }, { limit: args.limit });
  const docs = result.docs ?? [];
  if (docs.length === 0) return `Nothing found for "${args.query}". (Needs Huly's fulltext indexer; very new changes may not be indexed yet.)`;
  const lines = docs.map((r) => {
    const title = r.shortTitle != null && r.title != null && r.shortTitle !== r.title ? `${r.shortTitle}: ${r.title}` : r.title ?? r.shortTitle ?? "(untitled)";
    const where = r.doc?.attachedTo != null ? ` \xB7 on \`${r.doc.attachedTo}\`` : "";
    const desc = r.description != null && r.description !== "" ? `
  ${String(r.description).replace(/\s+/g, " ").slice(0, 160)}` : "";
    return `- [${shortClass(r.doc?._class ?? "")}] **${String(title)}** \u2014 \`${String(r.id)}\`${where}${desc}`;
  });
  return `## Search "${args.query}" (${docs.length}${result.total != null && result.total > docs.length ? ` of ${result.total}` : ""})

${lines.join("\n")}`;
});
