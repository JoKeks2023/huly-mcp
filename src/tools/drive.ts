// Drive: drives (spaces) with folders and versioned files. Mirrors Huly's drive utils:
// File.file points at the current FileVersion; the blob, size and type live on the version.
// path = ancestor folder ids, nearest first; top level = drive:ids:Root.
import { generateId, SortingOrder } from '@hcengineering/core'
import { readFileSync, writeFileSync } from 'node:fs'
import { getConnection, getWorkspaceInfo } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C, IDS } from '../utils/classes'
import { uploadBlob } from '../utils/storage'
import { downloadBlob } from '../utils/content'
import { isTextType, localPath, mimeFromName } from '../utils/files'
import { formatDate } from '../utils/format'
import { currentAccountUuid } from '../utils/people'
import type { z } from 'zod'
import type { ListDrivesSchema, ListDriveFilesSchema, CreateFolderSchema, UploadFileSchema, DownloadFileSchema, UpdateDriveItemSchema, DeleteDriveItemSchema, ListFileVersionsSchema, RestoreFileVersionSchema, CreateDriveSchema } from '../schemas'

const MAX_INLINE = 200_000

const size = (n: number | undefined): string => {
  if (n == null) return '?'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

async function findDrive (client: any, ref: string): Promise<any> {
  const drives: any[] = await client.findAll(C.Drive, {})
  const k = ref.trim().toLowerCase()
  const hits = drives.filter((d) => d._id === ref || String(d.name).toLowerCase() === k)
  if (hits.length === 1) return hits[0]
  if (hits.length > 1) throw new Error(`Drive '${ref}' is ambiguous: ${hits.map((d) => d._id).join(', ')}.`)
  throw new Error(`Drive '${ref}' not found. Available: ${drives.map((d) => d.name).join(', ') || 'none'}.`)
}

async function findItem (client: any, id: string): Promise<any> {
  const item = await client.findOne(C.DriveResource, { _id: id })
  if (item == null) throw new Error(`Drive item '${id}' not found.`)
  return item
}

async function findFolder (client: any, drive: any, folderId: string | undefined): Promise<any | undefined> {
  if (folderId == null) return undefined
  const folder = await client.findOne(C.Folder, { _id: folderId })
  if (folder == null) throw new Error(`Folder '${folderId}' not found.`)
  if (drive != null && folder.space !== drive._id) throw new Error(`Folder '${String(folder.title)}' is in another drive.`)
  return folder
}

const isFolder = (item: any): boolean => item._class === C.Folder

export const listDrives = wrapToolHandler<z.infer<typeof ListDrivesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const drives: any[] = await client.findAll(C.Drive, { archived: false })
  if (drives.length === 0) return 'No drives.'
  const lines: string[] = []
  for (const d of drives) {
    const items: any[] = await client.findAll(C.DriveResource, { space: d._id })
    const files = items.filter((i) => !isFolder(i)).length
    lines.push(`- **${String(d.name)}** — ${files} file(s), ${items.length - files} folder(s)${d.private === true ? ' · private' : ''} — \`${String(d._id)}\``)
  }
  return `## Drives (${drives.length})\n\n${lines.join('\n')}`
})

export const listDriveFiles = wrapToolHandler<z.infer<typeof ListDriveFilesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const drive = await findDrive(client, args.drive)
  const folder = await findFolder(client, drive, args.folderId)
  const items: any[] = await client.findAll(C.DriveResource, { space: drive._id }, { sort: { title: SortingOrder.Ascending } })
  const versions: any[] = await client.findAll(C.FileVersion, { space: drive._id })
  const current = new Map(versions.map((v) => [v._id, v]))
  const root = folder?._id ?? IDS.DriveRoot
  const byParent = new Map<string, any[]>()
  for (const i of items) byParent.set(i.parent, [...(byParent.get(i.parent) ?? []), i])
  const lines: string[] = []
  const walk = (parent: string, depth: number): void => {
    const kids = (byParent.get(parent) ?? []).sort((a, b) => Number(isFolder(b)) - Number(isFolder(a)) || String(a.title).localeCompare(String(b.title)))
    for (const i of kids) {
      if (isFolder(i)) {
        lines.push(`${'  '.repeat(depth)}- 📁 **${String(i.title)}** — \`${String(i._id)}\``)
        if (args.recursive && depth < 20) walk(i._id, depth + 1)
      } else {
        const v = current.get(i.file)
        lines.push(`${'  '.repeat(depth)}- ${String(i.title)} (${size(v?.size)}, ${String(v?.type ?? '?')}, v${String(i.version ?? 1)}, ${formatDate(i.modifiedOn)}) — \`${String(i._id)}\``)
      }
    }
  }
  walk(root, 0)
  if (lines.length === 0) return `${folder != null ? `Folder "${String(folder.title)}"` : `Drive "${String(drive.name)}"`} is empty.`
  return `## ${String(drive.name)}${folder != null ? ` / ${String(folder.title)}` : ''}\n\n${lines.join('\n')}`
})

