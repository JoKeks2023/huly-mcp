// Stage C: recruiting, CRM, HR, inventory, message templates, surveys (fake client).
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import contact from '@hcengineering/contact'
import { setConnectionManager, getConnection } from '../src/connection'
import { TOOLS } from '../src/registry'
import { toTzDate, tzText } from '../src/tools/hr'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const run = async (name: string, args: Record<string, unknown>): Promise<string> => (await TOOLS.find((t) => t.name === name)!.handler({ workspace: W, ...args })).content[0].text

function data (): FakeDoc[] {
  return [
    { _id: 'me', _class: contact.class.Person, space: 'contact:space:Contacts', name: 'Keks,Jo', personUuid: 'acc-1' },
    { _id: 'me', _class: contact.mixin.Employee, name: 'Keks,Jo', active: true },
    { _id: 'social-id', _class: contact.class.SocialIdentity, attachedTo: 'me' },
    { _id: 'pt', _class: 'task:class:ProjectType', tasks: ['tt'], targetClass: 'recruit:mixin:DefaultVacancyTypeData' },
    { _id: 'recruit:template:DefaultVacancy', _class: 'task:class:ProjectType', tasks: ['tt'], targetClass: 'recruit:mixin:DefaultVacancyTypeData' },
    { _id: 'tt', _class: 'task:class:TaskType', statuses: ['s-b', 's-hr'] },
    { _id: 's-b', _class: 'core:class:Status', name: 'Backlog' },
    { _id: 's-hr', _class: 'core:class:Status', name: 'HR Interview' },
    { _id: 'seq-a', _class: 'core:class:Sequence', attachedTo: 'recruit:class:Applicant', sequence: 4 },
    { _id: 'seq-v', _class: 'core:class:Sequence', attachedTo: 'recruit:class:Vacancy', sequence: 0 },
    { _id: 'seq-l', _class: 'core:class:Sequence', attachedTo: 'lead:class:Lead', sequence: 9 },
    { _id: 'v-1', _class: 'recruit:class:Vacancy', space: 'core:space:Space', name: 'iOS Dev', type: 'pt', archived: false },
    { _id: 'f-1', _class: 'lead:class:Funnel', space: 'core:space:Space', name: 'Funnel', type: 'pt', archived: false },
    { _id: 'cand', _class: contact.class.Person, space: 'contact:space:Contacts', name: 'Doe,Jane' },
    { _id: 'org', _class: 'contact:class:Organization', space: 'contact:space:Contacts', name: 'Acme' },
    { _id: 'hr:ids:Head', _class: 'hr:class:Department', space: 'core:space:Workspace', name: 'Organization' },
    { _id: 'cat', _class: 'inventory:class:Category', space: 'core:space:Workspace', name: 'Tools', attachedTo: 'inventory:global:Category', attachedToClass: 'inventory:class:Category', collection: 'categories' },
    { _id: 'prod', _class: 'inventory:class:Product', space: 'core:space:Workspace', name: 'Hammer', attachedTo: 'cat', attachedToClass: 'inventory:class:Category', collection: 'products' },
    { _id: 'var', _class: 'inventory:class:Variant', space: 'core:space:Workspace', name: 'Big', sku: 'H-B', attachedTo: 'prod', attachedToClass: 'inventory:class:Product', collection: 'variants' },
    { _id: 'sv', _class: 'survey:class:Survey', name: 'Fit', questions: [{ name: 'Lang?', kind: 'options', options: ['TS', 'Swift'] }, { name: 'Why?', kind: 'string' }] },
    { _id: 'poll-1', _class: 'survey:class:Poll', survey: 'sv', isCompleted: true, questions: [{ name: 'Lang?', answers: [0, 1] }, { name: 'Why?', answer: 'fun' }] },
    { _id: 'poll-2', _class: 'survey:class:Poll', survey: 'sv', isCompleted: true, questions: [{ name: 'Lang?', answers: [1] }, { name: 'Why?', answer: '' }] },
    { _id: 'poll-3', _class: 'survey:class:Poll', survey: 'sv', isCompleted: false, questions: [{ name: 'Lang?', answers: [0] }] }
  ]
}

