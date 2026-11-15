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
var files_exports = {};
__export(files_exports, {
  fileRoot: () => fileRoot,
  isTextType: () => isTextType,
  localPath: () => localPath,
  mimeFromName: () => mimeFromName
});
module.exports = __toCommonJS(files_exports);
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
function fileRoot(env = process.env) {
  const root = env.HULY_FILE_ROOT;
  return root != null && root !== "" ? (0, import_node_fs.realpathSync)(root) : void 0;
}
function localPath(path, env = process.env) {
  const root = fileRoot(env);
  if (root == null) throw new Error("Local file paths are disabled. Set HULY_FILE_ROOT to a directory to allow them, or pass contentBase64.");
  const abs = (0, import_node_path.resolve)(root, path);
  let base = abs;
  const rest = [];
  while (!(0, import_node_fs.existsSync)(base)) {
    const parent = (0, import_node_path.dirname)(base);
    if (parent === base) break;
    rest.unshift(base.slice(parent.length).replace(/^[\\/]+/, ""));
    base = parent;
  }
  const real = (0, import_node_path.resolve)((0, import_node_fs.existsSync)(base) ? (0, import_node_fs.realpathSync)(base) : base, ...rest);
  const norm = (p) => process.platform === "win32" ? p.toLowerCase() : p;
  if (norm(real) !== norm(root) && !norm(real).startsWith(norm(root) + import_node_path.sep)) throw new Error(`'${path}' is outside HULY_FILE_ROOT.`);
  return real;
}
const TEXT_TYPES = /^(text\/|application\/(json|xml|javascript|x-yaml|yaml|sql|x-sh|toml)|image\/svg)/;
const isTextType = (mime) => TEXT_TYPES.test(mime ?? "");
const EXT_TYPES = {
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  ts: "text/plain",
  js: "text/javascript",
  sh: "application/x-sh"
};
const mimeFromName = (name) => EXT_TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
