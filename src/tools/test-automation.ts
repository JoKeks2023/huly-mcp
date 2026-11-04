// Test management beyond clicking: CI results in (JUnit XML), bugs out of failed results, a report
// over recent runs (failing now, flaky, never run) and bulk case creation.
import { readFile } from 'node:fs/promises'
import { generateId, SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { readMarkup, writeMarkup } from '../utils/content'
import { findPerson } from '../utils/people'
import { parseJUnit, type JUnitCase } from '../utils/junit'
import { TM, findProject, findSuite, findDoc, idx, name, CASE_TYPES, CASE_PRIORITIES, RESULT_STATUSES } from './testing'
import { createIssue, updateIssue } from './issues'
import type { z } from 'zod'
import type * as S from '../schemas'

const MAX_DETAILS = 4000
const UNTESTED = 0; const BLOCKED = 1; const PASSED = 2; const FAILED = 3

export interface ImportOptions {
  workspace?: string
  project: string
  xml: string
  runName?: string
  parentSuite?: string
  createMissing?: boolean
  dryRun?: boolean
}

export interface ImportSummary { text: string, passed: number, failed: number, skipped: number, created: number, unmatched: number, runId?: string }

const resultComment = (c: JUnitCase): string | undefined => {
  if (c.status === 'passed') return undefined
  const parts = [c.status === 'skipped' ? `Skipped${c.message != null ? `: ${c.message}` : ''}` : `**${c.message ?? 'Failed'}**`]
  if (c.details != null) parts.push('```\n' + (c.details.length > MAX_DETAILS ? c.details.slice(0, MAX_DETAILS) + '\n… (truncated)' : c.details) + '\n```')
  if (c.time != null) parts.push(`Duration: ${c.time.toFixed(2)} s`)
  return parts.join('\n\n')
}

/** Imports JUnit XML as a new test run; one Huly suite per JUnit suite (under parentSuite, if given). */
export async function importJUnit (o: ImportOptions): Promise<ImportSummary> {
  const cases = parseJUnit(o.xml)
  if (cases.length === 0) throw new Error('The report contains no test cases.')
  const client: any = await getConnection(o.workspace)
  const project = await findProject(client, o.project)
  const parent = o.parentSuite != null ? await findSuite(client, project, o.parentSuite) : undefined
  const parentId: string = parent?._id ?? TM.NoParent
  const create = o.createMissing !== false
  const suites: any[] = await client.findAll(TM.Suite, { space: project._id, parent: parentId })
  const existing: any[] = await client.findAll(TM.Case, { space: project._id })
  const suiteIds = new Map<string, string | undefined>()
  for (const sName of new Set(cases.map((c) => c.suite))) suiteIds.set(sName, suites.find((s) => String(s.name).toLowerCase() === sName.toLowerCase())?._id)

  const plan: Array<{ c: JUnitCase, caseId?: string, isNew: boolean }> = cases.map((c) => {
    const sid = suiteIds.get(c.suite)
    const hit = sid != null ? existing.find((x) => x.attachedTo === sid && String(x.name).toLowerCase() === c.name.toLowerCase()) : undefined
    return { c, caseId: hit?._id, isNew: hit == null }
  })
  const missing = plan.filter((p) => p.isNew)
  const newSuites = [...suiteIds].filter(([, id]) => id == null).map(([s]) => s)
  const count = (s: JUnitCase['status']): number => cases.filter((c) => c.status === s).length
  const summary: ImportSummary = { text: '', passed: count('passed'), failed: count('failed'), skipped: count('skipped'), created: create ? missing.length : 0, unmatched: create ? 0 : missing.length }
  const runName = o.runName ?? `CI ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
  const head = `${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`

  if (o.dryRun === true) {
    summary.text = [`Dry run: would create run **${runName}** in ${String(project.name)} — ${head}.`,
      create ? `Would create ${newSuites.length} suite(s) and ${missing.length} case(s).` : `${missing.length} case(s) have no match and would be left out (createMissing: false).`,
      'Nothing was changed.'].join('\n')
    return summary
  }
  if (!create && missing.length === cases.length) throw new Error(`None of the ${cases.length} test(s) match a case in ${String(project.name)} — import with createMissing: true.`)

  for (const s of newSuites) {
    if (!create) continue
    suiteIds.set(s, await client.createDoc(TM.Suite, project._id, { name: s, description: '', parent: parentId }))
  }
  if (create) {
    for (const p of missing) {
      const sid = suiteIds.get(p.c.suite)!
      p.caseId = await client.addCollection(TM.Case, project._id, sid, TM.Suite, 'testCases', {
        name: p.c.name, description: null, type: idx(CASE_TYPES, 'Regression'), priority: idx(CASE_PRIORITIES, 'Medium'), status: 3 /* Approved */, assignee: null, attachments: 0
      })
    }
  }
  const runId = await client.createDoc(TM.Run, project._id, { name: runName, description: null })
  for (const p of plan) {
    if (p.caseId == null) continue
    const comment = resultComment(p.c)
    await client.addCollection(TM.Result, project._id, runId, TM.Run, 'results', {
      name: p.c.name,
      testCase: p.caseId,
      testSuite: suiteIds.get(p.c.suite),
      description: comment != null ? await writeMarkup(o.workspace, `testresult-${generateId()}`, comment) : null,
      status: p.c.status === 'passed' ? PASSED : p.c.status === 'failed' ? FAILED : UNTESTED,
      assignee: null
    })
  }
  summary.runId = runId
  const failed = cases.filter((c) => c.status === 'failed').slice(0, 15).map((c) => `- ❌ ${c.suite} › ${c.name}${c.message != null ? ` — ${c.message.slice(0, 160)}` : ''}`)
  summary.text = [
    `✅ Run **${runName}** imported into ${String(project.name)} — ${head} — \`${runId}\``,
    create && missing.length > 0 ? `Created ${newSuites.length} suite(s) and ${missing.length} new case(s).` : '',
    !create && missing.length > 0 ? `⚠️ ${missing.length} test(s) without a matching case were left out.` : '',
    failed.length > 0 ? `\n### Failed\n${failed.join('\n')}${summary.failed > 15 ? `\n… ${summary.failed - 15} more` : ''}` : ''
  ].filter((x) => x !== '').join('\n')
  return summary
}

export const importTestResults = wrapToolHandler<z.infer<typeof S.ImportTestResultsSchema>>(async (args) => {
  if ((args.xml == null) === (args.file == null)) throw new Error('Pass either xml (the report) or file (a path on the machine running this server).')
  const xml = args.xml ?? await readFile(args.file!, 'utf8')
  return (await importJUnit({ workspace: args.workspace, project: args.project, xml, runName: args.runName, parentSuite: args.parentSuite, createMissing: args.createMissing, dryRun: args.dryRun })).text
})

const SYMBOL = ['·', '⛔', '✅', '❌']

export const getTestReport = wrapToolHandler<z.infer<typeof S.GetTestReportSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  const runs: any[] = (await client.findAll(TM.Run, { space: project._id }, { sort: { createdOn: SortingOrder.Descending }, limit: args.runs ?? 10 })).sort((a: any, b: any) => Number(a.createdOn ?? 0) - Number(b.createdOn ?? 0))
  const cases: any[] = await client.findAll(TM.Case, { space: project._id })
  const suites: any[] = await client.findAll(TM.Suite, { space: project._id })
  if (cases.length === 0) return `No test cases in ${String(project.name)}.`
  const results: any[] = runs.length > 0 ? await client.findAll(TM.Result, { attachedTo: { $in: runs.map((r) => r._id) } }) : []
  const history = new Map<string, number[]>()
  for (const r of runs) {
    for (const res of results.filter((x) => x.attachedTo === r._id)) {
      const h = history.get(res.testCase) ?? []
      h.push(res.status ?? UNTESTED)
      history.set(res.testCase, h)
    }
  }
  const suiteName = (id: string): string => String(suites.find((s) => s._id === id)?.name ?? '?')
  const label = (c: any): string => `${suiteName(c.attachedTo)} › ${String(c.name)}`
  const tested = (h: number[] | undefined): number[] => (h ?? []).filter((s) => s === PASSED || s === FAILED)
  const switches = (h: number[]): number => h.slice(1).filter((s, i) => s !== h[i]).length
  const latest = (c: any): number | undefined => tested(history.get(c._id)).at(-1)
  const failing = cases.filter((c) => latest(c) === FAILED)
  const flaky = cases.filter((c) => switches(tested(history.get(c._id))) >= 2)
  const never = cases.filter((c) => tested(history.get(c._id)).length === 0)
  const blocked = cases.filter((c) => (history.get(c._id) ?? []).at(-1) === BLOCKED)
  const withLatest = cases.filter((c) => latest(c) != null)
  const rate = withLatest.length > 0 ? Math.round(100 * withLatest.filter((c) => latest(c) === PASSED).length / withLatest.length) : undefined
  const line = (c: any): string => `- ${label(c)} ${(history.get(c._id) ?? []).map((s) => SYMBOL[s] ?? '?').join('')} — \`${String(c._id)}\``
  const max = args.limit ?? 25
  const section = (title: string, list: any[]): string[] => list.length === 0 ? [] : ['', `### ${title} (${list.length})`, ...list.slice(0, max).map(line), ...(list.length > max ? [`… ${list.length - max} more`] : [])]
  const bySuite = suites.map((s) => {
    const mine = cases.filter((c) => c.attachedTo === s._id)
    if (mine.length === 0) return undefined
    const p = mine.filter((c) => latest(c) === PASSED).length; const f = mine.filter((c) => latest(c) === FAILED).length
    return `| ${String(s.name)} | ${mine.length} | ${p} | ${f} | ${mine.length - p - f} |`
  }).filter((x) => x != null)
  return [
    `## Test report: ${String(project.name)}`,
    `${cases.length} case(s) · last ${runs.length} run(s)${runs.length > 0 ? ` (${String(runs[0].name)} → ${String(runs.at(-1).name)})` : ''} · pass rate of latest results: ${rate != null ? `${rate}%` : '—'}`,
    'History oldest → newest: ✅ passed ❌ failed ⛔ blocked · untested',
    ...section('Failing now', failing),
    ...section('Flaky (flipped between pass and fail at least twice)', flaky),
    ...section('Blocked in the latest run', blocked),
    ...section('Never run in these runs', never),
    ...(bySuite.length > 0 ? ['', '### By suite (latest result)', '| Suite | Cases | Passed | Failed | Not run |', '|---|---|---|---|---|', ...bySuite] : [])
  ].join('\n')
})

