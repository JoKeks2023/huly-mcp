// Cards: Huly's flexible records. A card's _class is its type (a MasterTag, itself a class
// extending card:class:Card); tags are mixins on the card. Cards nest via parent/parentInfo.
import { generateId, SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C, IDS } from '../utils/classes'
import { readMarkup, writeMarkup } from '../utils/content'
import { coerceValue, embeddedLabel, fieldsOf, findField, labelText, showValue, valueOf, writeFields } from '../utils/attributes'
import type { z } from 'zod'
import type { ListCardTypesSchema, ListCardsSchema, GetCardSchema, CreateCardSchema, UpdateCardSchema, DeleteCardSchema, CreateCardTypeSchema, DeleteCardTypeSchema } from '../schemas'

const CLASS = 0
const MIXIN = 2

interface TypeInfo { _id: string, label: string, kind: number, extends?: string, removed?: boolean }

function cardTypes (client: any): TypeInfo[] {
  const h = client.getHierarchy()
  return h.getDescendants(C.Card)
    .filter((id: string) => id !== C.Card)
    .map((id: string) => h.getClass(id))
    .map((c: any) => ({ _id: c._id, label: labelText(c.label), kind: c.kind, extends: c.extends, removed: c.removed }))
    .filter((t: TypeInfo) => t.removed !== true)
}

/** Resolves a card type (MasterTag) or tag by id or name. */
function resolveType (client: any, ref: string, kind: number): TypeInfo {
  const types = cardTypes(client).filter((t) => t.kind === kind)
  const k = ref.trim().toLowerCase()
  const hits = types.filter((t) => t._id.toLowerCase() === k || t.label.toLowerCase() === k)
  const what = kind === MIXIN ? 'Card tag' : 'Card type'
  if (hits.length === 1) return hits[0]
  if (hits.length > 1) throw new Error(`${what} '${ref}' is ambiguous: ${hits.map((t) => t._id).join(', ')}.`)
  throw new Error(`${what} '${ref}' not found. Available: ${types.map((t) => t.label).join(', ')}.`)
}

async function findCard (client: any, id: string): Promise<any> {
  const card = await client.findOne(C.Card, { _id: id })
  if (card == null) throw new Error(`Card '${id}' not found.`)
  return card
}

const parentChain = (parent: any): any[] => [...(parent.parentInfo ?? []), { _id: parent._id, _class: parent._class, title: parent.title }]

export const listCardTypes = wrapToolHandler<z.infer<typeof ListCardTypesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const types = cardTypes(client)
  const masters = types.filter((t) => t.kind === CLASS)
  const lines = masters.map((t) => {
    const tags = types.filter((x) => x.kind === MIXIN && x.extends === t._id).map((x) => x.label)
    const sub = t.extends != null && t.extends !== C.Card ? ` (subtype of ${labelText(client.getHierarchy().getClass(t.extends).label)})` : ''
    return `- **${t.label}**${sub} — \`${t._id}\`${tags.length > 0 ? `\n  tags: ${tags.join(', ')}` : ''}`
  })
  return `## Card types (${masters.length})\n\n${lines.join('\n')}`
})

export const listCards = wrapToolHandler<z.infer<typeof ListCardsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const _class = args.type != null ? resolveType(client, args.type, CLASS)._id : C.Card
  const query: Record<string, unknown> = {}
  if (args.parentId !== undefined) query.parent = args.parentId
  let cards: any[] = await client.findAll(_class, query, { sort: { modifiedOn: SortingOrder.Descending }, limit: args.query != null ? 1000 : args.limit })
  cards = cards.filter((c) => c.isLatest !== false)
  if (args.query != null) cards = cards.filter((c) => String(c.title ?? '').toLowerCase().includes(args.query!.toLowerCase())).slice(0, args.limit)
  if (cards.length === 0) return 'No cards found.'
  const h = client.getHierarchy()
  const lines = cards.map((c) => {
    let type = c._class
    try { type = labelText(h.getClass(c._class).label) } catch { /* unknown type */ }
    const parent = (c.parentInfo ?? []).length > 0 ? ` · in ${(c.parentInfo as any[]).map((p) => p.title).join(' › ')}` : ''
    return `- **${String(c.title ?? '(untitled)').trim()}** [${type}]${parent} — \`${c._id as string}\``
  })
  return `## Cards (${cards.length})\n\n${lines.join('\n')}`
})

