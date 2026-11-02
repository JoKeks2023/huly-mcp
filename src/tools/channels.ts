import chunter, { type Channel, type ChunterSpace, type DirectMessage } from '@hcengineering/chunter'
import contact from '@hcengineering/contact'
import core, { SortingOrder, generateId, type Ref } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate, markupToText } from '../utils/format'
import { socialIdNames } from '../utils/people'
import { C } from '../utils/classes'
import type { z } from 'zod'
import type { ListChannelsSchema, CreateChannelSchema, StartDirectMessageSchema, SendMessageSchema, ListMessagesSchema, ListThreadSchema, ReplyToMessageSchema, UpdateMessageSchema, DeleteMessageSchema, ReactionSchema, PinMessageSchema } from '../schemas'

export const listChannels = wrapToolHandler<z.infer<typeof ListChannelsSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const query: Record<string, unknown> = {}
  if (!args.includeArchived) query.archived = false

  const channels = await client.findAll(chunter.class.Channel, query as any)
  if (channels.length === 0) return 'No channels found in this workspace.'

  const lines = channels.map((c) =>
    `- **#${c.name}** (id: \`${c._id}\`)${c.topic != null && c.topic !== '' ? ` — ${c.topic}` : ''}${c.private === true ? ' 🔒' : ''} — ${c.messages ?? 0} messages`
  )
  return `## Channels (${channels.length})\n\n${lines.join('\n')}`
})

export const createChannel = wrapToolHandler<z.infer<typeof CreateChannelSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  const existing = await client.findOne(chunter.class.Channel, { name: args.name })
  if (existing != null) return `ℹ️ Channel **#${args.name}** already exists (id: \`${existing._id}\`).`

  const channelId = generateId<Channel>()
  await client.createDoc(
    chunter.class.Channel,
    core.space.Space,
    {
      name: args.name,
      topic: args.topic ?? '',
      description: args.topic ?? '',
      private: args.isPrivate,
      members: [client.user],
      owners: [client.user],
      autoJoin: false,
      archived: false,
      messages: 0
    } as any,
    channelId
  )

  return `✅ Channel **#${args.name}** created (id: \`${channelId}\`).`
})

export const startDirectMessage = wrapToolHandler<z.infer<typeof StartDirectMessageSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  const persons = await client.findAll(contact.class.Person, {})
  const match = persons.find((p) => (p.name ?? '').toLowerCase().includes(args.member.toLowerCase()))
  if (match == null || match.personUuid == null) throw new Error(`Member '${args.member}' not found.`)

  const targetAccount = match.personUuid as unknown as Ref<any>
  const matchName = match.name
  const selfAccount = client.user

  // A DM is identified by its exact member set — look for an existing one first.
  const existingDms = await client.findAll(chunter.class.DirectMessage, {})
  const existing = existingDms.find((dm) => {
    const dmMembers = ((dm as any).members ?? []) as string[]
    return dmMembers.length === 2 && dmMembers.includes(String(targetAccount)) && dmMembers.includes(String(selfAccount))
  })
  if (existing != null) return `ℹ️ Direct message with **${matchName}** already exists (id: \`${existing._id}\`).`

  const dmId = generateId<DirectMessage>()
  await client.createDoc(
    chunter.class.DirectMessage,
    core.space.Space,
    {
      name: '',
      description: '',
      private: true,
      members: [selfAccount, targetAccount],
      owners: [selfAccount, targetAccount],
      autoJoin: false,
      archived: false,
      messages: 0
    } as any,
    dmId
  )

  return `✅ Direct message with **${matchName}** started (id: \`${dmId}\`).`
})

async function resolveChatSpace (client: Awaited<ReturnType<typeof getConnection>>, spaceId: string): Promise<{ space: ChunterSpace, spaceClass: Ref<any> }> {
  const channel = await client.findOne(chunter.class.Channel, { _id: spaceId as Ref<Channel> })
  if (channel != null) return { space: channel, spaceClass: chunter.class.Channel }

  const dm = await client.findOne(chunter.class.DirectMessage, { _id: spaceId as Ref<DirectMessage> })
  if (dm != null) return { space: dm, spaceClass: chunter.class.DirectMessage }

  throw new Error(`Channel or direct message '${spaceId}' not found.`)
}

export const sendMessage = wrapToolHandler<z.infer<typeof SendMessageSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const { space, spaceClass } = await resolveChatSpace(client, args.spaceId)

  await client.addCollection(
    chunter.class.ChatMessage,
    space._id,
    space._id,
    spaceClass as any,
    'messages',
    { message: args.message }
  )

  return `✅ Message sent to \`${args.spaceId}\`.`
})

