// Recruiting (recruit plugin): vacancies (spaces), candidates (Candidate mixin on persons) and
// applications (tasks APP-n attached to the candidate, living in the vacancy).
import { generateId, SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate } from '../utils/format'
import { currentAccountUuid, findPerson, peopleNames, formatPersonName } from '../utils/people'
import { nextNumber, workflowOf, pickStatus, statusName, findContact, findNamed, parseDay, contactName } from '../utils/tasks'
import type { z } from 'zod'
import type * as S from '../schemas'

export const R = {
  Vacancy: 'recruit:class:Vacancy',
  Applicant: 'recruit:class:Applicant',
  Candidate: 'recruit:mixin:Candidate',
  DefaultType: 'recruit:template:DefaultVacancy',
  Person: 'contact:class:Person',
  Contacts: 'contact:space:Contacts'
} as const

async function findVacancy (client: any, ref: string): Promise<any> {
  return await findNamed(client, R.Vacancy, ref, 'Vacancy')
}

async function findApplication (client: any, identifier: string): Promise<any> {
  const app = await client.findOne(R.Applicant, { identifier: identifier.trim().toUpperCase() })
  if (app == null) throw new Error(`Application '${identifier}' not found (ids look like APP-12).`)
  return app
}

export const listVacancies = wrapToolHandler<z.infer<typeof S.ListVacanciesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const vacancies: any[] = await client.findAll(R.Vacancy, args.includeArchived === true ? {} : { archived: false })
  if (vacancies.length === 0) return 'No vacancies.'
  const apps: any[] = await client.findAll(R.Applicant, { space: { $in: vacancies.map((v) => v._id) } })
  const lines: string[] = []
  for (const v of vacancies) {
    const company = v.company != null ? contactName(await client.findOne('contact:class:Organization', { _id: v.company })) : undefined
    const mine = apps.filter((a) => a.space === v._id)
    const wf = await workflowOf(client, v).catch(() => undefined)
    const byStatus = new Map<string, number>()
    for (const a of mine) { const n = wf != null ? statusName(wf, a.status) : '?'; byStatus.set(n, (byStatus.get(n) ?? 0) + 1) }
    const extras = [company, v.location, v.dueTo != null ? `due ${formatDate(v.dueTo)}` : undefined, v.archived === true ? 'archived' : undefined].filter((x) => x != null && x !== '')
    lines.push(`- **${String(v.name)}**${extras.length > 0 ? ` (${extras.join(', ')})` : ''} — ${mine.length} application(s)${byStatus.size > 0 ? `: ${[...byStatus].map(([s, n]) => `${n} ${s}`).join(', ')}` : ''} — \`${String(v._id)}\``)
  }
  return `## Vacancies (${vacancies.length})\n\n${lines.join('\n')}`
})

export const createVacancy = wrapToolHandler<z.infer<typeof S.CreateVacancySchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const existing: any[] = await client.findAll(R.Vacancy, {})
  if (existing.some((v) => String(v.name).toLowerCase() === args.name.trim().toLowerCase())) throw new Error(`A vacancy named '${args.name}' already exists.`)
  const type = await client.findOne('task:class:ProjectType', { _id: R.DefaultType })
  if (type == null) throw new Error('Recruiting is not set up in this workspace (no default vacancy type).')
  const company = args.company != null ? (await findContact(client, args.company, 'contact:class:Organization'))._id : undefined
  const me = await currentAccountUuid(client)
  const id = generateId()
  const number = await nextNumber(client, R.Vacancy)
  await client.createDoc(R.Vacancy, 'core:space:Space', {
    name: args.name.trim(),
    description: args.description ?? '',
    fullDescription: null,
    private: false,
    archived: false,
    number,
    company,
    location: args.location,
    dueTo: args.dueDate != null ? parseDay(args.dueDate, 'dueDate') : undefined,
    members: [me],
    owners: [me],
    autoJoin: type.autoJoin ?? false,
    type: R.DefaultType,
    attachments: 0,
    comments: 0
  }, id)
  await client.createMixin(id, R.Vacancy, 'core:space:Space', type.targetClass, {})
  return `✅ Vacancy **${args.name}** created — \`${id}\``
})

export const updateVacancy = wrapToolHandler<z.infer<typeof S.UpdateVacancySchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const v = await findVacancy(client, args.vacancy)
  const update: Record<string, unknown> = {}
  if (args.name != null) update.name = args.name.trim()
  if (args.description !== undefined) update.description = args.description ?? ''
  if (args.location !== undefined) update.location = args.location ?? ''
  if (args.dueDate !== undefined) update.dueTo = args.dueDate != null ? parseDay(args.dueDate, 'dueDate') : null
  if (args.archived != null) update.archived = args.archived
  if (Object.keys(update).length === 0) throw new Error('Nothing to change.')
  await client.updateDoc(R.Vacancy, v.space, v._id, update)
  return `✅ Vacancy **${String(update.name ?? v.name)}** updated: ${Object.keys(update).join(', ')}.`
})

export const listCandidates = wrapToolHandler<z.infer<typeof S.ListCandidatesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  let people: any[] = await client.findAll(R.Candidate, {})
  if (args.query != null) {
    const q = args.query.toLowerCase()
    people = people.filter((p) => formatPersonName(p.name).toLowerCase().includes(q) || String(p[R.Candidate]?.title ?? '').toLowerCase().includes(q))
  }
  const limit = args.limit ?? 50
  if (people.length === 0) return 'No candidates.'
  const lines = people.slice(0, limit).map((p) => {
    const c = p[R.Candidate] ?? {}
    const where = [c.onsite === true ? 'onsite' : undefined, c.remote === true ? 'remote' : undefined, p.city].filter((x) => x != null && x !== '')
    return `- **${formatPersonName(p.name)}**${c.title != null && c.title !== '' ? ` — ${String(c.title)}` : ''}${where.length > 0 ? ` (${where.join(', ')})` : ''} · ${Number(c.applications ?? 0)} application(s) — \`${String(p._id)}\``
  })
  return `## Candidates (${people.length})\n\n${lines.join('\n')}${people.length > limit ? `\n… ${people.length - limit} more` : ''}`
})

