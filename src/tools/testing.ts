// Test management: projects → suites (nested) → cases; plans pick cases; runs hold one result per case.
// Mirrors Huly's test-management UI (CreateTestSuite, CreateTestCase, NewTestPlanPanel, NewTestRunPanel).
import { SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { readMarkup, writeMarkup } from '../utils/content'
import { formatDate } from '../utils/format'
import { currentAccountUuid, findPerson, peopleNames } from '../utils/people'
import type { z } from 'zod'
import type * as S from '../schemas'

export const TM = {
  Project: 'testManagement:class:TestProject',
  Suite: 'testManagement:class:TestSuite',
  Case: 'testManagement:class:TestCase',
  Plan: 'testManagement:class:TestPlan',
  PlanItem: 'testManagement:class:TestPlanItem',
  Run: 'testManagement:class:TestRun',
  Result: 'testManagement:class:TestResult',
  NoParent: 'testManagement:ids:NoParent',
  SpaceType: 'testManagement:spaceType:DefaultProject',
  TypeMixin: 'testManagement:mixin:DefaultProjectTypeData'
} as const

export const CASE_TYPES = ['Functional', 'Performance', 'Regression', 'Security', 'Smoke', 'Usability'] as const
export const CASE_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const
export const CASE_STATUSES = ['Draft', 'ReadyForReview', 'FixReviewComments', 'Approved', 'Rejected'] as const
export const RESULT_STATUSES = ['Untested', 'Blocked', 'Passed', 'Failed'] as const

export const idx = (list: readonly string[], v: string): number => list.indexOf(v)
export const name = (list: readonly string[], i: number | undefined): string => (i != null ? list[i] : undefined) ?? '—'

export async function findProject (client: any, ref: string): Promise<any> {
  const all: any[] = await client.findAll(TM.Project, {})
  const hits = all.filter((p) => p._id === ref || String(p.name).toLowerCase() === ref.toLowerCase())
  if (hits.length === 1) return hits[0]
  if (hits.length > 1) throw new Error(`Test project '${ref}' is ambiguous: ${hits.map((p) => p._id).join(', ')}.`)
  throw new Error(`Test project '${ref}' not found. Available: ${all.map((p) => p.name).join(', ') || 'none'}.`)
}

export async function findSuite (client: any, project: any, ref: string): Promise<any> {
  const suites: any[] = await client.findAll(TM.Suite, { space: project._id })
  const hits = suites.filter((s) => s._id === ref || String(s.name).toLowerCase() === ref.toLowerCase())
  if (hits.length === 1) return hits[0]
  if (hits.length > 1) throw new Error(`Suite '${ref}' is ambiguous — use its id: ${hits.map((s) => s._id).join(', ')}.`)
  throw new Error(`Suite '${ref}' not found in ${String(project.name)}.`)
}

export async function findDoc (client: any, _class: string, id: string, what: string): Promise<any> {
  const doc = await client.findOne(_class, { _id: id })
  if (doc == null) throw new Error(`${what} '${id}' not found.`)
  return doc
}

export const listTestProjects = wrapToolHandler<z.infer<typeof S.ListTestProjectsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const projects: any[] = await client.findAll(TM.Project, { archived: false })
  if (projects.length === 0) return 'No test projects.'
  const lines: string[] = []
  for (const p of projects) {
    const cases = await client.findAll(TM.Case, { space: p._id }, { limit: 1, total: true })
    const runs = await client.findAll(TM.Run, { space: p._id }, { limit: 1, total: true })
    lines.push(`- **${String(p.name)}** — ${String(cases.total ?? cases.length)} case(s), ${String(runs.total ?? runs.length)} run(s) — \`${String(p._id)}\``)
  }
  return `## Test projects (${projects.length})\n\n${lines.join('\n')}`
})

export const createTestProject = wrapToolHandler<z.infer<typeof S.CreateTestProjectSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const existing: any[] = await client.findAll(TM.Project, {})
  const same = existing.find((p) => String(p.name).toLowerCase() === args.name.toLowerCase())
  if (same != null) return `ℹ️ Test project **${String(same.name)}** already exists — \`${String(same._id)}\`.`
  const me = await currentAccountUuid(client)
  const id = await client.createDoc(TM.Project, 'core:space:Space', {
    name: args.name, description: args.description ?? '', private: args.isPrivate, members: [me], owners: [me], archived: false, type: TM.SpaceType
  })
  await client.createMixin(id, TM.Project, 'core:space:Space', TM.TypeMixin, {})
  return `✅ Test project **${args.name}** created — \`${String(id)}\`.`
})

