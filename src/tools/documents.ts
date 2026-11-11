import document from '@hcengineering/document'
import core, { SortingOrder, generateId, type Ref } from '@hcengineering/core'
import { getFirstRank } from '@hcengineering/document'
import { makeRank } from '@hcengineering/rank'
import chunter from '@hcengineering/chunter'
import { socialIdNames, currentAccountUuid } from '../utils/people'
import { markupToText } from '../utils/format'
import { getConnection, getWorkspaceInfo } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { markdownToProseMirror, extractText } from '../utils/markdown'
import { uploadMarkupBlob } from '../utils/storage'
import tracker from '@hcengineering/tracker'
import type { z } from 'zod'
import type { ListTeamspacesSchema, ListDocumentsSchema, GetDocumentSchema, CreateDocumentSchema, UpdateDocumentSchema, LinkDocumentSchema, CreateTeamspaceSchema, DeleteDocumentSchema, ListDocumentCommentsSchema, AddDocumentCommentSchema } from '../schemas'
import { fetchBlob } from '../utils/content'
import type { Teamspace, Document } from '@hcengineering/document'

export const listTeamspaces = wrapToolHandler<z.infer<typeof ListTeamspacesSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const teamspaces = await client.findAll(document.class.Teamspace, {})

  if (teamspaces.length === 0) return 'No teamspaces found in this workspace.'

  const lines = teamspaces.map((t) =>
    `- **${t.name}** (id: \`${t._id}\`)${t.description != null && t.description !== '' ? `\n  ${t.description}` : ''}`
  )

  return `## Teamspaces (${teamspaces.length})\n\n${lines.join('\n')}`
})

export const createTeamspace = wrapToolHandler<z.infer<typeof CreateTeamspaceSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  const teamspaceId = generateId<Teamspace>()
  // Space members and owners are account uuids in Huly 0.7 (not the social id in client.user).
  const me = await currentAccountUuid(client)
  await client.createDoc(
    document.class.Teamspace,
    core.space.Space,
    {
      name: args.name,
      description: args.description ?? '',
      private: args.isPrivate ?? false,
      members: [me],
      owners: [me],
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
  const client = await getConnection(args.workspace)
  const docs = await client.findAll(
    document.class.Document,
    { space: args.teamspaceId as Ref<Teamspace> },
    { sort: { rank: SortingOrder.Ascending }, limit: 100 }
  )

  if (docs.length === 0) return 'No documents found in this teamspace.'

  // Real tree: children under their parent, any depth.
  const noParentId = document.ids.NoParent as string
  const ids = new Set(docs.map((d) => String(d._id)))
  const byParent = new Map<string, any[]>()
  for (const d of docs) {
    const p = d.parent != null && String(d.parent) !== noParentId && ids.has(String(d.parent)) ? String(d.parent) : noParentId
    byParent.set(p, [...(byParent.get(p) ?? []), d])
  }
  const lines: string[] = []
  const walk = (parent: string, depth: number): void => {
    for (const d of byParent.get(parent) ?? []) {
      lines.push(`${'  '.repeat(depth)}- **${d.title}** (id: \`${d._id}\`)${(d as any).comments > 0 ? ` · ${(d as any).comments as number} comment(s)` : ''}`)
      if (depth < 20) walk(String(d._id), depth + 1)
    }
  }
  walk(noParentId, 0)
  return `## Documents (${docs.length})\n\n${lines.join('\n')}`
})