export const createCandidate = wrapToolHandler<z.infer<typeof S.CreateCandidateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const name = `${args.lastName.trim()},${args.firstName.trim()}`
  const dup: any[] = await client.findAll(R.Person, { name })
  if (dup.length > 0) throw new Error(`A person named ${args.firstName} ${args.lastName} already exists (\`${String(dup[0]._id)}\`) — use create_application with that name.`)
  const id = generateId()
  await client.createDoc(R.Person, R.Contacts, { name, city: args.city ?? '', channels: 0, avatarType: 'color' }, id)
  await client.createMixin(id, R.Person, R.Contacts, R.Candidate, { title: args.title ?? '', onsite: args.onsite ?? false, remote: args.remote ?? false, skills: 0 })
  if (args.email != null) await client.addCollection('contact:class:Channel', R.Contacts, id, R.Person, 'channels', { value: args.email.trim(), provider: 'contact:channelProvider:Email' })
  return `✅ Candidate **${args.firstName} ${args.lastName}** created — \`${id}\``
})

export const listApplications = wrapToolHandler<z.infer<typeof S.ListApplicationsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const query: Record<string, unknown> = {}
  let vacancies: any[]
  if (args.vacancy != null) { const v = await findVacancy(client, args.vacancy); vacancies = [v]; query.space = v._id } else vacancies = await client.findAll(R.Vacancy, {})
  const apps: any[] = await client.findAll(R.Applicant, query, { sort: { modifiedOn: SortingOrder.Descending }, limit: args.limit ?? 50 })
  if (apps.length === 0) return 'No applications.'
  const names = await peopleNames(client)
  const persons: any[] = await client.findAll(R.Person, { _id: { $in: [...new Set(apps.map((a) => a.attachedTo))] } })
  const wfs = new Map<string, any>()
  for (const v of vacancies) wfs.set(v._id, await workflowOf(client, v).catch(() => undefined))
  const rows = apps.map((a) => {
    const v = vacancies.find((x) => x._id === a.space)
    const wf = wfs.get(a.space)
    return { a, status: wf != null ? statusName(wf, a.status) : '?', v }
  }).filter((r) => args.status == null || r.status.toLowerCase() === args.status.toLowerCase())
  const lines = rows.map(({ a, status, v }) => `- **${String(a.identifier)}** ${contactName(persons.find((p) => p._id === a.attachedTo))} → ${String(v?.name ?? '?')} [${status}]${a.assignee != null ? ` · ${names.get(a.assignee) ?? '?'}` : ''} · ${formatDate(a.modifiedOn)}`)
  return `## Applications (${rows.length})\n\n${lines.join('\n') || '_(none with that status)_'}`
})

export const createApplication = wrapToolHandler<z.infer<typeof S.CreateApplicationSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const vacancy = await findVacancy(client, args.vacancy)
  const person = await findContact(client, args.candidate, R.Person)
  const wf = await workflowOf(client, vacancy)
  const status = pickStatus(wf, args.status)
  const assignee = args.assignee != null ? (await findPerson(client, args.assignee))._id : null
  const existing = await client.findOne(R.Applicant, { space: vacancy._id, attachedTo: person._id })
  if (existing != null) throw new Error(`${contactName(person)} already applied to ${String(vacancy.name)} (${String(existing.identifier)}).`)
  if (person[R.Candidate] == null) await client.createMixin(person._id, person._class, person.space, R.Candidate, {})
  const number = await nextNumber(client, R.Applicant)
  const identifier = `APP-${number}`
  await client.addCollection(R.Applicant, vacancy._id, person._id, R.Candidate, 'applications', {
    status, number, identifier, rank: '', kind: wf.kind, assignee, startDate: null, dueDate: null, isDone: false
  })
  return `✅ **${identifier}**: ${contactName(person)} → ${String(vacancy.name)} [${statusName(wf, status)}]`
})

export const updateApplication = wrapToolHandler<z.infer<typeof S.UpdateApplicationSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const app = await findApplication(client, args.identifier)
  const update: Record<string, unknown> = {}
  const done: string[] = []
  if (args.status != null) {
    const vacancy = await client.findOne(R.Vacancy, { _id: app.space })
    const wf = await workflowOf(client, vacancy)
    update.status = pickStatus(wf, args.status)
    done.push(`status → ${statusName(wf, update.status as string)}`)
  }
  if (args.assignee !== undefined) {
    update.assignee = args.assignee != null ? (await findPerson(client, args.assignee))._id : null
    done.push(args.assignee != null ? `assignee → ${args.assignee}` : 'unassigned')
  }
  if (Object.keys(update).length === 0) throw new Error('Nothing to change.')
  await client.updateDoc(R.Applicant, app.space, app._id, update)
  return `✅ **${String(app.identifier)}**: ${done.join(', ')}.`
})

export const deleteApplication = wrapToolHandler<z.infer<typeof S.DeleteApplicationSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const app = await findApplication(client, args.identifier)
  await client.removeCollection(R.Applicant, app.space, app._id, app.attachedTo, app.attachedToClass, app.collection ?? 'applications')
  return `🗑️ Application **${String(app.identifier)}** deleted.`
})
