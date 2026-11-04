// my_day: calendar, to-dos, my issues, reviews and inbox in one call.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import contact from '@hcengineering/contact'
import task from '@hcengineering/task'
import core from '@hcengineering/core'
import { setConnectionManager, getConnection } from '../src/connection'
import { myDay, dayStart } from '../src/tools/overview'
import { C } from '../src/utils/classes'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const D = Date.UTC(2026, 10, 4)
const H = 3_600_000

function data (): FakeDoc[] {
  return [
    { _id: 'me', _class: contact.class.Person, space: 'contact:space:Contacts', name: 'Keks,Jo', personUuid: 'acc-1' },
    { _id: 'ann', _class: contact.class.Person, space: 'contact:space:Contacts', name: 'Other,Ann', personUuid: 'acc-2' },
    { _id: 'social-id', _class: contact.class.SocialIdentity, attachedTo: 'me' },
    // Calendar: mine today, someone else's today, mine tomorrow
    { _id: 'ev-1', _class: C.Event, title: 'Standup', date: D + 9 * H, dueDate: D + 9.25 * H, participants: ['me', 'ann'] },
    { _id: 'ev-2', _class: C.Event, title: 'Ann only', date: D + 10 * H, dueDate: D + 11 * H, participants: ['ann'] },
    { _id: 'ev-3', _class: C.Event, title: 'Tomorrow', date: D + 30 * H, dueDate: D + 31 * H, participants: ['me'] },
    // To-dos: one without due date (ranked first), one overdue, one done
    { _id: 'td-1', _class: C.ToDo, title: 'Someday', user: 'me', doneOn: null, priority: 0, rank: '0|a' },
    { _id: 'td-2', _class: C.ToDo, title: 'Overdue thing', user: 'me', doneOn: null, priority: 1, rank: '0|b', dueDate: D - 2 * 86_400_000 },
    { _id: 'td-3', _class: C.ToDo, title: 'Finished', user: 'me', doneOn: D, priority: 0, rank: '0|c' },
    // Issues: in progress, todo with due date, done; and one for Ann
    { _id: 'st-a', _class: 'core:class:Status', name: 'In Progress', category: task.statusCategory.Active },
    { _id: 'st-t', _class: 'core:class:Status', name: 'Todo', category: task.statusCategory.ToDo },
    { _id: 'st-d', _class: 'core:class:Status', name: 'Done', category: task.statusCategory.Won },
    { _id: 'i-1', _class: tracker.class.Issue, identifier: 'PROJ-1', title: 'Todo with deadline', status: 'st-t', assignee: 'me', priority: 2, dueDate: D + H },
    { _id: 'i-2', _class: tracker.class.Issue, identifier: 'PROJ-2', title: 'Working on it', status: 'st-a', assignee: 'me', priority: 0 },
    { _id: 'i-3', _class: tracker.class.Issue, identifier: 'PROJ-3', title: 'Done already', status: 'st-d', assignee: 'me' },
    { _id: 'i-4', _class: tracker.class.Issue, identifier: 'PROJ-4', title: 'Ann task', status: 'st-a', assignee: 'ann' },
    // PRs: review requested from me, my own, a merged one
    { _id: 'pr-1', _class: C.PullRequest, identifier: 'PROJ-7', title: 'Please review', state: 0, reviewers: ['me'], assignee: 'ann' },
    { _id: 'pr-2', _class: C.PullRequest, identifier: 'PROJ-8', title: 'My PR', state: 0, reviewers: ['ann'], assignee: 'me', reviewDecision: 0 },
    { _id: 'pr-3', _class: C.PullRequest, identifier: 'PROJ-9', title: 'Old merged', state: 2, reviewers: ['me'], assignee: 'me' },
    // Inbox: two unread about PROJ-1, one read, one for another account
    { _id: 'ctx-1', _class: C.DocNotifyContext, user: 'acc-1', objectId: 'i-1', objectClass: tracker.class.Issue },
    { _id: 'n-1', _class: C.InboxNotification, user: 'acc-1', docNotifyContext: 'ctx-1', isViewed: false, archived: false, createdOn: D },
    { _id: 'n-2', _class: C.InboxNotification, user: 'acc-1', docNotifyContext: 'ctx-1', isViewed: false, archived: false, createdOn: D + 1 },
    { _id: 'n-3', _class: C.InboxNotification, user: 'acc-1', docNotifyContext: 'ctx-1', isViewed: true, archived: false, createdOn: D + 2 },
    { _id: 'n-4', _class: C.InboxNotification, user: 'acc-2', docNotifyContext: 'ctx-x', isViewed: false, archived: false, createdOn: D }
  ]
}

