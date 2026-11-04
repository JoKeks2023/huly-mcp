// Custom attributes ("custom fields"): definitions live in the model as core:class:Attribute
// (name 'custom<id>', isCustom: true). Values are plain fields on the document — or, when the
// attribute belongs to a mixin (project/task types, card tags), fields of that mixin.
import { generateId } from '@hcengineering/core'
import { C } from './classes'

export const FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'markup', 'enum', 'ref'] as const
export type FieldType = typeof FIELD_TYPES[number]

const TYPE_CLASS: Record<Exclude<FieldType, 'enum' | 'ref'>, string> = {
  string: 'core:class:TypeString',
  number: 'core:class:TypeNumber',
  boolean: 'core:class:TypeBoolean',
  date: 'core:class:TypeDate',
  markup: 'core:class:TypeMarkup'
}

/** "embedded:embedded:Budget" → "Budget"; "contact:string:Person" → "Person". */
export function labelText (label: unknown): string {
  const s = String(label ?? '')
  if (s.startsWith('embedded:embedded:')) return s.slice('embedded:embedded:'.length)
  return s.includes(':') ? s.split(':').pop() ?? s : s
}

export const embeddedLabel = (text: string): string => `embedded:embedded:${text}`

export interface FieldInfo { name: string, label: string, typeClass: string, of?: string, to?: string, owner: string, ownerIsMixin: boolean, attr: any }

/**
 * Mixins that can carry fields for this document: mixins already on it, plus the
 * type mixin of its task type (issues) — the UI shows those fields before they have a value.
 */
async function mixinsOf (client: any, doc: any): Promise<string[]> {
  const h = client.getHierarchy()
  const out = new Set<string>()
  // Mixin keys are class ids — "plugin:mixin:X" for built-in ones, plain generated ids for custom types/tags.
  for (const [key, value] of Object.entries(doc)) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) continue
    try { if (h.isMixin(key)) out.add(key) } catch { /* not a class */ }
  }
  if (doc.kind != null) {
    const taskType = await client.findOne('task:class:TaskType', { _id: doc.kind })
    if (taskType?.targetClass != null) out.add(taskType.targetClass)
  }
  return [...out]
}

/** Custom fields that apply to a document (class hierarchy + its mixins). */
export async function fieldsOf (client: any, doc: any): Promise<FieldInfo[]> {
  const h = client.getHierarchy()
  const owners = [doc._class, ...(await mixinsOf(client, doc))]
  const seen = new Set<string>()
  const out: FieldInfo[] = []
  for (const owner of owners) {
    let attrs: Map<string, any>
    try { attrs = h.getAllAttributes(owner) } catch { continue }
    for (const a of attrs.values()) {
      if (a.isCustom !== true || seen.has(a.name)) continue
      seen.add(a.name)
      const ownerIsMixin = (() => { try { return h.isMixin(a.attributeOf) } catch { return false } })()
      out.push({ name: a.name, label: labelText(a.label), typeClass: a.type?._class, of: a.type?.of, to: a.type?.to, owner: a.attributeOf, ownerIsMixin, attr: a })
    }
  }
  return out
}

/** Custom fields defined directly on a class or mixin (for list_custom_fields). */
export async function fieldsDefinedOn (client: any, owner: string): Promise<any[]> {
  return await client.findAll(C.Attribute, { attributeOf: owner, isCustom: true })
}

export function findField (fields: FieldInfo[], key: string): FieldInfo {
  const k = key.trim().toLowerCase()
  const hits = fields.filter((f) => f.label.toLowerCase() === k || f.name.toLowerCase() === k)
  if (hits.length === 1) return hits[0]
  if (hits.length > 1) throw new Error(`Field '${key}' is ambiguous: ${hits.map((f) => `${f.label} (${f.name})`).join(', ')}.`)
  throw new Error(`Field '${key}' not found. Available: ${fields.map((f) => f.label).join(', ') || 'none'}.`)
}

