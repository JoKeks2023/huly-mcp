// Overviews that combine several modules in one call: "my day" (calendar, to-dos, my issues,
// reviews, inbox) so Claude can answer "what's on today?" without five round trips, and a
// project report for a period (weekly report).
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C, TODO_PRIORITY, TODO_PRIORITY_LABEL } from '../utils/classes'
import { priorityLabel, clip, markupToText } from '../utils/format'
import { currentAccountUuid, currentPerson, peopleNames, socialIdNames } from '../utils/people'
import { parseSince } from './agent'
import { loadLabel } from '../utils/resolve'
import type { z } from 'zod'
import type * as S from '../schemas'

const DAY = 86_400_000
const day = (ts: number): string => new Date(ts).toISOString().slice(0, 10)
const hm = (ts: number): string => new Date(ts).toISOString().slice(11, 16)

/** Start of the given day (UTC, like the calendar tools) or of today. */
export function dayStart (date?: string): number {
  if (date == null) return Date.parse(new Date().toISOString().slice(0, 10))
  const t = Date.parse(date.slice(0, 10))
  if (Number.isNaN(t)) throw new Error(`date must be YYYY-MM-DD, got '${date}'.`)
  return t
}

const due = (ts: number | null | undefined, from: number): string => {
  if (ts == null) return ''
  if (ts < from) return ` · ⚠️ overdue (${day(ts)})`
  if (ts < from + DAY) return ' · due today'
  return ` · due ${day(ts)}`
}

export const myDay = wrapToolHandler<z.infer<typeof S.MyDaySchema>>(async (args) =>
  await myDayText(await getConnection(args.workspace), args.date, args.limit ?? 10))

