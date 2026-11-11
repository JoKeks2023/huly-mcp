// 3.4: list_issues filters for title text and due date.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { setConnectionManager } from '../src/connection'
import { listIssues } from '../src/tools/issues'
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
        { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', space: 'p-1' },
        { _id: 'st-todo', _class: tracker.class.IssueStatus, name: 'Todo', category: task.statusCategory.ToDo },
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
