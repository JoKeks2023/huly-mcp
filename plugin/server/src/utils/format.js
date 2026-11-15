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
var format_exports = {};
__export(format_exports, {
  MILESTONE_STATUS_LABELS: () => MILESTONE_STATUS_LABELS,
  PRIORITY_LABELS: () => PRIORITY_LABELS,
  clip: () => clip,
  formatDate: () => formatDate,
  markupToText: () => markupToText,
  priorityLabel: () => priorityLabel,
  textToMarkup: () => textToMarkup
});
module.exports = __toCommonJS(format_exports);
var import_markdown = require("./markdown.js");
var import_tracker = require("../../vendor/@hcengineering/tracker/lib/index.js");
const PRIORITY_LABELS = {
  [import_tracker.IssuePriority.NoPriority]: "No Priority",
  [import_tracker.IssuePriority.Urgent]: "Urgent",
  [import_tracker.IssuePriority.High]: "High",
  [import_tracker.IssuePriority.Medium]: "Medium",
  [import_tracker.IssuePriority.Low]: "Low"
};
const MILESTONE_STATUS_LABELS = {
  0: "Planned",
  1: "In Progress",
  2: "Completed",
  3: "Canceled"
};
function formatDate(ts) {
  if (ts == null) return "None";
  return new Date(ts).toISOString().split("T")[0];
}
function priorityLabel(priority) {
  return PRIORITY_LABELS[priority] ?? "Unknown";
}
function markupToText(markup) {
  if (markup == null || markup === "") return "";
  if (!markup.trimStart().startsWith("{")) return markup;
  try {
    return (0, import_markdown.extractText)(JSON.parse(markup)).trim();
  } catch {
    return markup;
  }
}
function textToMarkup(text) {
  if (text == null || text === "") return "";
  return JSON.stringify((0, import_markdown.markdownToProseMirror)(text));
}
function clip(text, max, hint) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}\u2026 _[${text.length - max} more chars \u2014 ${hint}]_`;
}
