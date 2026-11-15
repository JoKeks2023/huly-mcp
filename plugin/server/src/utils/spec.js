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
var spec_exports = {};
__export(spec_exports, {
  planFromMarkup: () => planFromMarkup
});
module.exports = __toCommonJS(spec_exports);
var import_markdown = require("./markdown.js");
const CHECK = /^\s*\[( |x|X)\]\s+/;
function childrenOf(node) {
  return Array.isArray(node?.content) ? node.content : [];
}
function checklist(root) {
  const open = [];
  let done = 0;
  const walk = (node) => {
    const type = String(node?.type ?? "");
    if (type === "todoItem" || type === "taskItem") {
      const [first, ...rest] = childrenOf(node);
      const title = (0, import_markdown.extractText)(first ?? node).trim();
      const nested = rest.map(import_markdown.extractText).join("\n").trim();
      if (node.attrs?.checked === true) done++;
      else if (title !== "") open.push({ title, description: nested !== "" ? nested : void 0 });
      return;
    }
    if (type === "listItem") {
      const [first, ...rest] = childrenOf(node);
      const text = (0, import_markdown.extractText)(first ?? node).trim();
      const m = CHECK.exec(text);
      if (m != null) {
        const nested = rest.map(import_markdown.extractText).join("\n").trim();
        if (m[1] !== " ") done++;
        else open.push({ title: text.replace(CHECK, "").trim(), description: nested !== "" ? nested : void 0 });
        return;
      }
    }
    for (const c of childrenOf(node)) walk(c);
  };
  walk(root);
  return { open, done };
}
function headings(root) {
  const blocks = childrenOf(root);
  const levels = blocks.filter((b) => b?.type === "heading").map((b) => Number(b.attrs?.level ?? 1));
  if (levels.length === 0) return [];
  const count = (l) => levels.filter((x) => x === l).length;
  const level = [2, 3, 1].find((l) => count(l) > 1) ?? [2, 3, 1].find((l) => count(l) > 0) ?? levels[0];
  const tasks = [];
  let current;
  const flush = () => {
    if (current == null) return;
    const body = current.body.join("\n").trim();
    tasks.push({ title: current.title, description: body !== "" ? body.slice(0, 2e3) : void 0 });
  };
  for (const b of blocks) {
    if (b?.type === "heading") {
      const l = Number(b.attrs?.level ?? 1);
      if (l === level) {
        flush();
        current = { title: (0, import_markdown.extractText)(b).trim(), body: [] };
        continue;
      }
      if (l < level) {
        flush();
        current = void 0;
        continue;
      }
    }
    if (current != null) current.body.push((0, import_markdown.extractText)(b));
  }
  flush();
  return tasks.filter((t) => t.title !== "");
}
function planFromMarkup(root) {
  const list = checklist(root);
  if (list.open.length > 0 || list.done > 0) return { source: "checklist", tasks: list.open, skippedDone: list.done };
  const secs = headings(root);
  return { source: secs.length > 0 ? "headings" : "none", tasks: secs, skippedDone: 0 };
}
