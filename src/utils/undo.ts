// Undo for every write tool, without per-tool code.
//
// While a write tool runs, the Huly client it gets is wrapped: each write first notes how to
// reverse it (create → remove, update → old field values, remove → re-create with the same id
// and data). The steps of one tool call form one entry; undo_changes plays entries backwards.
// Entries live in memory per connection manager — per process over stdio, per session over HTTP.
import { AsyncLocalStorage } from 'node:async_hooks'

export type StepKind = 'created' | 'changed' | 'deleted'

export interface UndoStep {
  kind: StepKind
  /** The TxOperations method that reverses the change, and its arguments. */
  method: 'removeDoc' | 'removeCollection' | 'updateDoc' | 'createDoc' | 'addCollection' | 'updateMixin'
  args: unknown[]
  target: { _class: string, _id: string, label: string }
  fields?: string[]
}

export interface UndoEntry {
  id: number
  tool: string
  workspace?: string
  at: number
  steps: UndoStep[]
  /** modifiedOn of every touched document right after the call — to notice later edits by others. */
  after: Record<string, { _class: string, modifiedOn: number | null }>
  failed?: string
}

interface Recording { steps: UndoStep[], client?: any }

const recording = new AsyncLocalStorage<Recording>()
const journals = new WeakMap<object, UndoEntry[]>()
const MAX_ENTRIES = 50
let nextId = 1

export function journalOf (owner: object): UndoEntry[] {
  let j = journals.get(owner)
  if (j == null) { j = []; journals.set(owner, j) }
  return j
}

export function isRecording (): boolean { return recording.getStore() != null }

const SYSTEM = new Set(['_id', '_class', 'space', 'modifiedOn', 'modifiedBy', 'createdOn', 'createdBy', 'attachedTo', 'attachedToClass', 'collection', '%hash%'])
const isMixinKey = (k: string): boolean => k.includes(':mixin:')

export function labelOf (doc: any, fallback: string): string {
  if (doc == null) return fallback
  if (typeof doc.identifier === 'string') return doc.title != null ? `${doc.identifier as string}: ${String(doc.title)}` : doc.identifier
  const name = doc.title ?? doc.name ?? doc.label ?? (typeof doc.message === 'string' ? doc.message.slice(0, 40) : undefined)
  return name != null ? String(name) : fallback
}

export function isCounterOnly (ops: Record<string, unknown>): boolean {
  const keys = Object.keys(ops ?? {})
  return keys.length > 0 && keys.every((k) => k === '$inc')
}

/** Fields an update touches: plain keys and the keys inside $push/$pull/$inc/$unset/…. */
export function touchedFields (ops: Record<string, any>): string[] {
  const out = new Set<string>()
  for (const [k, v] of Object.entries(ops ?? {})) {
    if (k.startsWith('$')) { if (v != null && typeof v === 'object') for (const f of Object.keys(v)) out.add(f) } else out.add(k)
  }
  return [...out]
}

/** The update that puts these fields back to their values in `before`. */
export function restoreUpdate (before: any, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) out[f] = before?.[f] === undefined ? null : before[f]
  return out
}

/** Plain data of a document, for re-creating it after a delete. */
export function dataOf (doc: any): { data: Record<string, unknown>, mixins: Record<string, Record<string, unknown>> } {
  const data: Record<string, unknown> = {}
  const mixins: Record<string, Record<string, unknown>> = {}
  for (const [k, v] of Object.entries(doc ?? {})) {
    if (SYSTEM.has(k)) continue
    if (isMixinKey(k) && v != null && typeof v === 'object') mixins[k] = v as Record<string, unknown>
    else data[k] = v
  }
  return { data, mixins }
}

