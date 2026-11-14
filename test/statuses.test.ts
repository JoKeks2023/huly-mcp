// Statuses per project type and task type: "Merged" for pull requests only must not be set on issues.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { setConnectionManager } from '../src/connection'
import { updateIssue, createIssue } from '../src/tools/issues'
import { startWork } from '../src/tools/agent'
import { createIssueStatus } from '../src/tools/statuses'
import { createFakeEnv, PERSONAL } from './helpers'
import contact from '@hcengineering/contact'

const W = 'jokeks2023'
let env: ReturnType<typeof createFakeEnv>
beforeEach(() => {
  env = createFakeEnv({
    workspaces: [PERSONAL],
    data: {
      [W]: [
        { _id: 'pt', _class: task.class.ProjectType, statuses: [{ _id: 'st-backlog', taskType: 'tt-issue' }, { _id: 'st-done', taskType: 'tt-issue' }, { _id: 'st-ip', taskType: 'tt-issue' }, { _id: 'st-merged', taskType: 'tt-pr' }] },
        { _id: 'tt-issue', _class: task.class.TaskType, parent: 'pt', name: 'Issue', ofClass: tracker.class.Issue, statuses: ['st-backlog', 'st-ip', 'st-done'] },
        { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', space: 'p-1', type: 'pt', sequence: 1, defaultIssueStatus: 'st-backlog' },
        { _id: 'st-backlog', _class: tracker.class.IssueStatus, name: 'Backlog', category: task.statusCategory.UnStarted },
        { _id: 'st-ip', _class: tracker.class.IssueStatus, name: 'In Progress', category: task.statusCategory.Active },
        { _id: 'st-done', _class: tracker.class.IssueStatus, name: 'Done', category: task.statusCategory.Won },
        { _id: 'st-merged', _class: tracker.class.IssueStatus, name: 'Merged', category: task.statusCategory.Won },
        { _id: 'i-1', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-1', title: 'x', status: 'st-backlog', kind: 'tt-issue', parents: [] },
        { _id: 'me', _class: contact.class.Person, name: 'Keks,Jo' },
        { _id: 'social-id', _class: contact.class.SocialIdentity, attachedTo: 'me' }
      ]
    }
  })
  setConnectionManager(env.manager)
})
afterEach(() => { setConnectionManager(null) })

test('statuses: a pull-request-only status is refused for issues, with the statuses that work', async () => {
  await assert.rejects(updateIssue({ workspace: W, identifier: 'PROJ-1', statusName: 'Merged' } as any), /Status 'Merged' is not used for issues in PROJ \(it belongs to another task type.*Available: Backlog, In Progress, Done/)
  await assert.rejects(createIssue({ workspace: W, projectIdentifier: 'PROJ', title: 'y', priority: 'NoPriority', statusName: 'Merged' } as any), /not used for issues/)
  await assert.rejects(startWork({ workspace: W, identifier: 'PROJ-1', statusName: 'Merged', assignToMe: false } as any), /not used for issues/)
  assert.equal(env.clients.get(W)!.mutations.length, 0, 'nothing written')
  assert.match((await updateIssue({ workspace: W, identifier: 'PROJ-1', statusName: 'done' } as any)).content[0].text, /changed: status/)
})

test('create_issue_status: reuses a same-named status of another task type and adds it to the Issue workflow', async () => {
  const out = (await createIssueStatus({ workspace: W, name: 'Merged', category: 'Done', projectIdentifier: 'PROJ' } as any)).content[0].text
  assert.match(out, /"Merged".*already existed; now usable for issues in: pt/)
  const m = env.clients.get(W)!.mutations
  assert.ok(!m.some((x) => x.op === 'createDoc'), 'no duplicate status created')
  assert.ok(m.some((x) => x._class === task.class.TaskType && JSON.stringify(x.data).includes('st-merged')), 'task type got the status')
  assert.ok(m.some((x) => x._class === task.class.ProjectType && JSON.stringify(x.data).includes('tt-issue')), 'project type got { _id, taskType }')
  const again = (await createIssueStatus({ workspace: W, name: 'Done', category: 'Done', projectIdentifier: 'PROJ' } as any)).content[0].text
  assert.match(again, /already usable for issues there/)
})
