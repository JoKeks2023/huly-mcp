// Test coverage per milestone and a release readiness check. Issues link test cases through their
// "Related" list (issue.relations with testManagement:class:TestCase), as Huly's UI and
// create_issue_from_test_result do; the latest TestResult per case is its current state.
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { SortingOrder } from '@hcengineering/core'
import type { z } from 'zod'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate } from '../utils/format'
import { findByLabel } from '../utils/labels'
import { C } from '../utils/classes'
import { TM, RESULT_STATUSES } from './testing'
import type * as S from '../schemas'

const caseIdsOf = (issue: any): string[] => (issue.relations ?? []).filter((r: any) => r._class === TM.Case).map((r: any) => String(r._id))

interface Coverage {
  issues: any[]
  statusName: Map<string, string>
  closed: Set<string>
  cases: Map<string, any>
  latest: Map<string, any>
}

async function coverageData (client: any, projectIdentifier: string, milestoneLabel?: string): Promise<Coverage & { project: any, milestone?: any }> {
  const project = await client.findOne(tracker.class.Project, { identifier: projectIdentifier })
  if (project == null) throw new Error(`Project '${projectIdentifier}' not found.`)
  const milestone = milestoneLabel != null ? await findByLabel(client, 'milestone', project._id, milestoneLabel, projectIdentifier) : undefined
  const issues: any[] = (await client.findAll(tracker.class.Issue, { space: project._id, ...(milestone != null ? { milestone: milestone._id } : {}) }, { sort: { rank: SortingOrder.Ascending } }))
  const statuses: any[] = await client.findAll(tracker.class.IssueStatus, {})
  const closed = new Set(statuses.filter((s) => s.category === task.statusCategory.Won || s.category === task.statusCategory.Lost).map((s) => String(s._id)))
  const ids = [...new Set(issues.flatMap(caseIdsOf))]
  const cases = new Map<string, any>((ids.length > 0 ? await client.findAll(TM.Case, { _id: { $in: ids } }) : []).map((c: any) => [String(c._id), c]))
  const results: any[] = ids.length > 0 ? await client.findAll(TM.Result, { testCase: { $in: ids } }, { sort: { modifiedOn: SortingOrder.Descending } }) : []
  const latest = new Map<string, any>()
  for (const r of results) if (!latest.has(String(r.testCase))) latest.set(String(r.testCase), r)
  return { project, milestone, issues, statusName: new Map(statuses.map((s) => [String(s._id), s.name])), closed, cases, latest }
}

const resultName = (r: any): string => r == null ? 'never run' : RESULT_STATUSES[r.status] ?? String(r.status)
const mark = (r: any): string => r == null ? '⚪' : r.status === 2 ? '✅' : r.status === 3 ? '❌' : r.status === 1 ? '⛔' : '⚪'

export const testCoverage = wrapToolHandler<z.infer<typeof S.TestCoverageSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const d = await coverageData(client, args.projectIdentifier, args.milestoneLabel)
  const scope = d.issues.filter((i) => args.onlyOpen !== true || !d.closed.has(String(i.status)))
  if (scope.length === 0) return `No issues in ${args.projectIdentifier}${d.milestone != null ? ` / ${String(d.milestone.label)}` : ''}.`
  const covered = scope.filter((i) => caseIdsOf(i).some((id) => d.cases.has(id)))
  const uncovered = scope.filter((i) => !covered.includes(i))
  const caseStates = covered.flatMap((i) => caseIdsOf(i).filter((id) => d.cases.has(id)).map((id) => d.latest.get(id)))
  const failing = caseStates.filter((r) => r?.status === 3).length
  const never = caseStates.filter((r) => r == null).length
  const out = [`## Test coverage — ${args.projectIdentifier}${d.milestone != null ? ` / ${String(d.milestone.label)}` : ''}`,
    `${covered.length}/${scope.length} issues have test cases · ${failing} failing · ${never} never run`]
  if (uncovered.length > 0) {
    out.push('', `### Without test cases (${uncovered.length})`)
    for (const i of uncovered.slice(0, 40)) out.push(`- **${String(i.identifier)}** ${String(i.title)} — ${d.statusName.get(String(i.status)) ?? '?'}`)
    if (uncovered.length > 40) out.push(`- … ${uncovered.length - 40} more`)
  }
  if (covered.length > 0) {
    out.push('', `### Covered (${covered.length})`)
    for (const i of covered) {
      const parts = caseIdsOf(i).filter((id) => d.cases.has(id)).map((id) => { const r = d.latest.get(id); return `${mark(r)} ${String(d.cases.get(id).name)} (${resultName(r)}${r != null ? `, ${formatDate(r.modifiedOn)}` : ''})` })
      out.push(`- **${String(i.identifier)}** ${String(i.title)} — ${parts.join(' · ')}`)
    }
  }
  out.push('', '_Link a case: link_test_case. Run them: create_test_run._')
  return out.join('\n')
})

