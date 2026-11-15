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
var meeting_exports = {};
__export(meeting_exports, {
  actionsFromMarkup: () => actionsFromMarkup,
  parseActionLine: () => parseActionLine
});
module.exports = __toCommonJS(meeting_exports);
const ACTION_HEADING = /^(action items?|actions?|next steps?|to-?dos?|tasks?|follow-?ups?|aufgaben|nächste schritte|maßnahmen|offene punkte)\b/i;
const PREFIX = /^(?:todo|to-do|to do|action(?: item)?|aufgabe|task)\s*[:–-]\s*/i;
const CHECK = /^\s*\[( |x|X)\]\s+/;
const DUE = /(?:\b(?:due|by|until|bis|fällig(?: am)?|deadline)\s*:?\s*)?\b(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})\b/i;
const AT_NAME = /(^|\s)@([\p{L}][\p{L}\p{M}'.\u00a0-]*)/u;
const BLOCKS = /* @__PURE__ */ new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "todoList", "todoItem", "taskList", "taskItem", "codeBlock", "blockquote"]);
const kids = (node) => Array.isArray(node?.content) ? node.content : [];
function textOf(node) {
  if (node == null || typeof node !== "object") return "";
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "reference" || node.type === "mention") {
    const label = String(node.attrs?.label ?? "").trim();
    return label !== "" ? `@${label.replace(/\s+/g, "\xA0")}` : "";
  }
  const cs = kids(node);
  return cs.map(textOf).join(cs.some((c) => BLOCKS.has(c?.type)) ? "\n" : "");
}
function isoDate(raw) {
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw);
  const iso = de != null ? `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}` : raw;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== iso ? void 0 : iso;
}
function parseActionLine(line, description) {
  let title = line.replace(CHECK, "").replace(PREFIX, "");
  let assignee;
  const at = AT_NAME.exec(title);
  if (at != null) {
    assignee = at[2].replace(/ /g, " ").replace(/[.'-]+$/, "");
    title = title.slice(0, at.index) + at[1] + title.slice(at.index + at[0].length);
  }
  let dueDate;
  const due = DUE.exec(title);
  if (due != null) {
    dueDate = isoDate(due[1]);
    if (dueDate != null) title = title.slice(0, due.index) + title.slice(due.index + due[0].length);
  }
  title = title.replace(/\(\s*\)/g, "").replace(/\s+/g, " ").replace(/^[\s:;,–—-]+|[\s:;,–—-]+$/g, "").trim();
  if (title === "") return void 0;
  return { title, description, assignee, dueDate };
}
function actionsFromMarkup(root) {
  const tasks = [];
  let skippedDone = 0;
  const add = (t) => {
    if (t != null && !tasks.some((x) => x.title.toLowerCase() === t.title.toLowerCase())) tasks.push(t);
  };
  const nested = (rest) => {
    const s = rest.map(textOf).join("\n").trim();
    return s !== "" ? s : void 0;
  };
  const walk = (node, inActions) => {
    const type = String(node?.type ?? "");
    if (type === "todoItem" || type === "taskItem") {
      const [first, ...rest] = kids(node);
      if (node.attrs?.checked === true) skippedDone++;
      else add(parseActionLine(textOf(first ?? node), nested(rest)));
      return;
    }
    if (type === "listItem") {
      const [first, ...rest] = kids(node);
      const line = textOf(first ?? node).trim();
      const check = CHECK.exec(line);
      if (check != null) {
        if (check[1] !== " ") skippedDone++;
        else add(parseActionLine(line, nested(rest)));
        return;
      }
      if (inActions || PREFIX.test(line)) {
        add(parseActionLine(line, nested(rest)));
        return;
      }
    }
    if (type === "paragraph") {
      const line = textOf(node).trim();
      if (PREFIX.test(line)) add(parseActionLine(line));
      return;
    }
    for (const c of kids(node)) walk(c, inActions);
  };
  let actionLevel;
  for (const block of kids(root)) {
    if (block?.type === "heading") {
      const level = Number(block.attrs?.level ?? 1);
      if (actionLevel != null && level <= actionLevel) actionLevel = void 0;
      if (ACTION_HEADING.test(textOf(block).replace(/^[^\p{L}]+/u, "").trim())) actionLevel = level;
      continue;
    }
    walk(block, actionLevel != null);
  }
  return { tasks, skippedDone };
}
