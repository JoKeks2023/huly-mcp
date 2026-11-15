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
var junit_exports = {};
__export(junit_exports, {
  decodeXml: () => decodeXml,
  parseJUnit: () => parseJUnit
});
module.exports = __toCommonJS(junit_exports);
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodeXml(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c) => c.replace(/&/g, "\0amp;")).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()]).replace(/\u0000amp;/g, "&");
}
function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1]] = decodeXml(m[3] ?? m[4] ?? "");
  return out;
}
function parseJUnit(xml) {
  let src = xml;
  for (let prev = ""; prev !== src; ) {
    prev = src;
    src = src.replace(/<!--[\s\S]*?-->/g, "");
  }
  src = src.replace(/<\?xml[\s\S]*?\?>/, "");
  if (!/<testsuites?[\s>]|<testcase[\s>]/.test(src)) throw new Error("Not JUnit XML: no <testsuite> or <testcase> element found.");
  const out = [];
  const stack = [];
  const re = /<(\/?)(testsuites|testsuite|testcase)\b([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(src)) != null) {
    const [, close, tag, rawAttrs, selfClose] = m;
    if (tag === "testsuite") {
      if (close === "/") stack.pop();
      else if (selfClose !== "/") stack.push(attrs(rawAttrs).name ?? "");
      continue;
    }
    if (tag !== "testcase" || close === "/") continue;
    const a = attrs(rawAttrs);
    let body = "";
    if (selfClose !== "/") {
      const end = src.indexOf("</testcase>", re.lastIndex);
      if (end === -1) throw new Error(`Unclosed <testcase name="${a.name ?? "?"}">.`);
      body = src.slice(re.lastIndex, end);
      re.lastIndex = end + "</testcase>".length;
    }
    const c = { suite: [...stack].reverse().find((s) => s !== "") ?? a.classname ?? "Tests", name: a.name ?? "(unnamed)", status: "passed" };
    if (a.classname != null && a.classname !== "") c.classname = a.classname;
    if (a.time != null && !Number.isNaN(Number(a.time))) c.time = Number(a.time);
    const bad = /<(failure|error)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/.exec(body);
    if (bad != null) {
      c.status = "failed";
      const ba = attrs(bad[2]);
      c.message = ba.message ?? ba.type;
      const text = decodeXml(bad[4] ?? "").trim();
      if (text !== "") c.details = text;
    } else if (/<skipped\b/.test(body)) {
      c.status = "skipped";
      const sa = /<skipped\b([^>]*)/.exec(body);
      if (sa != null) c.message = attrs(sa[1]).message;
    }
    out.push(c);
  }
  return out;
}
