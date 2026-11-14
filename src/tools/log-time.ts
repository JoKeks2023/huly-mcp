import tracker from '@hcengineering/tracker'
import { currentPerson, findPerson, peopleNames } from '../utils/people'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate } from '../utils/format'
import type { z } from 'zod'
import type { LogTimeSchema, ListTimeReportsSchema, TimesheetSchema } from '../schemas'
import { generateId } from '@hcengineering/core'

export const logTime = wrapToolHandler<z.infer<typeof LogTimeSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  // Time is booked on the person behind the connected account.
  const me = await currentPerson(client)

  const now = new Date().getTime()
  const valueInHours = args.hours

  await client.addCollection(
    tracker.class.TimeSpendReport,
    issue.space,
    issue._id,
    tracker.class.Issue,
    'reports',
    {
      employee: me._id as unknown as any,
      date: now,
      value: valueInHours,
      description: args.description ?? ''
    },
    generateId()
  )

  return `✅ Logged **${args.hours}h** on **${args.identifier}**${args.description ? ` — "${args.description}"` : ''}`
})

export const listTimeReports = wrapToolHandler<z.infer<typeof ListTimeReportsSchema>>(async (args) => {
  if ((args.identifier == null) === (args.projectIdentifier == null)) {
    throw new Error('Pass exactly one of identifier (issue) or projectIdentifier.')
  }
  const client = await getConnection(args.workspace)

  const query: Record<string, unknown> = {}
  let scope: string
  if (args.identifier != null) {
    const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
    if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)
    query.attachedTo = issue._id
    scope = args.identifier
  } else {
    const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
    if (project == null) throw new Error(`Project '${args.projectIdentifier as string}' not found.`)
    query.space = project._id
    scope = args.projectIdentifier as string
  }

  const nameOf = await peopleNames(client)
  if (args.member != null) query.employee = (await findPerson(client, args.member))._id

  const parse = (v: string | undefined, end: boolean): number | undefined => {
    if (v == null) return undefined
    const d = new Date(v)
    if (isNaN(d.getTime())) throw new Error(`Invalid date: '${v}'`)
    // A bare date as upper bound includes that whole day.
    return end && /^\d{4}-\d{2}-\d{2}$/.test(v) ? d.getTime() + 86_400_000 - 1 : d.getTime()
  }
  const from = parse(args.from, false)
  const to = parse(args.to, true)

  const all = await client.findAll(tracker.class.TimeSpendReport, query as any)
  const reports = all
    .filter((r) => (from == null || (r.date ?? 0) >= from) && (to == null || (r.date ?? 0) <= to))
    .sort((a, b) => (b.date ?? 0) - (a.date ?? 0))
  if (reports.length === 0) return `No time reports found for ${scope}.`

  const issueIds = [...new Set(reports.map((r) => r.attachedTo as string))]
  const issues = await client.findAll(tracker.class.Issue, { _id: { $in: issueIds } } as any)
  const issueId = new Map(issues.map((i) => [i._id as string, i.identifier]))

  const totalHours = reports.reduce((sum, r) => sum + (r.value ?? 0), 0)
  const byMember = new Map<string, number>()
  for (const r of reports) {
    const who = r.employee != null ? nameOf.get(r.employee as string) ?? String(r.employee) : 'Unknown'
    byMember.set(who, (byMember.get(who) ?? 0) + (r.value ?? 0))
  }

  const shown = reports.slice(0, args.limit)
  const lines = shown.map((r) => {
    const who = r.employee != null ? nameOf.get(r.employee as string) ?? String(r.employee) : 'Unknown'
    const note = r.description !== '' ? ` — ${r.description}` : ''
    return `- ${formatDate(r.date)} **${r.value}h** ${issueId.get(r.attachedTo as string) ?? ''} (${who})${note}`
  })
  const perMember = [...byMember.entries()].map(([who, h]) => `${who}: ${Math.round(h * 100) / 100}h`).join(', ')

  return [
    `## Time reports for ${scope}`,
    `**Total:** ${Math.round(totalHours * 100) / 100}h in ${reports.length} report(s) — ${perMember}`,
    '',
    ...lines,
    reports.length > shown.length ? `\n_${reports.length - shown.length} more not shown (raise limit)._` : ''
  ].filter((l, i, a) => !(l === '' && i === a.length - 1)).join('\n')
})

