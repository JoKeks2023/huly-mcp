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
var qms_exports = {};
__export(qms_exports, {
  QMS: () => QMS,
  getControlledDocument: () => getControlledDocument,
  getTraining: () => getTraining,
  listControlledDocuments: () => listControlledDocuments,
  listTrainings: () => listTrainings
});
module.exports = __toCommonJS(qms_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_content = require("../utils/content.js");
var import_people = require("../utils/people.js");
const QMS = {
  Space: "documents:class:DocumentSpace",
  Meta: "documents:class:DocumentMeta",
  ProjectMeta: "documents:class:ProjectMeta",
  ProjectDoc: "documents:class:ProjectDocument",
  Doc: "documents:class:ControlledDocument",
  Category: "documents:class:DocumentCategory",
  ChangeControl: "documents:class:ChangeControl",
  Request: "documents:class:DocumentRequest",
  Template: "documents:mixin:DocumentTemplate",
  NoProject: "documents:ids:NoProject",
  NoParent: "documents:ids:NoParent",
  Folder: "documents:ids:Folder",
  Training: "training:class:Training",
  TrainingRequest: "training:class:TrainingRequest",
  Attempt: "training:class:TrainingAttempt",
  Question: "questions:class:Question"
};
const version = (d) => `v${Number(d.major ?? 0)}.${Number(d.minor ?? 0)}`;
const state = (d) => `${String(d.state)}${d.controlledState != null ? `/${String(d.controlledState)}` : ""}`;
const newest = (a, b) => b.seqNumber - a.seqNumber || b.major - a.major || b.minor - a.minor || b.createdOn - a.createdOn;
const listControlledDocuments = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const spaces = (await client.findAll(QMS.Space, {})).filter((s) => s._class !== "products:class:Product");
  const chosen = args.space != null ? spaces.filter((s) => s._id === args.space || String(s.name).toLowerCase() === args.space.toLowerCase()) : spaces;
  if (chosen.length === 0) throw new Error(`Document space '${args.space ?? ""}' not found. Spaces: ${spaces.map((s) => s.name).join(", ") || "none"}.`);
  const names = await (0, import_people.peopleNames)(client);
  const out = [];
  for (const sp of chosen) {
    const [metas, pms] = await Promise.all([client.findAll(QMS.Meta, { space: sp._id }), client.findAll(QMS.ProjectMeta, { space: sp._id, project: QMS.NoProject })]);
    const pds = pms.length > 0 ? await client.findAll(QMS.ProjectDoc, { attachedTo: { $in: pms.map((p) => p._id) } }) : [];
    const docIds = pds.map((p) => p.document).filter((d) => d !== QMS.Folder);
    const docs = docIds.length > 0 ? await client.findAll(QMS.Doc, { _id: { $in: docIds } }) : [];
    out.push(`## ${String(sp.name)} (${docs.filter((d) => d[QMS.Template] == null).length} version(s))`);
    const walk = (parent, depth) => {
      const kids = pms.filter((p) => p.parent === parent).sort((a, b) => String(a.rank).localeCompare(String(b.rank)));
      for (const pm of kids) {
        const meta = metas.find((m) => m._id === pm.meta);
        const mine = pds.filter((p) => p.attachedTo === pm._id);
        const isFolder = mine.some((p) => p.document === QMS.Folder);
        const versions = docs.filter((d) => mine.some((p) => p.document === d._id) && (args.includeTemplates === true || d[QMS.Template] == null)).sort(newest);
        if (isFolder) out.push(`${"  ".repeat(depth)}- \u{1F4C1} ${String(meta?.title ?? "?")}`);
        else if (versions.length > 0) {
          const d = versions[0];
          out.push(`${"  ".repeat(depth)}- **${String(d.code)}** ${String(d.title)} ${version(d)} \u2014 ${state(d)}${d.effectiveDate != null ? ` \xB7 effective ${(0, import_format.formatDate)(d.effectiveDate)}` : ""}${d.owner != null ? ` \xB7 owner ${names.get(d.owner) ?? "?"}` : ""}${versions.length > 1 ? ` \xB7 ${versions.length} versions` : ""}${d[QMS.Template] != null ? " \xB7 template" : ""}`);
        }
        walk(pm.meta, depth + 1);
      }
    };
    walk(QMS.NoParent, 0);
  }
  return out.join("\n");
});
const getControlledDocument = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const ref = args.document.trim();
  let docs = await client.findAll(QMS.Doc, { code: ref.toUpperCase() });
  if (docs.length === 0) {
    const byId = await client.findOne(QMS.Doc, { _id: ref });
    if (byId != null) docs = await client.findAll(QMS.Doc, { attachedTo: byId.attachedTo });
  }
  if (docs.length === 0) {
    const all = await client.findAll(QMS.Doc, {});
    const hits = all.filter((d2) => String(d2.title).toLowerCase() === ref.toLowerCase());
    if (hits.length > 0) docs = all.filter((d2) => d2.attachedTo === hits[0].attachedTo);
  }
  if (docs.length === 0) throw new Error(`Controlled document '${args.document}' not found (use its code like SOP-12, its title or id).`);
  docs.sort(newest);
  const d = docs[0];
  const names = await (0, import_people.peopleNames)(client);
  const who = (ids) => (ids ?? []).map((i) => names.get(i) ?? "?").join(", ") || "\u2014";
  const [category, change, requests] = await Promise.all([
    d.category != null ? client.findOne(QMS.Category, { _id: d.category }) : void 0,
    d.changeControl != null ? client.findOne(QMS.ChangeControl, { _id: d.changeControl }) : void 0,
    client.findAll(QMS.Request, { attachedTo: d._id })
  ]);
  const out = [
    `## ${String(d.code)} ${String(d.title)} ${version(d)}`,
    `**State:** ${state(d)} \xB7 **Category:** ${category != null ? `${String(category.code)} ${String(category.title)}` : "\u2014"} \xB7 **Effective:** ${(0, import_format.formatDate)(d.effectiveDate)}${d.plannedEffectiveDate != null ? ` (planned ${(0, import_format.formatDate)(d.plannedEffectiveDate)})` : ""}`,
    `**Author:** ${who(d.author != null ? [d.author] : [])} \xB7 **Owner:** ${who(d.owner != null ? [d.owner] : [])} \xB7 **Co-authors:** ${who(d.coAuthors)}`,
    `**Reviewers:** ${who(d.reviewers)} \xB7 **Approvers:** ${who(d.approvers)}${d.reviewInterval != null ? ` \xB7 review every ${Number(d.reviewInterval)} months` : ""}`
  ];
  if (d.abstract != null && d.abstract !== "") out.push("", `**Abstract:** ${String(d.abstract)}`);
  if (change != null && [change.description, change.reason, change.impact].some((x) => x != null && x !== "")) {
    out.push("", "### Change control", `- Reason: ${(0, import_format.markupToText)(change.reason) || "\u2014"}`, `- Description: ${(0, import_format.markupToText)(change.description) || "\u2014"}`, `- Impact: ${(0, import_format.markupToText)(change.impact) || "\u2014"}`);
  }
  if (requests.length > 0) {
    out.push("", "### Review / approval requests");
    for (const r of requests) out.push(`- ${String(r._class).split(":").pop() ?? ""}: ${String(r.status)} \xB7 approved by ${who(r.approved)} of ${who(r.requested)}${(r.rejected ?? []).length > 0 ? ` \xB7 rejected by ${who(r.rejected)}` : ""}`);
  }
  if (docs.length > 1) out.push("", "### Versions", ...docs.map((v) => `- ${version(v)} \u2014 ${state(v)}${v.effectiveDate != null ? ` \xB7 effective ${(0, import_format.formatDate)(v.effectiveDate)}` : ""} \u2014 \`${String(v._id)}\``));
  if (args.content !== false) {
    const text = await (0, import_content.readMarkup)(args.workspace, d.content);
    out.push("", "### Content", text.trim() !== "" ? text : "_(empty)_");
  }
  return out.join("\n");
});
const listTrainings = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const all = await client.findAll(QMS.Training, {}, { sort: { revision: import_core.SortingOrder.Descending } });
  const latest = /* @__PURE__ */ new Map();
  for (const t of all) if (!latest.has(t.code)) latest.set(t.code, t);
  const list = [...latest.values()].filter((t) => args.includeArchived === true || !["archived", "deleted"].includes(t.state));
  if (list.length === 0) return "No trainings.";
  const names = await (0, import_people.peopleNames)(client);
  const lines = list.map((t) => `- **${String(t.code)}** rev ${Number(t.revision)} \u2014 ${String(t.title)} \u2014 ${String(t.state)} \xB7 pass ${Number(t.passingScore)}% \xB7 ${Number(t.questions ?? 0)} question(s) \xB7 ${Number(t.requests ?? 0)} request(s) \xB7 owner ${names.get(t.owner) ?? "?"}`);
  return `## Trainings (${list.length})

${lines.join("\n")}`;
});
const getTraining = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const all = await client.findAll(QMS.Training, {}, { sort: { revision: import_core.SortingOrder.Descending } });
  const t = all.find((x) => x._id === args.training || String(x.code).toLowerCase() === args.training.toLowerCase() || String(x.title).toLowerCase() === args.training.toLowerCase());
  if (t == null) throw new Error(`Training '${args.training}' not found (code like TR-3, title or id).`);
  const names = await (0, import_people.peopleNames)(client);
  const [questions, requests] = await Promise.all([
    client.findAll(QMS.Question, { attachedTo: t._id }, { sort: { rank: import_core.SortingOrder.Ascending } }),
    client.findAll(QMS.TrainingRequest, { attachedTo: t._id })
  ]);
  const attempts = requests.length > 0 ? await client.findAll(QMS.Attempt, { attachedTo: { $in: requests.map((r) => r._id) } }) : [];
  const out = [`## ${String(t.code)} rev ${Number(t.revision)}: ${String(t.title)}`, `**State:** ${String(t.state)} \xB7 **Passing score:** ${Number(t.passingScore)}%${t.releasedOn != null ? ` \xB7 released ${(0, import_format.formatDate)(t.releasedOn)}` : ""}`];
  const desc = (0, import_format.markupToText)(t.description).trim();
  if (desc !== "") out.push("", desc);
  out.push("", `### Questions (${questions.length})`);
  questions.forEach((q, i) => {
    const kind = String(q._class).split(":").pop() ?? "";
    const opts = (q.questionData?.options ?? []).map((o) => (0, import_format.markupToText)(o.label).trim());
    const a = q.assessmentData ?? {};
    const correct = new Set(a.correctIndex != null ? [a.correctIndex] : a.correctIndices ?? []);
    out.push(`${i + 1}. ${(0, import_format.markupToText)(q.title).trim()} _(${kind})_`);
    opts.forEach((o, j) => out.push(`   - ${args.showAnswers === true && correct.has(j) ? "\u2705 " : ""}${o}`));
    if (args.showAnswers === true && a.correctOrder != null) out.push(`   - correct order: ${opts.map((o, i2) => ({ o, pos: Number(a.correctOrder[i2]) })).sort((x, y) => x.pos - y.pos).map((x) => x.o).join(" \u2192 ")}`);
  });
  if (requests.length > 0) {
    out.push("", "### Assignments");
    for (const r of requests) {
      const mine = attempts.filter((x) => x.attachedTo === r._id);
      const per = (r.trainees ?? []).map((p) => {
        const best = mine.filter((x) => x.owner === p).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))[0];
        return `${names.get(p) ?? "?"}: ${best != null ? `${String(best.state)}${best.score != null ? ` ${Number(best.score)}%` : ""}` : "not started"}`;
      });
      out.push(`- due ${(0, import_format.formatDate)(r.dueDate)}${r.canceledOn != null ? " (canceled)" : ""} \u2014 ${per.join("; ") || "no trainees"} \u2014 \`${String(r._id)}\``);
    }
  }
  return out.join("\n");
});
