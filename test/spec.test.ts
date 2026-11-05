// Spec → issues: document structure → planned issues, then create_issue_tree + link.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { setConnectionManager, getConnection } from '../src/connection'
import { planFromMarkup } from '../src/utils/spec'
import { issuesFromDocument } from '../src/tools/agent'
import { markdownToProseMirror } from '../src/utils/markdown'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const text = (r: any): string => r.content[0].text
const savedFetch = globalThis.fetch
const p = (t: string): any => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })
const h = (level: number, t: string): any => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text: t }] })

test('planFromMarkup: Huly todo items — open ones become tasks, checked ones are counted', () => {
  const doc = {
    type: 'doc',
    content: [h(1, 'Spec'), p('Intro'), {
      type: 'todoList',
      content: [
        { type: 'todoItem', attrs: { checked: false }, content: [p('Login form'), p('with validation')] },
        { type: 'todoItem', attrs: { checked: true }, content: [p('Wireframes')] },
        { type: 'todoItem', attrs: { checked: false }, content: [p('Password reset')] }
      ]
    }]
  }
  assert.deepEqual(planFromMarkup(doc), {
    source: 'checklist',
    tasks: [{ title: 'Login form', description: 'with validation' }, { title: 'Password reset', description: undefined }],
    skippedDone: 1
  })
})

test('planFromMarkup: "[ ]" list items from Markdown count as a checklist', () => {
  const plan = planFromMarkup(markdownToProseMirror('# Plan\n\n- [ ] API endpoint\n- [x] Schema\n- plain bullet\n'))
  assert.equal(plan.source, 'checklist')
  assert.deepEqual(plan.tasks.map((t) => t.title), ['API endpoint'])
  assert.equal(plan.skippedDone, 1)
})

test('planFromMarkup: without a checklist, H2 sections become tasks with their text', () => {
  const plan = planFromMarkup(markdownToProseMirror('# Title\n\nIntro\n\n## Login\n\nUser logs in.\n\n### Detail\n\nMore.\n\n## Logout\n\nBye.\n'))
  assert.equal(plan.source, 'headings')
  assert.deepEqual(plan.tasks.map((t) => t.title), ['Login', 'Logout'])
  assert.match(plan.tasks[0].description ?? '', /User logs in\.[\s\S]*Detail[\s\S]*More\./)
  assert.equal(planFromMarkup(markdownToProseMirror('Just text.')).source, 'none')
})

function data (): FakeDoc[] {
  return [
    { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', sequence: 1, space: 'p-1' },
    { _id: 'st-b', _class: tracker.class.IssueStatus, name: 'Backlog' },
    { _id: 'tt', _class: task.class.TaskType, name: 'Issue' },
    { _id: 'i-1', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-1', title: 'Password reset', status: 'st-b', parents: [] },
    { _id: 'doc-1', _class: 'document:class:Document', title: 'Auth spec', content: 'blob-spec' },
    { _id: 'doc-2', _class: 'document:class:Document', title: 'Empty', content: null }
  ]
}

beforeEach(() => {
  process.env.HULY_FRONT_URL = 'https://huly.example.com'
  // GET = the spec's content; POST = uploads of new issue descriptions.
  globalThis.fetch = (async (_url: string, init?: RequestInit) => init?.method === 'POST'
    ? new Response(JSON.stringify([{ key: 'file', id: 'blob-new' }]), { status: 200 })
    : new Response(JSON.stringify(markdownToProseMirror('# Auth\n\n- [ ] Login form\n- [ ] Password reset\n- [x] Wireframes\n')), { status: 200 })) as typeof fetch
  setConnectionManager(createFakeEnv({ workspaces: [PERSONAL], data: { [W]: data() } }).manager)
})
afterEach(() => {
  globalThis.fetch = savedFetch
  delete process.env.HULY_FRONT_URL
  setConnectionManager(null)
})

test('issues_from_document: dry run by title shows the plan, reuses duplicates, writes nothing', async () => {
  const out = text(await issuesFromDocument({ workspace: W, document: 'auth spec', projectIdentifier: 'PROJ', skipDuplicates: true, dryRun: true } as any))
  assert.match(out, /"Auth spec" → 2 issue\(s\) from open checklist items \(1 checked item\(s\) skipped\)/)
  assert.match(out, /Epic: create "Auth spec"/)
  assert.match(out, /#1 create "Login form"/)
  assert.match(out, /#2 "Password reset" → reuse existing \*\*PROJ-1\*\*/)
  assert.equal(((await getConnection(W)) as any).mutations.length, 0)
})

test('issues_from_document: creating links the document to the new epic', async () => {
  const out = text(await issuesFromDocument({ workspace: W, document: 'doc-1', projectIdentifier: 'PROJ', skipDuplicates: true, dryRun: false } as any))
  assert.match(out, /Issue tree under \*\*PROJ-\d+\*\*/)
  assert.match(out, /Document \*\*"Auth spec"\*\* linked to/)
  const link = ((await getConnection(W)) as any).mutations.find((m: any) => m.op === 'updateDoc' && m.data?.relations != null)
  assert.deepEqual(link.data.relations, [{ _id: 'doc-1', _class: 'document:class:Document' }])
})

test('issues_from_document: clear errors for missing or empty documents', async () => {
  await assert.rejects(issuesFromDocument({ workspace: W, document: 'Nope', projectIdentifier: 'PROJ', skipDuplicates: true, dryRun: true } as any), /Document 'Nope' not found/)
  await assert.rejects(issuesFromDocument({ workspace: W, document: 'doc-2', projectIdentifier: 'PROJ', skipDuplicates: true, dryRun: true } as any), /"Empty" is empty/)
})
