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
var training_exports = {};
__export(training_exports, {
  addTrainingQuestions: () => addTrainingQuestions,
  assignTraining: () => assignTraining,
  cancelTrainingRequest: () => cancelTrainingRequest,
  createTraining: () => createTraining,
  questionDoc: () => questionDoc,
  releaseTraining: () => releaseTraining
});
module.exports = __toCommonJS(training_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_rank = require("../../vendor/@hcengineering/rank/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_markdown = require("../utils/markdown.js");
var import_people = require("../utils/people.js");
const T = {
  Training: "training:class:Training",
  Request: "training:class:TrainingRequest",
  Space: "training:space:Trainings",
  Question: "questions:class:Question"
};
const QUESTION_CLASS = {
  single: { question: "questions:class:SingleChoiceQuestion", assessment: "questions:class:SingleChoiceAssessment" },
  multiple: { question: "questions:class:MultipleChoiceQuestion", assessment: "questions:class:MultipleChoiceAssessment" },
  ordering: { question: "questions:class:OrderingQuestion", assessment: "questions:class:OrderingAssessment" }
};
function questionDoc(q, n) {
  const where = `Question ${n} ("${q.title}")`;
  if (q.options.length < 2) throw new Error(`${where}: give at least two options.`);
  const options = q.options.map((label) => ({ label }));
  const kind = QUESTION_CLASS[q.type];
  if (q.correct == null) return { _class: kind.question, data: { title: q.title, questionData: { options } } };
  const idx = (Array.isArray(q.correct) ? q.correct : [q.correct]).map((c) => {
    const i = typeof c === "number" ? c - 1 : q.options.findIndex((o) => o.trim().toLowerCase() === String(c).trim().toLowerCase());
    if (i < 0 || i >= q.options.length) throw new Error(`${where}: correct answer '${String(c)}' is not one of the options (use the option text or its number, 1 = first).`);
    return i;
  });
  let assessmentData;
  if (q.type === "single") {
    if (idx.length !== 1) throw new Error(`${where}: a single-choice question has exactly one correct answer.`);
    assessmentData = { correctIndex: idx[0] };
  } else if (q.type === "multiple") {
    assessmentData = { correctIndices: [...new Set(idx)].sort((a, b) => a - b) };
  } else {
    if (idx.length !== q.options.length || new Set(idx).size !== idx.length) throw new Error(`${where}: for ordering, list every option once, in the correct order.`);
    const correctOrder = q.options.map((_o, i) => idx.indexOf(i) + 1);
    assessmentData = { correctOrder };
  }
  return { _class: kind.assessment, data: { title: q.title, questionData: { options }, assessmentData } };
}
async function findTraining(client, ref, state) {
  const all = await client.findAll(T.Training, {}, { sort: { revision: import_core.SortingOrder.Descending } });
  const matches = all.filter((x) => x._id === ref || String(x.code).toLowerCase() === ref.toLowerCase() || String(x.title).toLowerCase() === ref.toLowerCase());
  if (matches.length === 0) throw new Error(`Training '${ref}' not found (code like TR-3, title or id; list_trainings).`);
  if (state != null) {
    const inState = matches.find((x) => x.state === state);
    if (inState != null) return inState;
    throw new Error(`Training '${ref}' has no ${state} revision (latest: rev ${Number(matches[0].revision)}, ${String(matches[0].state)}).`);
  }
  return matches[0];
}
async function addQuestions(client, training, questions, owner) {
  const docs = questions.map((q, i) => questionDoc(q, i + 1));
  const existing = await client.findAll(T.Question, { attachedTo: training._id, collection: "questions" }, { sort: { rank: import_core.SortingOrder.Descending }, limit: 1 });
  let rank = existing[0]?.rank;
  for (const d of docs) {
    rank = (0, import_rank.makeRank)(rank, void 0);
    await client.addCollection(d._class, training.space, training._id, T.Training, "questions", { ...d.data, rank, owner, releasedOn: null, releasedBy: null });
  }
  return docs.length;
}
const createTraining = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  (args.questions ?? []).forEach((q, i) => questionDoc(q, i + 1));
  const me = await (0, import_people.currentPerson)(client);
  const sequence = await client.findOne("core:class:Sequence", { attachedTo: T.Training });
  if (sequence == null) throw new Error("The training module is not set up in this workspace (no training sequence).");
  const inc = await client.updateDoc(sequence._class, sequence.space, sequence._id, { $inc: { sequence: 1 } }, true);
  const code = `TR-${Number(inc?.object?.sequence ?? sequence.sequence + 1)}`;
  const id = await client.createDoc(T.Training, T.Space, {
    title: args.title,
    code,
    revision: 1,
    state: "draft",
    owner: me._id,
    author: me._id,
    description: JSON.stringify((0, import_markdown.markdownToProseMirror)(args.description ?? "")),
    attachments: 0,
    passingScore: args.passingScore,
    releasedOn: null,
    releasedBy: null,
    questions: 0,
    requests: 0
  });
  const training = await client.findOne(T.Training, { _id: id });
  const n = args.questions != null && args.questions.length > 0 ? await addQuestions(client, training, args.questions, me._id) : 0;
  return `\u2705 Created **${code}** "${args.title}" (draft, pass ${args.passingScore}%, ${n} question(s)). Next: release_training, then assign_training.`;
});
const addTrainingQuestions = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const training = await findTraining(client, args.training, "draft");
  const me = await (0, import_people.currentPerson)(client);
  const n = await addQuestions(client, training, args.questions, me._id);
  return `\u2705 Added ${n} question(s) to **${String(training.code)}** (draft).`;
});
const releaseTraining = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const draft = await findTraining(client, args.training, "draft");
  const me = await (0, import_people.currentPerson)(client);
  const questions = await client.findAll(T.Question, { attachedTo: draft._id, collection: "questions" });
  if (questions.length === 0) throw new Error(`${String(draft.code)} has no questions \u2014 add some first (add_training_questions).`);
  const released = await client.findAll(T.Training, { code: draft.code, state: "released" });
  const now = Date.now();
  for (const old of released) await client.updateDoc(old._class, old.space, old._id, { state: "archived" });
  for (const q of questions) {
    if (q.releasedOn == null) await client.updateCollection(q._class, q.space, q._id, q.attachedTo, q.attachedToClass, q.collection, { releasedOn: now, releasedBy: me._id });
  }
  await client.updateDoc(draft._class, draft.space, draft._id, { state: "released", releasedOn: now, releasedBy: me._id, author: me._id });
  return `\u2705 Released **${String(draft.code)}** rev ${Number(draft.revision)} with ${questions.length} question(s)${released.length > 0 ? `; archived ${released.length} earlier release(s)` : ""}. Assign it with assign_training.`;
});
const assignTraining = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const training = await findTraining(client, args.training, "released");
  const trainees = [...new Set((await Promise.all(args.trainees.map(async (n) => await (0, import_people.findPerson)(client, n)))).map((p) => p._id))];
  const me = await (0, import_people.currentPerson)(client);
  const dueDate = args.dueDate != null ? new Date(args.dueDate).getTime() : null;
  if (dueDate != null && Number.isNaN(dueDate)) throw new Error(`Cannot read dueDate '${args.dueDate}' (ISO date, e.g. 2026-12-01).`);
  await client.addCollection(T.Request, training.space, training._id, T.Training, "requests", {
    owner: me._id,
    trainees,
    dueDate,
    maxAttempts: args.maxAttempts ?? null,
    attempts: 0,
    canceledOn: null,
    canceledBy: null
  });
  return `\u2705 Assigned **${String(training.code)}** "${String(training.title)}" to ${trainees.length} person(s)${dueDate != null ? `, due ${(0, import_format.formatDate)(dueDate)}` : ""}${args.maxAttempts != null ? `, max ${args.maxAttempts} attempt(s)` : ""}. Progress: get_training.`;
});
const cancelTrainingRequest = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const request = await client.findOne(T.Request, { _id: args.requestId });
  if (request == null) throw new Error(`Assignment '${args.requestId}' not found (ids are shown by get_training).`);
  if (request.canceledOn != null) return `Assignment was already canceled on ${(0, import_format.formatDate)(request.canceledOn)}.`;
  const me = await (0, import_people.currentPerson)(client);
  await client.updateCollection(request._class, request.space, request._id, request.attachedTo, request.attachedToClass, request.collection, { canceledOn: Date.now(), canceledBy: me._id });
  return "\u2705 Assignment canceled; the trainees no longer see it as open.";
});
