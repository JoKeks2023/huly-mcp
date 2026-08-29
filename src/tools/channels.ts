import chunter, { type Channel, type ChunterSpace, type DirectMessage } from '@hcengineering/chunter'
import contact from '@hcengineering/contact'
import core, { SortingOrder, generateId, type Ref } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate } from '../utils/format'
import type { z } from 'zod'
import type { ListChannelsSchema, CreateChannelSchema, StartDirectMessageSchema, SendMessageSchema, ListMessagesSchema } from '../schemas'

export const listChannels = wrapToolHandler<z.infer<typeof ListChannelsSchema>>(async (args) => {
  const client = await getConnection()
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
  const client = await getConnection()

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
  const client = await getConnection()

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
  const client = await getConnection()
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
  const client = await getConnection()
  const { space } = await resolveChatSpace(client, args.spaceId)

  const messages = await client.findAll(
    chunter.class.ChatMessage,
    { attachedTo: space._id },
    { limit: args.limit, sort: { createdOn: SortingOrder.Ascending } }
  )

  if (messages.length === 0) return 'No messages found in this channel.'

  const lines = messages.map((m) => `**[${formatDate(m.createdOn)}]** ${(m as any).message}`)
  return `## Messages (${messages.length})\n\n${lines.join('\n')}`
})
