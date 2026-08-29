import document from '@hcengineering/document'
import core, { SortingOrder, generateId, type Ref } from '@hcengineering/core'
import { getFirstRank } from '@hcengineering/document'
import { getConnection, getWorkspaceInfo } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { markdownToProseMirror, extractText } from '../utils/markdown'
import { uploadMarkupBlob } from '../utils/storage'
import tracker from '@hcengineering/tracker'
import type { z } from 'zod'
import type { ListDocumentsSchema, GetDocumentSchema, CreateDocumentSchema, UpdateDocumentSchema, LinkDocumentSchema, CreateTeamspaceSchema, DeleteDocumentSchema } from '../schemas'
import type { Teamspace, Document } from '@hcengineering/document'

export const listTeamspaces = wrapToolHandler<Record<string, never>>(async () => {
  const client = await getConnection()
  const teamspaces = await client.findAll(document.class.Teamspace, {})

  if (teamspaces.length === 0) return 'No teamspaces found in this workspace.'

  const lines = teamspaces.map((t) =>
    `- **${t.name}** (id: \`${t._id}\`)${t.description != null && t.description !== '' ? `\n  ${t.description}` : ''}`
  )

  return `## Teamspaces (${teamspaces.length})\n\n${lines.join('\n')}`
})

export const createTeamspace = wrapToolHandler<z.infer<typeof CreateTeamspaceSchema>>(async (args) => {
  const client = await getConnection()

  const teamspaceId = generateId<Teamspace>()
  await client.createDoc(
    document.class.Teamspace,
    core.space.Space,
    {
      name: args.name,
      description: args.description ?? '',
      private: args.isPrivate ?? false,
      members: [client.user],
      owners: [client.user],
      autoJoin: false,
      archived: false,
      icon: undefined,
      color: undefined,
      type: document.spaceType.DefaultTeamspaceType
    } as any,
    teamspaceId
  )

  return `✅ Teamspace **"${args.name}"** created (id: \`${teamspaceId}\`).`
})

export const listDocuments = wrapToolHandler<z.infer<typeof ListDocumentsSchema>>(async (args) => {
  const client = await getConnection()
  const docs = await client.findAll(
    document.class.Document,
    { space: args.teamspaceId as Ref<Teamspace> },
    { sort: { rank: SortingOrder.Ascending }, limit: 100 }
  )

  if (docs.length === 0) return 'No documents found in this teamspace.'

  // Build parent-child tree display
  const noParentId = document.ids.NoParent as string
  const lines = docs.map((d) => {
    const isNested = d.parent != null && String(d.parent) !== noParentId
    const prefix = isNested ? '  - ' : '- '
    return `${prefix}**${d.title}** (id: \`${d._id}\`)${d.snapshots != null && d.snapshots > 0 ? ` [${d.snapshots} snapshots]` : ''}`
  })
  return `## Documents (${docs.length})\n\n${lines.join('\n')}`
})

export const getDocument = wrapToolHandler<z.infer<typeof GetDocumentSchema>>(async (args) => {
  const client = await getConnection()
  const doc = await client.findOne(document.class.Document, { _id: args.documentId as Ref<Document> })
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`)

  const teamspace = await client.findOne(document.class.Teamspace, { _id: doc.space })

  const lines = [
    `## ${doc.title}`,
    `**ID:** \`${doc._id}\``,
    `**Teamspace:** ${teamspace?.name ?? doc.space}`,
    `**Comments:** ${doc.comments ?? 0}`,
    `**Attachments:** ${doc.attachments ?? 0}`,
    `**Snapshots:** ${doc.snapshots ?? 0}`
  ]

  // Provide content access instructions if content blob ref exists
  if (doc.content != null) {
    const frontUrl = process.env.HULY_FRONT_URL
    if (frontUrl != null && frontUrl !== '') {
      const { wsToken, workspaceUuid } = await getWorkspaceInfo()
      const blobUrl = `${frontUrl}/files?file=${encodeURIComponent(doc.content)}&workspace=${workspaceUuid}&token=${wsToken}`
      lines.push(`\n**Content:** Available at blob ref \`${doc.content}\``)
      lines.push(`**Content URL:** ${blobUrl}`)
      // Try to fetch content
      try {
        const res = await fetch(blobUrl)
        if (res.ok) {
          const text = await res.text()
          // Huly stores content as JSON markup — extract plain text if possible
          try {
            const parsed = JSON.parse(text)
            const extracted = extractText(parsed)
            if (extracted.length > 0) {
              lines.push(`\n**Content:**\n${extracted}`)
            }
          } catch {
            lines.push(`\n**Content (raw):**\n${text.substring(0, 2000)}`)
          }
        }
      } catch {
        lines.push(`_(Set HULY_FRONT_URL env var to fetch content)_`)
      }
    } else {
      lines.push(`\n**Content blob ref:** \`${doc.content}\``)
      lines.push(`_(Set HULY_FRONT_URL env var to fetch document content, e.g. https://front.huly.app)_`)
    }
  } else {
    lines.push('\n**Content:** _(empty document)_')
  }

  return lines.join('\n')
})

