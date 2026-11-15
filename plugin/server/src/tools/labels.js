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
var labels_exports = {};
__export(labels_exports, {
  addLabel: () => addLabel,
  createLabel: () => createLabel,
  createLabelCategory: () => createLabelCategory,
  deleteLabel: () => deleteLabel,
  listLabelCategories: () => listLabelCategories,
  listLabels: () => listLabels,
  removeLabel: () => removeLabel,
  setLabelCategory: () => setLabelCategory,
  updateLabel: () => updateLabel
});
module.exports = __toCommonJS(labels_exports);
var import_tags = __toESM(require("../../vendor/@hcengineering/tags/lib/index.js"));
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_core = __toESM(require("../../vendor/@hcengineering/core/lib/index.js"));
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
const listLabels = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const allLabels = await client.findAll(import_tags.default.class.TagElement, { targetClass: import_tracker.default.class.Issue });
  if (allLabels.length === 0) return "No labels found in this workspace.";
  const lines = allLabels.map((l) => {
    const color = l.color != null ? ` (color: #${l.color.toString(16).padStart(6, "0")})` : "";
    return `- **${l.title}**${color} \u2014 used ${l.refCount ?? 0} time(s) | id: \`${l._id}\``;
  });
  return `## Labels (${allLabels.length})

${lines.join("\n")}`;
});
const createLabel = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const existing = await client.findOne(import_tags.default.class.TagElement, {
    targetClass: import_tracker.default.class.Issue,
    title: args.title
  });
  if (existing != null) {
    return `Label **${args.title}** already exists (id: \`${existing._id}\`).`;
  }
  const category = await client.findOne(import_tags.default.class.TagCategory, {
    targetClass: import_tracker.default.class.Issue
  });
  const labelId = (0, import_core.generateId)();
  await client.createDoc(
    import_tags.default.class.TagElement,
    import_core.default.space.Workspace,
    {
      title: args.title,
      targetClass: import_tracker.default.class.Issue,
      description: "",
      color: args.color != null ? parseInt(args.color.replace("#", ""), 16) : 8,
      category: category?._id ?? import_tags.default.category.NoCategory,
      refCount: 0
    },
    labelId
  );
  return `\u2705 Created label **${args.title}** (id: \`${labelId}\`)`;
});
const addLabel = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  let label = await client.findOne(import_tags.default.class.TagElement, {
    targetClass: import_tracker.default.class.Issue,
    title: args.labelName
  });
  if (label == null) {
    const category = await client.findOne(import_tags.default.class.TagCategory, {
      targetClass: import_tracker.default.class.Issue
    });
    const labelId = (0, import_core.generateId)();
    await client.createDoc(
      import_tags.default.class.TagElement,
      import_core.default.space.Workspace,
      {
        title: args.labelName,
        targetClass: import_tracker.default.class.Issue,
        description: "",
        color: 8,
        category: category?._id ?? import_tags.default.category.NoCategory,
        refCount: 0
      },
      labelId
    );
    label = await client.findOne(import_tags.default.class.TagElement, { _id: labelId });
    if (label == null) throw new Error(`Failed to create label '${args.labelName}'.`);
  }
  const existing = await client.findOne(import_tags.default.class.TagReference, {
    attachedTo: issue._id,
    tag: label._id
  });
  if (existing != null) {
    return `Label **${args.labelName}** is already on **${args.identifier}**.`;
  }
  await client.addCollection(
    import_tags.default.class.TagReference,
    issue.space,
    issue._id,
    import_tracker.default.class.Issue,
    "labels",
    {
      tag: label._id,
      title: label.title,
      color: label.color
    }
  );
  return `\u2705 Added label **${args.labelName}** to **${args.identifier}**`;
});
const removeLabel = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const label = await client.findOne(import_tags.default.class.TagElement, {
    targetClass: import_tracker.default.class.Issue,
    title: args.labelName
  });
  if (label == null) throw new Error(`Label '${args.labelName}' not found.`);
  const ref = await client.findOne(import_tags.default.class.TagReference, {
    attachedTo: issue._id,
    tag: label._id
  });
  if (ref == null) {
    return `Label **${args.labelName}** is not on **${args.identifier}**.`;
  }
  await client.removeCollection(
    import_tags.default.class.TagReference,
    issue.space,
    ref._id,
    issue._id,
    import_tracker.default.class.Issue,
    "labels"
  );
  return `\u2705 Removed label **${args.labelName}** from **${args.identifier}**`;
});
async function findLabel(client, title) {
  const label = await client.findOne(import_tags.default.class.TagElement, { targetClass: import_tracker.default.class.Issue, title });
  if (label == null) throw new Error(`Label '${title}' not found.`);
  return label;
}
const updateLabel = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const label = await findLabel(client, args.labelName);
  const updates = {};
  if (args.newName !== void 0 && args.newName !== label.title) {
    const clash = await client.findOne(import_tags.default.class.TagElement, { targetClass: import_tracker.default.class.Issue, title: args.newName });
    if (clash != null) throw new Error(`A label named '${args.newName}' already exists.`);
    updates.title = args.newName;
  }
  if (args.color !== void 0) updates.color = parseInt(args.color.replace("#", ""), 16);
  if (args.description !== void 0) updates.description = args.description;
  if (Object.keys(updates).length === 0) return `Nothing to update for label **${label.title}**.`;
  await client.updateDoc(import_tags.default.class.TagElement, label.space, label._id, updates);
  const refUpdates = {};
  if (updates.title !== void 0) refUpdates.title = updates.title;
  if (updates.color !== void 0) refUpdates.color = updates.color;
  let synced = 0;
  if (Object.keys(refUpdates).length > 0) {
    const refs = await client.findAll(import_tags.default.class.TagReference, { tag: label._id });
    for (const ref of refs) {
      await client.updateCollection(import_tags.default.class.TagReference, ref.space, ref._id, ref.attachedTo, ref.attachedToClass, ref.collection, refUpdates);
      synced++;
    }
  }
  return `\u2705 Label **${updates.title ?? label.title}** updated (${Object.keys(updates).map((k) => k === "title" ? "name" : k).join(", ")})${synced > 0 ? ` on ${synced} issue(s)` : ""}.`;
});
const deleteLabel = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const label = await findLabel(client, args.labelName);
  const refs = await client.findAll(import_tags.default.class.TagReference, { tag: label._id });
  for (const ref of refs) {
    await client.removeCollection(import_tags.default.class.TagReference, ref.space, ref._id, ref.attachedTo, ref.attachedToClass, ref.collection);
  }
  await client.removeDoc(import_tags.default.class.TagElement, label.space, label._id);
  return `\u{1F5D1}\uFE0F Label **${label.title}** deleted${refs.length > 0 ? ` and removed from ${refs.length} issue(s)` : ""}.`;
});
const listLabelCategories = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const categories = await client.findAll(import_tags.default.class.TagCategory, { targetClass: import_tracker.default.class.Issue });
  const labels = await client.findAll(import_tags.default.class.TagElement, { targetClass: import_tracker.default.class.Issue });
  if (categories.length === 0) return "No label categories.";
  const lines = categories.map((c) => {
    const own = labels.filter((l) => l.category === c._id).map((l) => l.title);
    return `- **${String(c.label)}**${c.default === true ? " (default)" : ""} \u2014 ${own.length > 0 ? own.join(", ") : "no labels"} \u2014 \`${String(c._id)}\``;
  });
  const loose = labels.filter((l) => !categories.some((c) => c._id === l.category)).map((l) => l.title);
  return `## Label categories (${categories.length})

${lines.join("\n")}${loose.length > 0 ? `

