// undo_changes: every write tool is recorded and can be reversed, newest first, without overwriting others' edits.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { setConnectionManager, getConnection } from '../src/connection'
import { TOOLS } from '../src/registry'
import { guard } from '../src/guard'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const env = { HULY_CONFIRM: 'off' }
const call = async (name: string, args: Record<string, unknown>): Promise<string> => {
  const tool = TOOLS.find((t) => t.name === name)!
  const r: any = await guard(tool, env)({ workspace: W, ...args })
  return r.content[0].text
}
let docs: FakeDoc[]

beforeEach(() => {
  docs = [
    { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', space: 'p-1', sequence: 1 },
    { _id: 'st-todo', _class: tracker.class.IssueStatus, name: 'Todo', category: task.statusCategory.ToDo },
    { _id: 'st-done', _class: tracker.class.IssueStatus, name: 'Done', category: task.statusCategory.Won },
    { _id: 'tt', _class: task.class.TaskType, name: 'Issue' },
    { _id: 'i-1', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-1', title: 'Old title', status: 'st-todo', priority: 0, parents: [], attachedTo: tracker.ids.NoParent, attachedToClass: tracker.class.Issue, collection: 'subIssues', modifiedOn: 100 }
  ]
  setConnectionManager(createFakeEnv({ workspaces: [PERSONAL], data: { [W]: docs } }).manager)
})
afterEach(() => { setConnectionManager(null) })

const muts = async (): Promise<any[]> => ((await getConnection(W)) as any).mutations

test('undo_changes: dry run lists the plan and writes nothing; then the old values come back', async () => {
  await call('update_issue', { identifier: 'PROJ-1', title: 'New title', statusName: 'Done' })
  const before = (await muts()).length
  const plan = await call('undo_changes', { count: 1, dryRun: true })
  assert.match(plan, /dry run \(1 of 1 change\(s\) in jokeks2023\)/)
  assert.match(plan, /update_issue\n {3}- restore (title, status|status, title) on PROJ-1: Old title/)
  assert.equal((await muts()).length, before, 'a dry run writes nothing')

  const done = await call('undo_changes', { count: 1, dryRun: false })
  assert.match(done, /✅ undone \(1 step\(s\)\)/)
  const last = (await muts()).at(-1)
  assert.equal(last.op, 'updateDoc')
  assert.equal(last.attachedTo, 'i-1')
  assert.deepEqual({ title: last.data.title, status: last.data.status }, { title: 'Old title', status: 'st-todo' })
  assert.match(await call('undo_changes', { count: 1, dryRun: true }), /Nothing to undo/)
})

test('undo_changes: a created issue is removed, a deleted one re-created with the same id and data', async () => {
  const created = await call('create_issue', { projectIdentifier: 'PROJ', title: 'Throwaway' })
  assert.match(created, /PROJ-2/)
  await call('undo_changes', { count: 1, dryRun: false })
  const removed = (await muts()).at(-1)
  assert.equal((await muts()).filter((m) => m.attachedTo === 'p-1' && m.op === 'updateDoc' && m.data?.$inc == null).length, 0, 'the project issue counter is never wound back')
  assert.match(removed.op, /^remove(Doc|Collection)$/)
  assert.equal(removed._class, tracker.class.Issue)

  await call('delete_issue', { identifier: 'PROJ-1' })
  docs.splice(docs.findIndex((d) => d._id === 'i-1'), 1) // the fake does not apply removals itself
  const plan = await call('undo_changes', { count: 1, dryRun: true })
  assert.match(plan, /re-create PROJ-1: Old title/)
  await call('undo_changes', { count: 1, dryRun: false })
  const recreated = (await muts()).filter((m) => m.op === 'addCollection' || m.op === 'createDoc').at(-1)
  assert.equal(recreated.data.title, 'Old title')
  assert.equal(recreated.data.identifier, 'PROJ-1')
})

test('undo_changes: skipped when someone changed the object since; force overrides', async () => {
  await call('update_issue', { identifier: 'PROJ-1', title: 'Mine' })
  docs.find((d) => d._id === 'i-1')!.modifiedOn = 999 // an edit by someone else after ours
  const before = (await muts()).length
  const out = await call('undo_changes', { count: 1, dryRun: false })
  assert.match(out, /⚠️ skipped — changed since: PROJ-1: Old title \(force: true undoes anyway\)/)
  assert.equal((await muts()).length, before)
  assert.match(await call('undo_changes', { count: 1, dryRun: false, force: true }), /✅ undone/)
})

test('undo_changes: newest first over several calls; each connection manager (HTTP session) has its own history', async () => {
  await call('update_issue', { identifier: 'PROJ-1', title: 'A' })
  await call('update_issue', { identifier: 'PROJ-1', priority: 'High' })
  const plan = await call('undo_changes', { count: 2, dryRun: true })
  assert.ok(plan.indexOf('restore priority') < plan.indexOf('restore title'), 'newest first')
  setConnectionManager(createFakeEnv({ workspaces: [PERSONAL], data: { [W]: docs } }).manager)
  assert.match(await call('undo_changes', { count: 5, dryRun: true }), /Nothing to undo/)
})

test('reads are not recorded and undo itself is not recorded', async () => {
  await call('list_issues', { projectIdentifier: 'PROJ' })
  assert.match(await call('undo_changes', { count: 1, dryRun: true }), /Nothing to undo/)
})

test('undo_changes: one undo after another — our own undo does not count as someone else\'s edit', async () => {
  await call('update_issue', { identifier: 'PROJ-1', title: 'First' })
  await call('update_issue', { identifier: 'PROJ-1', title: 'Second' })
  const doc = docs.find((d) => d._id === 'i-1')!
  // The real server bumps modifiedOn on every write; emulate it for our undo below.
  const conn: any = await getConnection(W)
  const orig = conn.updateDoc.bind(conn)
  conn.updateDoc = async (...a: any[]) => { const r = await orig(...a); if (a[2] === 'i-1') doc.modifiedOn = Number(doc.modifiedOn ?? 0) + 1; return r }
  assert.match(await call('undo_changes', { count: 1, dryRun: false }), /✅ undone/)
  assert.match(await call('undo_changes', { count: 1, dryRun: false }), /✅ undone/)
})
