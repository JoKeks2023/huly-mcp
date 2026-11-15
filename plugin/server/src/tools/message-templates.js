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
var message_templates_exports = {};
__export(message_templates_exports, {
  MT: () => MT,
  createMessageTemplate: () => createMessageTemplate,
  deleteMessageTemplate: () => deleteMessageTemplate,
  getMessageTemplate: () => getMessageTemplate,
  listMessageTemplates: () => listMessageTemplates,
  updateMessageTemplate: () => updateMessageTemplate
});
module.exports = __toCommonJS(message_templates_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_markdown = require("../utils/markdown.js");
var import_people = require("../utils/people.js");
var import_tasks = require("../utils/tasks.js");
const markdownToMarkup = (md) => JSON.stringify((0, import_markdown.markdownToProseMirror)(md));
const MT = { Template: "templates:class:MessageTemplate", Category: "templates:class:TemplateCategory", Default: "templates:space:Templates" };
async function findCategory(client, ref) {
  if (ref == null) {
    const def = await client.findOne(MT.Category, { _id: MT.Default });
    if (def == null) throw new Error("No default template category \u2014 pass category.");
    return def;
  }
  return await (0, import_tasks.findNamed)(client, MT.Category, ref, "Template category");
}
async function findTemplate(client, ref) {
  return await (0, import_tasks.findNamed)(client, MT.Template, ref, "Message template");
}
const listMessageTemplates = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const cats = await client.findAll(MT.Category, {});
  const tpls = await client.findAll(MT.Template, {});
  if (tpls.length === 0) return `No message templates. Categories: ${cats.map((c) => c.name).join(", ") || "none"}.`;
  const lines = [];
  for (const c of cats) {
    const mine = tpls.filter((t) => t.space === c._id);
    if (mine.length === 0) continue;
    lines.push(`### ${String(c.name)}`);
    for (const t of mine) {
      const text = (0, import_format.markupToText)(t.message).replace(/\s+/g, " ").trim();
      lines.push(`- **${String(t.title)}** \u2014 ${text.slice(0, 100)}${text.length > 100 ? "\u2026" : ""} \u2014 \`${String(t._id)}\``);
    }
  }
  return `## Message templates (${tpls.length})

${lines.join("\n")}`;
});
const getMessageTemplate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const t = await findTemplate(client, args.template);
  const text = (0, import_format.markupToText)(t.message);
  const fields = [...new Set([...text.matchAll(/\$\{(\S+?)\}/g)].map((m) => m[1]))];
  return `## ${String(t.title)}

${text}${fields.length > 0 ? `

**Placeholders:** ${fields.join(", ")}` : ""}`;
});
const createMessageTemplate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  let cat;
  if (args.newCategory === true) {
    if (args.category == null) throw new Error("newCategory needs category (its name).");
    const id2 = (0, import_core.generateId)();
    await client.createDoc(MT.Category, "core:space:Space", { name: args.category.trim(), description: "", private: false, archived: false, members: [await (0, import_people.currentAccountUuid)(client)] }, id2);
    cat = { _id: id2, name: args.category.trim() };
  } else cat = await findCategory(client, args.category);
  const id = (0, import_core.generateId)();
  await client.createDoc(MT.Template, cat._id, { title: args.title.trim(), message: markdownToMarkup(args.message) }, id);
  return `\u2705 Template **${args.title}** in ${String(cat.name)} \u2014 \`${id}\``;
});
const updateMessageTemplate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const t = await findTemplate(client, args.template);
  const update = {};
  if (args.title != null) update.title = args.title.trim();
  if (args.message != null) update.message = markdownToMarkup(args.message);
  if (Object.keys(update).length === 0) throw new Error("Nothing to change.");
  await client.updateDoc(MT.Template, t.space, t._id, update);
  return `\u2705 Template **${String(update.title ?? t.title)}** updated: ${Object.keys(update).join(", ")}.`;
});
const deleteMessageTemplate = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const t = await findTemplate(client, args.template);
  await client.removeDoc(MT.Template, t.space, t._id);
  return `\u{1F5D1}\uFE0F Template **${String(t.title)}** deleted.`;
});
