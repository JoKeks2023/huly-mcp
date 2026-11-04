// Overviews that combine several modules in one call: "my day" (calendar, to-dos, my issues,
// reviews, inbox) so Claude can answer "what's on today?" without five round trips, and a
// project report for a period (weekly report).
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C, TODO_PRIORITY, TODO_PRIORITY_LABEL } from '../utils/classes'
import { priorityLabel } from '../utils/format'
import { currentAccountUuid, currentPerson, peopleNames } from '../utils/people'
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

export const myDay = wrapToolHandler<z.infer<typeof S.MyDaySchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const limit = args.limit ?? 10
  const from = dayStart(args.date)
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
  if (groups.size > limit) out.push(`_${groups.size - limit} more — list_notifications._`)
  return out.join('\n')
})

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