export const listTestCases = wrapToolHandler<z.infer<typeof S.ListTestCasesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  const suites: any[] = await client.findAll(TM.Suite, { space: project._id }, { sort: { name: SortingOrder.Ascending } })
  const query: Record<string, unknown> = { space: project._id }
  if (args.status != null) query.status = idx(CASE_STATUSES, args.status)
  const cases: any[] = await client.findAll(TM.Case, query, { sort: { name: SortingOrder.Ascending } })
  const people = await peopleNames(client)
  const root = args.suite != null ? (await findSuite(client, project, args.suite))._id : TM.NoParent
  const lines: string[] = []
  const walk = (parent: string, depth: number): void => {
    for (const s of suites.filter((x) => x.parent === parent)) {
      lines.push(`${'  '.repeat(depth)}- 📂 **${String(s.name)}** — \`${String(s._id)}\``)
      for (const c of cases.filter((x) => x.attachedTo === s._id)) {
        const who = c.assignee != null ? ` · @${people.get(c.assignee) ?? '?'}` : ''
        lines.push(`${'  '.repeat(depth + 1)}- ${String(c.name)} [${name(CASE_TYPES, c.type)}, ${name(CASE_PRIORITIES, c.priority)}, ${name(CASE_STATUSES, c.status)}]${who} — \`${String(c._id)}\``)
      }
      if (depth < 20) walk(s._id, depth + 1)
    }
  }
  if (args.suite != null) {
    const s = suites.find((x) => x._id === root)
    lines.push(`- 📂 **${String(s.name)}** — \`${String(s._id)}\``)
    for (const c of cases.filter((x) => x.attachedTo === root)) lines.push(`  - ${String(c.name)} [${name(CASE_TYPES, c.type)}, ${name(CASE_PRIORITIES, c.priority)}, ${name(CASE_STATUSES, c.status)}] — \`${String(c._id)}\``)
    walk(root, 1)
  } else walk(root, 0)
  if (lines.length === 0) return `No suites in ${String(project.name)} yet — create one with create_test_suite.`
  return `## ${String(project.name)}: ${cases.length} case(s)\n\n${lines.join('\n')}`
})

export const createTestSuite = wrapToolHandler<z.infer<typeof S.CreateTestSuiteSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  const parent = args.parent != null ? await findSuite(client, project, args.parent) : undefined
  const id = await client.createDoc(TM.Suite, project._id, { name: args.name, description: args.description ?? '', parent: parent?._id ?? TM.NoParent })
  return `✅ Suite **${args.name}** created${parent != null ? ` in "${String(parent.name)}"` : ''} — \`${String(id)}\`.`
})

export const getTestCase = wrapToolHandler<z.infer<typeof S.GetTestCaseSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const c = await findDoc(client, TM.Case, args.caseId, 'Test case')
  const suite = await client.findOne(TM.Suite, { _id: c.attachedTo })
  const people = await peopleNames(client)
  const results: any[] = await client.findAll(TM.Result, { testCase: c._id }, { sort: { modifiedOn: SortingOrder.Descending }, limit: 5 })
  const lines = [
    `## ${String(c.name)}`,
    '',
    `**Suite:** ${String(suite?.name ?? '—')} · **Type:** ${name(CASE_TYPES, c.type)} · **Priority:** ${name(CASE_PRIORITIES, c.priority)} · **Status:** ${name(CASE_STATUSES, c.status)}`,
    `**Assignee:** ${c.assignee != null ? people.get(c.assignee) ?? '?' : '—'} · **Id:** \`${String(c._id)}\``,
    '',
    '### Steps / description',
    (await readMarkup(args.workspace, c.description)) || '_(empty)_'
  ]
  if (results.length > 0) {
    lines.push('', '### Latest results')
    for (const r of results) {
      const run = await client.findOne(TM.Run, { _id: r.attachedTo })
      lines.push(`- ${name(RESULT_STATUSES, r.status)} in run "${String(run?.name ?? '?')}" (${formatDate(r.modifiedOn)})`)
    }
  }
  return lines.join('\n')
})

export const createTestCase = wrapToolHandler<z.infer<typeof S.CreateTestCaseSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  const suite = await findSuite(client, project, args.suite)
  const assignee = args.assignee != null ? (await findPerson(client, args.assignee))._id : null
  const id = await client.addCollection(TM.Case, project._id, suite._id, TM.Suite, 'testCases', {
    name: args.name,
    description: args.description != null && args.description !== '' ? await writeMarkup(args.workspace, 'testcase', args.description) : null,
    type: idx(CASE_TYPES, args.type ?? 'Functional'),
    priority: idx(CASE_PRIORITIES, args.priority ?? 'Medium'),
    status: idx(CASE_STATUSES, args.status ?? 'Draft'),
    assignee,
    attachments: 0
  })
  return `✅ Test case **${args.name}** created in "${String(suite.name)}" — \`${String(id)}\`.`
})