// ── Timesheet: one week by day and project, gaps marked ─────────────────────────

const DAY_MS = 86_400_000
const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Monday 00:00 (local) of the week that contains `date`. */
export function weekStart (date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const back = (d.getDay() + 6) % 7
  return d.getTime() - back * DAY_MS
}

export const timesheet = wrapToolHandler<z.infer<typeof TimesheetSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const ref = args.week != null ? new Date(args.week) : new Date()
  if (isNaN(ref.getTime())) throw new Error(`Invalid date: '${args.week}'`)
  const start = weekStart(ref)
  const days = Array.from({ length: 7 }, (_, i) => start + i * DAY_MS)
  const end = start + 7 * DAY_MS - 1
  const nameOf = await peopleNames(client)
  const query: Record<string, unknown> = {}
  let who = 'everyone'
  if (args.everyone !== true) {
    const person = args.member != null ? await findPerson(client, args.member) : await currentPerson(client)
    query.employee = person._id
    who = person.name
  }
  const reports = (await client.findAll(tracker.class.TimeSpendReport, query as any)).filter((r) => (r.date ?? 0) >= start && (r.date ?? 0) <= end)
  const issues = reports.length > 0 ? await client.findAll(tracker.class.Issue, { _id: { $in: [...new Set(reports.map((r) => r.attachedTo as string))] } } as any) : []
  const projects = await client.findAll(tracker.class.Project, {})
  const projectOf = new Map(issues.map((i) => [i._id as string, projects.find((p) => p._id === i.space)?.identifier ?? '?']))
  const dayOf = (t: number): number => Math.floor((t - start) / DAY_MS)
  // Local dates: the week starts at local midnight, which is the previous day in UTC east of Greenwich.
  const ymd = (t: number): string => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const label = (t: number): string => `${WEEKDAY[(new Date(t).getDay() + 6) % 7]} ${ymd(t).slice(5)}`
  const rowKey = (r: any): string => args.everyone === true ? (nameOf.get(r.employee as string) ?? '?') : (projectOf.get(r.attachedTo as string) ?? '?')
  const rows = new Map<string, number[]>()
  for (const r of reports) {
    const d = dayOf(r.date ?? 0)
    if (d < 0 || d > 6) continue
    const row = rows.get(rowKey(r)) ?? Array(7).fill(0)
    row[d] += r.value ?? 0
    rows.set(rowKey(r), row)
  }
  const fmt = (h: number): string => h === 0 ? '·' : String(Math.round(h * 100) / 100)
  const totals = Array(7).fill(0).map((_, d) => [...rows.values()].reduce((s, row) => s + row[d], 0))
  const header = `| ${args.everyone === true ? 'Person' : 'Project'} | ${days.map(label).join(' | ')} | Σ |`
  const lines = [header, `|---|${days.map(() => '--:').join('|')}|--:|`]
  for (const [key, row] of [...rows.entries()].sort((a, b) => a[0].localeCompare(b[0]))) lines.push(`| ${key} | ${row.map(fmt).join(' | ')} | **${fmt(row.reduce((s, h) => s + h, 0))}** |`)
  lines.push(`| **Total** | ${totals.map((h) => `**${fmt(h)}**`).join(' | ')} | **${fmt(totals.reduce((s, h) => s + h, 0))}** |`)
  // Gaps: past and current workdays below the expected hours (one person only).
  const expected = args.hoursPerDay ?? 8
  const today = Date.now()
  const gaps = args.everyone === true || reports.length === 0 ? [] : days.slice(0, 5).map((t, d) => ({ t, h: totals[d] })).filter((x) => x.t <= today && x.h < expected).map((x) => `${label(x.t)} (${fmt(x.h) === '·' ? '0' : fmt(x.h)}h of ${expected}h)`)
  return [`## Timesheet ${ymd(start)} – ${ymd(start + 6 * DAY_MS)} — ${who}`, '', ...lines,
    ...(gaps.length > 0 ? ['', `**Gaps:** ${gaps.join(', ')} — log_time to fill them.`] : []),
    ...(reports.length === 0 ? ['', '_No time logged this week._'] : [])].join('\n')
})