export const createFolder = wrapToolHandler<z.infer<typeof CreateFolderSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const drive = await findDrive(client, args.drive)
  const parent = await findFolder(client, drive, args.parentId)
  const parentId = parent?._id ?? IDS.DriveRoot
  const existing = await client.findOne(C.Folder, { space: drive._id, parent: parentId, title: args.title })
  if (existing != null) return `ℹ️ Folder **${args.title}** already exists — \`${String(existing._id)}\`.`
  const id = await client.createDoc(C.Folder, drive._id, { title: args.title, parent: parentId, path: parent != null ? [parent._id, ...(parent.path ?? [])] : [] })
  return `✅ Folder **${args.title}** created — \`${String(id)}\`.`
})

export const uploadFile = wrapToolHandler<z.infer<typeof UploadFileSchema>>(async (args) => {
  if ((args.contentBase64 == null) === (args.localPath == null)) throw new Error('Pass either contentBase64 or localPath.')
  const client: any = await getConnection(args.workspace)
  const drive = await findDrive(client, args.drive)
  const parent = await findFolder(client, drive, args.folderId)
  const parentId = parent?._id ?? IDS.DriveRoot
  const bytes = args.localPath != null ? readFileSync(localPath(args.localPath)) : Buffer.from(args.contentBase64!, 'base64')
  const name = args.filename ?? (args.localPath != null ? args.localPath.split(/[\\/]/).pop()! : undefined)
  if (name == null || name === '') throw new Error('filename is required with contentBase64.')
  const type = args.mimeType ?? mimeFromName(name)

  const { wsToken, workspaceUuid } = await getWorkspaceInfo(args.workspace)
  const uploaded = await uploadBlob(wsToken, workspaceUuid, `${generateId()}-${name}`, new Blob([bytes], { type }))
  const data = { title: name, file: uploaded.id, size: uploaded.size, type, lastModified: Date.now() }

  const existing = await client.findOne(C.File, { space: drive._id, parent: parentId, title: name })
  if (existing != null && args.newVersion) {
    // Like Huly's createFileVersion: bump the version counter, add the version, point the file at it.
    const inc = await client.updateDoc(C.File, existing.space, existing._id, { $inc: { version: 1 } }, true)
    const version = inc?.object?.version ?? (existing.version ?? 1) + 1
    const versionId = await client.addCollection(C.FileVersion, existing.space, existing._id, C.File, 'versions', { ...data, version })
    await client.updateDoc(C.File, existing.space, existing._id, { file: versionId })
    return `✅ **${name}** updated to version ${String(version)} (${size(uploaded.size)}) — \`${String(existing._id)}\`.`
  }
  const fileId = generateId()
  const versionId = generateId()
  await client.createDoc(C.File, drive._id, { title: name, parent: parentId, path: parent != null ? [parent._id, ...(parent.path ?? [])] : [], file: versionId, version: 1, versions: 0 }, fileId)
  await client.addCollection(C.FileVersion, drive._id, fileId, C.File, 'versions', { ...data, version: 1 }, versionId)
  return `✅ **${name}** uploaded (${size(uploaded.size)}) — \`${fileId}\`.${existing != null ? ' (A file with this name already existed; newVersion=false kept both.)' : ''}`
})

async function versionOf (client: any, file: any, version: number | undefined): Promise<any> {
  if (version == null) {
    const v = await client.findOne(C.FileVersion, { _id: file.file })
    if (v == null) throw new Error('Current version of this file not found.')
    return v
  }
  const v = await client.findOne(C.FileVersion, { attachedTo: file._id, version })
  if (v == null) throw new Error(`Version ${version} of "${String(file.title)}" not found.`)
  return v
}

export const downloadFile = wrapToolHandler<z.infer<typeof DownloadFileSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const file = await findItem(client, args.fileId)
  if (isFolder(file)) throw new Error(`"${String(file.title)}" is a folder.`)
  const v = await versionOf(client, file, args.version)
  if (args.savePath != null) {
    const target = localPath(args.savePath)
    const bytes = await downloadBlob(args.workspace, v.file)
    writeFileSync(target, bytes)
    return `✅ Saved **${String(file.title)}** v${String(v.version)} (${size(bytes.length)}) to \`${target}\`.`
  }
  if ((v.size ?? 0) > MAX_INLINE) throw new Error(`"${String(file.title)}" is ${size(v.size)} — too large to return inline. Use savePath (needs HULY_FILE_ROOT).`)
  const bytes = await downloadBlob(args.workspace, v.file)
  const head = `## ${String(file.title)} (v${String(v.version)}, ${size(bytes.length)}, ${String(v.type)})\n\n`
  if (isTextType(v.type)) return head + '```\n' + bytes.toString('utf8') + '\n```'
  return head + `Binary content, base64:\n\n${bytes.toString('base64')}`
})

/**
 * All folders and files below the given folders (any depth). Walks `parent` level by level:
 * the server does not match a value inside the `path` array.
 */
async function subtree (client: any, folderIds: string[]): Promise<any[]> {
  const out: any[] = []
  let level = folderIds
  for (let depth = 0; depth < 50 && level.length > 0; depth++) {
    const kids: any[] = await client.findAll(C.DriveResource, { parent: { $in: level } })
    out.push(...kids)
    level = kids.filter(isFolder).map((k) => k._id)
  }
  return out
}

