// Found in the live test: reused issues were not put under the epic; blob requests had no timeout.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { setConnectionManager, getConnection } from '../src/connection'
import { createIssueTree } from '../src/tools/agent'
import { fetchBlob } from '../src/utils/content'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const text = (r: any): string => r.content[0].text
const savedFetch = globalThis.fetch

function data (): FakeDoc[] {
  return [
    { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', sequence: 3, space: 'p-1' },
    { _id: 'st-b', _class: tracker.class.IssueStatus, name: 'Backlog' },
    { _id: 'tt', _class: task.class.TaskType, name: 'Issue' },
    { _id: 'e-1', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-1', title: 'Epic', status: 'st-b', attachedTo: tracker.ids.NoParent, parents: [] },
    { _id: 'i-2', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-2', title: 'Loose', status: 'st-b', attachedTo: tracker.ids.NoParent, parents: [] },
    { _id: 'o-1', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-9', title: 'Other epic', status: 'st-b', attachedTo: tracker.ids.NoParent, parents: [] },
    { _id: 'i-3', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-3', title: 'Elsewhere', status: 'st-b', attachedTo: 'o-1', parents: [{ parentId: 'o-1', identifier: 'PROJ-9', parentTitle: 'Other epic', space: 'p-1' }] }
  ]
}

beforeEach(() => { setConnectionManager(createFakeEnv({ workspaces: [PERSONAL], data: { [W]: data() } }).manager) })
afterEach(() => { globalThis.fetch = savedFetch; setConnectionManager(null) })

test('create_issue_tree: a reused issue without parent moves under the epic; one with another parent stays and is named', async () => {
  const args = { workspace: W, projectIdentifier: 'PROJ', epicIdentifier: 'PROJ-1', children: [{ title: 'Loose' }, { title: 'Elsewhere' }], skipDuplicates: true }
  const dry = text(await createIssueTree({ ...args, dryRun: true } as any))
  assert.match(dry, /"Loose" → reuse existing \*\*PROJ-2\*\*\n/)
  assert.match(dry, /"Elsewhere" → reuse existing \*\*PROJ-3\*\* \(stays under PROJ-9\)/)

  const out = text(await createIssueTree({ ...args, dryRun: false } as any))
  assert.match(out, /2 existing reused \(PROJ-3 stays under PROJ-9\)/)
  const muts: any[] = ((await getConnection(W)) as any).mutations
  const moved = muts.filter((m) => m.op !== 'findAll' && JSON.stringify(m).includes('i-2'))
  assert.ok(moved.length > 0, 'PROJ-2 was attached to the epic')
  assert.equal(muts.filter((m) => JSON.stringify(m).includes('"i-3"')).length, 0, 'PROJ-3 untouched')
})

test('fetchBlob: a stalled or unreachable front service gives a clear error instead of hanging', async () => {
  globalThis.fetch = (async (_u: string, init?: RequestInit) => {
    assert.ok(init?.signal instanceof AbortSignal, 'request has a timeout signal')
    throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
  }) as typeof fetch
  await assert.rejects(fetchBlob('https://huly.example.com/files?file=x', 't'), /did not answer within 30s \(HULY_FRONT_URL\)/)
  globalThis.fetch = (async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }) }) as typeof fetch
  await assert.rejects(fetchBlob('https://huly.example.com/files?file=x', 't'), /not reachable \(HULY_FRONT_URL\): ECONNRESET/)
})
