// 3.4: list_issues filters for title text and due date.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { setConnectionManager } from '../src/connection'
import { listIssues } from '../src/tools/issues'
import { createIssueTree } from '../src/tools/agent'
import { z } from 'zod'
import { TOOLS } from '../src/registry'
import { getConnection } from '../src/connection'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const DAY = 86_400_000
const issue = (n: number, title: string, dueDate: number | null): FakeDoc => ({
  _id: `i-${n}`, _class: tracker.class.Issue, space: 'p-1', identifier: `PROJ-${n}`, title, status: 'st-todo', priority: 0, dueDate, parents: [], modifiedOn: n
})

beforeEach(() => {
  setConnectionManager(createFakeEnv({
    workspaces: [PERSONAL],
    data: {
      [W]: [
        { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', space: 'p-1', sequence: 4 },
        { _id: 'st-todo', _class: tracker.class.IssueStatus, name: 'Todo', category: task.statusCategory.ToDo },
        { _id: 'cmp-1', _class: tracker.class.Component, space: 'p-1', label: 'API' },
        { _id: 'tt', _class: task.class.TaskType, name: 'Issue' },
        issue(1, 'Login is slow', Date.now() - 2 * DAY),
        issue(2, 'Fix LOGIN redirect', Date.now() + 5 * DAY),
        issue(3, 'Docs: 100% coverage', null),
        issue(4, 'Release notes', null)
      ]
    }
  }).manager)
})
afterEach(() => { setConnectionManager(null) })

const ids = async (args: Record<string, unknown>): Promise<string[]> =>
  [...(await listIssues({ workspace: W, projectIdentifier: 'PROJ', limit: 50, ...args } as any)).content[0].text.matchAll(/\*\*(PROJ-\d+)\*\*/g)].map((m) => m[1]).sort()

test('list_issues: title contains text (case-insensitive), % and _ match literally', async () => {
  assert.deepEqual(await ids({ title: 'login' }), ['PROJ-1', 'PROJ-2'])
  assert.deepEqual(await ids({ title: '100%' }), ['PROJ-3'])
  assert.deepEqual(await ids({ title: '%' }), ['PROJ-3'])
  assert.deepEqual(await ids({ title: 'nothing like this' }), [])
})

test('list_issues: due overdue / set / none, combinable with title', async () => {
  assert.deepEqual(await ids({ due: 'overdue' }), ['PROJ-1'])
  assert.deepEqual(await ids({ due: 'set' }), ['PROJ-1', 'PROJ-2'])
  assert.deepEqual(await ids({ due: 'none' }), ['PROJ-3', 'PROJ-4'])
  assert.deepEqual(await ids({ due: 'set', title: 'redirect' }), ['PROJ-2'])
})

test('check_setup: version compare, hosts without paths, no secrets in the report', async () => {
  const { isNewer, hostOf, checkSetupReport } = await import('../src/tools/diagnostics')
  assert.equal(isNewer('3.10.0', '3.9.9'), true)
  assert.equal(isNewer('3.4.0', '3.4.0'), false)
  assert.equal(isNewer('3.3.1', '3.4.0'), false)
  const withLogin = new URL('https://huly.example.com/_accounts?x=1'); withLogin.username = 'user'; withLogin.password = 'pw'
  assert.equal(hostOf(withLogin.href), 'https://huly.example.com', 'no credentials, path or query')
  assert.equal(hostOf(''), undefined)
  const env = { HULY_EMAIL: 'me@example.com', HULY_PASSWORD: 'secret-pw', HULY_ACCOUNTS_URL: 'https://huly.example.com/_accounts', HULY_WRITE_PROJECTS: 'TSK' }
  const out = await checkSetupReport({ skipVersionCheck: true }, env)
  assert.match(out, /✅ Logged in · 1 workspace\(s\): jokeks2023/)
  assert.match(out, /✅ Workspace jokeks2023 connected/)
  assert.match(out, /⚠️ HULY_FRONT_URL is not set/)
  assert.match(out, /writes only in TSK/)
  assert.doesNotMatch(out, /secret-pw|me@example\.com|_accounts/)
  const none = await checkSetupReport({ skipVersionCheck: true }, {})
  assert.match(none, /❌ No credentials/)
})

test('check_setup: API token kind and expiry warning', async () => {
  const { checkSetupReport } = await import('../src/tools/diagnostics')
  const jwt = (c: object): string => `h.${Buffer.from(JSON.stringify(c)).toString('base64url')}.s`
  const soon = jwt({ exp: Math.floor(Date.now() / 1000) + 3 * 86_400, extra: { apiTokenId: 't' } })
  const out = await checkSetupReport({ skipVersionCheck: true }, { HULY_TOKEN: soon })
  assert.match(out, /Login: API token/)
  assert.match(out, /⚠️ Token expires on \d{4}-\d{2}-\d{2} \(in [23] day\(s\)\)/)
  assert.doesNotMatch(out, new RegExp(soon.split('.')[1]))
})

test('no tool drops unknown fields in nested objects silently (they are rejected)', () => {
  const loose: string[] = []
  const walk = (node: any, path: string, tool: string): void => {
    if (node == null || typeof node !== 'object') return
    if (node.type === 'object' && node.properties != null && path !== '' && node.additionalProperties !== false) loose.push(`${tool}: ${path}`)
    for (const [k, v] of Object.entries<any>(node.properties ?? {})) walk(v, path === '' ? k : `${path}.${k}`, tool)
    if (node.items != null) walk(node.items, `${path}[]`, tool)
    for (const a of [...(node.anyOf ?? []), ...(node.oneOf ?? [])]) walk(a, path, tool)
  }
  for (const t of TOOLS) walk(z.toJSONSchema(t.schema, { io: 'input', unrepresentable: 'any' }), '', t.name)
  assert.deepEqual(loose, [])
})

test('create_issue_tree: the epic gets component, milestone defaults and status too; unknown epic fields are an error', async () => {
  const tree = TOOLS.find((t) => t.name === 'create_issue_tree')!
  const bad = tree.schema.safeParse({ workspace: W, projectIdentifier: 'PROJ', epic: { title: 'E', component: 'API' }, children: [{ title: 'c' }] })
  assert.equal(bad.success, false, 'a misspelled field in the epic is rejected, not dropped')
  const args = { workspace: W, projectIdentifier: 'PROJ', epic: { title: 'Epic', statusName: 'Todo' }, componentLabel: 'API', children: [{ title: 'Child' }], skipDuplicates: true }
  const plan = (await createIssueTree({ ...args, dryRun: true } as any)).content[0].text
  assert.match(plan, /Epic: create "Epic" · API, Todo/)
  await createIssueTree({ ...args, dryRun: false } as any)
  const adds = ((await getConnection(W)) as any).mutations.filter((m: any) => m.op === 'addCollection' && m._class === tracker.class.Issue)
  assert.equal(adds[0].data.title, 'Epic')
  assert.equal(adds[0].data.component, 'cmp-1')
  assert.equal(adds[0].data.status, 'st-todo')
  assert.equal(adds[1].data.component, 'cmp-1')
})
