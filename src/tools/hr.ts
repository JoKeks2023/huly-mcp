// HR (hr plugin): departments (a tree of docs in the workspace space), staff membership
// (Staff mixin on employees; the server keeps Department.members in sync) and time-off requests.
import { generateId } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { markupToText, textToMarkup } from '../utils/format'
import { currentPerson, findPerson, peopleNames } from '../utils/people'
import { findNamed } from '../utils/tasks'
import type { z } from 'zod'
import type * as S from '../schemas'

export const HR = {
  Department: 'hr:class:Department',
  Staff: 'hr:mixin:Staff',
  Request: 'hr:class:Request',
  Head: 'hr:ids:Head',
  Space: 'core:space:Workspace'
} as const

export const REQUEST_TYPES = {
  vacation: 'hr:ids:Vacation',
  sick: 'hr:ids:Sick',
  pto: 'hr:ids:PTO',
  'pto-half-day': 'hr:ids:PTO2',
  overtime: 'hr:ids:Overtime',
  'overtime-half-day': 'hr:ids:Overtime2',
  remote: 'hr:ids:Remote'
} as const
const TYPE_NAME = new Map(Object.entries(REQUEST_TYPES).map(([k, v]) => [v as string, k]))

/** Huly's TzDate: calendar day, month 0-based, plus the UTC offset it was entered in. */
export interface TzDate { year: number, month: number, day: number, offset: number }

export function toTzDate (value: string, field: string): TzDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (m == null) throw new Error(`${field} must be YYYY-MM-DD, got '${value}'.`)
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (d.getMonth() !== Number(m[2]) - 1) throw new Error(`${field} '${value}' is not a real date.`)
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), offset: d.getTimezoneOffset() }
}

export const tzText = (t: TzDate | undefined): string => t == null ? '?' : `${t.year}-${String(t.month + 1).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
const tzKey = (t: TzDate): number => t.year * 10000 + t.month * 100 + t.day

async function findDepartment (client: any, ref: string): Promise<any> {
  if (ref.toLowerCase() === 'organization' || ref === HR.Head) {
    const head = await client.findOne(HR.Department, { _id: HR.Head })
    if (head != null) return head
  }
  return await findNamed(client, HR.Department, ref, 'Department')
}

export const listDepartments = wrapToolHandler<z.infer<typeof S.ListDepartmentsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const deps: any[] = await client.findAll(HR.Department, {})
  if (deps.length === 0) return 'No departments (is the HR module enabled?).'
  const names = await peopleNames(client)
  const staff: any[] = await client.findAll(HR.Staff, {})
  const lines: string[] = []
  const walk = (parent: string | undefined, depth: number): void => {
    for (const d of deps.filter((x) => (x.parent ?? undefined) === parent && x._id !== parent)) {
      const people = staff.filter((s) => s[HR.Staff]?.department === d._id).map((s) => names.get(s._id) ?? '?')
      const lead = d.teamLead != null ? ` · lead ${names.get(d.teamLead) ?? '?'}` : ''
      lines.push(`${'  '.repeat(depth)}- **${String(d.name)}**${lead} · ${people.length > 0 ? people.join(', ') : 'no members'} — \`${String(d._id)}\``)
      walk(d._id, depth + 1)
    }
  }
  walk(undefined, 0)
  return `## Departments (${deps.length})\n\n${lines.join('\n')}`
})

export const createDepartment = wrapToolHandler<z.infer<typeof S.CreateDepartmentSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const parent = await findDepartment(client, args.parent ?? HR.Head)
  const all: any[] = await client.findAll(HR.Department, {})
  if (all.some((d) => String(d.name).toLowerCase() === args.name.trim().toLowerCase())) throw new Error(`Department '${args.name}' already exists.`)
  const teamLead = args.teamLead != null ? (await findPerson(client, args.teamLead))._id : null
  const id = generateId()
  await client.createDoc(HR.Department, HR.Space, { name: args.name.trim(), description: '', parent: parent._id, members: [], teamLead, managers: [] }, id)
  return `✅ Department **${args.name}** created under ${String(parent.name)} — \`${id}\``
})

