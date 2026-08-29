import attachment, { type Attachment } from '@hcengineering/attachment'
import tracker from '@hcengineering/tracker'
import { generateId, type Ref } from '@hcengineering/core'
import { getConnection, getWorkspaceInfo } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { uploadBlob, deleteBlob } from '../utils/storage'
import { formatDate } from '../utils/format'
import type { z } from 'zod'
import type { AttachFileSchema, ListAttachmentsSchema, DeleteAttachmentSchema } from '../schemas'

function base64ToBlob (base64: string, mimeType: string): Blob {
  const binary = Buffer.from(base64, 'base64')
  return new Blob([binary], { type: mimeType })
}

export const attachFile = wrapToolHandler<z.infer<typeof AttachFileSchema>>(async (args) => {
  const client = await getConnection()
  const { wsToken, workspaceUuid } = await getWorkspaceInfo()

  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const blob = base64ToBlob(args.contentBase64, args.mimeType)
  const blobId = `${issue._id}-attachment-${Date.now()}-${args.filename}`
  const uploaded = await uploadBlob(wsToken, workspaceUuid, blobId, blob)

  const attachmentId = generateId<Attachment>()
  await client.addCollection(
    attachment.class.Attachment,
    issue.space,
    issue._id,
    tracker.class.Issue,
    'attachments',
    {
      name: args.filename,
      file: uploaded.id as unknown as Ref<any>,
      size: uploaded.size,
      type: args.mimeType,
      lastModified: Date.now()
    } as any,
    attachmentId
  )

  return `✅ File **"${args.filename}"** (${uploaded.size} bytes) attached to **${args.identifier}** (attachment id: \`${attachmentId}\`).`
})

export const listAttachments = wrapToolHandler<z.infer<typeof ListAttachmentsSchema>>(async (args) => {
  const client = await getConnection()
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const attachments = await client.findAll(attachment.class.Attachment, { attachedTo: issue._id })
  if (attachments.length === 0) return `No attachments found on **${args.identifier}**.`

  const lines = attachments.map((a) =>
    `- **${a.name}** (id: \`${a._id}\`, ${a.size} bytes, ${a.type}) — added ${formatDate(a.modifiedOn)}`
  )
  return `## Attachments on ${args.identifier} (${attachments.length})\n\n${lines.join('\n')}`
})

export const deleteAttachment = wrapToolHandler<z.infer<typeof DeleteAttachmentSchema>>(async (args) => {
  const client = await getConnection()
  const { wsToken, workspaceUuid } = await getWorkspaceInfo()

  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const att = await client.findOne(attachment.class.Attachment, { _id: args.attachmentId as Ref<Attachment> })
  if (att == null) throw new Error(`Attachment '${args.attachmentId}' not found.`)

  await client.removeCollection(
    attachment.class.Attachment,
    issue.space,
    att._id,
    issue._id,
    tracker.class.Issue,
    'attachments'
  )
  await deleteBlob(wsToken, workspaceUuid, String(att.file))

  return `✅ Attachment **"${att.name}"** deleted from **${args.identifier}**.`
})
