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
var surveys_exports = {};
__export(surveys_exports, {
  SV: () => SV,
  getSurvey: () => getSurvey,
  listSurveys: () => listSurveys
});
module.exports = __toCommonJS(surveys_exports);
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
const SV = { Survey: "survey:class:Survey", Poll: "survey:class:Poll" };
const KIND = { string: "free text", option: "single choice", options: "multiple choice" };
const listSurveys = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const surveys = await client.findAll(SV.Survey, {});
  if (surveys.length === 0) return "No surveys (the module may be disabled).";
  const polls = await client.findAll(SV.Poll, {});
  const lines = surveys.map((s) => {
    const mine = polls.filter((p) => p.survey === s._id);
    return `- **${String(s.name)}** \u2014 ${(s.questions ?? []).length} question(s) \xB7 ${mine.length} poll(s), ${mine.filter((p) => p.isCompleted === true).length} completed \u2014 \`${String(s._id)}\``;
  });
  return `## Surveys (${surveys.length})

${lines.join("\n")}`;
});
const getSurvey = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const all = await client.findAll(SV.Survey, {});
  const s = all.find((x) => x._id === args.survey || String(x.name).toLowerCase() === args.survey.trim().toLowerCase());
  if (s == null) throw new Error(`Survey '${args.survey}' not found. Surveys: ${all.map((x) => x.name).join(", ") || "none"}.`);
  const polls = await client.findAll(SV.Poll, { survey: s._id });
  const done = polls.filter((p) => p.isCompleted === true);
  const out = [`## ${String(s.name)}`];
  if (s.prompt != null && s.prompt !== "") out.push(String(s.prompt));
  out.push("", `### Questions \u2014 results from ${done.length} completed of ${polls.length} poll(s)`);
  (s.questions ?? []).forEach((q, i) => {
    out.push(`${i + 1}. ${String(q.name)} _(${KIND[q.kind] ?? q.kind}${q.isMandatory === true ? ", required" : ""})_`);
    const answers = done.map((p) => (p.questions ?? [])[i]).filter((a) => a != null && a.name === q.name);
    if (q.kind === "string") {
      for (const a of answers.filter((x) => x.answer != null && x.answer !== "").slice(0, args.maxTextAnswers ?? 10)) out.push(`   - \u201C${String(a.answer)}\u201D`);
      return;
    }
    const opts = q.options ?? [];
    opts.forEach((o, j) => {
      const n = answers.filter((a) => (a.answers ?? []).includes(j)).length;
      out.push(`   - ${o}${done.length > 0 ? `: ${n}` : ""}`);
    });
    const custom = answers.filter((a) => a.answer != null && a.answer !== "");
    if (q.hasCustomOption === true && custom.length > 0) out.push(`   - other: ${custom.map((a) => `\u201C${String(a.answer)}\u201D`).join(", ")}`);
  });
  return out.join("\n");
});
