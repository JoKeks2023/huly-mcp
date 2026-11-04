import tracker from '@hcengineering/tracker'
import chunter from '@hcengineering/chunter'
import { socialIdNames } from '../utils/people'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate, clip } from '../utils/format'
import type { z } from 'zod'
import type { AddCommentSchema, ListCommentsSchema, DeleteCommentSchema, UpdateCommentSchema } from '../schemas'
import { SortingOrder, type Ref } from '@hcengineering/core'
import type { ChatMessage } from '@hcengineering/chunter'

export const addComment = wrapToolHandler<z.infer<typeof AddCommentSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  await client.addCollection(
    chunter.class.ChatMessage,
    issue.space,
    issue._id,
    tracker.class.Issue,
    'comments',
    { message: args.message }
  )

  return `✅ Comment added to **${args.identifier}**.`
})

export const listComments = wrapToolHandler<z.infer<typeof ListCommentsSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  // The newest comments matter most: fetch newest first, show them in chronological order.
  const newest = await client.findAll(
    chunter.class.ChatMessage,
    { attachedTo: issue._id },
    { limit: args.limit, sort: { createdOn: SortingOrder.Descending }, total: true }
  )
  const total: number = (newest as any).total ?? newest.length
  const comments = [...newest].sort((a, b) => (a.createdOn ?? 0) - (b.createdOn ?? 0))

  if (comments.length === 0) return `No comments found on **${args.identifier}**.`

  // Filter comments with valid authors
  const commentsWithAuthors = comments.filter((c): c is typeof c & { createdBy: string } => c.createdBy != null)

  // Resolve author details
  const authorIds = [...new Set(commentsWithAuthors.map((c) => c.createdBy as unknown as string))]
  const memberMap = await socialIdNames(client, authorIds)

  const lines = commentsWithAuthors.map((comment) => {
    const author = memberMap.get(comment.createdBy as unknown as string) ?? 'Unknown'
    const date = formatDate(comment.createdOn)
    // Long comments (CI logs, bot output) are shortened unless full: true.
    const raw = (comment.message as string) ?? ''
    const message = args.full === true ? raw : clip(raw, 1500, 'list_comments full: true')
    return `**${author}** @ ${date} (id: \`${comment._id}\`):\n> ${message.split('\n').join('\n> ')}`
  })

  const count = total > comments.length ? `newest ${comments.length} of ${total}` : String(comments.length)
  return `## Comments on ${args.identifier} (${count})\n\n${lines.join('\n\n')}`
})

export const deleteComment = wrapToolHandler<z.infer<typeof DeleteCommentSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const comment = await client.findOne(chunter.class.ChatMessage, {
    _id: args.commentId as Ref<ChatMessage>,
    attachedTo: issue._id
  })
  if (comment == null) throw new Error(`Comment '${args.commentId}' not found on ${args.identifier}.`)

  await client.removeCollection(
    chunter.class.ChatMessage,
    issue.space,
    comment._id,
    issue._id,
    tracker.class.Issue,
    'comments'
  )

  return `✅ Comment \`${args.commentId}\` deleted from **${args.identifier}**.`
})

export const updateComment = wrapToolHandler<z.infer<typeof UpdateCommentSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const comment = await client.findOne(chunter.class.ChatMessage, {
    _id: args.commentId as Ref<ChatMessage>,
    attachedTo: issue._id
  })
  if (comment == null) throw new Error(`Comment '${args.commentId}' not found on ${args.identifier}.`)

  await client.updateCollection(
    chunter.class.ChatMessage,
    issue.space,
    comment._id,
    issue._id,
    tracker.class.Issue,
    'comments',
    { message: args.message, editedOn: Date.now() } as any
  )

  return `✅ Comment \`${args.commentId}\` on **${args.identifier}** updated.`
})
