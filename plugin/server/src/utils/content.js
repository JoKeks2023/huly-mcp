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
var content_exports = {};
__export(content_exports, {
  BLOB_TIMEOUT_MS: () => BLOB_TIMEOUT_MS,
  downloadBlob: () => downloadBlob,
  fetchBlob: () => fetchBlob,
  readMarkup: () => readMarkup,
  readMarkupJson: () => readMarkupJson,
  writeMarkup: () => writeMarkup
});
module.exports = __toCommonJS(content_exports);
var import_connection = require("../connection.js");
var import_markdown = require("./markdown.js");
var import_storage = require("./storage.js");
const BLOB_TIMEOUT_MS = 3e4;
function fetchBlob(url, wsToken) {
  return fetch(url, { headers: { Authorization: `Bearer ${wsToken}` }, signal: AbortSignal.timeout(BLOB_TIMEOUT_MS) }).catch((e) => {
    const err = e;
    if (err.name === "TimeoutError") throw new Error(`Huly front service did not answer within ${BLOB_TIMEOUT_MS / 1e3}s (HULY_FRONT_URL).`);
    throw new Error(`Huly front service not reachable (HULY_FRONT_URL): ${err.cause?.code ?? err.message}`);
  });
}
async function readMarkup(workspace, blobRef) {
  if (blobRef == null || blobRef === "") return "";
  const frontUrl = process.env.HULY_FRONT_URL;
  if (frontUrl == null || frontUrl === "") return `_(content not loaded \u2014 set HULY_FRONT_URL; blob \`${blobRef}\`)_`;
  const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(workspace);
  const url = `${frontUrl.replace(/\/$/, "")}/files?file=${encodeURIComponent(blobRef)}&workspace=${workspaceUuid}`;
  try {
    const res = await fetchBlob(url, wsToken);
    if (!res.ok) return `_(content fetch failed: HTTP ${res.status})_`;
    const text = await res.text();
    try {
      return (0, import_markdown.extractText)(JSON.parse(text));
    } catch {
      return text.slice(0, 4e3);
    }
  } catch (e) {
    return `_(content fetch failed: ${e.message})_`;
  }
}
async function readMarkupJson(workspace, blobRef) {
  const frontUrl = process.env.HULY_FRONT_URL;
  if (frontUrl == null || frontUrl === "") throw new Error("Reading document content needs HULY_FRONT_URL.");
  const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(workspace);
  const url = `${frontUrl.replace(/\/$/, "")}/files?file=${encodeURIComponent(blobRef)}&workspace=${workspaceUuid}`;
  const res = await fetchBlob(url, wsToken);
  if (!res.ok) throw new Error(`Content fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Document content is not Huly markup JSON.");
  }
}
async function writeMarkup(workspace, idHint, markdown) {
  const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(workspace);
  return await (0, import_storage.uploadMarkupBlob)(wsToken, workspaceUuid, `${idHint}-${Date.now()}`, JSON.stringify((0, import_markdown.markdownToProseMirror)(markdown)));
}
async function downloadBlob(workspace, blobRef) {
  const frontUrl = process.env.HULY_FRONT_URL;
  if (frontUrl == null || frontUrl === "") throw new Error("Downloading files needs HULY_FRONT_URL.");
  const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(workspace);
  const url = `${frontUrl.replace(/\/$/, "")}/files?file=${encodeURIComponent(blobRef)}&workspace=${workspaceUuid}`;
  const res = await fetchBlob(url, wsToken);
  if (!res.ok) throw new Error(`File download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
