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
var process_exports = {};
__export(process_exports, {
  PR: () => PR,
  cancelExecution: () => cancelExecution,
  listExecutions: () => listExecutions,
  listProcesses: () => listProcesses,
  needsUserInput: () => needsUserInput,
  startProcess: () => startProcess
});
module.exports = __toCommonJS(process_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_attributes = require("../utils/attributes.js");
const PR = { Process: "process:class:Process", State: "process:class:State", Transition: "process:class:Transition", Execution: "process:class:Execution", Log: "process:class:ExecutionLog", ToDo: "process:class:ProcessToDo" };
const trig = (id) => (String(id).split(":").pop() ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
async function findProcess(client, ref) {
  const all = await client.findAll(PR.Process, {});
  const hits = all.filter((p) => p._id === ref || String(p.name).toLowerCase() === ref.trim().toLowerCase());
  if (hits.length !== 1) throw new Error(hits.length === 0 ? `Process '${ref}' not found. Processes: ${all.map((p) => p.name).join(", ") || "none"}.` : `Process '${ref}' is ambiguous \u2014 pass its id.`);
  return hits[0];
}
const listProcesses = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const processes = await client.findAll(PR.Process, {});
  if (processes.length === 0) return "No processes defined.";
  const [states, transitions] = await Promise.all([client.findAll(PR.State, {}), client.findAll(PR.Transition, {})]);
  const h = client.getHierarchy();
  const out = [`## Processes (${processes.length})`];
  for (const p of processes) {
    let tag = String(p.masterTag);
    try {
      tag = (0, import_attributes.labelText)(h.getClass(p.masterTag).label);
    } catch {
    }
    const st = states.filter((s) => s.process === p._id).sort((a, b) => String(a.rank).localeCompare(String(b.rank)));
    const title = (id) => id == null ? "start" : String(st.find((s) => s._id === id)?.title ?? "?");
    const flags = [p.autoStart === true ? "auto-start" : void 0, p.parallelExecutionForbidden === true ? "one at a time" : void 0, p.automationOnly === true ? "automation only" : void 0].filter((x) => x != null);
    out.push("", `### ${String(p.name)} \u2014 on ${tag}${flags.length > 0 ? ` (${flags.join(", ")})` : ""} \`${String(p._id)}\``);
    if (p.description != null && p.description !== "") out.push(String(p.description));
    out.push(`States: ${st.map((s) => s.title).join(" \u2192 ") || "\u2014"}`);
    for (const t of transitions.filter((x) => x.process === p._id).sort((a, b) => String(a.rank).localeCompare(String(b.rank)))) {
      out.push(`- ${title(t.from)} \u2192 ${title(t.to)} \xB7 when ${trig(t.trigger)}${(t.actions ?? []).length > 0 ? ` \xB7 ${t.actions.length} action(s)` : ""}`);
    }
  }
  return out.join("\n");
});
const listExecutions = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const query = {};
  if (args.process != null) query.process = (await findProcess(client, args.process))._id;
  if (args.status != null) query.status = args.status;
  const execs = await client.findAll(PR.Execution, query, { sort: { modifiedOn: import_core.SortingOrder.Descending }, limit: args.limit ?? 30 });
  if (execs.length === 0) return "No process executions.";
  const [processes, states, cards] = await Promise.all([
    client.findAll(PR.Process, {}),
    client.findAll(PR.State, {}),
    client.findAll("card:class:Card", { _id: { $in: [...new Set(execs.map((e) => e.card))] } })
  ]);
  const lines = execs.map((e) => {
    const card = cards.find((c) => c._id === e.card);
    const state = e.currentState != null ? String(states.find((s) => s._id === e.currentState)?.title ?? "?") : "not started";
    const err = (e.error ?? []).length > 0 ? " \xB7 \u26A0\uFE0F error, waiting" : "";
    return `- **${String(processes.find((p) => p._id === e.process)?.name ?? "?")}** on "${String(card?.title ?? e.card)}" \u2014 ${String(e.status)} \xB7 state ${state}${err} \xB7 ${(0, import_format.formatDate)(e.modifiedOn)} \u2014 \`${String(e._id)}\``;
  });
  return `## Executions (${execs.length})

${lines.join("\n")}`;
});
function needsUserInput(transition) {
  const asks = (v) => {
    if (typeof v === "string") {
      const i = v.indexOf("${");
      const j = v.lastIndexOf("}");
      if (i === -1 || j <= i) return false;
      try {
        return JSON.parse(v.substring(i + 1, j + 1))?.type === "userRequest";
      } catch {
        return false;
      }
    }
    if (Array.isArray(v)) return v.some(asks);
    if (v != null && typeof v === "object") return Object.values(v).some(asks);
    return false;
  };
  return (transition?.actions ?? []).some((a) => a != null && asks(a.params));
}
const startProcess = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const proc = await findProcess(client, args.process);
  if (proc.automationOnly === true) throw new Error(`Process '${String(proc.name)}' only runs from automations.`);
  const card = await client.findOne("card:class:Card", { _id: args.card });
  if (card == null) throw new Error(`Card '${args.card}' not found (pass its id, see list_cards).`);
  const h = client.getHierarchy();
  const fits = h.isDerived(card._class, proc.masterTag) || h.isMixin(proc.masterTag) === true && h.hasMixin(card, proc.masterTag) === true;
  if (!fits) throw new Error(`Process '${String(proc.name)}' does not apply to this card's type.`);
  const start = (await client.findAll(PR.Transition, { process: proc._id, from: null }))[0];
  if (start == null) throw new Error(`Process '${String(proc.name)}' has no start transition.`);
  if (needsUserInput(start)) throw new Error(`Starting '${String(proc.name)}' asks for input that only the Huly app can collect \u2014 start it there.`);
  if (proc.parallelExecutionForbidden === true) {
    const running = await client.findOne(PR.Execution, { process: proc._id, card: card._id, status: "active" });
    if (running != null) throw new Error(`'${String(proc.name)}' is already running on this card (\`${String(running._id)}\`).`);
  }
  if (args.dryRun === true) return `Dry run: would start **${String(proc.name)}** on "${String(card.title)}". Nothing was changed.`;
  const id = (0, import_core.generateId)();
  await client.createDoc(PR.Execution, card.space, { process: proc._id, currentState: null, card: card._id, rollback: [], context: {}, status: "active" }, id);
  return `\u2705 Started **${String(proc.name)}** on "${String(card.title)}" \u2014 \`${id}\`. Huly's process service moves it on; check with list_executions.`;
});
const cancelExecution = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const exec = await client.findOne(PR.Execution, { _id: args.execution });
  if (exec == null) throw new Error(`Execution '${args.execution}' not found (ids from list_executions).`);
  if (exec.status !== "active") throw new Error(`Execution is already ${String(exec.status)}.`);
  const proc = await client.findOne(PR.Process, { _id: exec.process });
  if (args.dryRun === true) return `Dry run: would cancel **${String(proc?.name ?? "?")}** \`${String(exec._id)}\`. Nothing was changed.`;
  await client.updateDoc(PR.Execution, exec.space, exec._id, { status: "cancelled" });
  return `\u{1F6D1} Cancelled **${String(proc?.name ?? "?")}** \`${String(exec._id)}\`.`;
});
