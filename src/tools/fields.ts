// Custom fields: define them on issues, card types/tags or any class, and set their values.
import tracker from '@hcengineering/tracker'
import { generateId } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C } from '../utils/classes'
import { resolveObject } from '../utils/resolve'
import { coerceValue, embeddedLabel, fieldsDefinedOn, fieldsOf, findField, labelText, makeType, showValue, valueOf, writeFields } from '../utils/attributes'
import type { z } from 'zod'
import type { ListCustomFieldsSchema, CreateCustomFieldSchema, SetCustomFieldsSchema } from '../schemas'

/**
 * Where fields live:
 * - "issue" → all issues (tracker:class:Issue)
 * - a project key ("PROJ") → issues of that project's task type (the type mixin, like Huly's project-type settings)
 * - a card type or tag (name or id), or any class/mixin id
 */
async function resolveOwner (client: any, target: string): Promise<{ id: string, label: string }> {
  const h = client.getHierarchy()
  const t = target.trim()
  if (t.toLowerCase() === 'issue') return { id: tracker.class.Issue, label: 'all issues' }
  if (/^[A-Z][A-Z0-9]*$/.test(t)) {
    const project = await client.findOne(tracker.class.Project, { identifier: t })
    if (project != null) {
      const projectType = await client.findOne('task:class:ProjectType', { _id: project.type })
      const taskTypes: any[] = await client.findAll('task:class:TaskType', { _id: { $in: projectType?.tasks ?? [] } })
      const issueType = taskTypes.find((tt) => tt.ofClass === tracker.class.Issue && tt._id !== 'tracker:taskTypes:Issue') ?? taskTypes.find((tt) => tt.ofClass === tracker.class.Issue)
      if (issueType?.targetClass == null) throw new Error(`Project ${t} has no issue task type.`)
      return { id: issueType.targetClass, label: `issues of project type "${String(projectType?.name ?? project.type)}" (${t})` }
    }
  }
  try { const c = h.getClass(t); return { id: c._id, label: labelText(c.label) } } catch { /* not a class id */ }
  const cards = h.getDescendants(C.Card).map((id: string) => h.getClass(id)).filter((c: any) => labelText(c.label).toLowerCase() === t.toLowerCase())
  if (cards.length === 1) return { id: cards[0]._id, label: `card ${cards[0].kind === 2 ? 'tag' : 'type'} ${labelText(cards[0].label)}` }
  if (cards.length > 1) throw new Error(`'${target}' matches several card types: ${cards.map((c: any) => c._id).join(', ')}.`)
  throw new Error(`Unknown target '${target}'. Use "issue", a project key, a card type/tag name or a class id.`)
}

/** Issue (PROJ-12), card id or any document id. */
async function resolveDoc (client: any, ref: string): Promise<any> {
  const card = /^[A-Z][A-Z0-9]*-\d+$/.test(ref) ? undefined : await client.findOne(C.Card, { _id: ref })
  if (card != null) return card
  const obj = await resolveObject(client, ref)
  if (obj.doc == null) throw new Error(`'${ref}' not found.`)
  return obj.doc
}

const typeName = (a: any): string => {
  const c = String(a.type?._class ?? '')
  if (c === 'core:class:EnumOf') return 'enum'
  if (c === 'core:class:RefTo') return `ref → ${String(a.type?.to)}`
  return c.replace(/^core:class:Type/, '').toLowerCase() || c
}

export const listCustomFields = wrapToolHandler<z.infer<typeof ListCustomFieldsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  if (args.object != null) {
    const doc = await resolveDoc(client, args.object)
    const fields = await fieldsOf(client, doc)
    if (fields.length === 0) return `No custom fields on this ${labelText(client.getHierarchy().getClass(doc._class).label)}.`
    return `## Custom fields\n\n${fields.map((f) => `- **${f.label}** (${typeName(f.attr)}): ${showValue(f, valueOf(doc, f))}`).join('\n')}`
  }
  const owner = await resolveOwner(client, args.target ?? 'issue')
  const attrs: any[] = await fieldsDefinedOn(client, owner.id)
  if (attrs.length === 0) return `No custom fields on ${owner.label}.`
  const enums = new Map<string, string[]>()
  for (const a of attrs) {
    if (a.type?._class === 'core:class:EnumOf') enums.set(a._id, (await client.findOne(C.Enum, { _id: a.type.of }))?.enumValues ?? [])
  }
  return `## Custom fields on ${owner.label} (${attrs.length})\n\n${attrs.map((a) => `- **${labelText(a.label)}** (${typeName(a)}${enums.has(a._id) ? `: ${enums.get(a._id)!.join(', ')}` : ''}) — \`${String(a.name)}\``).join('\n')}`
})

export const createCustomField = wrapToolHandler<z.infer<typeof CreateCustomFieldSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const owner = await resolveOwner(client, args.target)
  const existing: any[] = await fieldsDefinedOn(client, owner.id)
  const same = existing.find((a) => labelText(a.label).toLowerCase() === args.label.toLowerCase())
  if (same != null) return `ℹ️ Field **${args.label}** already exists on ${owner.label} — \`${String(same.name)}\`.`
  const type = await makeType(client, args.type, { enumValues: args.enumValues, enumName: args.label, refClass: args.refClass })
  const name = 'custom' + generateId()
  // Like Huly's settings dialog (CreateAttribute.svelte).
  await client.createDoc(C.Attribute, 'core:space:Model', {
    attributeOf: owner.id,
    name,
    label: embeddedLabel(args.label),
    isCustom: true,
    type,
    defaultValue: null,
    readonly: false,
    automationOnly: false,
    required: false
  })
  return `✅ Field **${args.label}** (${args.type}) added to ${owner.label} — \`${name}\`.`
})

export const setCustomFields = wrapToolHandler<z.infer<typeof SetCustomFieldsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  if (Object.keys(args.fields).length === 0) throw new Error('Nothing to set: fields is empty.')
  const doc = await resolveDoc(client, args.object)
  const fields = await fieldsOf(client, doc)
  const values: Array<{ field: any, value: unknown }> = []
  for (const [key, raw] of Object.entries(args.fields)) {
    const field = findField(fields, key)
    values.push({ field, value: await coerceValue(client, field, raw) })
  }
  await writeFields(client, doc, values)
  return `✅ Set ${values.map((v) => `**${String(v.field.label)}** = ${showValue(v.field, v.value)}`).join(', ')}.`
})