export async function myDayText (client: any, date: string | undefined, limit: number): Promise<string> {
  const from = dayStart(date)
  const to = from + DAY - 1
  const [me, uuid] = await Promise.all([currentPerson(client), currentAccountUuid(client)])

  const [events, todos, issues, prs, unread]: any[][] = await Promise.all([
    client.findAll(C.Event, { date: { $lte: to }, dueDate: { $gte: from } }, { sort: { date: SortingOrder.Ascending } }),
    client.findAll(C.ToDo, { user: me._id, doneOn: null }, { sort: { rank: SortingOrder.Ascending } }),
    client.findAll(tracker.class.Issue, { assignee: me._id }),
    client.findAll(C.PullRequest, { state: 0 }),
    client.findAll(C.InboxNotification, { user: uuid, isViewed: false, archived: false }, { sort: { createdOn: SortingOrder.Descending }, limit: 500 })
  ])
  const out: string[] = [`# My day — ${day(from)} (times UTC)`]

  // Calendar: own events and work slots (the query also returns other people's public events).
  const mine = events.filter((e) => (e.participants ?? []).includes(me._id) || String(e.calendar ?? '').startsWith(uuid) || e.user === me._id)
  out.push('', `## Calendar (${mine.length})`)
  if (mine.length === 0) out.push('Nothing scheduled.')
  for (const e of mine.slice(0, limit)) {
    const when = e.allDay === true ? 'all day' : `${hm(Math.max(e.date, from))}–${hm(Math.min(e.dueDate, to))}`
    const slot = e._class === C.WorkSlot ? ` · work slot for ${await loadLabel(client, e.attachedToClass, e.attachedTo)}` : ''
    out.push(`- ${when} **${String(e.title)}**${e.location != null && e.location !== '' ? ` · 📍 ${String(e.location)}` : ''}${slot}`)
  }

  // To-dos: overdue and due today first, then the top of the planner.
  const urgency = (t: any): number => t.dueDate == null ? 2 : t.dueDate <= to ? 0 : 1
  const sortedTodos = [...todos].sort((a, b) => urgency(a) - urgency(b))
  const dueNow = todos.filter((t) => t.dueDate != null && t.dueDate <= to).length
  out.push('', `## To-dos (${todos.length} open${dueNow > 0 ? `, ${dueNow} due by today` : ''})`)
  if (todos.length === 0) out.push('No open to-dos.')
  for (const t of sortedTodos.slice(0, limit)) {
    const prio = t.priority != null && t.priority !== TODO_PRIORITY.NoPriority ? ` · ${String(TODO_PRIORITY_LABEL[t.priority] ?? t.priority)}` : ''
    out.push(`- [ ] **${String(t.title)}**${prio}${due(t.dueDate, from)} — \`${String(t._id)}\``)
  }

  // My issues: open ones, in progress first, then by due date and priority.
  const statuses: any[] = issues.length > 0 ? await client.findAll('core:class:Status', { _id: { $in: [...new Set(issues.map((i) => i.status))] } }) : []
  const st = new Map(statuses.map((s) => [s._id, s]))
  const closed = new Set<string>([task.statusCategory.Won, task.statusCategory.Lost])
  // PRs are issues too (github:class:GithubPullRequest); they belong to the reviews section.
  const open = issues.filter((i) => i._class !== C.PullRequest && !closed.has(st.get(i.status)?.category))
  const active = (i: any): number => st.get(i.status)?.category === task.statusCategory.Active ? 0 : 1
  open.sort((a, b) => active(a) - active(b) || (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || (a.priority || 9) - (b.priority || 9))
  out.push('', `## My issues (${open.length} open, ${open.filter((i) => active(i) === 0).length} in progress)`)
  if (open.length === 0) out.push('No open issues assigned to you.')
  for (const i of open.slice(0, limit)) {
    const prio = i.priority != null && i.priority !== 0 ? ` · ${priorityLabel(i.priority)}` : ''
    out.push(`- **${String(i.identifier)}** ${String(i.title)} — ${String(st.get(i.status)?.name ?? '?')}${prio}${due(i.dueDate, from)}`)
  }

  // Reviews: open PRs that ask me to review, and my own open PRs with their review state.
  const DECISION = ['changes requested', 'approved', 'review required']
  const toReview = prs.filter((p) => (p.reviewers ?? []).includes(me._id))
  const own = prs.filter((p) => p.assignee === me._id && !toReview.includes(p))
  out.push('', `## Reviews (${toReview.length} for you, ${own.length} of yours open)`)
  if (toReview.length + own.length === 0) out.push('No open pull requests for you.')
  for (const p of toReview.slice(0, limit)) out.push(`- 👀 **${String(p.identifier)}** ${String(p.title)}${p.draft === true ? ' · draft' : ''}`)
  for (const p of own.slice(0, limit)) out.push(`- **${String(p.identifier)}** ${String(p.title)} · ${p.reviewDecision != null ? DECISION[p.reviewDecision] ?? p.reviewDecision : 'no review yet'}${p.draft === true ? ' · draft' : ''}`)

  // Inbox: unread notifications grouped by object, newest first.
  const groups = new Map<string, any[]>()
  for (const n of unread) groups.set(n.docNotifyContext, [...(groups.get(n.docNotifyContext) ?? []), n])
  out.push('', `## Inbox (${unread.length}${unread.length === 500 ? '+' : ''} unread on ${groups.size} item(s))`)
  if (unread.length === 0) out.push('Inbox zero.')
  const ctxs: any[] = groups.size > 0 ? await client.findAll(C.DocNotifyContext, { _id: { $in: [...groups.keys()].slice(0, limit) } }) : []
  for (const [ctxId, notes] of [...groups.entries()].slice(0, limit)) {
    const ctx = ctxs.find((c) => c._id === ctxId)
    const cls = ctx?.objectClass ?? notes[0].objectClass
    const label = cls != null ? await loadLabel(client, cls, ctx?.objectId ?? notes[0].objectId) : '(unknown)'
    out.push(`- **${label}** — ${notes.length} unread`)
  }
  if (unread.length > 0) out.push(`_${groups.size > limit ? `${groups.size - limit} more. ` : ''}Work through them: triage_inbox._`)
  return out.join('\n')
}

// ── Project report: what happened in a project over a period (default: last 7 days) ──

const pct = (part: number, total: number): string => total === 0 ? '—' : `${Math.round(100 * part / total)}%`

export const projectReport = wrapToolHandler<z.infer<typeof S.ProjectReportSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)
  const since = parseSince(args.since ?? '7d')
  const now = Date.now()
  const all: any[] = await client.findAll(tracker.class.Issue, { space: project._id })
  const issues = all.filter((i) => i._class !== C.PullRequest)
  const prs = all.filter((i) => i._class === C.PullRequest)
  const ids = issues.map((i) => i._id)
  const [statuses, milestones, reports, statusMsgs]: any[][] = await Promise.all([
    client.findAll('core:class:Status', { _id: { $in: [...new Set(all.map((i) => i.status))] } }),
    client.findAll(tracker.class.Milestone, { space: project._id }),
    ids.length > 0 ? client.findAll(tracker.class.TimeSpendReport, { attachedTo: { $in: ids } }) : [],
    ids.length > 0 ? client.findAll(C.DocUpdateMessage, { attachedTo: { $in: ids }, createdOn: { $gte: since } }) : []
  ])
  const names = await peopleNames(client)
  const st = new Map(statuses.map((s) => [s._id, s]))
  const cat = (i: any): string | undefined => st.get(i.status)?.category
  const won = (i: any): boolean => cat(i) === task.statusCategory.Won
  const isOpen = (i: any): boolean => !won(i) && cat(i) !== task.statusCategory.Lost
  const who = (i: any): string => i.assignee != null ? ` · ${names.get(i.assignee) ?? '?'}` : ''
  const line = (i: any, extra = ''): string => `- **${String(i.identifier)}** ${String(i.title)}${extra}${who(i)}`

  // Done in the period: done now and its status changed in the period. modifiedOn is no use here —
  // GitHub sync touches closed issues long after they were finished.
  const statusChanged = new Set(statusMsgs.filter((m) => m.attributeUpdates?.attrKey === 'status').map((m) => m.attachedTo))
  const done = issues.filter((i) => won(i) && statusChanged.has(i._id))
  const created = issues.filter((i) => (i.createdOn ?? 0) >= since)
  const open = issues.filter(isOpen)
  const active = open.filter((i) => cat(i) === task.statusCategory.Active)
  const openIds = new Set(open.map((i) => i._id))
  const blocked = open.filter((i) => (i.blockedBy ?? []).some((b: any) => openIds.has(b._id ?? b)))
  const overdue = open.filter((i) => i.dueDate != null && i.dueDate < now)
  const stale = active.filter((i) => (i.modifiedOn ?? 0) < since)
  const merged = prs.filter((p) => p.state === 2 && (p.mergedAt ?? p.modifiedOn ?? 0) >= since)
  const openPrs = prs.filter((p) => p.state === 0)
  const time = reports.filter((r) => (r.date ?? 0) >= since)
  const hours = time.reduce((s, r) => s + (r.value ?? 0), 0)

  const L = 15
  const section = (title: string, list: any[], render: (i: any) => string = (i) => line(i)): void => {
    if (list.length === 0) return
    out.push('', `## ${title} (${list.length})`, ...list.slice(0, L).map(render))
    if (list.length > L) out.push(`_…${list.length - L} more_`)
  }
  const out: string[] = [
    `# ${String(project.name)} (${String(project.identifier)}) — ${day(since)} to ${day(now)}`,
    '',
    `**${done.length} done · ${created.length} new · ${open.length} open (${active.length} in progress) · ${blocked.length} blocked · ${overdue.length} overdue · ${merged.length} PRs merged · ${Math.round(hours * 10) / 10}h logged**`
  ]
  section('Done', done)
  section('New', created, (i) => line(i, ` — ${String(st.get(i.status)?.name ?? '?')}`))
  section('In progress', active, (i) => line(i, stale.includes(i) ? ' · ⚠️ no change in this period' : ''))
  section('Blocked', blocked, (i) => line(i, ` — by ${(i.blockedBy as any[]).map((b) => String(all.find((x) => x._id === (b._id ?? b))?.identifier ?? '?')).join(', ')}`))
  section('Overdue', overdue, (i) => line(i, ` — due ${day(i.dueDate)}`))
  section('Pull requests merged', merged)
  section('Pull requests open', openPrs, (p) => line(p, p.reviewDecision != null ? ` · ${['changes requested', 'approved', 'review required'][p.reviewDecision] ?? ''}` : ''))

  const ms = milestones.filter((m) => m.status !== 2 && m.status !== 3).sort((a, b) => (a.targetDate ?? Infinity) - (b.targetDate ?? Infinity))
  section('Milestones', ms, (m) => {
    const of = issues.filter((i) => i.milestone === m._id)
    const late = m.targetDate != null && m.targetDate < now ? ' ⚠️ past target' : ''
    return `- **${String(m.label)}** — ${of.filter(won).length}/${of.length} done (${pct(of.filter(won).length, of.length)})${m.targetDate != null ? `, target ${day(m.targetDate)}${late}` : ''}`
  })
  if (time.length > 0) {
    const per = new Map<string, number>()
    for (const r of time) { const n = names.get(r.employee) ?? '?'; per.set(n, (per.get(n) ?? 0) + (r.value ?? 0)) }
    out.push('', '## Time logged', ...[...per].sort((a, b) => b[1] - a[1]).map(([n, h]) => `- ${n}: ${Math.round(h * 10) / 10}h`))
  }
  return out.join('\n')
})

