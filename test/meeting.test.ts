// Meeting notes → issues: action items with assignee and due date, then create + link.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import contact from '@hcengineering/contact'
import { setConnectionManager, getConnection } from '../src/connection'
import { actionsFromMarkup, parseActionLine } from '../src/utils/meeting'
import { issuesFromMeeting } from '../src/tools/agent'
import { markdownToProseMirror } from '../src/utils/markdown'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const text = (r: any): string => r.content[0].text
const savedFetch = globalThis.fetch

test('parseActionLine: prefix, @assignee and due date leave the title', () => {
  assert.deepEqual(parseActionLine('Action: @Ann send the slides bis 10.11.2026'), { title: 'send the slides', description: undefined, assignee: 'Ann', dueDate: '2026-11-10' })
  assert.deepEqual(parseActionLine('TODO: Fix login (due 2026-11-07)'), { title: 'Fix login', description: undefined, assignee: undefined, dueDate: '2026-11-07' })
  // Not a real date: stays in the title.
  assert.equal(parseActionLine('Check 2026-02-31 report')?.dueDate, undefined)
  assert.equal(parseActionLine('TODO: '), undefined)
})

test('actionsFromMarkup: checkboxes, prefixed lines and the "Next steps" section; discussion is ignored', () => {
  const md = [
    '# Weekly 2026-11-05', '', '## Discussion', '', '- Login is slow', '- TODO: @Bob profile the login', '',
    'Aufgabe: Update docs', '', '## Next steps', '', '- @Ann ship 3.2.0 by 2026-11-10', '- Write blog post', '',
    '## Notes', '', '- not a task', '- [ ] Book room', '- [x] Send agenda', ''
  ].join('\n')
  const plan = actionsFromMarkup(markdownToProseMirror(md))
  assert.deepEqual(plan.tasks.map((t) => [t.title, t.assignee, t.dueDate]), [
    ['profile the login', 'Bob', undefined],
    ['Update docs', undefined, undefined],
    ['ship 3.2.0', 'Ann', '2026-11-10'],
    ['Write blog post', undefined, undefined],
    ['Book room', undefined, undefined]
  ])
  assert.equal(plan.skippedDone, 1)
})

test('actionsFromMarkup: Huly mentions and todo items', () => {
  const mention = { type: 'reference', attrs: { id: 'ann', objectclass: 'contact:class:Person', label: 'Ann Doe' } }
  const doc = {
    type: 'doc',
    content: [{
      type: 'todoList',
      content: [
        { type: 'todoItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [mention, { type: 'text', text: ' review PR' }] }] },
        { type: 'todoItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }] }
      ]
    }]
  }
  assert.deepEqual(actionsFromMarkup(doc), { tasks: [{ title: 'review PR', description: undefined, assignee: 'Ann Doe', dueDate: undefined }], skippedDone: 1 })
})

function data (): FakeDoc[] {
  return [
    { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', sequence: 1, space: 'p-1' },
    { _id: 'st-b', _class: tracker.class.IssueStatus, name: 'Backlog' },
    { _id: 'tt', _class: task.class.TaskType, name: 'Issue' },
    { _id: 'ann', _class: contact.class.Person, name: 'Doe,Ann' },
    { _id: 'ann', _class: contact.mixin.Employee, name: 'Doe,Ann', active: true },
    { _id: 'i-1', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-1', title: 'Write blog post', status: 'st-b', parents: [] },
    { _id: 'doc-1', _class: 'document:class:Document', title: 'Weekly', content: 'blob-weekly' },
    { _id: 'doc-2', _class: 'document:class:Document', title: 'Chat', content: 'blob-chat' }
  ]
}

beforeEach(() => {
  process.env.HULY_FRONT_URL = 'https://huly.example.com'
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return new Response(JSON.stringify([{ key: 'file', id: 'blob-new' }]), { status: 200 })
    const md = String(url).includes('blob-chat')
      ? '# Chat\n\nWe talked.\n'
      : '# Weekly\n\n## Action items\n\n- @Ann ship release bis 10.11.2026\n- @Zed fix CI\n- Write blog post\n'
    return new Response(JSON.stringify(markdownToProseMirror(md)), { status: 200 })
  }) as typeof fetch
  setConnectionManager(createFakeEnv({ workspaces: [PERSONAL], data: { [W]: data() } }).manager)
})
afterEach(() => {
  globalThis.fetch = savedFetch
  delete process.env.HULY_FRONT_URL
  setConnectionManager(null)
})

test('issues_from_meeting: dry run resolves people, flags unknown ones, skips duplicates, writes nothing', async () => {
  const out = text(await issuesFromMeeting({ workspace: W, document: 'weekly', projectIdentifier: 'PROJ', skipDuplicates: true, dryRun: true } as any))
  assert.match(out, /"Weekly" → 3 action item\(s\)/)
  assert.match(out, /#1 create "ship release" · Ann Doe · due 2026-11-10/)
  assert.match(out, /#2 create "fix CI" · ⚠️ Member 'Zed' not found\. → unassigned/)
  assert.match(out, /#3 "Write blog post" → exists as \*\*PROJ-1\*\*, skipped/)
  assert.equal(((await getConnection(W)) as any).mutations.length, 0)
})

test('issues_from_meeting: creates with assignee and due date and links each issue to the document', async () => {
  const out = text(await issuesFromMeeting({ workspace: W, document: 'doc-1', projectIdentifier: 'PROJ', skipDuplicates: true, dryRun: false } as any))
  assert.match(out, /PROJ-2: ship release · Ann Doe · due 2026-11-10/)
  assert.match(out, /PROJ-3: fix CI · ⚠️/)
  assert.match(out, /PROJ-1: Write blog post \(exists, skipped\)/)
  const muts: any[] = ((await getConnection(W)) as any).mutations
  const adds = muts.filter((m) => m.op === 'addCollection')
  assert.equal(adds.length, 2)
  assert.equal(adds[0].data.assignee, 'ann')
  assert.equal(adds[0].data.dueDate, Date.parse('2026-11-10'))
  assert.equal(adds[1].data.assignee, null)
  assert.equal(muts.filter((m) => m.op === 'updateDoc' && m.data?.relations != null).length, 2)
})

test('issues_from_meeting: a document without action items is a clear error', async () => {
  await assert.rejects(issuesFromMeeting({ workspace: W, document: 'Chat', projectIdentifier: 'PROJ', skipDuplicates: true, dryRun: true } as any), /No open action items in "Chat"/)
})
