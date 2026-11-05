// Argument check: aliases map to real names, unknown parameters are rejected instead of dropped.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import contact from '@hcengineering/contact'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer, normalizeArguments } from '../src/server'
import { setConnectionManager, getConnection } from '../src/connection'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const text = (r: any): string => r.content[0].text

function data (): FakeDoc[] {
  return [
    { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', sequence: 1, space: 'p-1' },
    { _id: 'st-b', _class: tracker.class.IssueStatus, name: 'Backlog' },
    { _id: 'st-d', _class: tracker.class.IssueStatus, name: 'Done' },
    { _id: 'tt', _class: task.class.TaskType, name: 'Issue' },
    { _id: 'comp', _class: tracker.class.Component, space: 'p-1', label: 'Core' },
    { _id: 'ms', _class: tracker.class.Milestone, space: 'p-1', label: 'v1' },
    { _id: 'ann', _class: contact.class.Person, name: 'Doe,Ann' },
    { _id: 'ann', _class: contact.mixin.Employee, name: 'Doe,Ann', active: true },
    { _id: 'i-1', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-1', title: 'Bug', status: 'st-b', priority: 0, parents: [], comments: 0, subIssues: 0, estimation: 0, reportedTime: 0 }
  ]
}

let env: ReturnType<typeof createFakeEnv>
let client: Client
beforeEach(async () => {
  delete process.env.HULY_FRONT_URL
  env = createFakeEnv({ workspaces: [PERSONAL], data: { [W]: data() } })
  setConnectionManager(env.manager)
  const server = createServer({ toolsets: '', workspace: '' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(b)
  client = new Client({ name: 'args', version: '0' })
  await client.connect(a)
})
afterEach(async () => {
  await client.close()
  await env.manager.closeAll()
  setConnectionManager(null)
})

const mutations = async (): Promise<any[]> => ((await getConnection(W)) as any).mutations

test('normalizeArguments: aliases, workspace always allowed, unknown keys listed', () => {
  const known = new Set(['workspace', 'identifier', 'statusName'])
  assert.deepEqual(normalizeArguments('t', { issueId: 'P-1', status: 'Done', workspace: 'w' }, known), { args: { identifier: 'P-1', statusName: 'Done', workspace: 'w' } })
  const bad = normalizeArguments('t', { identifier: 'P-1', colour: 'red' }, known)
  assert.ok('error' in bad)
  assert.match(bad.error, /Unknown parameter\(s\) for t: colour\. Valid: identifier, statusName/)
  // An alias whose target is already given is a conflict, not a rename.
  assert.ok('error' in normalizeArguments('t', { identifier: 'P-1', id: 'P-2' }, known))
  // An alias whose target the tool does not have is unknown.
  assert.ok('error' in normalizeArguments('t', { identifier: 'P-1', milestone: 'v1' }, known))
})

test('update_issue: "status" works like statusName; an unknown key changes nothing', async () => {
  const ok: any = await client.callTool({ name: 'update_issue', arguments: { workspace: W, identifier: 'PROJ-1', status: 'Done' } })
  assert.notEqual(ok.isError, true, text(ok))
  assert.match(text(ok), /changed: status/)
  const before = (await mutations()).length
  const bad: any = await client.callTool({ name: 'update_issue', arguments: { workspace: W, identifier: 'PROJ-1', colour: 'red' } })
  assert.equal(bad.isError, true)
  assert.match(text(bad), /Unknown parameter\(s\) for update_issue: colour.*Nothing was done/)
  assert.equal((await mutations()).length, before)
})

test('create_issue: component, milestone and assignee in one call; unknown status is an error', async () => {
  const res: any = await client.callTool({ name: 'create_issue', arguments: { workspace: W, projectIdentifier: 'PROJ', title: 'New', statusName: 'Done', componentLabel: 'Core', milestoneLabel: 'v1', assignee: 'Ann' } })
  assert.notEqual(res.isError, true, text(res))
  assert.match(text(res), /Status: Done.*Component: Core \| Milestone: v1/)
  const add = (await mutations()).find((m) => m.op === 'addCollection')
  assert.equal(add.data.component, 'comp')
  assert.equal(add.data.milestone, 'ms')
  assert.equal(add.data.assignee, 'ann')
  assert.equal(add.data.status, 'st-d')

  const before = (await mutations()).length
  const bad: any = await client.callTool({ name: 'create_issue', arguments: { workspace: W, projectIdentifier: 'PROJ', title: 'X', statusName: 'Doing' } })
  assert.equal(bad.isError, true)
  assert.match(text(bad), /Status 'Doing' not found\. Available: Backlog, Done/)
  const noComp: any = await client.callTool({ name: 'create_issue', arguments: { workspace: W, projectIdentifier: 'PROJ', title: 'X', componentLabel: 'Nope' } })
  assert.match(text(noComp), /Component 'Nope' not found/)
  // Nothing written, not even the sequence number.
  assert.equal((await mutations()).length, before)
})

test('get_issue: empty fields are left out', async () => {
  const res: any = await client.callTool({ name: 'get_issue', arguments: { workspace: W, identifier: 'PROJ-1' } })
  const out = text(res)
  assert.match(out, /\*\*Status:\*\* Backlog · \*\*Priority:\*\* No Priority/)
  assert.doesNotMatch(out, /None|Unassigned|Comments|Sub-issues|Estimation/)
})
