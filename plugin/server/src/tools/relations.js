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
var relations_exports = {};
__export(relations_exports, {
  addBlockedBy: () => addBlockedBy,
  addRelation: () => addRelation,
  isLegacyLink: () => isLegacyLink,
  linkToParent: () => linkToParent,
  removeBlockedBy: () => removeBlockedBy,
  removeRelation: () => removeRelation,
  repairParentLinks: () => repairParentLinks,
  setParent: () => setParent
});
module.exports = __toCommonJS(relations_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_rank = require("../../vendor/@hcengineering/rank/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
const addRelation = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issueA = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issueA == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const issueB = await client.findOne(import_tracker.default.class.Issue, { identifier: args.relatedTo });
  if (issueB == null) throw new Error(`Issue '${args.relatedTo}' not found.`);
  const relA = { _id: issueB._id, _class: issueB._class };
  const relB = { _id: issueA._id, _class: issueA._class };
  const existingRels = issueA.relations ?? [];
  if (existingRels.some((r) => r._id === issueB._id)) {
    return `**${args.identifier}** is already related to **${args.relatedTo}**.`;
  }
  await client.updateDoc(import_tracker.default.class.Issue, issueA.space, issueA._id, {
    relations: [...existingRels, relA]
  });
  await client.updateDoc(import_tracker.default.class.Issue, issueB.space, issueB._id, {
    relations: [...issueB.relations ?? [], relB]
  });
  return `\u2705 **${args.identifier}** is now related to **${args.relatedTo}**`;
});
const addBlockedBy = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const blocker = await client.findOne(import_tracker.default.class.Issue, { identifier: args.blockedBy });
  if (blocker == null) throw new Error(`Issue '${args.blockedBy}' not found.`);
  const blockerRef = { _id: blocker._id, _class: blocker._class };
  const existing = issue.blockedBy ?? [];
  if (existing.some((r) => r._id === blocker._id)) {
    return `**${args.identifier}** is already blocked by **${args.blockedBy}**.`;
  }
  await client.updateDoc(import_tracker.default.class.Issue, issue.space, issue._id, {
    blockedBy: [...existing, blockerRef]
  });
  return `\u2705 **${args.identifier}** is now blocked by **${args.blockedBy}**`;
});
const setParent = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const child = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (child == null) throw new Error(`Issue '${args.identifier}' not found.`);
  if (args.parentIdentifier == null) {
    const result2 = await linkToParent(client, child, null);
    return result2 === "unchanged" ? `**${args.identifier}** has no parent.` : `\u2705 Cleared parent from **${args.identifier}**`;
  }
  const parent = await client.findOne(import_tracker.default.class.Issue, { identifier: args.parentIdentifier });
  if (parent == null) throw new Error(`Parent issue '${args.parentIdentifier}' not found.`);
  const result = await linkToParent(client, child, parent);
  if (result === "unchanged") return `**${args.identifier}** is already a sub-issue of **${args.parentIdentifier}**.`;
  return `\u2705 **${args.identifier}** is now a sub-issue of **${args.parentIdentifier}**${result === "repaired" ? " (repaired link from an older version)" : ""}`;
});
function isLegacyLink(issue) {
  return issue.attachedTo === import_tracker.default.ids.NoParent && (issue.parents ?? []).length > 0;
}
async function linkToParent(client, child, parent) {
  const legacy = isLegacyLink(child);
  const undoLegacy = async () => {
    const old = await client.findOne(import_tracker.default.class.Issue, { _id: child.parents[0].parentId });
    if (old == null) return;
    const childInfo = (old.childInfo ?? []).filter((c) => c.childId !== child._id);
    const removed = (old.childInfo ?? []).length - childInfo.length;
    await client.updateDoc(import_tracker.default.class.Issue, old.space, old._id, {
      childInfo,
      subIssues: Math.max(0, (old.subIssues ?? 0) - Math.max(removed, 1))
    });
  };
  if (parent == null) {
    if (child.attachedTo === import_tracker.default.ids.NoParent && (child.parents ?? []).length === 0) return "unchanged";
    if (legacy) await undoLegacy();
    await client.update(child, { attachedTo: import_tracker.default.ids.NoParent, parents: [] });
    return "cleared";
  }
  if (parent._id === child._id) throw new Error("An issue cannot be its own parent.");
  if ((parent.parents ?? []).some((p) => p.parentId === child._id)) {
    throw new Error(`${parent.identifier} is a sub-issue of ${child.identifier} \u2014 that would create a cycle.`);
  }
  if (child.attachedTo === parent._id) return "unchanged";
  const lastSibling = await client.findOne(import_tracker.default.class.Issue, { attachedTo: parent._id }, { sort: { rank: import_core.SortingOrder.Descending } });
  if (legacy) await undoLegacy();
  await client.update(child, { attachedTo: parent._id, rank: (0, import_rank.makeRank)(lastSibling?.rank, void 0) });
  return legacy ? "repaired" : "linked";
}
const repairParentLinks = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
  const issues = await client.findAll(import_tracker.default.class.Issue, { space: project._id });
  const byId = new Map(issues.map((i) => [i._id, i]));
  const legacy = issues.filter(isLegacyLink);
  if (legacy.length === 0) return `No broken parent links in ${args.projectIdentifier}.`;
  const lines = [];
  let repaired = 0;
  let skipped = 0;
  for (const child of legacy) {
    const parentRef = child.parents[0];
    const parent = byId.get(parentRef.parentId) ?? await client.findOne(import_tracker.default.class.Issue, { _id: parentRef.parentId });
    if (parent == null) {
      skipped++;
      lines.push(`- ${child.identifier}: parent ${parentRef.identifier} no longer exists \u2014 skipped`);
      continue;
    }
    if (args.dryRun) {
      lines.push(`- ${child.identifier} \u2192 under ${parent.identifier}`);
      continue;
    }
    await linkToParent(client, child, parent);
    repaired++;
    lines.push(`- ${child.identifier} \u2192 under ${parent.identifier} \u2705`);
  }
  const head = args.dryRun ? `## Dry run: ${legacy.length - skipped} sub-issue(s) in ${args.projectIdentifier} would be re-linked${skipped > 0 ? `, ${skipped} skipped` : ""}
Run again with dryRun=false to apply.` : `## Repaired ${repaired} sub-issue link(s) in ${args.projectIdentifier}${skipped > 0 ? `, ${skipped} skipped` : ""}`;
  return `${head}

${lines.join("\n")}`;
});
const removeRelation = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issueA = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issueA == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const issueB = await client.findOne(import_tracker.default.class.Issue, { identifier: args.relatedTo });
  if (issueB == null) throw new Error(`Issue '${args.relatedTo}' not found.`);
  const aHas = (issueA.relations ?? []).some((r) => r._id === issueB._id);
  const bHas = (issueB.relations ?? []).some((r) => r._id === issueA._id);
  if (!aHas && !bHas) return `**${args.identifier}** and **${args.relatedTo}** are not related.`;
  if (aHas) await client.updateDoc(import_tracker.default.class.Issue, issueA.space, issueA._id, { relations: (issueA.relations ?? []).filter((r) => r._id !== issueB._id) });
  if (bHas) await client.updateDoc(import_tracker.default.class.Issue, issueB.space, issueB._id, { relations: (issueB.relations ?? []).filter((r) => r._id !== issueA._id) });
  return `\u2705 **${args.identifier}** and **${args.relatedTo}** are no longer related`;
});
const removeBlockedBy = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.identifier });
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`);
  const blocker = await client.findOne(import_tracker.default.class.Issue, { identifier: args.blockedBy });
  if (blocker == null) throw new Error(`Issue '${args.blockedBy}' not found.`);
  const existing = issue.blockedBy ?? [];
  if (!existing.some((r) => r._id === blocker._id)) return `**${args.identifier}** is not blocked by **${args.blockedBy}**.`;
  await client.updateDoc(import_tracker.default.class.Issue, issue.space, issue._id, { blockedBy: existing.filter((r) => r._id !== blocker._id) });
  return `\u2705 **${args.identifier}** is no longer blocked by **${args.blockedBy}**`;
});