export const updateTestCase = wrapToolHandler<z.infer<typeof S.UpdateTestCaseSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const c = await findDoc(client, TM.Case, args.caseId, 'Test case')
  const update: Record<string, unknown> = {}
  if (args.name != null) update.name = args.name
  if (args.description != null) update.description = await writeMarkup(args.workspace, 'testcase', args.description)
  if (args.type != null) update.type = idx(CASE_TYPES, args.type)
  if (args.priority != null) update.priority = idx(CASE_PRIORITIES, args.priority)
  if (args.status != null) update.status = idx(CASE_STATUSES, args.status)
  if (args.assignee !== undefined) update.assignee = args.assignee != null ? (await findPerson(client, args.assignee))._id : null
  if (Object.keys(update).length === 0) throw new Error('Nothing to change.')
  await client.updateCollection(TM.Case, c.space, c._id, c.attachedTo, TM.Suite, 'testCases', update)
  return `✅ Test case **${String(args.name ?? c.name)}** updated: ${Object.keys(update).join(', ')}.`
})

export const deleteTestCase = wrapToolHandler<z.infer<typeof S.DeleteTestCaseSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const c = await findDoc(client, TM.Case, args.caseId, 'Test case')
  await client.removeCollection(TM.Case, c.space, c._id, c.attachedTo, TM.Suite, 'testCases')
  return `✅ Test case **${String(c.name)}** deleted.`
})

/** Cases selected by ids and/or suites (including nested suites). */
async function selectCases (client: any, project: any, caseIds: string[] | undefined, suites: string[] | undefined): Promise<any[]> {
  const out = new Map<string, any>()
  for (const id of caseIds ?? []) {
    const c = await findDoc(client, TM.Case, id, 'Test case')
    if (c.space !== project._id) throw new Error(`Test case '${id}' belongs to another project.`)
    out.set(c._id, c)
  }
  if ((suites ?? []).length > 0) {
    const all: any[] = await client.findAll(TM.Suite, { space: project._id })
    let level = await Promise.all((suites ?? []).map(async (s) => (await findSuite(client, project, s))._id))
    const ids = new Set(level)
    while (level.length > 0) {
      level = all.filter((s) => level.includes(s.parent) && !ids.has(s._id)).map((s) => s._id)
      for (const l of level) ids.add(l)
    }
    const cases: any[] = await client.findAll(TM.Case, { space: project._id, attachedTo: { $in: [...ids] } })
    for (const c of cases) out.set(c._id, c)
  }
  return [...out.values()]
}

export const listTestPlans = wrapToolHandler<z.infer<typeof S.ListTestPlansSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  const plans: any[] = await client.findAll(TM.Plan, { space: project._id })
  if (plans.length === 0) return `No test plans in ${String(project.name)}.`
  const lines: string[] = []
  for (const p of plans) {
    const items: any[] = await client.findAll(TM.PlanItem, { attachedTo: p._id })
    lines.push(`- **${String(p.name)}** — ${items.length} case(s) — \`${String(p._id)}\``)
  }
  return `## Test plans in ${String(project.name)} (${plans.length})\n\n${lines.join('\n')}`
})

export const createTestPlan = wrapToolHandler<z.infer<typeof S.CreateTestPlanSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  const cases = await selectCases(client, project, args.caseIds, args.suites)
  if (cases.length === 0) throw new Error('No test cases selected (caseIds or suites).')
  const ops = client.apply?.() ?? client
  const id = await ops.createDoc(TM.Plan, project._id, { name: args.name, description: null })
  for (const c of cases) {
    await ops.addCollection(TM.PlanItem, project._id, id, TM.Plan, 'items', { testCase: c._id, testSuite: c.attachedTo, assignee: c.assignee ?? null })
  }
  if (ops !== client) await ops.commit()
  return `✅ Test plan **${args.name}** with ${cases.length} case(s) — \`${String(id)}\`.`
})

