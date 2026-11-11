// 3.0 tools: inbox, activity, planner, calendar, chat threads/reactions, GitHub PRs, contacts, generic access.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import contact from '@hcengineering/contact'
import chunter from '@hcengineering/chunter'
import core from '@hcengineering/core'
import { setConnectionManager, getConnection } from '../src/connection'
import { listNotifications, markNotificationsRead, manageNotifications } from '../src/tools/inbox'
import { getActivity } from '../src/tools/activity'
import { listTodos, createTodo, updateTodo, deleteTodo, scheduleTodo } from '../src/tools/planner'
import { listEvents, createEvent, updateEvent } from '../src/tools/calendar'
import { listThread, replyToMessage, updateMessage, addReaction, removeReaction, pinMessage, listMessages } from '../src/tools/channels'
import { listPullRequests, getPullRequest } from '../src/tools/github'
import { listPersons, createPerson, updatePerson, addContactChannel, getPerson } from '../src/tools/contacts'
import { listClasses, describeClass, queryDocuments, genericCreate, genericUpdate, genericDelete } from '../src/tools/generic'
import { C } from '../src/utils/classes'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const T0 = Date.UTC(2026, 10, 2, 9)

function data (): FakeDoc[] {
  return [
    { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj' },
    { _id: 'st-1', _class: tracker.class.IssueStatus, name: 'In Progress' },
    { _id: 'i-1', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-1', title: 'Login bug', attachedTo: tracker.ids.NoParent },
    { _id: 'me', _class: contact.class.Person, space: 'contact:space:Contacts', name: 'Keks,Jo', personUuid: 'acc-1', [contact.mixin.Employee]: { active: true } },
    { _id: 'me', _class: contact.mixin.Employee, name: 'Keks,Jo', active: true },
    { _id: 'ann', _class: contact.class.Person, space: 'contact:space:Contacts', name: 'Other,Ann', personUuid: 'acc-2', [contact.mixin.Employee]: { active: true } },
    { _id: 'ann', _class: contact.mixin.Employee, name: 'Other,Ann', active: true },
    { _id: 'bob', _class: contact.class.Person, space: 'contact:space:Contacts', name: 'Smith,Bob', city: 'Berlin' },
    { _id: 'bob2', _class: contact.class.Person, space: 'contact:space:Contacts', name: 'Smith,Bobby' },
    { _id: 'ch-1', _class: contact.class.Channel, space: 'contact:space:Contacts', attachedTo: 'bob', attachedToClass: contact.class.Person, provider: 'contact:channelProvider:Email', value: 'bob@example.com' },
    { _id: 'social-id', _class: contact.class.SocialIdentity, attachedTo: 'me' },
    { _id: 'sid-ann', _class: contact.class.SocialIdentity, attachedTo: 'ann' },
    // Inbox: two notifications about PROJ-1, one about a PR; one belongs to another account.
    { _id: 'ctx-1', _class: C.DocNotifyContext, space: 's', user: 'acc-1', objectId: 'i-1', objectClass: tracker.class.Issue },
    { _id: 'ctx-2', _class: C.DocNotifyContext, space: 's', user: 'acc-1', objectId: 'pr-1', objectClass: C.PullRequest },
    { _id: 'n-1', _class: C.InboxNotification, space: 's', user: 'acc-1', docNotifyContext: 'ctx-1', isViewed: false, archived: false, createdOn: T0 + 2 },
    { _id: 'n-2', _class: C.InboxNotification, space: 's', user: 'acc-1', docNotifyContext: 'ctx-1', isViewed: false, archived: false, createdOn: T0 + 1 },
    { _id: 'n-3', _class: C.InboxNotification, space: 's', user: 'acc-1', docNotifyContext: 'ctx-2', isViewed: false, archived: false, createdOn: T0 },
    { _id: 'n-4', _class: C.InboxNotification, space: 's', user: 'acc-2', docNotifyContext: 'ctx-x', isViewed: false, archived: false, createdOn: T0 },
    // Activity on PROJ-1
    { _id: 'a-1', _class: C.DocUpdateMessage, attachedTo: 'i-1', createdBy: 'social-id', createdOn: T0, action: 'create' },
    { _id: 'a-2', _class: C.DocUpdateMessage, attachedTo: 'i-1', createdBy: 'sid-ann', createdOn: T0 + 60_000, action: 'update', attributeUpdates: { attrKey: 'status', attrClass: tracker.class.IssueStatus, set: ['st-1'], added: [], removed: [] } },
    // Chat: a channel message with one thread reply; a comment on the issue
    { _id: 'm-1', _class: chunter.class.ChatMessage, space: 'chan', attachedTo: 'chan', attachedToClass: chunter.class.Channel, collection: 'messages', message: 'hello', createdBy: 'social-id', createdOn: T0, replies: 1 },
    { _id: 'r-1', _class: C.ThreadMessage, space: 'chan', attachedTo: 'm-1', attachedToClass: chunter.class.ChatMessage, collection: 'replies', message: 'hi back', createdBy: 'sid-ann', createdOn: T0 + 1 },
    { _id: 'chan', _class: chunter.class.Channel, name: 'general' },
    { _id: 'rx-1', _class: C.Reaction, space: 'chan', attachedTo: 'm-1', emoji: '👍', createBy: 'social-id' },
    // Planner + calendar
    { _id: 'acc-1_calendar', _class: C.Calendar, hidden: false },
    { _id: 'td-1', _class: C.ToDo, space: 'time:space:ToDos', title: 'Write report', user: 'me', doneOn: null, priority: 3, rank: '0|a', attachedTo: 'time:ids:NotAttached', attachedToClass: C.ToDo, collection: 'todos', visibility: 'private', dueDate: Date.UTC(2026, 10, 5) },
    { _id: 'td-2', _class: C.ToDo, space: 'time:space:ToDos', title: 'Old task', user: 'me', doneOn: T0, priority: 0, rank: '0|b', attachedTo: 'i-1', attachedToClass: tracker.class.Issue, collection: 'todos' },
    { _id: 'td-3', _class: C.ToDo, space: 'time:space:ToDos', title: 'Someone else', user: 'ann', doneOn: null, priority: 3, rank: '0|c' },
    { _id: 'ev-1', _class: C.Event, space: 'calendar:space:Calendar', title: 'Standup', date: T0, dueDate: T0 + 900_000, allDay: false, participants: ['me', 'ann'], attachedTo: 'calendar:ids:NoAttached', attachedToClass: C.Event, collection: 'events' },
    { _id: 'ev-2', _class: C.Event, space: 'calendar:space:Calendar', title: 'Next month', date: T0 + 40 * 86_400_000, dueDate: T0 + 40 * 86_400_000 + 1, allDay: false },
    // GitHub
    { _id: 'pr-1', _class: C.PullRequest, space: 'p-1', identifier: 'PROJ-7', title: 'Fix login', state: 0, reviewDecision: 1, attachedTo: 'i-1', modifiedOn: T0, 'github:mixin:GithubIssue': { githubNumber: 12, url: 'https://github.com/o/r/pull/12' }, head: { name: 'fix' }, base: { name: 'main' }, commits: 2, files: 3 },
    { _id: 'pr-2', _class: C.PullRequest, space: 'p-1', identifier: 'PROJ-8', title: 'Merged thing', state: 2, attachedTo: tracker.ids.NoParent, modifiedOn: T0 },
    { _id: 'rv-1', _class: C.PullRequestReview, attachedTo: 'pr-1', state: 2, body: '', createdBy: 'sid-ann', createdOn: T0 },
    { _id: 'rc-1', _class: C.ReviewComment, attachedTo: 'pr-1', path: 'src/a.ts', line: 10, body: 'nit', createdBy: 'sid-ann', createdOn: T0 },
    // Generic: a class without a dedicated tool, and a secret-bearing doc
    { _id: 'vac-1', _class: 'recruit:class:Vacancy', space: 'core:space:Space', name: 'Engineer', location: 'Remote' },
    { _id: 'auth-1', _class: 'github:class:GithubAuthentication', space: 's', login: 'jo', accessToken: 'ghp_SECRET', nested: { refreshToken: 'r_SECRET' } }
  ]
}

let env: ReturnType<typeof createFakeEnv>
let client: any
beforeEach(async () => {
  env = createFakeEnv({ workspaces: [PERSONAL], data: { jokeks2023: data() } })
  setConnectionManager(env.manager)
  client = await getConnection(W)
  client.classes = {
    [core.class.Doc]: {},
    [core.class.AttachedDoc]: { extends: core.class.Doc },
    [core.class.Space]: { extends: core.class.Doc, domain: 'space' },
    'recruit:class:Vacancy': { extends: core.class.Space, attrs: { name: 'core:class:TypeString', location: 'core:class:TypeString' } },
    'recruit:class:Applicant': { extends: core.class.AttachedDoc, domain: 'task', attrs: { title: 'core:class:TypeString', status: 'core:class:RefTo' } },
    'recruit:class:Opinion': { extends: core.class.AttachedDoc, domain: 'recruit', attrs: { value: 'core:class:TypeString' } },
    'github:class:GithubAuthentication': { extends: core.class.Doc, domain: 'github', attrs: { login: 'core:class:TypeString', accessToken: 'core:class:TypeString' } },
    'core:class:TxCUD': { extends: core.class.Doc, domain: 'tx' },
    // Real class hierarchy, so base-class queries (Task, ActivityMessage, Event) find derived docs.
    'task:class:Task': { extends: core.class.AttachedDoc },
    [tracker.class.Issue]: { extends: 'task:class:Task' },
    [C.PullRequest]: { extends: 'task:class:Task' },
    [C.ActivityMessage]: { extends: core.class.AttachedDoc },
    [C.DocUpdateMessage]: { extends: C.ActivityMessage },
    [chunter.class.ChatMessage]: { extends: C.ActivityMessage },
    [C.ThreadMessage]: { extends: chunter.class.ChatMessage },
    [C.Event]: { extends: core.class.AttachedDoc },
    [C.WorkSlot]: { extends: C.Event },
    [C.ToDo]: { extends: core.class.AttachedDoc },
    [C.ProjectToDo]: { extends: C.ToDo }
  }
})
afterEach(async () => {
  await env.manager.closeAll()
  setConnectionManager(null)
})

const text = (r: { content: Array<{ text: string }> }): string => r.content[0].text
const muts = (): any[] => env.clients.get(W)!.mutations

// ── Inbox ──
test('list_notifications groups unread notifications of the current account by object', async () => {
  const out = text(await listNotifications({ unreadOnly: true, limit: 30 }))
  assert.match(out, /Notifications \(3 unread\)/)
  assert.match(out, /\*\*PROJ-1: Login bug\*\* \(Issue\) — 2 notification\(s\), 2 unread/)
  assert.match(out, /\*\*PROJ-7: Fix login\*\* \(GithubPullRequest\) — 1 notification/)
  assert.doesNotMatch(out, /n-4/)
})

test('mark_notifications_read by object marks only that object and stamps the context', async () => {
  await assert.rejects(markNotificationsRead({ workspace: W, archive: false }), /exactly one of/)
  await assert.rejects(markNotificationsRead({ workspace: W, all: true, object: 'PROJ-1', archive: false }), /exactly one of/)
  const out = text(await markNotificationsRead({ workspace: W, object: 'PROJ-1', archive: false }))
  assert.match(out, /2 notification\(s\) marked read \(PROJ-1: Login bug\)/)
  const m = muts()
  assert.deepEqual(m.filter((x) => x._class === C.InboxNotification).map((x) => [x.attachedTo, x.data]), [['n-1', { isViewed: true }], ['n-2', { isViewed: true }]])
  assert.equal(m.find((x) => x._class === C.DocNotifyContext).attachedTo, 'ctx-1')
  assert.equal(typeof m.find((x) => x._class === C.DocNotifyContext).data.lastViewedTimestamp, 'number')
})

test('mark_notifications_read all + archive', async () => {
  const out = text(await markNotificationsRead({ workspace: W, all: true, archive: true }))
  assert.match(out, /3 notification\(s\) archived/)
  assert.ok(muts().filter((x) => x._class === C.InboxNotification).every((x) => x.data.archived === true && x.data.isViewed === true))
})

// ── Activity ──
test('get_activity renders who changed what, with referenced names', async () => {
  const out = text(await getActivity({ object: 'PROJ-1', limit: 50 }))
  assert.match(out, /Activity of PROJ-1: Login bug/)
  assert.match(out, /\*\*Jo Keks\*\* created/)
  assert.match(out, /\*\*Ann Other\*\* status: → In Progress/)
})

// ── Planner ──
test('list_todos: own open to-dos with due date, priority and linked issue', async () => {
  const open = text(await listTodos({ status: 'open', limit: 50 }))
  assert.match(open, /\[ \] \*\*Write report\*\* · due 2026-11-05 — `td-1`/)
  assert.doesNotMatch(open, /Old task|Someone else/)
  const done = text(await listTodos({ status: 'done', limit: 50 }))
  assert.match(done, /\[x\] \(done 2026-11-02\) \*\*Old task\*\* · High · PROJ-1: Login bug/)
})

test('create_todo: private planner to-do, or ProjectToDo on an issue', async () => {
  await createTodo({ workspace: W, title: 'Plain', priority: 'High', dueDate: '2026-11-10' })
  const [a] = muts()
  assert.equal(a.op, 'addCollection')
  assert.equal(a._class, C.ToDo)
  assert.equal(a.attachedTo, 'time:ids:NotAttached')
  assert.equal(a.data.visibility, 'private')
  assert.equal(a.data.priority, 0)
  assert.equal(a.data.user, 'me')
  assert.equal(a.data.doneOn, null)
  await createTodo({ workspace: W, title: 'On issue', priority: 'NoPriority', issue: 'PROJ-1' })
  const b = muts()[1]
  assert.equal(b._class, C.ProjectToDo)
  assert.equal(b.attachedTo, 'i-1')
  assert.equal(b.data.attachedSpace, 'p-1')
  assert.equal(b.data.visibility, 'public')
  await assert.rejects(createTodo({ workspace: W, title: 'x', priority: 'Low', dueDate: 'soon' }), /Invalid dueDate/)
})

test('update_todo marks done/reopens; delete_todo removes from its collection', async () => {
  const out = text(await updateTodo({ workspace: W, todoId: 'td-1', done: true }))
  assert.match(out, /updated \(done\)/)
  assert.equal(typeof muts()[0].data.doneOn, 'number')
  await updateTodo({ workspace: W, todoId: 'td-2', done: false })
  assert.equal(muts()[1].data.doneOn, null)
  assert.match(text(await updateTodo({ workspace: W, todoId: 'td-1', done: false })), /Nothing to update/)
  await deleteTodo({ workspace: W, todoId: 'td-1' })
  assert.equal(muts()[2].op, 'removeCollection')
})

test('schedule_todo creates a WorkSlot in the personal calendar', async () => {
  await scheduleTodo({ workspace: W, todoId: 'td-1', start: '2026-11-03T09:00:00Z', durationMinutes: 45 })
  const [m] = muts()
  assert.equal(m._class, C.WorkSlot)
  assert.equal(m.attachedTo, 'td-1')
  assert.equal(m.data.calendar, 'acc-1_calendar')
  assert.equal(m.data.dueDate - m.data.date, 45 * 60_000)
  assert.equal(m.data.visibility, 'freeBusy')
  assert.match(m.data.eventId, /^[0-9a-v]+$/)
})

// ── Calendar ──
test('list_events shows events overlapping the range', async () => {
  const out = text(await listEvents({ from: '2026-11-01', to: '2026-11-07', limit: 50 }))
  assert.match(out, /2026-11-02 09:00–09:15 \*\*Standup\*\* · Jo Keks, Ann Other — `ev-1`/)
  assert.doesNotMatch(out, /Next month/)
})

test('create_event: participants by name, all-day normalized, end after start', async () => {
  await createEvent({ workspace: W, title: 'Offsite', start: '2026-11-20T15:00:00Z', allDay: true, participants: ['ann'] })
  const [m] = muts()
  assert.equal(m._class, C.Event)
  assert.equal(m.data.date, Date.UTC(2026, 10, 20))
  assert.equal(m.data.dueDate, Date.UTC(2026, 10, 21) - 1)
  assert.deepEqual(m.data.participants, ['me', 'ann'])
  assert.equal(m.data.calendar, 'acc-1_calendar')
  await assert.rejects(createEvent({ workspace: W, title: 'x', start: '2026-11-20T15:00Z', end: '2026-11-20T14:00Z', allDay: false }), /end must be after start/)
})

test('update_event keeps the duration when only the start moves', async () => {
  await updateEvent({ workspace: W, eventId: 'ev-1', start: '2026-11-02T10:00:00Z' })
  assert.deepEqual(muts()[0].data, { date: Date.UTC(2026, 10, 2, 10), dueDate: Date.UTC(2026, 10, 2, 10) + 900_000 })
})

// ── Chat ──
test('list_messages shows authors, ids and thread info; list_thread shows replies', async () => {
  assert.match(text(await listMessages({ spaceId: 'chan', limit: 50 })), /Jo Keks\*\* hello _\(1 replies\)_ — `m-1`/)
  const thread = text(await listThread({ messageId: 'm-1', limit: 50 }))
  assert.match(thread, /> \*\*\[2026-11-02\] Ann Other\*\* hi back — `r-1`/)
})

test('reply_to_message posts into the root thread, also when replying to a reply', async () => {
  await replyToMessage({ workspace: W, messageId: 'r-1', message: 'ok' })
  const [m] = muts()
  assert.equal(m._class, C.ThreadMessage)
  assert.equal(m.attachedTo, 'm-1')
  assert.equal(m.data.objectId, 'chan')
})

test('reactions are per user and not duplicated; edit and pin use the message collection', async () => {
  assert.match(text(await addReaction({ workspace: W, messageId: 'm-1', emoji: '👍' })), /already reacted/)
  await addReaction({ workspace: W, messageId: 'm-1', emoji: '🎉' })
  assert.equal(muts()[0].data.createBy, 'social-id')
  await removeReaction({ workspace: W, messageId: 'm-1', emoji: '👍' })
  assert.equal(muts()[1].op, 'removeCollection')
  await updateMessage({ workspace: W, messageId: 'm-1', message: 'hello!' })
  assert.equal(muts()[2].data.message, 'hello!')
  await pinMessage({ workspace: W, messageId: 'm-1', pinned: true })
  assert.deepEqual(muts()[3].data, { isPinned: true })
})

// ── GitHub ──
test('list_pull_requests filters by state and issue; get_pull_request shows reviews', async () => {
  const open = text(await listPullRequests({ state: 'open', limit: 30 }))
  assert.match(open, /\*\*PROJ-7\*\* \[open · approved\] Fix login/)
  assert.doesNotMatch(open, /PROJ-8/)
  assert.match(text(await listPullRequests({ state: 'merged', limit: 30 })), /PROJ-8/)
  assert.match(text(await listPullRequests({ state: 'all', issue: 'PROJ-1', limit: 30 })), /PROJ-7/)
  const pr = text(await getPullRequest({ identifier: 'PROJ-7' }))
  assert.match(pr, /\*\*Issue:\*\* PROJ-1: Login bug/)
  assert.match(pr, /\*\*Branch:\*\* fix → main · 3 file\(s\) changed/)
  assert.match(pr, /Ann Other: approved/)
  assert.match(pr, /`src\/a\.ts:10` Ann Other: nit/)
})

// ── Contacts ──
test('persons: list with channels, exact names win, ambiguity is reported', async () => {
  const out = text(await listPersons({ limit: 100, employeesOnly: false }))
  assert.match(out, /\*\*Bob Smith\*\* · Berlin · Email: bob@example\.com/)
  assert.match(out, /\*\*Jo Keks\*\* \(member\)/)
  assert.match(text(await getPerson({ person: 'Bob Smith' })), /Contact channels:\*\* Email: bob@example\.com/)
  await assert.rejects(getPerson({ person: 'smith' }), /ambiguous/)
})

test('create_person stores "Last,First" with channels; duplicates are not created', async () => {
  await createPerson({ workspace: W, firstName: 'Eve', lastName: 'Adams', channels: [{ provider: 'Phone', value: '+49 1' }] })
  assert.deepEqual(muts()[0].data, { name: 'Adams,Eve', city: '', avatarType: 'color' })
  assert.equal(muts()[1].data.provider, 'contact:channelProvider:Phone')
  assert.match(text(await createPerson({ workspace: W, firstName: 'Bob', lastName: 'Smith' })), /already exists/)
  await updatePerson({ workspace: W, person: 'bob', lastName: 'Jones' })
  assert.deepEqual(muts()[2].data, { name: 'Jones,Bob' })
  assert.match(text(await addContactChannel({ workspace: W, person: 'bob', provider: 'Email', value: 'bob@example.com' })), /already has/)
})

// ── Generic ──
test('list_classes / describe_class expose the model; tx is hidden', async () => {
  const out = text(await listClasses({ module: 'recruit', withCounts: true }))
  assert.match(out, /`recruit:class:Applicant`/)
  assert.match(out, /`recruit:class:Vacancy` — 1 doc/)
  assert.doesNotMatch(text(await listClasses({ withCounts: false })), /TxCUD/)
  const d = text(await describeClass({ className: 'recruit:class:Applicant' }))
  assert.match(d, /Attached doc:\*\* yes/)
  assert.match(d, /`title`: TypeString/)
  await assert.rejects(describeClass({ className: 'nope:class:X' }), /Unknown class/)
})

test('query_documents redacts secrets', async () => {
  const out = text(await queryDocuments({ className: 'github:class:GithubAuthentication', limit: 20 }))
  assert.match(out, /"login": "jo"/)
  assert.doesNotMatch(out, /SECRET/)
  assert.match(out, /"accessToken": "\[redacted\]"/)
})

test('generic writes: dry run by default, unknown attributes and system classes rejected', async () => {
  const dry = text(await genericCreate({ workspace: W, className: 'recruit:class:Opinion', space: 's', attributes: { value: 'good' }, attachTo: { id: 'vac-1', className: 'recruit:class:Vacancy', collection: 'opinions' }, dryRun: true }))
  assert.match(dry, /Dry run — would create recruit:class:Opinion/)
  assert.equal(muts().length, 0)
  await assert.rejects(genericCreate({ workspace: W, className: 'recruit:class:Opinion', space: 's', attributes: { value: 'x' }, dryRun: true }), /attached document — pass attachTo/)
  await assert.rejects(genericUpdate({ workspace: W, className: 'recruit:class:Vacancy', id: 'vac-1', attributes: { name: 'x' }, dryRun: false }), /dedicated tools/)
  await assert.rejects(genericUpdate({ workspace: W, className: 'github:class:GithubAuthentication', id: 'auth-1', attributes: { login: 'x' }, dryRun: false }), /dedicated tools/)
  await assert.rejects(genericCreate({ workspace: W, className: 'recruit:class:Opinion', space: 's', attributes: { bogus: 1 }, attachTo: { id: 'vac-1', className: 'recruit:class:Vacancy', collection: 'opinions' }, dryRun: true }), /Unknown attribute\(s\) for recruit:class:Opinion: bogus/)
  const real = text(await genericCreate({ workspace: W, className: 'recruit:class:Opinion', space: 's', attributes: { value: 'good' }, attachTo: { id: 'vac-1', className: 'recruit:class:Vacancy', collection: 'opinions' }, dryRun: false }))
  assert.match(real, /Created recruit:class:Opinion/)
  assert.equal(muts()[0].op, 'addCollection')
})

test('generic_delete needs dryRun=false AND confirm=true', async () => {
  client.docs.push({ _id: 'op-1', _class: 'recruit:class:Opinion', space: 's', attachedTo: 'vac-1', attachedToClass: 'recruit:class:Vacancy', collection: 'opinions', value: 'x' })
  assert.match(text(await genericDelete({ workspace: W, className: 'recruit:class:Opinion', id: 'op-1', dryRun: false, confirm: false })), /Dry run/)
  assert.equal(muts().length, 0)
  await genericDelete({ workspace: W, className: 'recruit:class:Opinion', id: 'op-1', dryRun: false, confirm: true })
  assert.equal(muts()[0].op, 'removeCollection')
})

test('manage_notifications: pin/hide the context, unread rolls back last-viewed, follow adds my collaborator row once', async () => {
  const run = async (action: string, object = 'PROJ-1'): Promise<string> => text(await manageNotifications({ workspace: W, object, action } as any))
  const conn: any = await getConnection(W)
  assert.match(await run('pin'), /Pinned PROJ-1/)
  assert.match(await run('hide'), /Hidden PROJ-1: Login bug — it comes back with new activity/)
  assert.match(await run('unread'), /PROJ-1: Login bug is unread again \(2 notification\(s\)\)/)
  const ctxUpdates = conn.mutations.filter((m: any) => m._class === C.DocNotifyContext).map((m: any) => m.data)
  assert.deepEqual(ctxUpdates, [{ isPinned: true }, { hidden: true }, { lastViewedTimestamp: T0 + 1 - 1 }])
  assert.match(await run('follow'), /You now follow PROJ-1: Login bug/)
  const adds = conn.mutations.filter((m: any) => m.op === 'addCollection' && m._class === C.Collaborator)
  assert.equal(adds.length, 1)
  assert.deepEqual(adds[0].data, { collaborator: 'acc-1' })
  await assert.rejects(manageNotifications({ workspace: W, object: 'pr-x', action: 'pin' } as any), /Object 'pr-x' not found/)
})