export const linkTestCase = wrapToolHandler<z.infer<typeof S.LinkTestCaseSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)
  let tc = await client.findOne(TM.Case, { _id: args.testCase })
  if (tc == null) {
    const named: any[] = (await client.findAll(TM.Case, {})).filter((c: any) => String(c.name).toLowerCase() === args.testCase.trim().toLowerCase())
    if (named.length > 1) throw new Error(`Test case name '${args.testCase}' is ambiguous (${named.length} cases) — pass its id (list_test_cases).`)
    tc = named[0]
  }
  if (tc == null) throw new Error(`Test case '${args.testCase}' not found (id or exact name; list_test_cases).`)
  if (caseIdsOf(issue).includes(String(tc._id))) return `**${args.identifier}** is already linked to "${String(tc.name)}".`
  await client.updateDoc(tracker.class.Issue, issue.space, issue._id, { relations: [...(issue.relations ?? []), { _id: tc._id, _class: TM.Case }] })
  return `✅ **${args.identifier}** ↔ test case "${String(tc.name)}" (in the issue's Related list).`
})

export const releaseCheck = wrapToolHandler<z.infer<typeof S.ReleaseCheckSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const d = await coverageData(client, args.projectIdentifier, args.milestoneLabel)
  const ms = d.milestone
  const open = d.issues.filter((i) => !d.closed.has(String(i.status)))
  const done = d.issues.length - open.length
  // Blockers: open issues of the release that wait for an issue that is still open (anywhere).
  const blockerIds = [...new Set(open.flatMap((i) => (i.blockedBy ?? []).map((b: any) => String(b._id))))]
  const blockers = new Map<string, any>((blockerIds.length > 0 ? await client.findAll(tracker.class.Issue, { _id: { $in: blockerIds } }) : []).map((b: any) => [String(b._id), b]))
  const blocked = open.map((i) => ({ i, by: (i.blockedBy ?? []).map((b: any) => blockers.get(String(b._id))).filter((b: any) => b != null && !d.closed.has(String(b.status))) })).filter((x) => x.by.length > 0)
  const prs: any[] = d.issues.length > 0 ? await client.findAll(C.PullRequest, { attachedTo: { $in: d.issues.map((i) => i._id) } }) : []
  const openPrs = prs.filter((p) => p.state === 0 || p.state === 'open')
  const doneIssues = d.issues.filter((i) => d.closed.has(String(i.status)))
  const untested = doneIssues.filter((i) => !caseIdsOf(i).some((id) => d.cases.has(id)))
  const caseRows = [...new Set(d.issues.flatMap(caseIdsOf))].filter((id) => d.cases.has(id)).map((id) => ({ c: d.cases.get(id), r: d.latest.get(id) }))
  const failing = caseRows.filter((x) => x.r?.status === 3)
  const blockedTests = caseRows.filter((x) => x.r?.status === 1)
  const neverRun = caseRows.filter((x) => x.r == null)
  const overdue = ms?.targetDate != null && ms.targetDate < Date.now() && ms.status !== 2

  const reasons: string[] = []
  if (open.length > 0) reasons.push(`${open.length} open issue(s)`)
  if (blocked.length > 0) reasons.push(`${blocked.length} blocked`)
  if (openPrs.length > 0) reasons.push(`${openPrs.length} open PR(s)`)
  if (failing.length > 0) reasons.push(`${failing.length} failing test(s)`)
  if (blockedTests.length > 0) reasons.push(`${blockedTests.length} blocked test(s)`)
  const warnings: string[] = []
  if (untested.length > 0) warnings.push(`${untested.length} done issue(s) without test cases`)
  if (neverRun.length > 0) warnings.push(`${neverRun.length} linked test case(s) never run`)
  if (overdue) warnings.push(`target date ${formatDate(ms.targetDate)} has passed`)

  const out = [`## Release check — ${args.projectIdentifier} / ${String(ms?.label ?? args.milestoneLabel)}`,
    reasons.length === 0 ? `**✅ Ready**${warnings.length > 0 ? ` — but ${warnings.join(', ')}` : ''}` : `**❌ Not ready:** ${reasons.join(', ')}${warnings.length > 0 ? ` · also ${warnings.join(', ')}` : ''}`,
    `${done}/${d.issues.length} issues done${ms?.targetDate != null ? ` · target ${formatDate(ms.targetDate)}` : ''}`]
  const list = (title: string, rows: string[]): void => { if (rows.length > 0) out.push('', `### ${title} (${rows.length})`, ...rows.slice(0, 25), ...(rows.length > 25 ? [`- … ${rows.length - 25} more`] : [])) }
  list('Open issues', open.map((i) => `- **${String(i.identifier)}** ${String(i.title)} — ${d.statusName.get(String(i.status)) ?? '?'}`))
  list('Blocked', blocked.map((x) => `- **${String(x.i.identifier)}** waits for ${x.by.map((b: any) => String(b.identifier)).join(', ')}`))
  list('Open PRs', openPrs.map((p) => `- **${String(p.identifier)}** ${String(p.title)}`))
  list('Failing tests', failing.map((x) => `- ❌ ${String(x.c.name)} (${formatDate(x.r.modifiedOn)})`))
  list('Blocked tests', blockedTests.map((x) => `- ⛔ ${String(x.c.name)}`))
  list('Done without test cases', untested.map((i) => `- **${String(i.identifier)}** ${String(i.title)}`))
  out.push('', '_Release notes: release_notes. Coverage details: test_coverage._')
  return out.join('\n')
})
