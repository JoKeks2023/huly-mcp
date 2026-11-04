// Test management extras: JUnit import, report, bug from result, bulk cases, suite/run/plan admin.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import contact from '@hcengineering/contact'
import { setConnectionManager, getConnection } from '../src/connection'
import { TOOLS } from '../src/registry'
import { parseJUnit, decodeXml } from '../src/utils/junit'
import { importJUnit } from '../src/tools/test-automation'
import { parseJUnitArgs } from '../src/junit-cli'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const run = async (name: string, args: Record<string, unknown>): Promise<string> => (await TOOLS.find((t) => t.name === name)!.handler({ workspace: W, ...args })).content[0].text
const savedFetch = globalThis.fetch
const uploads: string[] = []

function data (): FakeDoc[] {
  return [
    { _id: 'me', _class: contact.class.Person, name: 'Keks,Jo', personUuid: 'acc-1' },
    { _id: 'me', _class: contact.mixin.Employee, name: 'Keks,Jo', active: true },
    { _id: 'social-id', _class: contact.class.SocialIdentity, attachedTo: 'me' },
    { _id: 'tp', _class: 'testManagement:class:TestProject', name: 'App', archived: false },
    { _id: 'su-login', _class: 'testManagement:class:TestSuite', space: 'tp', name: 'Login', parent: 'testManagement:ids:NoParent' },
    { _id: 'su-sub', _class: 'testManagement:class:TestSuite', space: 'tp', name: 'Reset', parent: 'su-login' },
    { _id: 'tc-ok', _class: 'testManagement:class:TestCase', space: 'tp', attachedTo: 'su-login', name: 'valid login' },
    { _id: 'tc-sub', _class: 'testManagement:class:TestCase', space: 'tp', attachedTo: 'su-sub', name: 'reset mail' }
  ]
}

let client: any
beforeEach(async () => {
  uploads.length = 0
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    uploads.push(String(init?.method))
    return new Response(JSON.stringify([{ key: 'file', id: `blob-${uploads.length}` }]), { status: 200 })
  }) as typeof fetch
  const env = createFakeEnv({ workspaces: [PERSONAL], data: { jokeks2023: data() } })
  setConnectionManager(env.manager)
  client = await getConnection(W)
})
afterEach(() => { globalThis.fetch = savedFetch })

const JEST = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="jest tests" tests="4" failures="1">
  <testsuite name="Login" tests="3">
    <testcase classname="Login valid login" name="valid login" time="0.12"/>
    <testcase classname="Login" name="rejects &quot;bad&quot; password" time="0.5">
      <failure message="expected 401 &amp; got 200" type="AssertionError"><![CDATA[Error: expected 401 & got 200
    at login.test.ts:12]]></failure>
    </testcase>
    <testcase name="sso"><skipped message="no idp"/></testcase>
  </testsuite>
  <!-- <testcase name="commented out"/> -->
  <testsuite name="Cart"><testcase name="adds item"></testcase></testsuite>