let env: ReturnType<typeof createFakeEnv>
beforeEach(async () => {
  env = createFakeEnv({ workspaces: [PERSONAL], data: { jokeks2023: data() } })
  setConnectionManager(env.manager)
  const client: any = await getConnection(W)
  client.classes = {
    [core.class.Doc]: {},
    [core.class.AttachedDoc]: { extends: core.class.Doc },
    'task:class:Task': { extends: core.class.AttachedDoc },
    [tracker.class.Issue]: { extends: 'task:class:Task' },
    [C.PullRequest]: { extends: 'task:class:Task' },
    [C.Event]: { extends: core.class.AttachedDoc },
    [C.WorkSlot]: { extends: C.Event },
    [C.ToDo]: { extends: core.class.AttachedDoc }
  }
})
afterEach(async () => {
  await env.manager.closeAll()
  setConnectionManager(null)
})

const text = (r: { content: Array<{ text: string }> }): string => r.content[0].text

test('my_day: own events of the day, urgent to-dos first, open issues, reviews, unread inbox', async () => {
  const out = text(await myDay({ date: '2026-11-04', limit: 10 }))
  assert.match(out, /# My day — 2026-11-04/)
  // Calendar: only my event today
  assert.match(out, /## Calendar \(1\)\n- 09:00–09:15 \*\*Standup\*\*/)
  assert.doesNotMatch(out, /Ann only|Tomorrow/)
  // To-dos: overdue before the higher-ranked one without due date; done ones hidden
  assert.match(out, /## To-dos \(2 open, 1 due by today\)\n- \[ \] \*\*Overdue thing\*\* · \w+ · ⚠️ overdue \(2026-11-02\)[^\n]*\n- \[ \] \*\*Someday\*\*/)
  assert.doesNotMatch(out, /Finished/)
  // Issues: in progress first, done and other people's hidden
  assert.match(out, /## My issues \(2 open, 1 in progress\)\n- \*\*PROJ-2\*\* Working on it — In Progress\n- \*\*PROJ-1\*\* Todo with deadline — Todo · High · due today/)
  assert.doesNotMatch(out, /PROJ-3|PROJ-4/)
  // Reviews
  assert.match(out, /## Reviews \(1 for you, 1 of yours open\)/)
  assert.match(out, /👀 \*\*PROJ-7\*\* Please review/)
  assert.match(out, /\*\*PROJ-8\*\* My PR · changes requested/)
  assert.doesNotMatch(out, /PROJ-9/)
  // Inbox: only my unread
  assert.match(out, /## Inbox \(2 unread on 1 item\(s\)\)\n- \*\*PROJ-1: Todo with deadline\*\* — 2 unread/)
})

test('my_day: empty sections and bad dates', async () => {
  assert.equal(dayStart('2026-11-04'), D)
  await assert.rejects(myDay({ date: 'tomorrow-ish', limit: 10 }), /YYYY-MM-DD/)
  const out = text(await myDay({ date: '2027-01-01', limit: 1 }))
  assert.match(out, /Nothing scheduled\./)
  assert.match(out, /## To-dos \(2 open, 1 due by today\)/)
})
