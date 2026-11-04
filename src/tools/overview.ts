// Overviews that combine several modules in one call: "my day" (calendar, to-dos, my issues,
// reviews, inbox) so Claude can answer "what's on today?" without five round trips.
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C, TODO_PRIORITY, TODO_PRIORITY_LABEL } from '../utils/classes'
import { priorityLabel } from '../utils/format'
import { currentAccountUuid, currentPerson } from '../utils/people'
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
  const open = issues.filter((i) => !closed.has(st.get(i.status)?.category))
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