export const createIssueFromTestResult = wrapToolHandler<z.infer<typeof S.CreateIssueFromTestResultSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const result = await findDoc(client, TM.Result, args.result, 'Test result')
  const testCase = await client.findOne(TM.Case, { _id: result.testCase })
  const run = await client.findOne(TM.Run, { _id: result.attachedTo })
  const steps = testCase != null ? await readMarkup(args.workspace, testCase.description) : ''
  const outcome = await readMarkup(args.workspace, result.description)
  const description = [
    `Test **${String(result.name)}** ${name(RESULT_STATUSES, result.status ?? UNTESTED).toLowerCase()} in run "${String(run?.name ?? '?')}".`,
    steps.trim() !== '' ? `## Steps\n\n${steps}` : '',
    outcome.trim() !== '' ? `## Result\n\n${outcome}` : '',
    args.notes != null ? `## Notes\n\n${args.notes}` : ''
  ].filter((x) => x !== '').join('\n\n')
  const created = (await createIssue({ workspace: args.workspace, projectIdentifier: args.projectIdentifier, title: args.title ?? `Test failed: ${String(result.name)}`, description, priority: args.priority ?? 'High' } as any)).content[0].text
  const identifier = /\*\*([A-Z0-9]+-\d+)\*\*/.exec(created)?.[1]
  if (identifier == null) throw new Error(`Issue created, but its identifier could not be read: ${created}`)
  const extra: string[] = []
  if (args.componentLabel != null || args.milestoneLabel != null || args.assignee != null) {
    await updateIssue({ workspace: args.workspace, identifier, componentLabel: args.componentLabel, milestoneLabel: args.milestoneLabel, assignee: args.assignee } as any)
    extra.push(...[args.componentLabel != null ? `component ${args.componentLabel}` : '', args.milestoneLabel != null ? `milestone ${args.milestoneLabel}` : '', args.assignee != null ? `assignee ${args.assignee}` : ''].filter((x) => x !== ''))
  }
  const issue = await client.findOne('tracker:class:Issue', { identifier })
  if (issue != null && testCase != null) {
    await client.updateDoc('tracker:class:Issue', issue.space, issue._id, { relations: [...(issue.relations ?? []), { _id: testCase._id, _class: TM.Case }] })
  }
  await client.addCollection('chunter:class:ChatMessage', result.space, result._id, TM.Result, 'comments', { message: `Bug filed: ${identifier}` })
  return `✅ **${identifier}** filed from test result "${String(result.name)}"${extra.length > 0 ? ` (${extra.join(', ')})` : ''}; related to the test case, and the result has a comment pointing to it.`
})

