import contact from '@hcengineering/contact'
import { generateId } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatPersonName } from '../utils/people'
import type { z } from 'zod'
import type { ListPersonsSchema, GetPersonSchema, CreatePersonSchema, UpdatePersonSchema, ContactChannelSchema } from '../schemas'

const provider = (name: string): string => `contact:channelProvider:${name}`
const providerName = (id: string): string => String(id).split(':').pop() ?? id

function splitName (raw: string): { first: string, last: string } {
  const [last, first] = (raw ?? '').split(',', 2)
  return first === undefined ? { first: last.trim(), last: '' } : { first: first.trim(), last: last.trim() }
}

/** Any contact person (not only workspace users), by id or name. */
async function findAnyPerson (client: any, ref: string): Promise<any> {
  const byId = await client.findOne(contact.class.Person, { _id: ref })
  if (byId != null) return byId
  const q = ref.trim().toLowerCase()
  const persons: any[] = await client.findAll(contact.class.Person, {})
  const exact = persons.filter((p) => formatPersonName(p.name).toLowerCase() === q || String(p.name ?? '').toLowerCase() === q)
  if (exact.length === 1) return exact[0]
  const partial = persons.filter((p) => formatPersonName(p.name).toLowerCase().includes(q))
  if (partial.length === 1) return partial[0]
  if (partial.length === 0) throw new Error(`Person '${ref}' not found.`)
  throw new Error(`Person '${ref}' is ambiguous: ${partial.map((p) => `${formatPersonName(p.name)} (\`${p._id as string}\`)`).join(', ')}.`)
}

function isEmployee (client: any, person: any): boolean {
  try { return client.getHierarchy().hasMixin(person, contact.mixin.Employee) } catch { return person[contact.mixin.Employee] != null }
}

export const listPersons = wrapToolHandler<z.infer<typeof ListPersonsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  let persons: any[] = await client.findAll(contact.class.Person, {})
  if (args.employeesOnly) persons = persons.filter((p) => isEmployee(client, p))
  if (args.query != null) persons = persons.filter((p) => formatPersonName(p.name).toLowerCase().includes(args.query!.toLowerCase()))
  persons.sort((a, b) => formatPersonName(a.name).localeCompare(formatPersonName(b.name)))
  const total = persons.length
  persons = persons.slice(0, args.limit)
  if (persons.length === 0) return 'No persons found.'
  const channels: any[] = await client.findAll(contact.class.Channel, { attachedTo: { $in: persons.map((p) => p._id) } })
  const lines = persons.map((p) => {
    const ch = channels.filter((c) => c.attachedTo === p._id).map((c) => `${providerName(c.provider)}: ${c.value as string}`)
    return `- **${formatPersonName(p.name)}**${isEmployee(client, p) ? ' (member)' : ''}${p.city != null && p.city !== '' ? ` · ${p.city as string}` : ''}${ch.length > 0 ? ` · ${ch.join(', ')}` : ''} — \`${p._id as string}\``
  })
  return `## Persons (${total})\n\n${lines.join('\n')}${total > persons.length ? `\n\n_${total - persons.length} more (raise limit)._` : ''}`
})

export const getPerson = wrapToolHandler<z.infer<typeof GetPersonSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const p = await findAnyPerson(client, args.person)
  const channels: any[] = await client.findAll(contact.class.Channel, { attachedTo: p._id })
  const memberships: any[] = await client.findAll(contact.class.Member, { contact: p._id })
  const orgs: string[] = []
  for (const m of memberships) {
    const org: any = await client.findOne(contact.class.Organization, { _id: m.attachedTo })
    if (org != null) orgs.push(org.name)
  }
  return [
    `## ${formatPersonName(p.name)}`,
    `**Id:** \`${p._id as string}\``,
    `**Workspace member:** ${isEmployee(client, p) ? 'yes' : 'no'}`,
    p.city != null && p.city !== '' ? `**City:** ${p.city as string}` : null,
    `**Contact channels:** ${channels.length > 0 ? channels.map((c) => `${providerName(c.provider)}: ${c.value as string}`).join(', ') : 'none'}`,
    `**Organizations:** ${orgs.length > 0 ? orgs.join(', ') : 'none'}`
  ].filter(Boolean).join('\n')
})

export const createPerson = wrapToolHandler<z.infer<typeof CreatePersonSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const name = `${args.lastName},${args.firstName}`
  const display = formatPersonName(name)
  const existing = (await client.findAll(contact.class.Person, {})).filter((p: any) => formatPersonName(p.name).toLowerCase() === display.toLowerCase())
  if (existing.length > 0) return `ℹ️ **${display}** already exists (id: \`${existing[0]._id as string}\`).`

  const id = generateId()
  // Huly stores names as "Last,First" (contact combineName).
  await client.createDoc(contact.class.Person, contact.space.Contacts, { name, city: args.city ?? '', avatarType: 'color' }, id)
  for (const ch of args.channels ?? []) {
    await client.addCollection(contact.class.Channel, contact.space.Contacts, id, contact.class.Person, 'channels', { provider: provider(ch.provider), value: ch.value })
  }
  return `✅ Person **${display}** created (id: \`${id}\`)${(args.channels ?? []).length > 0 ? ` with ${args.channels!.length} contact channel(s)` : ''}.`
})

export const updatePerson = wrapToolHandler<z.infer<typeof UpdatePersonSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const p = await findAnyPerson(client, args.person)
  const updates: Record<string, unknown> = {}
  if (args.firstName !== undefined || args.lastName !== undefined) {
    const cur = splitName(p.name)
    updates.name = `${args.lastName ?? cur.last},${args.firstName ?? cur.first}`
  }
  if (args.city !== undefined) updates.city = args.city
  if (Object.keys(updates).length === 0) return `Nothing to update for **${formatPersonName(p.name)}**.`
  await client.updateDoc(contact.class.Person, p.space, p._id, updates)
  return `✅ **${formatPersonName((updates.name as string | undefined) ?? p.name)}** updated (${Object.keys(updates).join(', ')}).`
})

export const addContactChannel = wrapToolHandler<z.infer<typeof ContactChannelSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const p = await findAnyPerson(client, args.person)
  const existing = await client.findOne(contact.class.Channel, { attachedTo: p._id, provider: provider(args.provider), value: args.value })
  if (existing != null) return `ℹ️ ${formatPersonName(p.name)} already has ${args.provider}: ${args.value}.`
  await client.addCollection(contact.class.Channel, p.space, p._id, p._class, 'channels', { provider: provider(args.provider), value: args.value })
  return `✅ Added ${args.provider} **${args.value}** to ${formatPersonName(p.name)}.`
})

export const removeContactChannel = wrapToolHandler<z.infer<typeof ContactChannelSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const p = await findAnyPerson(client, args.person)
  const ch = await client.findOne(contact.class.Channel, { attachedTo: p._id, provider: provider(args.provider), value: args.value })
  if (ch == null) return `${formatPersonName(p.name)} has no ${args.provider} "${args.value}".`
  await client.removeCollection(contact.class.Channel, ch.space, ch._id, p._id, ch.attachedToClass, 'channels')
  return `✅ Removed ${args.provider} **${args.value}** from ${formatPersonName(p.name)}.`
})