export const getCard = wrapToolHandler<z.infer<typeof GetCardSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const card = await findCard(client, args.cardId)
  const h = client.getHierarchy()
  const typeLabel = labelText(h.getClass(card._class).label)
  const tags = cardTypes(client).filter((t) => t.kind === MIXIN && card[t._id] != null).map((t) => t.label)
  const fields = await fieldsOf(client, card)
  const children: any[] = await client.findAll(C.Card, { parent: card._id }, { limit: 50 })
  const lines = [
    `## ${String(card.title).trim()}`,
    '',
    `**Type:** ${typeLabel} (\`${card._class as string}\`)`,
    `**Id:** \`${card._id as string}\``
  ]
  if ((card.parentInfo ?? []).length > 0) lines.push(`**Parent:** ${(card.parentInfo as any[]).map((p) => `${String(p.title)} (\`${String(p._id)}\`)`).join(' › ')}`)
  if (tags.length > 0) lines.push(`**Tags:** ${tags.join(', ')}`)
  for (const f of fields) lines.push(`**${f.label}:** ${showValue(f, valueOf(card, f))}`)
  if (children.length > 0) lines.push('', `### Child cards (${children.length})`, ...children.map((c) => `- ${String(c.title).trim()} — \`${c._id as string}\``))
  const body = await readMarkup(args.workspace, card.content)
  lines.push('', '### Content', body !== '' ? body : '_(empty)_')
  return lines.join('\n')
})

async function fieldValues (client: any, card: any, values: Record<string, unknown> | undefined): Promise<Array<{ field: any, value: unknown }>> {
  if (values == null) return []
  const fields = await fieldsOf(client, card)
  const out: Array<{ field: any, value: unknown }> = []
  for (const [key, raw] of Object.entries(values)) {
    const field = findField(fields, key)
    out.push({ field, value: await coerceValue(client, field, raw) })
  }
  return out
}

export const createCard = wrapToolHandler<z.infer<typeof CreateCardSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const type = resolveType(client, args.type, CLASS)
  const h = client.getHierarchy()
  // Like Huly: a base type that has subtypes cannot hold cards itself.
  if ((h.getClass(type._id) as any).baseType === true && cardTypes(client).some((t) => t.kind === CLASS && t.extends === type._id)) {
    throw new Error(`'${type.label}' is a base type with subtypes — pick one of its subtypes.`)
  }
  const parent = args.parentId != null ? await findCard(client, args.parentId) : undefined
  const tags = (args.tags ?? []).map((t) => resolveType(client, t, MIXIN))
  const space = parent?.space ?? args.space ?? IDS.CardDefaultSpace
  const _id = generateId()
  // Validate field values before anything is written (fields of the type and the chosen tags).
  const draft: any = { _id, _class: type._id, space, ...Object.fromEntries(tags.map((t) => [t._id, {}])) }
  const values = await fieldValues(client, draft, args.fields)

  const content = args.content != null && args.content !== '' ? await writeMarkup(args.workspace, `card-${_id}`, args.content) : ''
  const data: Record<string, unknown> = { title: args.title, rank: '', content, blobs: {}, parentInfo: parent != null ? parentChain(parent) : [] }
  if (parent != null) data.parent = parent._id
  for (const { field, value } of values) if (!field.ownerIsMixin) data[field.name] = value
  await client.createDoc(type._id, space, data, _id)
  for (const tag of tags) {
    const tagValues = Object.fromEntries(values.filter((v) => v.field.owner === tag._id).map((v) => [v.field.name, v.value]))
    await client.createMixin(_id, type._id, space, tag._id, tagValues)
  }
  return `✅ Card **${args.title}** [${type.label}] created — \`${_id}\`${parent != null ? ` under "${String(parent.title)}"` : ''}.`
})

