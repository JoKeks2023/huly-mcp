// Generic access to any Huly class — the fallback for everything without a dedicated tool.
// Reads redact secrets; writes are dry runs unless dryRun=false, deletes also need confirm=true,
// unknown attributes are rejected and system classes cannot be written.
import core, { generateId } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type { ListClassesSchema, DescribeClassSchema, QueryDocumentsSchema, GenericCreateSchema, GenericUpdateSchema, GenericDeleteSchema } from '../schemas'

const SECRET_KEY = /token|secret|password|credential|api[-_]?key|private[-_]?key|access[-_]?key/i
const BLOCKED_READ_DOMAINS = new Set(['tx'])
const BLOCKED_WRITE_DOMAINS = new Set(['model', 'tx'])
const BLOCKED_WRITE_CLASSES = [
  core.class.Space, // projects, teamspaces, channels…: use the dedicated tools
  'contact:class:SocialIdentity',
  'setting:class:Integration',
  'github:class:GithubAuthentication',
  'github:class:GithubIntegration'
]

function hierarchyOf (client: any): any { return client.getHierarchy() }

function getClass (client: any, className: string): any {
  const h = hierarchyOf(client)
  try {
    return h.getClass(className)
  } catch {
    throw new Error(`Unknown class '${className}'. Use list_classes to find class names.`)
  }
}

function domainOf (client: any, className: string): string | undefined {
  try { return hierarchyOf(client).findDomain(className) } catch { return undefined }
}

function typeName (attr: any): string {
  const t = attr.type ?? {}
  const base = String(t._class ?? '').split(':').pop() ?? '?'
  if (t.to != null) return `${base} → ${t.to as string}`
  if (t.of != null) return `${base}<${typeof t.of === 'string' ? t.of : (String(t.of._class ?? '').split(':').pop() ?? '?')}>`
  return base
}

function redact (value: unknown, depth = 0): unknown {
  if (value == null || depth > 4) return value
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEY.test(k) ? '[redacted]' : redact(v, depth + 1)]))
  }
  if (typeof value === 'string' && value.length > 300) return value.slice(0, 300) + '…'
  return value
}

function assertWritable (client: any, className: string): any {
  const cls = getClass(client, className)
  const h = hierarchyOf(client)
  const domain = domainOf(client, className)
  if (domain == null || BLOCKED_WRITE_DOMAINS.has(domain)) throw new Error(`'${className}' (domain ${domain ?? 'none'}) cannot be written generically.`)
  for (const blocked of BLOCKED_WRITE_CLASSES) {
    if (className === blocked || h.isDerived(className, blocked)) throw new Error(`'${className}' cannot be written generically — use the dedicated tools.`)
  }
  return cls
}

function assertKnownAttributes (client: any, className: string, attributes: Record<string, unknown>): void {
  const known = hierarchyOf(client).getAllAttributes(className)
  const unknown = Object.keys(attributes).filter((k) => !known.has(k) && !k.includes(':') && !k.startsWith('$'))
  if (unknown.length > 0) throw new Error(`Unknown attribute(s) for ${className}: ${unknown.join(', ')}. See describe_class.`)
  const system = Object.keys(attributes).filter((k) => ['_id', '_class', 'modifiedOn', 'modifiedBy', 'createdBy', 'createdOn'].includes(k))
  if (system.length > 0) throw new Error(`System attribute(s) cannot be set: ${system.join(', ')}.`)
}

const isAttached = (client: any, className: string): boolean => hierarchyOf(client).isDerived(className, core.class.AttachedDoc)

export const listClasses = wrapToolHandler<z.infer<typeof ListClassesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const h = hierarchyOf(client)
  const rows: string[] = []
  for (const id of h.getDescendants(core.class.Doc) as string[]) {
    const cls = h.getClass(id)
    if (cls.kind !== 0) continue // classes only, no mixins/interfaces
    const domain = domainOf(client, id)
    if (domain == null || domain === 'model' || BLOCKED_READ_DOMAINS.has(domain)) continue
    if (args.module != null && id.split(':')[0] !== args.module) continue
    let count = ''
    if (args.withCounts) {
      try { count = ` — ${(await client.findAll(id, {}, { limit: 1, total: true })).total as number} doc(s)` } catch { count = ' — ?' }
    }
    rows.push(`- \`${id}\`${count}`)
  }
  if (rows.length === 0) return `No classes${args.module != null ? ` in module '${args.module}'` : ''}.`
  return `## Classes (${rows.length})\n\n${rows.sort().join('\n')}`
})

