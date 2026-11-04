// Collaborators (who follows a document and gets its notifications) and public guest links.
import core from '@hcengineering/core'
import contact from '@hcengineering/contact'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { resolveObject } from '../utils/resolve'
import { C } from '../utils/classes'
import { currentPerson, findPerson, formatPersonName } from '../utils/people'
import type { z } from 'zod'
import type { ListCollaboratorsSchema, AddCollaboratorSchema, RemoveCollaboratorSchema, CreatePublicLinkSchema, ListPublicLinksSchema, RevokePublicLinkSchema } from '../schemas'

/** Account uuid → display name for all persons that have an account. */
async function accountNames (client: any): Promise<Map<string, string>> {
  const persons: any[] = await client.findAll(contact.class.Person, {})
  return new Map(persons.filter((p) => p.personUuid != null).map((p) => [p.personUuid as string, formatPersonName(p.name)]))
}

/** Account uuid of a member given by name, or of the current user when omitted. */
async function accountOf (client: any, member: string | undefined): Promise<{ uuid: string, name: string }> {
  const person = member == null ? await currentPerson(client) : await findPerson(client, member)
  const doc: any = await client.findOne(contact.class.Person, { _id: person._id })
  if (doc?.personUuid == null) throw new Error(`${person.name} has no Huly account and cannot follow documents.`)
  return { uuid: doc.personUuid, name: person.name }
}

export const listCollaborators = wrapToolHandler<z.infer<typeof ListCollaboratorsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const target = await resolveObject(client, args.object)
  const rows: any[] = await client.findAll(C.Collaborator, { attachedTo: target._id })
  if (rows.length === 0) return `Nobody follows ${target.label}.`
  const names = await accountNames(client)
  return `## Collaborators of ${target.label} (${rows.length})\n\n${rows.map((r) => `- ${names.get(r.collaborator) ?? r.collaborator}`).join('\n')}`
})

export const addCollaborator = wrapToolHandler<z.infer<typeof AddCollaboratorSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const target = await resolveObject(client, args.object)
  const who = await accountOf(client, args.member)
  // Huly adds collaborators itself on create/assign/mention — never add a second record.
  const existing = await client.findOne(C.Collaborator, { attachedTo: target._id, collaborator: who.uuid })
  if (existing != null) return `${who.name} already follows ${target.label}.`
  await client.addCollection(C.Collaborator, target.space, target._id, target._class, 'collaborators', { collaborator: who.uuid })
  return `✅ ${who.name} now follows ${target.label}.`
})

export const removeCollaborator = wrapToolHandler<z.infer<typeof RemoveCollaboratorSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const target = await resolveObject(client, args.object)
  const who = await accountOf(client, args.member)
  const rows: any[] = await client.findAll(C.Collaborator, { attachedTo: target._id, collaborator: who.uuid })
  if (rows.length === 0) return `${who.name} does not follow ${target.label}.`
  for (const r of rows) await client.removeCollection(C.Collaborator, r.space, r._id, r.attachedTo, r.attachedToClass, r.collection ?? 'collaborators')
  return `✅ ${who.name} no longer follows ${target.label}.`
})

// ── Public links ────────────────────────────────────────────────────────────

/**
 * Self-hosted servers often run with FRONT_URL=http://localhost:…, so the guest URL they generate
 * only works on the server itself. Then the origin is replaced by HULY_FRONT_URL (what we connect to).
 */
export function reachableUrl (url: string, frontUrl = process.env.HULY_FRONT_URL): string {
  if (url === '' || frontUrl == null || frontUrl === '') return url
  try {
    const u = new URL(url)
    if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(u.hostname)) return url
    const f = new URL(frontUrl)
    return `${f.origin}${u.pathname}${u.search}`
  } catch { return url }
}

const sleep = async (ms: number): Promise<void> => await new Promise((resolve) => setTimeout(resolve, ms))

/** The server fills in the guest URL (with its token) right after the link is created. */
async function waitForUrl (client: any, id: string, attempts = 10): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const link: any = await client.findOne(C.PublicLink, { _id: id })
    if (link?.url != null && link.url !== '') return reachableUrl(link.url)
    await sleep(300)
  }
  return ''
}

/** The panel Huly opens for a class (view:mixin:ObjectPanel), as used in its object links. */
function panelComponent (client: any, _class: string): string {
  try {
    const panel = client.getHierarchy().classHierarchyMixin(_class, 'view:mixin:ObjectPanel')
    if (panel?.component != null) return panel.component
  } catch { /* no model access (tests) */ }
  return 'view:component:EditDoc'
}

export const createPublicLink = wrapToolHandler<z.infer<typeof CreatePublicLinkSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const target = await resolveObject(client, args.object)
  const existing: any = await client.findOne(C.PublicLink, { attachedTo: target._id })
  if (existing != null && existing.url !== '') return `Public link for ${target.label} already exists:\n${reachableUrl(existing.url)}\n\nLink id: \`${existing._id as string}\``

  // Like Huly's share dialog: a read-only view without navigation, actions or comments.
  const component = panelComponent(client, target._class)
  const id = existing?._id ?? await client.createDoc(C.PublicLink, core.space.Workspace, {
    attachedTo: target._id,
    location: { path: [], fragment: encodeURIComponent([component, target._id, target._class, 'content'].join('|')) },
    revokable: true,
    restrictions: { readonly: true, disableNavigation: true, disableActions: true, disableComments: true },
    url: ''
  })
  const url = await waitForUrl(client, id)
  if (url === '') return `⚠️ Link for ${target.label} created, but the server has not filled in its URL yet — run list_public_links in a moment.\n\nLink id: \`${id as string}\``
  return `✅ Public read-only link for ${target.label}:\n${url}\n\nAnyone with this link can read it. Revoke with revoke_public_link (\`${id as string}\`).`
})

export const listPublicLinks = wrapToolHandler<z.infer<typeof ListPublicLinksSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const query: Record<string, unknown> = {}
  if (args.object != null) query.attachedTo = (await resolveObject(client, args.object))._id
  const links: any[] = await client.findAll(C.PublicLink, query, { limit: args.limit })
  if (links.length === 0) return 'No public links.'
  const lines: string[] = []
  for (const l of links) {
    let label = String(l.attachedTo)
    try { label = (await resolveObject(client, String(l.attachedTo))).label } catch { /* target deleted or unknown class */ }
    lines.push(`- **${label}** — ${l.url !== '' ? reachableUrl(String(l.url)) : '_(URL pending)_'} — \`${l._id as string}\`${l.revokable === false ? ' (not revokable)' : ''}`)
  }
  return `## Public links (${links.length})\n\n${lines.join('\n')}`
})

export const revokePublicLink = wrapToolHandler<z.infer<typeof RevokePublicLinkSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const link: any = await client.findOne(C.PublicLink, { _id: args.linkId })
  if (link == null) throw new Error(`Public link '${args.linkId}' not found.`)
  if (link.revokable === false) throw new Error('This link is marked as not revokable in Huly.')
  await client.removeDoc(C.PublicLink, link.space, link._id)
  return `✅ Public link \`${args.linkId}\` revoked — its URL no longer works.`
})