export const updateCard = wrapToolHandler<z.infer<typeof UpdateCardSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const card = await findCard(client, args.cardId)
  const tags = (args.addTags ?? []).map((t) => resolveType(client, t, MIXIN))
  const withTags = { ...card, ...Object.fromEntries(tags.filter((t) => card[t._id] == null).map((t) => [t._id, {}])) }
  const values = await fieldValues(client, withTags, args.fields)
  let parent: any
  if (args.parentId != null) {
    parent = await findCard(client, args.parentId)
    if (parent._id === card._id || (parent.parentInfo ?? []).some((p: any) => p._id === card._id)) throw new Error('A card cannot be moved under itself or one of its children.')
  }
  const done: string[] = []
  const update: Record<string, unknown> = {}
  if (args.title != null) { update.title = args.title; done.push('title') }
  if (args.content != null) { update.content = await writeMarkup(args.workspace, `card-${String(card._id)}`, args.content); done.push('content') }
  if (args.parentId !== undefined) {
    update.parent = parent?._id ?? null
    update.parentInfo = parent != null ? parentChain(parent) : []
    done.push(parent != null ? `moved under "${String(parent.title)}"` : 'moved to top level')
  }
  if (Object.keys(update).length > 0) await client.updateDoc(card._class, card.space, card._id, update)
  for (const tag of tags) if (card[tag._id] == null) { await client.createMixin(card._id, card._class, card.space, tag._id, {}); done.push(`tag ${tag.label}`) }
  if (values.length > 0) { await writeFields(client, withTags, values); done.push(...values.map((v) => v.field.label)) }

  // Keep the breadcrumb (parentInfo) of all descendants in step after a move.
  if (args.parentId !== undefined) {
    const self = { ...card, ...update }
    let level = [self]
    for (let depth = 0; depth < 20 && level.length > 0; depth++) {
      const next: any[] = []
      for (const p of level) {
        const kids: any[] = await client.findAll(C.Card, { parent: p._id })
        for (const k of kids) {
          const parentInfo = parentChain(p)
          await client.updateDoc(k._class, k.space, k._id, { parentInfo })
          next.push({ ...k, parentInfo })
        }
      }
      level = next
    }
  }
  if (done.length === 0) return 'Nothing to change.'
  return `✅ Card **${String(args.title ?? card.title).trim()}** updated: ${done.join(', ')}.`
})

export const deleteCard = wrapToolHandler<z.infer<typeof DeleteCardSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const card = await findCard(client, args.cardId)
  const children: any[] = await client.findAll(C.Card, { parent: card._id }, { limit: 1 })
  if (children.length > 0) throw new Error(`Card "${String(card.title)}" has child cards — move or delete them first.`)
  await client.removeDoc(card._class, card.space, card._id)
  return `✅ Card **${String(card.title).trim()}** deleted.`
})

export const createCardType = wrapToolHandler<z.infer<typeof CreateCardTypeSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const isTag = args.kind === 'tag'
  if (isTag && args.parentType == null) throw new Error('A tag belongs to a card type: pass parentType.')
  const parent = args.parentType != null ? resolveType(client, args.parentType, CLASS) : undefined
  const existing = cardTypes(client).find((t) => t.label.toLowerCase() === args.name.toLowerCase() && t.kind === (isTag ? MIXIN : CLASS))
  if (existing != null) return `ℹ️ ${isTag ? 'Tag' : 'Card type'} **${existing.label}** already exists — \`${existing._id}\`.`
  // Like Huly's "create type/tag" dialog (CreateTag.svelte).
  const id = await client.createDoc(isTag ? C.CardTag : C.MasterTag, 'core:space:Model', {
    extends: parent?._id ?? C.Card,
    label: embeddedLabel(args.name),
    kind: isTag ? MIXIN : CLASS,
    icon: isTag ? 'card:icon:Tag' : 'card:icon:MasterTag'
  })
  return `✅ ${isTag ? `Tag **${args.name}** for ${parent!.label}` : `Card type **${args.name}**`} created — \`${String(id)}\`. Add fields with create_custom_field.`
})

export const deleteCardType = wrapToolHandler<z.infer<typeof DeleteCardTypeSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const all = cardTypes(client)
  const k = args.type.trim().toLowerCase()
  const hits = all.filter((t) => t._id.toLowerCase() === k || t.label.toLowerCase() === k)
  if (hits.length !== 1) throw new Error(hits.length === 0 ? `Card type or tag '${args.type}' not found.` : `'${args.type}' is ambiguous: ${hits.map((t) => t._id).join(', ')}.`)
  const type = hits[0]
  const cards: any[] = await client.findAll(type._id, {}, { limit: 1 })
  if (cards.length > 0) throw new Error(`'${type.label}' still has cards — delete or retype them first.`)
  // Like Huly: card types are hidden (removed: true), tags are deleted.
  if (type.kind === CLASS) await client.updateDoc(C.MasterTag, 'core:space:Model', type._id, { removed: true })
  else await client.removeDoc(C.CardTag, 'core:space:Model', type._id)
  return `✅ ${type.kind === CLASS ? 'Card type' : 'Tag'} **${type.label}** deleted.`
})