export const describeClass = wrapToolHandler<z.infer<typeof DescribeClassSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const cls = getClass(client, args.className)
  const h = hierarchyOf(client)
  const attrs = [...h.getAllAttributes(args.className).entries()]
    .filter(([k]: [string, any]) => !['_id', '_class', 'modifiedOn', 'modifiedBy', 'createdBy', 'createdOn'].includes(k))
    .map(([k, a]: [string, any]) => `- \`${k}\`: ${typeName(a)}${a.hidden === true ? ' (hidden)' : ''}`)
  let writable = 'yes (generic_create/update/delete, dry run by default)'
  try { assertWritable(client, args.className) } catch (e) { writable = `no — ${(e as Error).message}` }
  return [
    `## ${args.className}`,
    `**Extends:** ${cls.extends as string ?? '—'} · **Domain:** ${domainOf(client, args.className) ?? '—'} · **Attached doc:** ${isAttached(client, args.className) ? 'yes (needs attachTo)' : 'no'}`,
    `**Writable:** ${writable}`,
    '',
    '**Attributes:**',
    ...attrs
  ].join('\n')
})

export const queryDocuments = wrapToolHandler<z.infer<typeof QueryDocumentsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  getClass(client, args.className)
  const domain = domainOf(client, args.className)
  if (domain != null && BLOCKED_READ_DOMAINS.has(domain)) throw new Error(`'${args.className}' cannot be queried.`)
  const docs: any[] = await client.findAll(args.className, args.query ?? {}, { limit: args.limit })
  if (docs.length === 0) return `No ${args.className} documents match.`
  const shaped = docs.map((d) => {
    const picked = args.fields != null ? Object.fromEntries(['_id', ...args.fields].map((f) => [f, d[f]])) : d
    return redact(Object.fromEntries(Object.entries(picked).filter(([, v]) => v !== null && v !== undefined)))
  })
  return `## ${args.className} (${docs.length}${docs.length === args.limit ? '+' : ''})\n\n\`\`\`json\n${JSON.stringify(shaped, null, 1)}\n\`\`\``
})

export const genericCreate = wrapToolHandler<z.infer<typeof GenericCreateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  assertWritable(client, args.className)
  assertKnownAttributes(client, args.className, args.attributes)
  const attached = isAttached(client, args.className)
  if (attached && args.attachTo == null) throw new Error(`${args.className} is an attached document — pass attachTo { id, className, collection }.`)
  if (!attached && args.attachTo != null) throw new Error(`${args.className} is not an attached document — omit attachTo.`)
  if (args.attachTo != null) {
    const parent = await client.findOne(args.attachTo.className, { _id: args.attachTo.id })
    if (parent == null) throw new Error(`attachTo: ${args.attachTo.className} '${args.attachTo.id}' not found.`)
  }

  const plan = `${args.className} in space \`${args.space}\`${args.attachTo != null ? `, attached to ${args.attachTo.className} \`${args.attachTo.id}\` (${args.attachTo.collection})` : ''}\n\`\`\`json\n${JSON.stringify(args.attributes, null, 1)}\n\`\`\``
  if (args.dryRun) return `🔍 Dry run — would create ${plan}\nRun again with dryRun=false to apply.`

  const id = generateId()
  if (args.attachTo != null) {
    await client.addCollection(args.className, args.space, args.attachTo.id, args.attachTo.className, args.attachTo.collection, args.attributes, id)
  } else {
    await client.createDoc(args.className, args.space, args.attributes, id)
  }
  return `✅ Created ${args.className} \`${id}\`.`
})

export const genericUpdate = wrapToolHandler<z.infer<typeof GenericUpdateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  assertWritable(client, args.className)
  assertKnownAttributes(client, args.className, args.attributes)
  const doc = await client.findOne(args.className, { _id: args.id })
  if (doc == null) throw new Error(`${args.className} '${args.id}' not found.`)

  const diff = Object.entries(args.attributes).map(([k, v]) => `- \`${k}\`: ${JSON.stringify(redact(doc[k]))} → ${JSON.stringify(redact(v))}`)
  if (args.dryRun) return `🔍 Dry run — would update ${args.className} \`${args.id}\`:\n${diff.join('\n')}\nRun again with dryRun=false to apply.`

  if (isAttached(client, args.className)) {
    await client.updateCollection(doc._class, doc.space, doc._id, doc.attachedTo, doc.attachedToClass, doc.collection, args.attributes)
  } else {
    await client.updateDoc(doc._class, doc.space, doc._id, args.attributes)
  }
  return `✅ Updated ${args.className} \`${args.id}\`:\n${diff.join('\n')}`
})

export const genericDelete = wrapToolHandler<z.infer<typeof GenericDeleteSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  assertWritable(client, args.className)
  const doc = await client.findOne(args.className, { _id: args.id })
  if (doc == null) throw new Error(`${args.className} '${args.id}' not found.`)
  const what = `${args.className} \`${args.id}\` (${String(doc.title ?? doc.name ?? doc.label ?? '').slice(0, 80)})`
  if (args.dryRun || !args.confirm) {
    return `🔍 Dry run — would delete ${what}.\nTo delete, run again with dryRun=false and confirm=true.`
  }
  if (isAttached(client, args.className)) {
    await client.removeCollection(doc._class, doc.space, doc._id, doc.attachedTo, doc.attachedToClass, doc.collection)
  } else {
    await client.removeDoc(doc._class, doc.space, doc._id)
  }
  return `🗑️ Deleted ${what}.`
})