export const createTestRun = wrapToolHandler<z.infer<typeof S.CreateTestRunSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  let cases = await selectCases(client, project, args.caseIds, args.suites)
  if (args.plan != null) {
    const plans: any[] = await client.findAll(TM.Plan, { space: project._id })
    const plan = plans.find((p) => p._id === args.plan || String(p.name).toLowerCase() === args.plan!.toLowerCase())
    if (plan == null) throw new Error(`Test plan '${args.plan}' not found.`)
    const items: any[] = await client.findAll(TM.PlanItem, { attachedTo: plan._id })
    const fromPlan = await Promise.all(items.map(async (i) => await client.findOne(TM.Case, { _id: i.testCase })))
    cases = [...new Map([...cases, ...fromPlan.filter((c) => c != null)].map((c) => [c._id, c])).values()]
  }
  if (cases.length === 0) throw new Error('No test cases selected (plan, suites or caseIds).')
  const dueDate = args.dueDate != null ? new Date(args.dueDate).getTime() : undefined
  if (dueDate != null && Number.isNaN(dueDate)) throw new Error(`Invalid dueDate '${args.dueDate}'.`)
  const ops = client.apply?.() ?? client
  const id = await ops.createDoc(TM.Run, project._id, { name: args.name, description: null, ...(dueDate != null ? { dueDate } : {}) })
  for (const c of cases) {
    await ops.addCollection(TM.Result, project._id, id, TM.Run, 'results', { name: c.name, testCase: c._id, testSuite: c.attachedTo, description: null, status: idx(RESULT_STATUSES, 'Untested'), assignee: c.assignee ?? null })
  }
  if (ops !== client) await ops.commit()
  return `✅ Test run **${args.name}** started with ${cases.length} case(s) — \`${String(id)}\`. Record results with set_test_result.`
})

export const listTestRuns = wrapToolHandler<z.infer<typeof S.ListTestRunsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  const runs: any[] = await client.findAll(TM.Run, { space: project._id }, { sort: { modifiedOn: SortingOrder.Descending }, limit: args.limit })
  if (runs.length === 0) return `No test runs in ${String(project.name)}.`
  const lines: string[] = []
  for (const r of runs) {
    const results: any[] = await client.findAll(TM.Result, { attachedTo: r._id })
    const counts = RESULT_STATUSES.map((s, i) => [s, results.filter((x) => (x.status ?? 0) === i).length] as const).filter(([, n]) => n > 0)
    lines.push(`- **${String(r.name)}** — ${counts.map(([s, n]) => `${n} ${s}`).join(', ') || 'empty'}${r.dueDate != null ? ` · due ${formatDate(r.dueDate)}` : ''} — \`${String(r._id)}\``)
  }
  return `## Test runs in ${String(project.name)} (${runs.length})\n\n${lines.join('\n')}`
})

export const getTestRun = wrapToolHandler<z.infer<typeof S.GetTestRunSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const run = await findDoc(client, TM.Run, args.runId, 'Test run')
  const results: any[] = await client.findAll(TM.Result, { attachedTo: run._id })
  const people = await peopleNames(client)
  const lines = results.sort((a, b) => String(a.name).localeCompare(String(b.name))).map((r) => `- ${name(RESULT_STATUSES, r.status ?? 0)} — **${String(r.name)}**${r.assignee != null ? ` · @${people.get(r.assignee) ?? '?'}` : ''} — \`${String(r._id)}\``)
  const done = results.filter((r) => (r.status ?? 0) !== 0).length
  return `## Run: ${String(run.name)} (${done}/${results.length} tested)\n\n${lines.join('\n')}`
})

export const setTestResult = wrapToolHandler<z.infer<typeof S.SetTestResultSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  let result = await client.findOne(TM.Result, { _id: args.result })
  if (result == null && args.runId != null) {
    const all: any[] = await client.findAll(TM.Result, { attachedTo: args.runId })
    const hits = all.filter((r) => r.testCase === args.result || String(r.name).toLowerCase() === args.result.toLowerCase())
    if (hits.length > 1) throw new Error(`'${args.result}' matches several results in this run — use the result id.`)
    result = hits[0]
  }
  if (result == null) throw new Error(`Test result '${args.result}' not found (pass a result id, or runId plus case id/name).`)
  const update: Record<string, unknown> = { status: idx(RESULT_STATUSES, args.status) }
  if (args.comment != null) update.description = await writeMarkup(args.workspace, 'testresult', args.comment)
  if (args.assignee !== undefined) update.assignee = args.assignee != null ? (await findPerson(client, args.assignee))._id : null
  await client.updateCollection(TM.Result, result.space, result._id, result.attachedTo, TM.Run, 'results', update)
  return `✅ **${String(result.name)}**: ${args.status}${args.comment != null ? ' (with comment)' : ''}.`
})