Without category: ${loose.join(", ")}` : ""}`;
});
const createLabelCategory = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const existing = await client.findAll(import_tags.default.class.TagCategory, { targetClass: import_tracker.default.class.Issue });
  const same = existing.find((c) => String(c.label).toLowerCase() === args.name.toLowerCase());
  if (same != null) return `\u2139\uFE0F Category **${String(same.label)}** already exists \u2014 \`${String(same._id)}\`.`;
  const id = await client.createDoc(import_tags.default.class.TagCategory, import_core.default.space.Workspace, { label: args.name, targetClass: import_tracker.default.class.Issue, icon: import_tags.default.icon.Tags, tags: [], default: false });
  return `\u2705 Label category **${args.name}** created \u2014 \`${String(id)}\`.`;
});
const setLabelCategory = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const label = await client.findOne(import_tags.default.class.TagElement, { targetClass: import_tracker.default.class.Issue, title: args.labelName });
  if (label == null) throw new Error(`Label '${args.labelName}' not found.`);
  const categories = await client.findAll(import_tags.default.class.TagCategory, { targetClass: import_tracker.default.class.Issue });
  const cat = categories.find((c) => c._id === args.category || String(c.label).toLowerCase() === args.category.toLowerCase());
  if (cat == null) throw new Error(`Category '${args.category}' not found. Available: ${categories.map((c) => c.label).join(", ")}.`);
  await client.updateDoc(import_tags.default.class.TagElement, label.space, label._id, { category: cat._id });
  return `\u2705 Label **${args.labelName}** is now in category **${String(cat.label)}**.`;
});