// ── Standup: what I did since the last working day, what's on today, what blocks me ──

/** Start of the previous working day (Monday → Friday), UTC. */
export function lastWorkingDay (now = Date.now()): number {
  const today = dayStart(new Date(now).toISOString())
  const dow = new Date(today).getUTCDay() // 0 Sun … 6 Sat
  const back = dow === 1 ? 3 : dow === 0 ? 2 : 1
  return today - back * DAY
}

/** Sections of a markdown text by "## " heading. */
const sections = (md: string): Map<string, string> => new Map(md.split(/\n(?=## )/).filter((s) => s.startsWith('## ')).map((s) => [s.split('\n')[0].replace(/^## | \(.*$/g, ''), s.trim()]))

export const standup = wrapToolHandler<z.infer<typeof S.StandupSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const since = args.since != null ? parseSince(args.since) : lastWorkingDay()
  const me = await currentPerson(client)
  const idents: any[] = await client.findAll('contact:class:SocialIdentity', { attachedTo: me._id })
  const mine = [...new Set([client.user, ...idents.map((i) => i._id)])]

  const [updates, comments, reports, doneTodos]: any[][] = await Promise.all([
    client.findAll(C.DocUpdateMessage, { createdBy: { $in: mine }, createdOn: { $gte: since } }, { limit: 1000, sort: { createdOn: SortingOrder.Descending } }),
    client.findAll('chunter:class:ChatMessage', { createdBy: { $in: mine }, createdOn: { $gte: since }, attachedToClass: { $in: [tracker.class.Issue, C.PullRequest] } }, { limit: 200 }),
    client.findAll(tracker.class.TimeSpendReport, { employee: me._id, date: { $gte: since } }),
    client.findAll(C.ToDo, { user: me._id, doneOn: { $gte: since } })
  ])

  // What I did, per issue: created, status changes, other fields, comments, time.
  const per = new Map<string, { created: boolean, status: string[], fields: Set<string>, comments: number, hours: number }>()
  const entry = (id: string): any => per.get(id) ?? per.set(id, { created: false, status: [], fields: new Set(), comments: 0, hours: 0 }).get(id)
  const statusIds = new Set<string>()
  updates.sort((a, b) => (a.createdOn ?? 0) - (b.createdOn ?? 0))
  for (const u of updates) {
    if (u.objectClass != null && u.objectClass !== tracker.class.Issue && u.objectClass !== C.PullRequest && u.attachedToClass !== tracker.class.Issue) continue
    const e = entry(u.attachedTo)
    if (u.action === 'create') e.created = true
    else if (u.attributeUpdates?.attrKey === 'status') { for (const s of u.attributeUpdates.set ?? []) { e.status.push(s); statusIds.add(s) } } else if (u.attributeUpdates?.attrKey != null && !['rank', 'subIssues', 'comments', 'reports', 'reportedTime', 'remainingTime', 'modifiedOn'].includes(u.attributeUpdates.attrKey)) e.fields.add(u.attributeUpdates.attrKey === 'attachedTo' ? 'parent' : u.attributeUpdates.attrKey)
  }
  for (const c of comments) entry(c.attachedTo).comments++
  for (const r of reports) entry(r.attachedTo).hours += r.value ?? 0
  const issues: any[] = per.size > 0 ? await client.findAll(tracker.class.Issue, { _id: { $in: [...per.keys()] } }) : []
  const stNames = new Map(((statusIds.size > 0 ? await client.findAll('core:class:Status', { _id: { $in: [...statusIds] } }) : []) as any[]).map((s) => [s._id, s.name]))

  const out: string[] = [`# Standup — since ${new Date(since).toISOString().slice(0, 16).replace('T', ' ')} UTC`, '', '## Done / worked on']
  if (updates.length === 1000) out.push('_Very busy period: only the latest 1000 changes are counted._')
  // Most telling first: status changes and new issues, then comments/time, then field edits.
  const weight = (i: any): number => { const e = per.get(i._id)!; return e.status.length > 0 || e.created ? 0 : e.comments > 0 || e.hours > 0 ? 1 : 2 }
  issues.sort((a, b) => weight(a) - weight(b))
  const did = issues.slice(0, 15).map((i) => {
    const e = per.get(i._id)!
    const parts = [
      e.created ? 'created' : undefined,
      e.status.length > 0 ? `→ ${e.status.map((s: string) => stNames.get(s) ?? '?').filter((n: string, k: number, a: string[]) => k === 0 || n !== a[k - 1]).join(' → ')}` : undefined,
      e.fields.size > 0 ? `changed ${[...e.fields].join(', ')}` : undefined,
      e.comments > 0 ? `${e.comments} comment(s)` : undefined,
      e.hours > 0 ? `${Math.round(e.hours * 10) / 10}h` : undefined
    ].filter((p) => p != null)
    return `- **${String(i.identifier)}** ${String(i.title)} — ${parts.join(' · ')}`
  })
  if (issues.length > 15) did.push(`_…${issues.length - 15} more issues touched — changes_since for all._`)
  for (const t of doneTodos) did.push(`- [x] ${String(t.title)}`)
  out.push(...(did.length > 0 ? did : ['Nothing recorded in Huly.']))

  // Today and blockers: reuse my_day (calendar, to-dos, my issues).
  const day = sections(await myDayText(client, undefined, 5))
  out.push('', '## Today')
  for (const key of ['Calendar', 'To-dos', 'My issues']) {
    const s = day.get(key)
    if (s != null) out.push(s.replace(/^## /, '### '))
  }
  const blocked = await myBlockedIssues(client, me._id)
  out.push('', '## Blockers', ...(blocked.length > 0 ? blocked : ['None in Huly.']))
  return out.join('\n')
})

/** My open issues that wait for another open issue. */
async function myBlockedIssues (client: any, me: string): Promise<string[]> {
  const mineOpen: any[] = (await client.findAll(tracker.class.Issue, { assignee: me })).filter((i: any) => (i.blockedBy ?? []).length > 0)
  if (mineOpen.length === 0) return []
  const blockerIds = [...new Set(mineOpen.flatMap((i) => (i.blockedBy as any[]).map((b) => b._id ?? b)))]
  const [blockers, statuses]: any[][] = await Promise.all([
    client.findAll(tracker.class.Issue, { _id: { $in: blockerIds } }),
    client.findAll('core:class:Status', {})
  ])
  const closed = new Set(statuses.filter((s) => s.category === task.statusCategory.Won || s.category === task.statusCategory.Lost).map((s) => s._id))
  const out: string[] = []
  for (const i of mineOpen) {
    if (closed.has(i.status)) continue
    const open = (i.blockedBy as any[]).map((b) => blockers.find((x) => x._id === (b._id ?? b))).filter((b) => b != null && !closed.has(b.status))
    if (open.length > 0) out.push(`- **${String(i.identifier)}** ${String(i.title)} — waits for ${open.map((b) => `${String(b.identifier)}`).join(', ')}`)
  }
  return out
}

// ── Inbox triage: per unread object, what happened since I last looked ──

/** One-line plain text of a comment: no HTML (bot comments), no entities, collapsed whitespace. */
export const plain = (markup: string): string => markupToText(markup).replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()

export const triageInbox = wrapToolHandler<z.infer<typeof S.TriageInboxSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const uuid = await currentAccountUuid(client)
  const limit = args.limit ?? 10
  const unread: any[] = await client.findAll(C.InboxNotification, { user: uuid, isViewed: false, archived: false }, { sort: { createdOn: SortingOrder.Descending }, limit: 500 })
  if (unread.length === 0) return 'Inbox zero — nothing unread.'
  const groups = new Map<string, any[]>()
  for (const n of unread) groups.set(n.docNotifyContext, [...(groups.get(n.docNotifyContext) ?? []), n])
  const ctxIds = [...groups.keys()].slice(0, limit)
  const ctxs: any[] = await client.findAll(C.DocNotifyContext, { _id: { $in: ctxIds } })
  const statuses = new Map(((await client.findAll('core:class:Status', {})) as any[]).map((s) => [s._id, s.name]))
  const names = await peopleNames(client)

  const out: string[] = [`# Inbox triage — ${unread.length}${unread.length === 500 ? '+' : ''} unread on ${groups.size} item(s)${groups.size > limit ? `, newest ${limit} shown` : ''}`]
  for (const ctxId of ctxIds) {
    const notes = groups.get(ctxId)!
    const ctx = ctxs.find((c) => c._id === ctxId)
    const objectId = ctx?.objectId ?? notes[0].objectId
    const objectClass = ctx?.objectClass ?? notes[0].objectClass
    // Since I last looked: the context's lastViewedTimestamp, else just before the oldest unread.
    const since = ctx?.lastViewedTimestamp ?? Math.min(...notes.map((n) => n.createdOn ?? Date.now())) - 1
    const [doc, found]: [any, any[]] = await Promise.all([
      objectClass != null ? client.findOne(objectClass, { _id: objectId }) : undefined,
      client.findAll(C.ActivityMessage, { attachedTo: objectId, createdOn: { $gt: since } }, { sort: { createdOn: SortingOrder.Descending }, limit: 50 })
    ])
    const msgs = found.filter((m) => (m.createdOn ?? 0) > since).sort((a, b) => (b.createdOn ?? 0) - (a.createdOn ?? 0))
    const label = objectClass != null ? await loadLabel(client, objectClass, objectId) : '(unknown)'
    const state = doc?.status != null ? ` — ${String(statuses.get(doc.status) ?? '?')}${doc.assignee != null ? ` · ${names.get(doc.assignee) ?? '?'}` : ''}` : ''
    out.push('', `## ${label}${state} (${notes.length} unread)`)
    const who = await socialIdNames(client, [...new Set(msgs.map((m) => m.createdBy).filter((x) => x != null))])
    // Only real comments (ChatMessage and derived); activity-info messages carry a label id as "message".
    const h = client.getHierarchy()
    const comments = msgs.filter((m) => typeof m.message === 'string' && (m._class === 'chunter:class:ChatMessage' || h.isDerived(m._class, 'chunter:class:ChatMessage')))
    const fields = [...new Set(msgs.filter((m) => m._class === C.DocUpdateMessage).map((m) => m.action === 'create' ? 'created' : m.attributeUpdates?.attrKey === 'attachedTo' ? 'parent' : m.attributeUpdates?.attrKey).filter((k) => k != null && !['rank', 'subIssues', 'comments', 'modifiedOn'].includes(k)))]
    if (fields.length > 0) out.push(`- changed: ${fields.join(', ')}`)
    for (const m of comments.slice(0, 3).reverse()) out.push(`- 💬 **${who.get(m.createdBy) ?? '?'}**: ${clip(plain(m.message), 200, 'list_comments')}`)
    if (comments.length > 3) out.push(`- _${comments.length - 3} older new comment(s)_`)
    if (fields.length === 0 && comments.length === 0) out.push('- (no details recorded)')
  }
  out.push('', '_Done with an item? mark_notifications_read with its id (e.g. PROJ-12)._')
  return out.join('\n')
})

// ── Release notes from a milestone ──

const FIX = /\b(bug|fix|fixes|fixed|hotfix|regression|crash|security|fehler|bugfix|absturz|stürzt|behoben|reparier\w*|sicherheit)\b/i

export const releaseNotes = wrapToolHandler<z.infer<typeof S.ReleaseNotesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)
  const milestones: any[] = await client.findAll(tracker.class.Milestone, { space: project._id })
  const ms = milestones.find((m) => String(m.label).toLowerCase() === args.milestoneLabel.trim().toLowerCase())
  if (ms == null) throw new Error(`Milestone '${args.milestoneLabel}' not found. Milestones: ${milestones.map((m) => m.label).join(', ') || 'none'}.`)
  const all: any[] = await client.findAll(tracker.class.Issue, { space: project._id, milestone: ms._id })
  const issues = all.filter((i) => i._class !== C.PullRequest)
  const ids = issues.map((i) => i._id)
  const [statuses, labels, prs]: any[][] = await Promise.all([
    client.findAll('core:class:Status', {}),
    ids.length > 0 ? client.findAll('tags:class:TagReference', { attachedTo: { $in: ids } }) : [],
    ids.length > 0 ? client.findAll(C.PullRequest, { attachedTo: { $in: ids } }) : []
  ])
  const cat = new Map(statuses.map((s) => [s._id, s.category]))
  // Epics (issues with sub-issues) are containers; their children are listed instead.
  const done = issues.filter((i) => cat.get(i.status) === task.statusCategory.Won && (i.subIssues ?? 0) === 0)
  const open = issues.filter((i) => cat.get(i.status) !== task.statusCategory.Won && cat.get(i.status) !== task.statusCategory.Lost)
  const isFix = (i: any): boolean => FIX.test(String(i.title)) || labels.some((l) => l.attachedTo === i._id && FIX.test(String(l.title)))
  const pr = (i: any): string => {
    const nums = prs.filter((p) => p.attachedTo === i._id && p.state === 2).map((p) => `#${String(p['github:mixin:GithubIssue']?.githubNumber ?? p.identifier)}`)
    return nums.length > 0 ? ` (${nums.join(', ')})` : ''
  }
  const line = (i: any): string => `- ${String(i.title)} — ${String(i.identifier)}${pr(i)}`
  const out = [`# ${String(ms.label)}${ms.targetDate != null ? ` — ${day(ms.targetDate)}` : ''}`]
  const features = done.filter((i) => !isFix(i))
  const fixes = done.filter(isFix)
  if (features.length > 0) out.push('', '## New and changed', ...features.map(line))
  if (fixes.length > 0) out.push('', '## Fixes', ...fixes.map(line))
  if (done.length === 0) out.push('', 'Nothing done in this milestone yet.')
  if (open.length > 0) out.push('', `## Still open (${open.length}) — not part of the notes`, ...open.slice(0, 15).map((i) => `- ${String(i.identifier)} ${String(i.title)}`))
  return out.join('\n')
})