export const deleteDepartment = wrapToolHandler<z.infer<typeof S.DeleteDepartmentSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const d = await findDepartment(client, args.department)
  if (d._id === HR.Head) throw new Error('The root department cannot be deleted.')
  const children: any[] = await client.findAll(HR.Department, { parent: d._id })
  if (children.length > 0) throw new Error(`${String(d.name)} has sub-departments (${children.map((c) => c.name).join(', ')}) — delete or move them first.`)
  await client.removeDoc(HR.Department, d.space, d._id)
  return `🗑️ Department **${String(d.name)}** deleted. Its members are moved out by Huly.`
})

export const setDepartment = wrapToolHandler<z.infer<typeof S.SetDepartmentSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const dep = await findDepartment(client, args.department)
  const person = await findPerson(client, args.member)
  const doc: any = await client.findOne('contact:class:Person', { _id: person._id })
  if (doc[HR.Staff] == null) await client.createMixin(doc._id, doc._class, doc.space, HR.Staff, { department: dep._id })
  else if (doc[HR.Staff].department === dep._id) return `${person.name} is already in ${String(dep.name)}.`
  else await client.updateMixin(doc._id, doc._class, doc.space, HR.Staff, { department: dep._id })
  return `✅ ${person.name} → department ${String(dep.name)}.`
})

export const listTimeOff = wrapToolHandler<z.infer<typeof S.ListTimeOffSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const query: Record<string, unknown> = {}
  if (args.member != null) query.attachedTo = (await findPerson(client, args.member))._id
  if (args.department != null) query.department = (await findDepartment(client, args.department))._id
  let reqs: any[] = await client.findAll(HR.Request, query)
  const from = args.from != null ? tzKey(toTzDate(args.from, 'from')) : undefined
  const to = args.to != null ? tzKey(toTzDate(args.to, 'to')) : undefined
  reqs = reqs.filter((r) => (from == null || tzKey(r.tzDueDate) >= from) && (to == null || tzKey(r.tzDate) <= to))
    .sort((a, b) => tzKey(a.tzDate) - tzKey(b.tzDate))
  if (reqs.length === 0) return 'No time-off requests in that range.'
  const names = await peopleNames(client)
  const lines = reqs.map((r) => {
    const note = markupToText(r.description).trim()
    return `- ${tzText(r.tzDate)}${tzKey(r.tzDate) !== tzKey(r.tzDueDate) ? ` – ${tzText(r.tzDueDate)}` : ''} · **${names.get(r.attachedTo) ?? '?'}** · ${TYPE_NAME.get(r.type) ?? String(r.type)}${note !== '' ? ` — ${note.slice(0, 120)}` : ''} — \`${String(r._id)}\``
  })
  return `## Time off (${reqs.length})\n\n${lines.join('\n')}`
})

export const createTimeOff = wrapToolHandler<z.infer<typeof S.CreateTimeOffSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const person = args.member != null ? await findPerson(client, args.member) : await currentPerson(client)
  const doc: any = await client.findOne('contact:class:Person', { _id: person._id })
  const department = doc?.[HR.Staff]?.department
  if (department == null) throw new Error(`${person.name} is not in any department yet — set_department first.`)
  const start = toTzDate(args.from, 'from')
  const end = toTzDate(args.to ?? args.from, 'to')
  if (tzKey(end) < tzKey(start)) throw new Error('to is before from.')
  const id = generateId()
  await client.addCollection(HR.Request, HR.Space, doc._id, doc._class, 'requests', {
    type: REQUEST_TYPES[args.type], tzDate: start, tzDueDate: end, description: textToMarkup(args.description ?? ''), department
  }, id)
  return `✅ ${args.type} for ${person.name}: ${tzText(start)}${tzKey(end) !== tzKey(start) ? ` – ${tzText(end)}` : ''} — \`${id}\``
})

export const deleteTimeOff = wrapToolHandler<z.infer<typeof S.DeleteTimeOffSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const r = await client.findOne(HR.Request, { _id: args.id })
  if (r == null) throw new Error(`Time-off request '${args.id}' not found (ids come from list_time_off).`)
  await client.removeCollection(HR.Request, r.space, r._id, r.attachedTo, r.attachedToClass, r.collection ?? 'requests')
  return `🗑️ Time-off request ${tzText(r.tzDate)} deleted.`
})