export const getDocument = wrapToolHandler<z.infer<typeof GetDocumentSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
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
      const { wsToken, workspaceUuid } = await getWorkspaceInfo(args.workspace)
      // Never put the workspace token in the URL — it would end up in the tool result and
      // in proxy/access logs. front's /files accepts it as a Bearer header (same as uploads).
      const contentUrl = `${frontUrl}/files?file=${encodeURIComponent(doc.content)}&workspace=${workspaceUuid}`
      lines.push(`\n**Content:** Available at blob ref \`${doc.content}\``)
      lines.push(`**Content URL:** ${contentUrl} _(requires a workspace token as Bearer header)_`)
      // Try to fetch content
      try {
        const res = await fetchBlob(contentUrl, wsToken)
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
  const client = await getConnection(args.workspace)

  const teamspace = await client.findOne(document.class.Teamspace, { _id: args.teamspaceId as Ref<Teamspace> })
  if (teamspace == null) throw new Error(`Teamspace '${args.teamspaceId}' not found.`)

  const noParent = document.ids.NoParent as Ref<Document>
  const parentId = args.parentId != null ? (args.parentId as Ref<Document>) : noParent

  // Like Huly: after the last sibling.
  const rank = makeRank(await getFirstRank(client, teamspace._id, parentId), undefined)

  const docId = generateId<Document>()
  await client.createDoc(
    document.class.Document,
    teamspace._id,
    {
      title: args.title,
      content: null,
      parent: parentId,
      rank,
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
  const client = await getConnection(args.workspace)
  const doc = await client.findOne(document.class.Document, { _id: args.documentId as Ref<Document> })
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`)

  await client.removeDoc(document.class.Document, doc.space, doc._id)

  return `✅ Document **"${doc.title}"** (\`${doc._id}\`) deleted.`
})

/** All descendants of a document (any depth). */
async function descendants (client: any, root: any): Promise<any[]> {
  const out: any[] = []
  let level = [root._id]
  while (level.length > 0) {
    const kids: any[] = await client.findAll(document.class.Document, { parent: { $in: level } })
    out.push(...kids)
    level = kids.map((k) => k._id)
  }
  return out
}

export const updateDocument = wrapToolHandler<z.infer<typeof UpdateDocumentSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const doc = await client.findOne(document.class.Document, { _id: args.documentId as Ref<Document> })
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`)
  if (args.markdown == null && args.title == null && args.parentId === undefined && args.teamspaceId == null) {
    throw new Error('Nothing to change: pass markdown, title, parentId or teamspaceId.')
  }
  const done: string[] = []

  // Move (new parent and/or teamspace) — validated before anything is written.
  const moving = args.parentId !== undefined || args.teamspaceId != null
  let move: Record<string, unknown> | undefined
  let subtree: any[] = []
  if (moving) {
    const noParent = document.ids.NoParent as string
    let parent: any
    if (args.parentId != null) {
      parent = await client.findOne(document.class.Document, { _id: args.parentId })
      if (parent == null) throw new Error(`Parent document '${args.parentId}' not found.`)
    }
    const space = parent?.space ?? args.teamspaceId ?? doc.space
    if (args.teamspaceId != null && parent != null && parent.space !== args.teamspaceId) throw new Error('parentId is in a different teamspace than teamspaceId.')
    if (space !== doc.space && (await client.findOne(document.class.Teamspace, { _id: space })) == null) throw new Error(`Teamspace '${String(space)}' not found.`)
    subtree = await descendants(client, doc)
    if (parent != null && (parent._id === doc._id || subtree.some((d) => d._id === parent._id))) throw new Error('A document cannot be moved under itself or one of its children.')
    const parentId = parent?._id ?? (args.parentId === null || args.teamspaceId != null ? noParent : doc.parent)
    move = { space, parent: parentId, rank: makeRank(await getFirstRank(client, space, parentId), undefined) }
  }

  if (args.markdown != null) {
    const { wsToken, workspaceUuid } = await getWorkspaceInfo(args.workspace)
    const uploadedId = await uploadMarkupBlob(wsToken, workspaceUuid, `${args.documentId}-content-${Date.now()}`, JSON.stringify(markdownToProseMirror(args.markdown)))
    await client.updateDoc(document.class.Document, doc.space, doc._id, { content: uploadedId })
    done.push('content replaced')
  }
  if (args.title != null && args.title !== doc.title) {
    await client.updateDoc(document.class.Document, doc.space, doc._id, { title: args.title })
    done.push(`renamed to "${args.title}"`)
  }
  if (move != null) {
    await client.updateDoc(document.class.Document, doc.space, doc._id, move)
    // Children keep their parent but must live in the same teamspace.
    if (move.space !== doc.space) for (const d of subtree) await client.updateDoc(document.class.Document, d.space, d._id, { space: move.space })
    done.push(`moved${move.space !== doc.space ? ` to another teamspace (with ${subtree.length} sub-document(s))` : ''}${String(move.parent) === document.ids.NoParent ? ' to top level' : ' under the new parent'}`)
  }
  return `✅ Document **"${args.title ?? doc.title}"**: ${done.join(', ') || 'no change'}.`
})

export const listDocumentComments = wrapToolHandler<z.infer<typeof ListDocumentCommentsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const doc = await client.findOne(document.class.Document, { _id: args.documentId })
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`)
  const comments: any[] = await client.findAll(chunter.class.ChatMessage, { attachedTo: doc._id }, { sort: { createdOn: SortingOrder.Ascending }, limit: args.limit })
  if (comments.length === 0) return `No comments on "${doc.title as string}".`
  const names = await socialIdNames(client, [...new Set(comments.map((c) => c.createdBy).filter((x) => x != null))])
  const lines = comments.map((c) => `- **${names.get(c.createdBy) ?? 'Unknown'}** (${new Date(c.createdOn ?? 0).toISOString().slice(0, 16).replace('T', ' ')}) — \`${c._id as string}\`\n  ${markupToText(c.message).replace(/\n/g, '\n  ')}`)
  return `## Comments on "${doc.title as string}" (${comments.length})\n\n${lines.join('\n')}`
})

export const addDocumentComment = wrapToolHandler<z.infer<typeof AddDocumentCommentSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const doc = await client.findOne(document.class.Document, { _id: args.documentId })
  if (doc == null) throw new Error(`Document '${args.documentId}' not found.`)
  await client.addCollection(chunter.class.ChatMessage, doc.space, doc._id, document.class.Document, 'comments', { message: args.message })
  return `✅ Comment added to "${doc.title as string}".`
})

export const linkDocument = wrapToolHandler<z.infer<typeof LinkDocumentSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

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
