// Helpers for task-like documents outside the tracker (applicants, leads): numbering, workflows,
// contacts. They follow how Huly's own create dialogs write (see recruit/lead resources).
import { formatPersonName } from './people'

/** Next number from the core Sequence of a class ($inc like Huly's create dialogs). */
export async function nextNumber (client: any, cls: string): Promise<number> {
  const seq = await client.findOne('core:class:Sequence', { attachedTo: cls })
  if (seq == null) throw new Error(`No number sequence for ${cls} — is the module enabled in this workspace?`)
  const res = await client.update(seq, { $inc: { sequence: 1 } }, true)
  return res?.object?.sequence ?? (Number(seq.sequence ?? 0) + 1)
}

export interface Workflow { kind: string, statuses: Array<{ _id: string, name: string, category?: string }> }

/** Task type and ordered statuses of a project-like space (vacancy, funnel). */
export async function workflowOf (client: any, space: any): Promise<Workflow> {
  const type = await client.findOne('task:class:ProjectType', { _id: space.type })
  const kind: string | undefined = type?.tasks?.[0]
  if (kind == null) throw new Error(`'${String(space.name)}' has no task type.`)
  const taskType = await client.findOne('task:class:TaskType', { _id: kind })
  const ids: string[] = taskType?.statuses ?? []
  const docs: any[] = await client.findAll('core:class:Status', { _id: { $in: ids } })
  const statuses = ids.map((id) => docs.find((d) => d._id === id)).filter((d) => d != null).map((d) => ({ _id: d._id, name: d.name, category: d.category }))
  return { kind, statuses }
}

export function pickStatus (wf: Workflow, name?: string): string {
  if (name == null) {
    if (wf.statuses.length === 0) throw new Error('This workflow has no statuses.')
    return wf.statuses[0]._id
  }
  const hit = wf.statuses.find((s) => s.name.toLowerCase() === name.trim().toLowerCase())
  if (hit == null) throw new Error(`Status '${name}' not found. Available: ${wf.statuses.map((s) => s.name).join(', ')}.`)
  return hit._id
}

export const statusName = (wf: Workflow, id: string): string => wf.statuses.find((s) => s._id === id)?.name ?? '?'

/** Display name of a person ("Last,First") or organization. */
export const contactName = (c: any): string => c == null ? '—' : c._class === 'contact:class:Organization' ? String(c.name ?? '') : formatPersonName(c.name)

/** Finds one contact (person or organization) by id or name, optionally of one class. */
export async function findContact (client: any, ref: string, cls = 'contact:class:Contact'): Promise<any> {
  const byId = await client.findOne(cls, { _id: ref })
  if (byId != null) return byId
  const all: any[] = await client.findAll(cls, {})
  const q = ref.trim().toLowerCase()
  const exact = all.filter((c) => contactName(c).toLowerCase() === q || String(c.name ?? '').toLowerCase() === q)
  const hits = exact.length > 0 ? exact : all.filter((c) => contactName(c).toLowerCase().includes(q))
  if (hits.length === 1) return hits[0]
  if (hits.length === 0) throw new Error(`Contact '${ref}' not found.`)
  throw new Error(`Contact '${ref}' is ambiguous: ${hits.slice(0, 8).map(contactName).join(', ')}.`)
}

/** Finds one space-like doc of a class by id or (case-insensitive) name. */
export async function findNamed (client: any, cls: string, ref: string, what: string, query: Record<string, unknown> = {}): Promise<any> {
  const all: any[] = await client.findAll(cls, query)
  const hits = all.filter((d) => d._id === ref || String(d.name ?? d.title ?? '').toLowerCase() === ref.trim().toLowerCase())
  if (hits.length === 1) return hits[0]
  if (hits.length === 0) throw new Error(`${what} '${ref}' not found. Available: ${all.map((d) => d.name ?? d.title).slice(0, 15).join(', ') || 'none'}.`)
  throw new Error(`${what} '${ref}' is ambiguous — pass its id.`)
}

/** "2026-06-01" → timestamp (local midnight); throws on bad input. */
export function parseDay (value: string, field: string): number {
  const t = Date.parse(value)
  if (Number.isNaN(t)) throw new Error(`${field} must be a date (YYYY-MM-DD), got '${value}'.`)
  return t
}
