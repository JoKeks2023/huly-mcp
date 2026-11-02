import tracker from '@hcengineering/tracker'
import { currentPerson, findPerson, peopleNames } from '../utils/people'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate } from '../utils/format'
import type { z } from 'zod'
import type { LogTimeSchema, ListTimeReportsSchema } from '../schemas'
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