export const listMessages = wrapToolHandler<z.infer<typeof ListMessagesSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const { space } = await resolveChatSpace(client, args.spaceId)

  const messages = await client.findAll(
    chunter.class.ChatMessage,
    { attachedTo: space._id },
    { limit: args.limit, sort: { createdOn: SortingOrder.Ascending } }
  )

  if (messages.length === 0) return 'No messages found in this channel.'

  const who = await socialIdNames(client, [...new Set(messages.map((m) => m.createdBy as string).filter((x) => x != null))])
  const lines = messages.map((m: any) => {
    const extras = [
      (m.replies ?? 0) > 0 ? `${m.replies as number} replies` : '',
      (m.reactions ?? 0) > 0 ? `${m.reactions as number} reactions` : '',
      m.isPinned === true ? 'pinned' : ''
    ].filter(Boolean).join(', ')
    return `**[${formatDate(m.createdOn)}] ${who.get(m.createdBy) ?? ''}** ${markupToText(m.message)}${extras !== '' ? ` _(${extras})_` : ''} — \`${m._id as string}\``
  })
  return `## Messages (${messages.length})\n\n${lines.join('\n')}`
})

// ── Threads, editing, reactions, pins — work on channel messages and issue comments alike ──

async function findMessage (client: any, messageId: string): Promise<any> {
  const msg = await client.findOne(C.ActivityMessage, { _id: messageId })
  if (msg == null) throw new Error(`Message '${messageId}' not found.`)
  return msg
}

export const listThread = wrapToolHandler<z.infer<typeof ListThreadSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const parent = await findMessage(client, args.messageId)
  const replies: any[] = await client.findAll(C.ThreadMessage, { attachedTo: parent._id }, { sort: { createdOn: SortingOrder.Ascending }, limit: args.limit })
  const who = await socialIdNames(client, [...new Set([parent, ...replies].map((m) => m.createdBy).filter((x) => x != null))])
  const line = (m: any): string => `**[${formatDate(m.createdOn)}] ${who.get(m.createdBy) ?? ''}** ${markupToText(m.message)} — \`${m._id as string}\``
  return `## Thread\n\n${line(parent)}\n\n${replies.length === 0 ? '_No replies._' : replies.map((r) => `> ${line(r)}`).join('\n')}`
})

export const replyToMessage = wrapToolHandler<z.infer<typeof ReplyToMessageSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const parent = await findMessage(client, args.messageId)
  // Replies to a reply go into the same thread (as in Huly).
  const root = parent._class === C.ThreadMessage ? await findMessage(client, parent.attachedTo) : parent
  const id = generateId()
  await client.addCollection(C.ThreadMessage, root.space, root._id, root._class, 'replies', {
    message: args.message,
    attachments: 0,
    objectId: root.attachedTo,
    objectClass: root.attachedToClass
  }, id)
  return `✅ Reply posted (id: \`${id}\`).`
})

export const updateMessage = wrapToolHandler<z.infer<typeof UpdateMessageSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const msg = await findMessage(client, args.messageId)
  if (typeof msg.message !== 'string') throw new Error(`'${args.messageId}' is not a text message.`)
  await client.updateCollection(msg._class, msg.space, msg._id, msg.attachedTo, msg.attachedToClass, msg.collection, { message: args.message, editedOn: Date.now() })
  return '✅ Message updated.'
})

export const deleteMessage = wrapToolHandler<z.infer<typeof DeleteMessageSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const msg = await findMessage(client, args.messageId)
  if (typeof msg.message !== 'string') throw new Error(`'${args.messageId}' is not a text message.`)
  await client.removeCollection(msg._class, msg.space, msg._id, msg.attachedTo, msg.attachedToClass, msg.collection)
  return '🗑️ Message deleted.'
})

export const addReaction = wrapToolHandler<z.infer<typeof ReactionSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const msg = await findMessage(client, args.messageId)
  const existing = await client.findOne(C.Reaction, { attachedTo: msg._id, emoji: args.emoji, createBy: client.user })
  if (existing != null) return `You already reacted with ${args.emoji}.`
  await client.addCollection(C.Reaction, msg.space, msg._id, msg._class, 'reactions', { emoji: args.emoji, createBy: client.user })
  return `✅ Reacted with ${args.emoji}.`
})

export const removeReaction = wrapToolHandler<z.infer<typeof ReactionSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const msg = await findMessage(client, args.messageId)
  const existing = await client.findOne(C.Reaction, { attachedTo: msg._id, emoji: args.emoji, createBy: client.user })
  if (existing == null) return `You have no ${args.emoji} reaction on this message.`
  await client.removeCollection(C.Reaction, existing.space, existing._id, msg._id, msg._class, 'reactions')
  return `✅ Removed ${args.emoji}.`
})

export const pinMessage = wrapToolHandler<z.infer<typeof PinMessageSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const msg = await findMessage(client, args.messageId)
  await client.updateCollection(msg._class, msg.space, msg._id, msg.attachedTo, msg.attachedToClass, msg.collection, { isPinned: args.pinned })
  return args.pinned ? '📌 Message pinned.' : 'Message unpinned.'
})
