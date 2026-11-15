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
var drive_exports = {};
__export(drive_exports, {
  createDrive: () => createDrive,
  createFolder: () => createFolder,
  deleteDriveItem: () => deleteDriveItem,
  downloadFile: () => downloadFile,
  listDriveFiles: () => listDriveFiles,
  listDrives: () => listDrives,
  listFileVersions: () => listFileVersions,
  restoreFileVersion: () => restoreFileVersion,
  updateDriveItem: () => updateDriveItem,
  uploadFile: () => uploadFile
});
module.exports = __toCommonJS(drive_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_node_fs = require("node:fs");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_classes = require("../utils/classes.js");
var import_storage = require("../utils/storage.js");
var import_content = require("../utils/content.js");
var import_files = require("../utils/files.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
const MAX_INLINE = 2e5;
const size = (n) => {
  if (n == null) return "?";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
async function findDrive(client, ref) {
  const drives = await client.findAll(import_classes.C.Drive, {});
  const k = ref.trim().toLowerCase();
  const hits = drives.filter((d) => d._id === ref || String(d.name).toLowerCase() === k);
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw new Error(`Drive '${ref}' is ambiguous: ${hits.map((d) => d._id).join(", ")}.`);
  throw new Error(`Drive '${ref}' not found. Available: ${drives.map((d) => d.name).join(", ") || "none"}.`);
}
async function findItem(client, id) {
  const item = await client.findOne(import_classes.C.DriveResource, { _id: id });
  if (item == null) throw new Error(`Drive item '${id}' not found.`);
  return item;
}
async function findFolder(client, drive, folderId) {
  if (folderId == null) return void 0;
  const folder = await client.findOne(import_classes.C.Folder, { _id: folderId });
  if (folder == null) throw new Error(`Folder '${folderId}' not found.`);
  if (drive != null && folder.space !== drive._id) throw new Error(`Folder '${String(folder.title)}' is in another drive.`);
  return folder;
}
const isFolder = (item) => item._class === import_classes.C.Folder;
const listDrives = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const drives = await client.findAll(import_classes.C.Drive, { archived: false });
  if (drives.length === 0) return "No drives.";
  const lines = [];
  for (const d of drives) {
    const items = await client.findAll(import_classes.C.DriveResource, { space: d._id });
    const files = items.filter((i) => !isFolder(i)).length;
    lines.push(`- **${String(d.name)}** \u2014 ${files} file(s), ${items.length - files} folder(s)${d.private === true ? " \xB7 private" : ""} \u2014 \`${String(d._id)}\``);
  }
  return `## Drives (${drives.length})

${lines.join("\n")}`;
});
const listDriveFiles = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const drive = await findDrive(client, args.drive);
  const folder = await findFolder(client, drive, args.folderId);
  const items = await client.findAll(import_classes.C.DriveResource, { space: drive._id }, { sort: { title: import_core.SortingOrder.Ascending } });
  const versions = await client.findAll(import_classes.C.FileVersion, { space: drive._id });
  const current = new Map(versions.map((v) => [v._id, v]));
  const root = folder?._id ?? import_classes.IDS.DriveRoot;
  const byParent = /* @__PURE__ */ new Map();
  for (const i of items) byParent.set(i.parent, [...byParent.get(i.parent) ?? [], i]);
  const lines = [];
  const walk = (parent, depth) => {
    const kids = (byParent.get(parent) ?? []).sort((a, b) => Number(isFolder(b)) - Number(isFolder(a)) || String(a.title).localeCompare(String(b.title)));
    for (const i of kids) {
      if (isFolder(i)) {
        lines.push(`${"  ".repeat(depth)}- \u{1F4C1} **${String(i.title)}** \u2014 \`${String(i._id)}\``);
        if (args.recursive && depth < 20) walk(i._id, depth + 1);
      } else {
        const v = current.get(i.file);
        lines.push(`${"  ".repeat(depth)}- ${String(i.title)} (${size(v?.size)}, ${String(v?.type ?? "?")}, v${String(i.version ?? 1)}, ${(0, import_format.formatDate)(i.modifiedOn)}) \u2014 \`${String(i._id)}\``);
      }
    }
  };
  walk(root, 0);
  if (lines.length === 0) return `${folder != null ? `Folder "${String(folder.title)}"` : `Drive "${String(drive.name)}"`} is empty.`;
  return `## ${String(drive.name)}${folder != null ? ` / ${String(folder.title)}` : ""}

${lines.join("\n")}`;
});
const createFolder = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const drive = await findDrive(client, args.drive);
  const parent = await findFolder(client, drive, args.parentId);
  const parentId = parent?._id ?? import_classes.IDS.DriveRoot;
  const existing = await client.findOne(import_classes.C.Folder, { space: drive._id, parent: parentId, title: args.title });
  if (existing != null) return `\u2139\uFE0F Folder **${args.title}** already exists \u2014 \`${String(existing._id)}\`.`;
  const id = await client.createDoc(import_classes.C.Folder, drive._id, { title: args.title, parent: parentId, path: parent != null ? [parent._id, ...parent.path ?? []] : [] });
  return `\u2705 Folder **${args.title}** created \u2014 \`${String(id)}\`.`;
});
const uploadFile = (0, import_errors.wrapToolHandler)(async (args) => {
  if (args.contentBase64 == null === (args.localPath == null)) throw new Error("Pass either contentBase64 or localPath.");
  const client = await (0, import_connection.getConnection)(args.workspace);
  const drive = await findDrive(client, args.drive);
  const parent = await findFolder(client, drive, args.folderId);
  const parentId = parent?._id ?? import_classes.IDS.DriveRoot;
  const bytes = args.localPath != null ? (0, import_node_fs.readFileSync)((0, import_files.localPath)(args.localPath)) : Buffer.from(args.contentBase64, "base64");
  const name = args.filename ?? (args.localPath != null ? args.localPath.split(/[\\/]/).pop() : void 0);
  if (name == null || name === "") throw new Error("filename is required with contentBase64.");
  const type = args.mimeType ?? (0, import_files.mimeFromName)(name);
  const { wsToken, workspaceUuid } = await (0, import_connection.getWorkspaceInfo)(args.workspace);
  const uploaded = await (0, import_storage.uploadBlob)(wsToken, workspaceUuid, `${(0, import_core.generateId)()}-${name}`, new Blob([bytes], { type }));
  const data = { title: name, file: uploaded.id, size: uploaded.size, type, lastModified: Date.now() };
  const existing = await client.findOne(import_classes.C.File, { space: drive._id, parent: parentId, title: name });
  if (existing != null && args.newVersion) {
    const inc = await client.updateDoc(import_classes.C.File, existing.space, existing._id, { $inc: { version: 1 } }, true);
    const version = inc?.object?.version ?? (existing.version ?? 1) + 1;
    const versionId2 = await client.addCollection(import_classes.C.FileVersion, existing.space, existing._id, import_classes.C.File, "versions", { ...data, version });
    await client.updateDoc(import_classes.C.File, existing.space, existing._id, { file: versionId2 });
    return `\u2705 **${name}** updated to version ${String(version)} (${size(uploaded.size)}) \u2014 \`${String(existing._id)}\`.`;
  }
  const fileId = (0, import_core.generateId)();
  const versionId = (0, import_core.generateId)();
  await client.createDoc(import_classes.C.File, drive._id, { title: name, parent: parentId, path: parent != null ? [parent._id, ...parent.path ?? []] : [], file: versionId, version: 1, versions: 0 }, fileId);
  await client.addCollection(import_classes.C.FileVersion, drive._id, fileId, import_classes.C.File, "versions", { ...data, version: 1 }, versionId);
  return `\u2705 **${name}** uploaded (${size(uploaded.size)}) \u2014 \`${fileId}\`.${existing != null ? " (A file with this name already existed; newVersion=false kept both.)" : ""}`;
});
async function versionOf(client, file, version) {
  if (version == null) {
    const v2 = await client.findOne(import_classes.C.FileVersion, { _id: file.file });
    if (v2 == null) throw new Error("Current version of this file not found.");
    return v2;
  }
  const v = await client.findOne(import_classes.C.FileVersion, { attachedTo: file._id, version });
  if (v == null) throw new Error(`Version ${version} of "${String(file.title)}" not found.`);
  return v;
}
const downloadFile = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const file = await findItem(client, args.fileId);
  if (isFolder(file)) throw new Error(`"${String(file.title)}" is a folder.`);
  const v = await versionOf(client, file, args.version);
  if (args.savePath != null) {
    const target = (0, import_files.localPath)(args.savePath);
    const bytes2 = await (0, import_content.downloadBlob)(args.workspace, v.file);
    (0, import_node_fs.writeFileSync)(target, bytes2);
    return `\u2705 Saved **${String(file.title)}** v${String(v.version)} (${size(bytes2.length)}) to \`${target}\`.`;
  }
  if ((v.size ?? 0) > MAX_INLINE) throw new Error(`"${String(file.title)}" is ${size(v.size)} \u2014 too large to return inline. Use savePath (needs HULY_FILE_ROOT).`);
  const bytes = await (0, import_content.downloadBlob)(args.workspace, v.file);
  const head = `## ${String(file.title)} (v${String(v.version)}, ${size(bytes.length)}, ${String(v.type)})

`;
  if ((0, import_files.isTextType)(v.type)) return head + "```\n" + bytes.toString("utf8") + "\n```";
  return head + `Binary content, base64:

${bytes.toString("base64")}`;
});
async function subtree(client, folderIds) {
  const out = [];
  let level = folderIds;
  for (let depth = 0; depth < 50 && level.length > 0; depth++) {
    const kids = await client.findAll(import_classes.C.DriveResource, { parent: { $in: level } });
    out.push(...kids);
    level = kids.filter(isFolder).map((k) => k._id);
  }
  return out;
}
const updateDriveItem = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const item = await findItem(client, args.itemId);
  if (args.title == null && args.parentId === void 0) throw new Error("Nothing to change: pass title or parentId.");
  const done = [];
  if (args.title != null && args.title !== item.title) {
    await client.updateDoc(item._class, item.space, item._id, { title: args.title });
    done.push(`renamed to "${args.title}"`);
  }
  if (args.parentId !== void 0) {
    const parent = args.parentId != null ? await findFolder(client, void 0, args.parentId) : void 0;
    const space = parent?.space ?? item.space;
    const below = isFolder(item) ? await subtree(client, [item._id]) : [];
    if (parent != null && (parent._id === item._id || below.some((b) => b._id === parent._id))) throw new Error("A folder cannot be moved into itself or one of its subfolders.");
    const path = parent != null ? [parent._id, ...parent.path ?? []] : [];
    await client.updateDoc(item._class, item.space, item._id, { space, parent: parent?._id ?? import_classes.IDS.DriveRoot, path });
    for (const b of below) {
      const keep = b.path.slice(0, b.path.indexOf(item._id) + 1);
      await client.updateDoc(b._class, b.space, b._id, { space, path: [...keep, ...path] });
    }
    if (space !== item.space) {
      const files = [item, ...below].filter((x) => !isFolder(x));
      for (const f of files) {
        const versions = await client.findAll(import_classes.C.FileVersion, { attachedTo: f._id });
        for (const v of versions) await client.updateDoc(import_classes.C.FileVersion, v.space, v._id, { space });
      }
    }
    done.push(parent != null ? `moved into "${String(parent.title)}"` : "moved to the top level");
  }
  return `\u2705 **${String(item.title)}**: ${done.join(", ") || "no change"}.`;
});
const deleteDriveItem = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const item = await findItem(client, args.itemId);
  const below = isFolder(item) ? await subtree(client, [item._id]) : [];
  if (below.length > 0 && !args.recursive) throw new Error(`Folder "${String(item.title)}" contains ${below.length} item(s). Pass recursive: true to delete it with its contents.`);
  const all = [...below.sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0)), item];
  for (const x of all) {
    if (!isFolder(x)) {
      const versions = await client.findAll(import_classes.C.FileVersion, { attachedTo: x._id });
      for (const v of versions) await client.removeCollection(import_classes.C.FileVersion, v.space, v._id, x._id, import_classes.C.File, "versions");
    }
    await client.removeDoc(x._class, x.space, x._id);
  }
  return `\u2705 Deleted **${String(item.title)}**${below.length > 0 ? ` with ${below.length} item(s)` : ""}.`;
});
const listFileVersions = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const file = await findItem(client, args.fileId);
  const versions = await client.findAll(import_classes.C.FileVersion, { attachedTo: file._id }, { sort: { version: import_core.SortingOrder.Descending } });
  if (versions.length === 0) return `No versions of "${String(file.title)}".`;
  const lines = versions.sort((a, b) => b.version - a.version).map((v) => `- v${String(v.version)}${v._id === file.file ? " (current)" : ""} \u2014 ${size(v.size)}, ${(0, import_format.formatDate)(v.modifiedOn ?? v.lastModified)} \u2014 \`${String(v._id)}\``);
  return `## Versions of ${String(file.title)} (${versions.length})

${lines.join("\n")}`;
});
const restoreFileVersion = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const file = await findItem(client, args.fileId);
  const v = await versionOf(client, file, args.version);
  if (v._id === file.file) return `v${String(v.version)} is already the current version.`;
  await client.updateDoc(import_classes.C.File, file.space, file._id, { file: v._id });
  return `\u2705 **${String(file.title)}** restored to v${String(v.version)}.`;
});
const createDrive = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const drives = await client.findAll(import_classes.C.Drive, {});
  const same = drives.find((d) => String(d.name).toLowerCase() === args.name.toLowerCase());
  if (same != null) return `\u2139\uFE0F Drive **${String(same.name)}** already exists \u2014 \`${String(same._id)}\`.`;
  const me = await (0, import_people.currentAccountUuid)(client);
  const id = await client.createDoc(import_classes.C.Drive, "core:space:Space", {
    name: args.name,
    description: args.description ?? "",
    private: args.isPrivate,
    archived: false,
    autoJoin: false,
    members: [me],
    owners: [me],
    type: "drive:spaceType:DefaultDrive"
  });
  return `\u2705 Drive **${args.name}** created \u2014 \`${String(id)}\`.`;
});