</testsuites>`

test('parseJUnit: suites, failures with CDATA/entities, skipped, comments ignored', () => {
  const cases = parseJUnit(JEST)
  assert.deepEqual(cases.map((c) => [c.suite, c.name, c.status]), [
    ['Login', 'valid login', 'passed'], ['Login', 'rejects "bad" password', 'failed'], ['Login', 'sso', 'skipped'], ['Cart', 'adds item', 'passed']
  ])
  assert.equal(cases[1].message, 'expected 401 & got 200')
  assert.match(cases[1].details!, /^Error: expected 401 & got 200\n {4}at login\.test\.ts:12$/)
  assert.equal(cases[0].time, 0.12)
  assert.equal(cases[2].message, 'no idp')
  assert.equal(decodeXml('&#x41;&#66;&lt;'), 'AB<')
  assert.throws(() => parseJUnit('<html></html>'), /Not JUnit XML/)
})

test('parseJUnit: pytest style (single testsuite root, error element), nested suites use the innermost name', () => {
  const py = '<testsuite name="pytest"><testcase classname="tests.test_api" name="test_get"><error message="boom"/></testcase></testsuite>'
  assert.deepEqual(parseJUnit(py).map((c) => [c.suite, c.status, c.message]), [['pytest', 'failed', 'boom']])
  const nested = '<testsuites><testsuite name="outer"><testsuite name="inner"><testcase name="a"/></testsuite><testcase name="b"/></testsuite></testsuites>'
  assert.deepEqual(parseJUnit(nested).map((c) => `${c.suite}/${c.name}`), ['inner/a', 'outer/b'])
})

test('import: matches existing cases, creates missing suites/cases, records statuses, failure details as markup', async () => {
  const s = await importJUnit({ workspace: W, project: 'app', xml: JEST, runName: 'CI #7' })
  assert.deepEqual([s.passed, s.failed, s.skipped, s.created], [2, 1, 1, 3])
  const muts = client.mutations
  const newSuites = muts.filter((m: any) => m.op === 'createDoc' && m._class === 'testManagement:class:TestSuite')
  assert.deepEqual(newSuites.map((m: any) => m.data.name), ['Cart'])
  const newCases = muts.filter((m: any) => m.op === 'addCollection' && m._class === 'testManagement:class:TestCase')
  assert.deepEqual(newCases.map((m: any) => m.data.name), ['rejects "bad" password', 'sso', 'adds item'])
  const runDoc = muts.find((m: any) => m._class === 'testManagement:class:TestRun')
  assert.equal(runDoc.data.name, 'CI #7')
  const results = muts.filter((m: any) => m._class === 'testManagement:class:TestResult')
  assert.deepEqual(results.map((m: any) => [m.data.name, m.data.status]), [['valid login', 2], ['rejects "bad" password', 3], ['sso', 0], ['adds item', 2]])
  assert.equal(results[0].data.testCase, 'tc-ok')
  assert.equal(results[0].data.description, null)
  assert.notEqual(results[1].data.description, null)
  assert.equal(uploads.length, 2) // failure + skipped comment
  assert.match(s.text, /❌ Login › rejects "bad" password — expected 401 & got 200/)
})

test('import: dry run changes nothing; createMissing false keeps only matches; parentSuite scopes suites', async () => {
  const dry = await importJUnit({ workspace: W, project: 'app', xml: JEST, dryRun: true })
  assert.match(dry.text, /Would create 1 suite\(s\) and 3 case\(s\)/)
  assert.equal(client.mutations.length, 0)
  const only = await importJUnit({ workspace: W, project: 'app', xml: JEST, createMissing: false })
  assert.equal(only.unmatched, 3)
  assert.equal(client.mutations.filter((m: any) => m._class === 'testManagement:class:TestResult').length, 1)
  await assert.rejects(importJUnit({ workspace: W, project: 'app', xml: '<testsuite name="X"><testcase name="y"/></testsuite>', createMissing: false }), /None of the 1 test/)
  client.mutations.length = 0
  await importJUnit({ workspace: W, project: 'app', xml: '<testsuite name="Reset"><testcase name="reset mail"/></testsuite>', parentSuite: 'Login' })
  assert.equal(client.mutations.filter((m: any) => m._class === 'testManagement:class:TestCase').length, 0)
  assert.equal(client.mutations.find((m: any) => m._class === 'testManagement:class:TestResult').data.testCase, 'tc-sub')
})

test('get_test_report: failing now, flaky, never run, per-suite table', async () => {
  client.docs.push(
    { _id: 'tc-3', _class: 'testManagement:class:TestCase', space: 'tp', attachedTo: 'su-login', name: 'logout' },
    ...[1, 2, 3, 4].map((n) => ({ _id: `r${n}`, _class: 'testManagement:class:TestRun', space: 'tp', name: `Run ${n}`, createdOn: n })),
    ...[[2, 3, 2, 3], [2, 2, 2, 3]].flatMap((hist, k) => hist.map((st, n) => ({ _id: `res-${k}-${n}`, _class: 'testManagement:class:TestResult', space: 'tp', attachedTo: `r${n + 1}`, testCase: k === 0 ? 'tc-ok' : 'tc-sub', status: st })))
  )
  const out = await run('get_test_report', { project: 'App' })
  assert.match(out, /3 case\(s\) · last 4 run\(s\) \(Run 1 → Run 4\) · pass rate of latest results: 0%/)
  assert.match(out, /### Failing now \(2\)/)
  assert.match(out, /### Flaky[^\n]*\(1\)\n- Login › valid login ✅❌✅❌/)
  assert.match(out, /### Never run in these runs \(1\)\n- Login › logout/)
  assert.match(out, /\| Login \| 2 \| 0 \| 1 \| 1 \|/)
})

test('create_issue_from_test_result: issue with steps and failure, related to the case, comment on the result', async () => {
  client.docs.push(
    { _id: 'tracker-p', _class: 'tracker:class:Project', identifier: 'PROJ', name: 'Proj', sequence: 4, type: 'pt' },
    { _id: 'st', _class: 'tracker:class:IssueStatus', name: 'Backlog' },
    { _id: 'kind', _class: 'task:class:TaskType', parent: 'pt' },
    { _id: 'run-1', _class: 'testManagement:class:TestRun', space: 'tp', name: 'Nightly' },
    { _id: 'res-1', _class: 'testManagement:class:TestResult', space: 'tp', attachedTo: 'run-1', testCase: 'tc-ok', name: 'valid login', status: 3, description: null }
  )
  const out = await run('create_issue_from_test_result', { result: 'res-1', projectIdentifier: 'PROJ' })
  assert.match(out, /\*\*PROJ-5\*\* filed from test result "valid login"/)
  const issue = client.mutations.find((m: any) => m._class === 'tracker:class:Issue' && m.op === 'addCollection')
  assert.equal(issue.data.title, 'Test failed: valid login')
  assert.equal(issue.data.priority, 2) // High
  const comment = client.mutations.find((m: any) => m._class === 'chunter:class:ChatMessage')
  assert.equal(comment.attachedTo, 'res-1')
  assert.equal(comment.data.message, 'Bug filed: PROJ-5')
})

test('create_test_cases: bulk, skips existing names, can create the suite', async () => {
  assert.match(await run('create_test_cases', { project: 'App', suite: 'Login', cases: [{ name: 'Valid login' }, { name: 'Lockout', description: '1. fail 5x\n2. expect lock', priority: 'High' }, { name: 'lockout' }] }), /1 case\(s\) created in "Login"; skipped 2 that already exist: Valid login, lockout/)
  const c = client.mutations.find((m: any) => m._class === 'testManagement:class:TestCase')
  assert.deepEqual([c.data.name, c.data.priority, c.data.status], ['Lockout', 2, 0])
  await assert.rejects(run('create_test_cases', { project: 'App', suite: 'Billing', cases: [{ name: 'x' }] }), /Suite 'Billing' not found/)
  assert.match(await run('create_test_cases', { project: 'App', suite: 'Billing', createSuite: true, parentSuite: 'Login', cases: [{ name: 'x' }] }), /1 case\(s\) created in "Billing"/)
  assert.equal(client.mutations.find((m: any) => m._class === 'testManagement:class:TestSuite').data.parent, 'su-login')
})

test('suite admin: no move into own child; delete needs recursive when not empty', async () => {
  await assert.rejects(run('update_test_suite', { project: 'App', suite: 'Login', parent: 'Reset' }), /cannot move into itself/)
  assert.match(await run('update_test_suite', { project: 'App', suite: 'Reset', parent: null, name: 'Password reset' }), /updated: name, parent/)
  await assert.rejects(run('delete_test_suite', { project: 'App', suite: 'Login' }), /1 sub-suite\(s\) and 2 case\(s\) — pass recursive/)
  assert.match(await run('delete_test_suite', { project: 'App', suite: 'Login', recursive: true }), /with 1 sub-suite\(s\) and 2 case\(s\)/)
  const removed = client.mutations.filter((m: any) => m.op === 'removeDoc' || m.op === 'removeCollection').length
  assert.equal(removed, 4)
})

test('junit CLI arguments', () => {
  assert.deepEqual(parseJUnitArgs(['r.xml', '--project', 'App', '--run', 'CI 1', '--no-create', '--fail-on-failures']), { failOnFailures: true, file: 'r.xml', project: 'App', runName: 'CI 1', createMissing: false })
  assert.throws(() => parseJUnitArgs(['r.xml']), /Missing --project/)
  assert.throws(() => parseJUnitArgs(['--project', 'A']), /Missing report file/)
  assert.throws(() => parseJUnitArgs(['r.xml', '--project', 'A', '--nope']), /Unknown option --nope/)
})