/** Wraps a Huly client so every write notes its reverse first. Reads pass through unchanged. */
export function recordingClient<T extends object> (client: T): T {
  const rec = recording.getStore()
  if (rec == null) return client
  const c: any = client
  const find = async (_class: string, _id: string): Promise<any> => await c.findOne(_class, { _id }).catch(() => undefined)
  const note = (step: UndoStep): void => { rec.steps.push(step) }

  const wrap = (target: any): any => new Proxy(target, {
    get (t, prop, receiver) {
      const orig = Reflect.get(t, prop, receiver)
      if (typeof orig !== 'function') return orig
      switch (prop) {
        case 'createDoc': return async (_class: string, space: string, attrs: any, id?: string, ...rest: unknown[]) => {
          const ref = await orig.call(t, _class, space, attrs, id, ...rest)
          note({ kind: 'created', method: 'removeDoc', args: [_class, space, ref], target: { _class, _id: ref, label: labelOf(attrs, ref) } })
          return ref
        }
        case 'addCollection': return async (_class: string, space: string, attachedTo: string, attachedToClass: string, collection: string, attrs: any, id?: string, ...rest: unknown[]) => {
          const ref = await orig.call(t, _class, space, attachedTo, attachedToClass, collection, attrs, id, ...rest)
          note({ kind: 'created', method: 'removeCollection', args: [_class, space, ref, attachedTo, attachedToClass, collection], target: { _class, _id: ref, label: labelOf(attrs, ref) } })
          return ref
        }
        case 'updateDoc': return async (_class: string, space: string, objectId: string, ops: any, ...rest: unknown[]) => {
          // Counters ($inc only, e.g. a project's issue sequence) are never wound back: the next
          // issue would get a number that was already handed out.
          if (isCounterOnly(ops)) return await orig.call(t, _class, space, objectId, ops, ...rest)
          const before = await find(_class, objectId)
          const fields = touchedFields(ops)
          const res = await orig.call(t, _class, space, objectId, ops, ...rest)
          note({ kind: 'changed', method: 'updateDoc', args: [_class, space, objectId, restoreUpdate(before, fields)], target: { _class, _id: objectId, label: labelOf(before, objectId) }, fields })
          return res
        }
        case 'updateCollection': return async (_class: string, space: string, objectId: string, attachedTo: string, attachedToClass: string, collection: string, ops: any, ...rest: unknown[]) => {
          const before = await find(_class, objectId)
          const fields = touchedFields(ops)
          const res = await orig.call(t, _class, space, objectId, attachedTo, attachedToClass, collection, ops, ...rest)
          note({ kind: 'changed', method: 'updateDoc', args: [_class, space, objectId, restoreUpdate(before, fields)], target: { _class, _id: objectId, label: labelOf(before, objectId) }, fields })
          return res
        }
        case 'update': return async (doc: any, ops: any, ...rest: unknown[]) => {
          if (isCounterOnly(ops)) return await orig.call(t, doc, ops, ...rest)
          const before = await find(doc._class, doc._id) ?? doc
          const fields = touchedFields(ops)
          const res = await orig.call(t, doc, ops, ...rest)
          note({ kind: 'changed', method: 'updateDoc', args: [doc._class, before.space ?? doc.space, doc._id, restoreUpdate(before, fields)], target: { _class: doc._class, _id: doc._id, label: labelOf(before, doc._id) }, fields })
          return res
        }
        case 'removeDoc': return async (_class: string, space: string, objectId: string, ...rest: unknown[]) => {
          const before = await find(_class, objectId)
          const res = await orig.call(t, _class, space, objectId, ...rest)
          if (before != null) {
            const { data, mixins } = dataOf(before)
            note({ kind: 'deleted', method: 'createDoc', args: [before._class, before.space, data, objectId, mixins], target: { _class: before._class, _id: objectId, label: labelOf(before, objectId) } })
          }
          return res
        }
        case 'removeCollection': return async (_class: string, space: string, objectId: string, attachedTo: string, attachedToClass: string, collection: string, ...rest: unknown[]) => {
          const before = await find(_class, objectId)
          const res = await orig.call(t, _class, space, objectId, attachedTo, attachedToClass, collection, ...rest)
          if (before != null) {
            const { data, mixins } = dataOf(before)
            note({ kind: 'deleted', method: 'addCollection', args: [before._class, before.space, attachedTo, attachedToClass, collection, data, objectId, mixins], target: { _class: before._class, _id: objectId, label: labelOf(before, objectId) } })
          }
          return res
        }
        case 'remove': return async (doc: any, ...rest: unknown[]) => {
          const before = await find(doc._class, doc._id) ?? doc
          const res = await orig.call(t, doc, ...rest)
          const { data, mixins } = dataOf(before)
          if (before.attachedTo != null && before.collection != null) {
            note({ kind: 'deleted', method: 'addCollection', args: [before._class, before.space, before.attachedTo, before.attachedToClass, before.collection, data, doc._id, mixins], target: { _class: before._class, _id: doc._id, label: labelOf(before, doc._id) } })
          } else {
            note({ kind: 'deleted', method: 'createDoc', args: [before._class, before.space, data, doc._id, mixins], target: { _class: before._class, _id: doc._id, label: labelOf(before, doc._id) } })
          }
          return res
        }
        case 'createMixin':
        case 'updateMixin': return async (objectId: string, objectClass: string, objectSpace: string, mixin: string, attrs: any, ...rest: unknown[]) => {
          const before = await find(objectClass, objectId)
          const fields = touchedFields(attrs)
          const res = await orig.call(t, objectId, objectClass, objectSpace, mixin, attrs, ...rest)
          note({ kind: 'changed', method: 'updateMixin', args: [objectId, objectClass, objectSpace, mixin, restoreUpdate(before?.[mixin], fields)], target: { _class: objectClass, _id: objectId, label: labelOf(before, objectId) }, fields: fields.map((f) => `${mixin.split(':').pop() ?? mixin}.${f}`) })
          return res
        }
        case 'apply': return (...args: unknown[]) => wrap(orig.apply(t, args))
        default: return orig.bind(t)
      }
    }
  })
  return wrap(c)
}

/** Runs one tool call and returns its undo entry (also when the call failed halfway). */
export async function recordChanges<T> (fn: () => Promise<T>): Promise<{ result?: T, error?: unknown, steps: UndoStep[] }> {
  const rec: Recording = { steps: [] }
  return await recording.run(rec, async () => {
    try { return { result: await fn(), steps: rec.steps } } catch (error) { return { error, steps: rec.steps } }
  })
}

export function addEntry (owner: object, entry: Omit<UndoEntry, 'id'>): UndoEntry {
  const journal = journalOf(owner)
  const full = { ...entry, id: nextId++ }
  journal.push(full)
  if (journal.length > MAX_ENTRIES) journal.splice(0, journal.length - MAX_ENTRIES)
  return full
}