export const createDocument = wrapToolHandler<z.infer<typeof CreateDocumentSchema>>(async (args) => {
  const client = await getConnection()

  const teamspace = await client.findOne(document.class.Teamspace, { _id: args.teamspaceId as Ref<Teamspace> })
  if (teamspace == null) throw new Error(`Teamspace '${args.teamspaceId}' not found.`)

  const noParent = document.ids.NoParent as Ref<Document>
  const parentId = args.parentId != null ? (args.parentId as Ref<Document>) : noParent

  // Compute rank (prepend before existing docs at same level)
  const rank = await getFirstRank(client, teamspace._id, parentId)

  const docId = generateId<Document>()
  await client.createDoc(
    document.class.Document,
    teamspace._id,
    {
      title: args.title,
      content: null,
      parent: parentId,
      rank: rank ?? '',
      icon: null,
      color: undefined as any,
      snapshots: 0,
      attachments: 0,
      comments: 0,
      labels: 0,
      references: 0,
      embeddings: 0
    } as any,
    docId
  )

  return `✅ Document **"${args.title}"** created (id: \`${docId}\`) in teamspace "${teamspace.name}".\nOpen it in Huly to add content via the editor.`
})

export const deleteDocument = wrapToolHandler<z.infer<typeof DeleteDocumentSchema>>(async (args) => {
  const client = await getConnection()
  const doc = await client.findOne(document.class.Document, { _id: args.documentId as Ref<Document> })
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`)

  await client.removeDoc(document.class.Document, doc.space, doc._id)

  return `✅ Document **"${doc.title}"** (\`${doc._id}\`) deleted.`
})

export const updateDocument = wrapToolHandler<z.infer<typeof UpdateDocumentSchema>>(async (args) => {
  const client = await getConnection()
  const { wsToken, workspaceUuid } = await getWorkspaceInfo()

  const doc = await client.findOne(document.class.Document, { _id: args.documentId as Ref<Document> })
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`)

  // Convert markdown to ProseMirror JSON
  const prosemirror = markdownToProseMirror(args.markdown)
  const content = JSON.stringify(prosemirror)

  const blobId = `${args.documentId}-content-${Date.now()}`
  const uploadedId = await uploadMarkupBlob(wsToken, workspaceUuid, blobId, content)

  // Update document content ref
  await client.updateDoc(document.class.Document, doc.space, doc._id, { content: uploadedId } as any)

  return `✅ Document **"${doc.title}"** updated (blob: \`${uploadedId}\`).`
})

export const linkDocument = wrapToolHandler<z.infer<typeof LinkDocumentSchema>>(async (args) => {
  const client = await getConnection()

  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const doc = await client.findOne(document.class.Document, { _id: args.documentId as Ref<Document> })
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`)

  const existing = (issue as any).relations ?? []
  if (existing.some((r: any) => r._id === doc._id)) {
    return `ℹ️ Document **"${doc.title}"** is already linked to **${args.identifier}**.`
  }

  await client.updateDoc(tracker.class.Issue, issue.space, issue._id, {
    relations: [...existing, { _id: doc._id, _class: doc._class }]
  } as any)

  return `✅ Document **"${doc.title}"** linked to **${args.identifier}** — visible in the Relations panel.`
})
