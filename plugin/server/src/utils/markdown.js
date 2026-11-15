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
var markdown_exports = {};
__export(markdown_exports, {
  buildTable: () => buildTable,
  extractText: () => extractText,
  markdownToProseMirror: () => markdownToProseMirror,
  parseInline: () => parseInline
});
module.exports = __toCommonJS(markdown_exports);
function markdownToProseMirror(md) {
  const lines = md.split("\n");
  const nodes = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      const nodeType = lang === "mermaid" ? "mermaid" : "codeBlock";
      nodes.push({
        type: nodeType,
        attrs: { language: lang !== "" ? lang : null },
        content: [{ type: "text", text: codeLines.join("\n") }]
      });
      continue;
    }
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch != null) {
      nodes.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInline(headingMatch[2])
      });
      i++;
      continue;
    }
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableRows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().startsWith("|")) {
        const row = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!row.every((c) => /^[-:]+$/.test(c))) {
          tableRows.push(row);
        }
        i++;
      }
      if (tableRows.length > 0) {
        nodes.push(buildTable(tableRows));
      }
      continue;
    }
    if (/^(\s*[-*+])\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^(\s*[-*+])\s/.test(lines[i])) {
        const text = lines[i].replace(/^\s*[-*+]\s/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(text) }]
        });
        i++;
      }
      nodes.push({ type: "bulletList", content: items });
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    nodes.push({ type: "paragraph", content: parseInline(line) });
    i++;
  }
  if (nodes.length === 0) {
    nodes.push({ type: "paragraph", content: [] });
  }
  return { type: "doc", content: nodes };
}
function parseInline(text) {
  const nodes = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`|([^`*]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1] != null) {
      nodes.push({ type: "text", text: m[1], marks: [{ type: "bold" }] });
    } else if (m[2] != null) {
      nodes.push({ type: "text", text: m[2], marks: [{ type: "code" }] });
    } else if (m[3] != null && m[3].length > 0) {
      nodes.push({ type: "text", text: m[3] });
    }
  }
  return nodes.length > 0 ? nodes : [{ type: "text", text }];
}
function buildTable(rows) {
  const [headerRow, ...bodyRows] = rows;
  const tableRows = [];
  if (headerRow != null) {
    tableRows.push({
      type: "tableRow",
      content: headerRow.map((cell) => ({
        type: "tableHeader",
        content: [{ type: "paragraph", content: parseInline(cell) }]
      }))
    });
  }
  for (const row of bodyRows) {
    tableRows.push({
      type: "tableRow",
      content: row.map((cell) => ({
        type: "tableCell",
        content: [{ type: "paragraph", content: parseInline(cell) }]
      }))
    });
  }
  return { type: "table", content: tableRows };
}
const BLOCK_TYPES = /* @__PURE__ */ new Set(["doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "codeBlock", "blockquote", "table", "tableRow", "tableCell", "tableHeader", "horizontalRule", "image"]);
function extractText(node) {
  if (typeof node === "string") return node;
  if (node == null || typeof node !== "object") return "";
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (node.type === "hardBreak") return "\n";
  const children = Array.isArray(node.content) ? node.content : Array.isArray(node.children) ? node.children : [];
  const hasBlocks = children.some((c) => BLOCK_TYPES.has(c?.type));
  return children.map(extractText).join(hasBlocks ? "\n" : "");
}