export const updateTestSuite = wrapToolHandler<z.infer<typeof S.UpdateTestSuiteSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  const suite = await findSuite(client, project, args.suite)
  const update: Record<string, unknown> = {}
  if (args.name != null) update.name = args.name
  if (args.description != null) update.description = args.description
  if (args.parent !== undefined) {
    if (args.parent == null) update.parent = TM.NoParent
    else {
      const parent = await findSuite(client, project, args.parent)
      const all: any[] = await client.findAll(TM.Suite, { space: project._id })
      for (let p: any = parent; p != null; p = all.find((s) => s._id === p.parent)) {
        if (p._id === suite._id) throw new Error('A suite cannot move into itself or one of its sub-suites.')
      }
      update.parent = parent._id
    }
  }
  if (Object.keys(update).length === 0) throw new Error('Nothing to change.')
  await client.updateDoc(TM.Suite, suite.space, suite._id, update)
  return `✅ Suite **${String(args.name ?? suite.name)}** updated: ${Object.keys(update).join(', ')}.`
})

export const deleteTestSuite = wrapToolHandler<z.infer<typeof S.DeleteTestSuiteSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  const suite = await findSuite(client, project, args.suite)
  const all: any[] = await client.findAll(TM.Suite, { space: project._id })
  const ids = [suite._id]
  for (let i = 0; i < ids.length; i++) ids.push(...all.filter((s) => s.parent === ids[i]).map((s) => s._id))
  const cases: any[] = await client.findAll(TM.Case, { space: project._id, attachedTo: { $in: ids } })
  if ((ids.length > 1 || cases.length > 0) && args.recursive !== true) throw new Error(`Suite '${String(suite.name)}' holds ${ids.length - 1} sub-suite(s) and ${cases.length} case(s) — pass recursive: true to delete them too.`)
  for (const c of cases) await client.removeCollection(TM.Case, c.space, c._id, c.attachedTo, TM.Suite, 'testCases')
  for (const id of ids.reverse()) await client.removeDoc(TM.Suite, project._id, id)
  return `🗑️ Suite **${String(suite.name)}** deleted${ids.length > 1 || cases.length > 0 ? ` with ${ids.length - 1} sub-suite(s) and ${cases.length} case(s)` : ''}.`
})

export const updateTestRun = wrapToolHandler<z.infer<typeof S.UpdateTestRunSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const run = await findDoc(client, TM.Run, args.runId, 'Test run')
  const update: Record<string, unknown> = {}
  if (args.name != null) update.name = args.name
  if (args.dueDate !== undefined) {
    const t = args.dueDate != null ? new Date(args.dueDate).getTime() : null
    if (t != null && Number.isNaN(t)) throw new Error(`Invalid dueDate '${String(args.dueDate)}'.`)
    update.dueDate = t
  }
  if (args.description != null) update.description = await writeMarkup(args.workspace, 'testrun', args.description)
  if (Object.keys(update).length === 0) throw new Error('Nothing to change.')
  await client.updateDoc(TM.Run, run.space, run._id, update)
  return `✅ Run **${String(args.name ?? run.name)}** updated: ${Object.keys(update).join(', ')}.`
})

export const deleteTestRun = wrapToolHandler<z.infer<typeof S.DeleteTestRunSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const run = await findDoc(client, TM.Run, args.runId, 'Test run')
  const results: any[] = await client.findAll(TM.Result, { attachedTo: run._id })
  for (const r of results) await client.removeCollection(TM.Result, r.space, r._id, run._id, TM.Run, 'results')
  await client.removeDoc(TM.Run, run.space, run._id)
  return `🗑️ Run **${String(run.name)}** deleted with ${results.length} result(s).`
})

export const deleteTestPlan = wrapToolHandler<z.infer<typeof S.DeleteTestPlanSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.project)
  const plans: any[] = await client.findAll(TM.Plan, { space: project._id })
  const plan = plans.find((p) => p._id === args.plan || String(p.name).toLowerCase() === args.plan.toLowerCase())
  if (plan == null) throw new Error(`Test plan '${args.plan}' not found.`)
  const items: any[] = await client.findAll(TM.PlanItem, { attachedTo: plan._id })
  for (const i of items) await client.removeCollection(TM.PlanItem, i.space, i._id, plan._id, TM.Plan, 'items')
  await client.removeDoc(TM.Plan, plan.space, plan._id)
  return `🗑️ Test plan **${String(plan.name)}** deleted (${items.length} item(s); runs made from it stay).`
})