export const createTestCases = wrapToolHandler<z.infer<typeof S.CreateTestCasesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  let suite: any
  try { suite = await findSuite(client, project, args.suite) } catch (e) {
    if (args.createSuite !== true) throw e
    const parent = args.parentSuite != null ? await findSuite(client, project, args.parentSuite) : undefined
    suite = { _id: await client.createDoc(TM.Suite, project._id, { name: args.suite, description: '', parent: parent?._id ?? TM.NoParent }), name: args.suite }
  }
  const existing: any[] = await client.findAll(TM.Case, { space: project._id, attachedTo: suite._id })
  const seen = new Set(existing.map((c) => String(c.name).toLowerCase()))
  const made: string[] = []; const skipped: string[] = []
  for (const c of args.cases) {
    if (seen.has(c.name.toLowerCase())) { skipped.push(c.name); continue }
    seen.add(c.name.toLowerCase())
    const assignee = c.assignee != null ? (await findPerson(client, c.assignee))._id : null
    await client.addCollection(TM.Case, project._id, suite._id, TM.Suite, 'testCases', {
      name: c.name,
      description: c.description != null && c.description !== '' ? await writeMarkup(args.workspace, `testcase-${generateId()}`, c.description) : null,
      type: idx(CASE_TYPES, c.type ?? 'Functional'),
      priority: idx(CASE_PRIORITIES, c.priority ?? 'Medium'),
      status: 0,
      assignee,
      attachments: 0
    })
    made.push(c.name)
  }
  return `✅ ${made.length} case(s) created in "${String(suite.name)}"${skipped.length > 0 ? `; skipped ${skipped.length} that already exist: ${skipped.slice(0, 10).join(', ')}` : ''}.`
})
