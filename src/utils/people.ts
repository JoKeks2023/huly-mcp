// People in Huly 0.7: every user is a contact.class.Person with the contact.mixin.Employee
// mixin (contact.class.Member is the membership of a person in an organization — it is
// empty for most workspaces and must not be used to find users). Names are stored as
// "Last,First". Changes are attributed to a PersonId (social identity), which
// contact.class.SocialIdentity maps back to its Person.

import contact from '@hcengineering/contact'
import type { Ref, TxOperations } from '@hcengineering/core'
import type { Person } from '@hcengineering/contact'

export interface PersonInfo { _id: Ref<Person>, name: string, rawName: string, uuid?: string }

/** "Conrad,Joris" → "Joris Conrad"; other formats are returned trimmed. */
export function formatPersonName (raw: string | null | undefined): string {
  if (raw == null) return ''
  const [last, first] = raw.split(',', 2)
  if (first === undefined) return raw.trim()
  return `${first.trim()} ${last.trim()}`.trim()
}

/** Workspace users (employees); falls back to all persons if the mixin query returns nothing. */
export async function listPeople (client: TxOperations): Promise<PersonInfo[]> {
  let docs: any[] = await client.findAll(contact.mixin.Employee as any, {})
  if (docs.length === 0) docs = await client.findAll(contact.class.Person, {})
  return docs.map((d) => ({ _id: d._id, rawName: d.name ?? '', name: formatPersonName(d.name) }))
}

/** Map person id → display name. */
export async function peopleNames (client: TxOperations): Promise<Map<string, string>> {
  return new Map((await listPeople(client)).map((p) => [p._id as string, p.name]))
}

/**
 * Finds one user by name ("Joris", "Conrad", "Joris Conrad", "Conrad,Joris"), case-insensitive.
 * An exact full-name match wins; otherwise the query must match exactly one person.
 */
export async function findPerson (client: TxOperations, query: string): Promise<PersonInfo> {
  const q = query.trim().toLowerCase()
  const people = await listPeople(client)
  const exact = people.filter((p) => p.name.toLowerCase() === q || p.rawName.toLowerCase() === q)
  if (exact.length === 1) return exact[0]
  const partial = people.filter((p) => p.name.toLowerCase().includes(q) || p.rawName.toLowerCase().includes(q))
  if (partial.length === 1) return partial[0]
  if (partial.length === 0) throw new Error(`Member '${query}' not found.`)
  throw new Error(`Member '${query}' is ambiguous: ${partial.map((p) => p.name).join(', ')}.`)
}

/** The Person behind the connected account (via its social identity). */
export async function currentPerson (client: TxOperations): Promise<PersonInfo> {
  const identity: any = await client.findOne(contact.class.SocialIdentity as any, { _id: client.user as any })
  const personId = identity?.attachedTo
  if (personId == null) throw new Error('Could not identify current user.')
  const person: any = await client.findOne(contact.class.Person, { _id: personId })
  return { _id: personId, rawName: person?.name ?? '', name: formatPersonName(person?.name), uuid: person?.personUuid }
}

/** Map social identity (PersonId, e.g. createdBy/modifiedBy) → display name. */
export async function socialIdNames (client: TxOperations, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const identities: any[] = await client.findAll(contact.class.SocialIdentity as any, { _id: { $in: ids } } as any)
  const names = await peopleNames(client)
  return new Map(identities.map((i) => [i._id as string, names.get(i.attachedTo) ?? 'Unknown']))
}

/** Account UUID of the connected user (inbox notifications and calendars are keyed by it). */
export async function currentAccountUuid (client: TxOperations): Promise<string> {
  const me = await currentPerson(client)
  if (me.uuid == null) throw new Error('Could not determine the account of the current user.')
  return me.uuid
}