/** Converts a user value to what the field type stores; throws with a clear message. */
export async function coerceValue (client: any, field: FieldInfo, value: unknown): Promise<unknown> {
  if (value === null) return null
  switch (field.typeClass) {
    case 'core:class:TypeString':
    case 'core:class:TypeMarkup':
    case 'core:class:TypeHyperlink':
      return String(value)
    case 'core:class:TypeNumber': {
      const n = typeof value === 'number' ? value : Number(value)
      if (Number.isNaN(n)) throw new Error(`Field '${field.label}' expects a number, got '${String(value)}'.`)
      return n
    }
    case 'core:class:TypeBoolean':
      if (typeof value === 'boolean') return value
      if (/^(true|yes|1)$/i.test(String(value))) return true
      if (/^(false|no|0)$/i.test(String(value))) return false
      throw new Error(`Field '${field.label}' expects true/false.`)
    case 'core:class:TypeDate': {
      const t = typeof value === 'number' ? value : new Date(String(value)).getTime()
      if (Number.isNaN(t)) throw new Error(`Field '${field.label}' expects a date (YYYY-MM-DD).`)
      return t
    }
    case 'core:class:EnumOf': {
      const e = await client.findOne(C.Enum, { _id: field.of })
      const allowed: string[] = e?.enumValues ?? []
      const hit = allowed.find((v) => v.toLowerCase() === String(value).toLowerCase())
      if (hit == null) throw new Error(`Field '${field.label}' must be one of: ${allowed.join(', ')}.`)
      return hit
    }
    case 'core:class:RefTo':
      return String(value)
    default:
      throw new Error(`Field '${field.label}' has type ${field.typeClass}, which cannot be set here.`)
  }
}

/** Display a stored value. */
export function showValue (field: FieldInfo, value: unknown): string {
  if (value == null || value === '') return '—'
  if (field.typeClass === 'core:class:TypeDate' && typeof value === 'number') return new Date(value).toISOString().slice(0, 10)
  return Array.isArray(value) ? value.join(', ') : String(value)
}

/** Value of a field on a document (mixin fields live under the mixin key). */
export function valueOf (doc: any, field: FieldInfo): unknown {
  return field.ownerIsMixin ? doc[field.owner]?.[field.name] : doc[field.name]
}

/** Writes custom field values like Huly: updateDoc for class fields, updateMixin for mixin fields. */
export async function writeFields (client: any, doc: any, values: Array<{ field: FieldInfo, value: unknown }>): Promise<void> {
  const plain: Record<string, unknown> = {}
  const byMixin = new Map<string, Record<string, unknown>>()
  for (const { field, value } of values) {
    if (field.ownerIsMixin) byMixin.set(field.owner, { ...(byMixin.get(field.owner) ?? {}), [field.name]: value })
    else plain[field.name] = value
  }
  if (Object.keys(plain).length > 0) await client.updateDoc(doc._class, doc.space, doc._id, plain)
  for (const [mixin, data] of byMixin) await client.updateMixin(doc._id, doc._class, doc.space, mixin, data)
}

/** The type object for a new attribute. */
export async function makeType (client: any, type: FieldType, opts: { enumValues?: string[], enumName?: string, refClass?: string }): Promise<Record<string, unknown>> {
  if (type === 'enum') {
    const values = (opts.enumValues ?? []).map((v) => v.trim()).filter((v) => v !== '')
    if (values.length === 0) throw new Error('enumValues is required for type enum.')
    const enumId = generateId()
    await client.createDoc(C.Enum, 'core:space:Model', { name: opts.enumName ?? 'Enum', enumValues: [...new Set(values)] }, enumId)
    return { _class: 'core:class:EnumOf', of: enumId, label: 'core:string:Enum' }
  }
  if (type === 'ref') {
    if (opts.refClass == null) throw new Error('refClass is required for type ref (e.g. contact:mixin:Employee).')
    return { _class: 'core:class:RefTo', to: opts.refClass, label: 'core:string:Ref' }
  }
  return { _class: TYPE_CLASS[type] }
}