let client: any
beforeEach(async () => {
  const env = createFakeEnv({ workspaces: [PERSONAL], data: { jokeks2023: data() } })
  setConnectionManager(env.manager)
  client = await getConnection(W)
})

test('create_application: next number, first status, kind, Candidate mixin ensured', async () => {
  assert.match(await run('create_application', { vacancy: 'ios dev', candidate: 'Jane Doe' }), /\*\*APP-5\*\*: Jane Doe → iOS Dev \[Backlog\]/)
  const mixin = client.mutations.find((m: any) => m.op === 'createMixin')
  assert.equal(mixin.data.mixin ?? mixin.mixin ?? 'recruit:mixin:Candidate', 'recruit:mixin:Candidate')
  const add = client.mutations.find((m: any) => m.op === 'addCollection')
  assert.equal(add._class, 'recruit:class:Applicant')
  assert.equal(add.space, 'v-1')
  assert.equal(add.attachedTo, 'cand')
  assert.deepEqual({ status: add.data.status, kind: add.data.kind, identifier: add.data.identifier }, { status: 's-b', kind: 'tt', identifier: 'APP-5' })
  await assert.rejects(run('create_application', { vacancy: 'iOS Dev', candidate: 'Jane', status: 'Offer' }), /Status 'Offer' not found. Available: Backlog, HR Interview/)
})

test('create_lead with a new organization customer', async () => {
  const out = await run('create_lead', { title: 'Deal', customer: 'Globex', newCustomer: 'organization', status: 'hr interview' })
  assert.match(out, /\*\*LEAD-10\*\* Deal — Globex \(new organization\) \[HR Interview\] in Funnel/)
  assert.ok(client.mutations.some((m: any) => m.op === 'createDoc' && m._class === 'contact:class:Organization'))
  await assert.rejects(run('create_lead', { title: 'X', customer: 'Acme', newCustomer: 'organization' }), /already exists/)
})

test('HR: TzDate is a calendar day; time off needs a department', async () => {
  assert.deepEqual({ ...toTzDate('2030-01-07', 'from'), offset: 0 }, { year: 2030, month: 0, day: 7, offset: 0 })
  assert.equal(tzText(toTzDate('2030-12-31', 'x')), '2030-12-31')
  assert.throws(() => toTzDate('2030-02-30', 'from'), /not a real date/)
  assert.throws(() => toTzDate('07.01.2030', 'from'), /YYYY-MM-DD/)
  await assert.rejects(run('create_time_off', { type: 'vacation', from: '2030-01-07' }), /not in any department/)
  await assert.rejects(run('delete_department', { department: 'Organization' }), /root department/)
})

test('inventory: tree listing, refuses non-empty delete without recursive', async () => {
  assert.match(await run('list_inventory', {}), /📁 \*\*Tools\*\*[\s\S]*Hammer — Big \(H-B\)/)
  await assert.rejects(run('delete_inventory_item', { id: 'cat' }), /still contains 1 item/)
  assert.match(await run('delete_inventory_item', { id: 'cat', recursive: true }), /with 2 item/)
  assert.deepEqual(client.mutations.filter((m: any) => m.op === 'removeCollection').map((m: any) => m.attachedTo), ['var', 'prod', 'cat'], 'deepest first')
  await assert.rejects(run('update_inventory_item', { id: 'prod', sku: 'x' }), /Only variants/)
})

test('get_survey aggregates completed polls only', async () => {
  const out = await run('get_survey', { survey: 'fit' })
  assert.match(out, /results from 2 completed of 3 poll/)
  assert.match(out, /- TS: 1\n {3}- Swift: 2/)
  assert.match(out, /“fun”/)
})

test('message templates: placeholders listed, markdown stored as markup', async () => {
  client.docs.push({ _id: 'templates:space:Templates', _class: 'templates:class:TemplateCategory', name: 'Public templates' })
  await run('create_message_template', { title: 'Hi', message: 'Hello ${name}, **thanks**' })
  const created = client.mutations.find((m: any) => m.op === 'createDoc' && m._class === 'templates:class:MessageTemplate')
  assert.equal(created.space, 'templates:space:Templates')
  assert.equal(JSON.parse(created.data.message).type, 'doc')
})