export const updateDriveItem = wrapToolHandler<z.infer<typeof UpdateDriveItemSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const item = await findItem(client, args.itemId)
  if (args.title == null && args.parentId === undefined) throw new Error('Nothing to change: pass title or parentId.')
  const done: string[] = []
  if (args.title != null && args.title !== item.title) {
    await client.updateDoc(item._class, item.space, item._id, { title: args.title })
    done.push(`renamed to "${args.title}"`)
  }
  if (args.parentId !== undefined) {
    const parent = args.parentId != null ? await findFolder(client, undefined, args.parentId) : undefined
    const space = parent?.space ?? item.space
    const below = isFolder(item) ? await subtree(client, [item._id]) : []
    if (parent != null && (parent._id === item._id || below.some((b) => b._id === parent._id))) throw new Error('A folder cannot be moved into itself or one of its subfolders.')
    const path = parent != null ? [parent._id, ...(parent.path ?? [])] : []
    await client.updateDoc(item._class, item.space, item._id, { space, parent: parent?._id ?? IDS.DriveRoot, path })
    // Like Huly's moveResources, but for every descendant: drop the old ancestors, append the new ones.
    for (const b of below) {
      const keep = (b.path as string[]).slice(0, (b.path as string[]).indexOf(item._id) + 1)
      await client.updateDoc(b._class, b.space, b._id, { space, path: [...keep, ...path] })
    }
    if (space !== item.space) {
      const files = [item, ...below].filter((x) => !isFolder(x))
      for (const f of files) {
        const versions: any[] = await client.findAll(C.FileVersion, { attachedTo: f._id })
        for (const v of versions) await client.updateDoc(C.FileVersion, v.space, v._id, { space })
      }
    }
    done.push(parent != null ? `moved into "${String(parent.title)}"` : 'moved to the top level')
  }
  return `✅ **${String(item.title)}**: ${done.join(', ') || 'no change'}.`
})

export const deleteDriveItem = wrapToolHandler<z.infer<typeof DeleteDriveItemSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const item = await findItem(client, args.itemId)
  const below = isFolder(item) ? await subtree(client, [item._id]) : []
  if (below.length > 0 && !args.recursive) throw new Error(`Folder "${String(item.title)}" contains ${below.length} item(s). Pass recursive: true to delete it with its contents.`)
  // Deepest first, so no item is left without its parent.
  const all = [...below.sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0)), item]
  for (const x of all) {
    if (!isFolder(x)) {
      // Versions are an attached collection; remove them too (their blobs are cleaned up by the server).
      const versions: any[] = await client.findAll(C.FileVersion, { attachedTo: x._id })
      for (const v of versions) await client.removeCollection(C.FileVersion, v.space, v._id, x._id, C.File, 'versions')
    }
    await client.removeDoc(x._class, x.space, x._id)
  }
  return `✅ Deleted **${String(item.title)}**${below.length > 0 ? ` with ${below.length} item(s)` : ''}.`
})

export const listFileVersions = wrapToolHandler<z.infer<typeof ListFileVersionsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const file = await findItem(client, args.fileId)
  const versions: any[] = await client.findAll(C.FileVersion, { attachedTo: file._id }, { sort: { version: SortingOrder.Descending } })
  if (versions.length === 0) return `No versions of "${String(file.title)}".`
  const lines = versions.sort((a, b) => b.version - a.version).map((v) => `- v${String(v.version)}${v._id === file.file ? ' (current)' : ''} — ${size(v.size)}, ${formatDate(v.modifiedOn ?? v.lastModified)} — \`${String(v._id)}\``)
  return `## Versions of ${String(file.title)} (${versions.length})\n\n${lines.join('\n')}`
})

export const restoreFileVersion = wrapToolHandler<z.infer<typeof RestoreFileVersionSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const file = await findItem(client, args.fileId)
  const v = await versionOf(client, file, args.version)
  if (v._id === file.file) return `v${String(v.version)} is already the current version.`
  // Like Huly's restoreFileVersion: the file simply points at the older version again.
  await client.updateDoc(C.File, file.space, file._id, { file: v._id })
  return `✅ **${String(file.title)}** restored to v${String(v.version)}.`
})

export const createDrive = wrapToolHandler<z.infer<typeof CreateDriveSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const drives: any[] = await client.findAll(C.Drive, {})
  const same = drives.find((d) => String(d.name).toLowerCase() === args.name.toLowerCase())
  if (same != null) return `ℹ️ Drive **${String(same.name)}** already exists — \`${String(same._id)}\`.`
  const me = await currentAccountUuid(client)
  const id = await client.createDoc(C.Drive, 'core:space:Space', {
    name: args.name,
    description: args.description ?? '',
    private: args.isPrivate,
    archived: false,
    autoJoin: false,
    members: [me],
    owners: [me],
    type: 'drive:spaceType:DefaultDrive'
  })
  return `✅ Drive **${args.name}** created — \`${String(id)}\`.`
})
