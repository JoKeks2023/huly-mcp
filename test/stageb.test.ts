// Stage B: sharing (collaborators, public links) and further Huly modules.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import contact from '@hcengineering/contact'
import { setConnectionManager, getConnection } from '../src/connection'
import { listCollaborators, addCollaborator, removeCollaborator, createPublicLink, revokePublicLink, reachableUrl } from '../src/tools/sharing'
import { C } from '../src/utils/classes'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const text = (r: any): string => r.content[0].text

function data (): FakeDoc[] {
  return [
    { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj' },
    { _id: 'i-1', _class: 'task:class:Task', space: 'p-1', identifier: 'PROJ-1', title: 'Login bug' },
    { _id: 'me', _class: contact.class.Person, name: 'Keks,Jo', personUuid: 'acc-1' },
    { _id: 'me', _class: contact.mixin.Employee, name: 'Keks,Jo', active: true },
    { _id: 'ann', _class: contact.class.Person, name: 'Doe,Ann', personUuid: 'acc-2' },
    { _id: 'ann', _class: contact.mixin.Employee, name: 'Doe,Ann', active: true },
    { _id: 'social-id', _class: contact.class.SocialIdentity, attachedTo: 'me' },
    { _id: 'col-1', _class: C.Collaborator, space: 'p-1', attachedTo: 'i-1', attachedToClass: 'task:class:Task', collection: 'collaborators', collaborator: 'acc-1' },
    { _id: 'ts-1', _class: 'document:class:Teamspace', name: 'Docs' },
    { _id: 'ts-2', _class: 'document:class:Teamspace', name: 'Other' },
    { _id: 'd-1', _class: 'document:class:Document', space: 'ts-1', title: 'Root', parent: 'document:ids:NoParent', rank: '0|a' },
    { _id: 'd-2', _class: 'document:class:Document', space: 'ts-1', title: 'Child', parent: 'd-1', rank: '0|b' },
    { _id: 'd-3', _class: 'document:class:Document', space: 'ts-1', title: 'Grandchild', parent: 'd-2', rank: '0|c' },
    { _id: 'link-1', _class: C.PublicLink, space: 'core:space:Workspace', attachedTo: 'i-9', url: 'x', revokable: false }
  ]
}

let env: ReturnType<typeof createFakeEnv>
beforeEach(async () => {
  delete process.env.HULY_FRONT_URL
  env = createFakeEnv({ workspaces: [PERSONAL], data: { jokeks2023: data() } })
  setConnectionManager(env.manager)
  await getConnection(W)
})
const mutations = (): any[] => env.clients.get(W)!.mutations

test('list_collaborators shows names by account', async () => {
  assert.match(text(await listCollaborators({ workspace: W, object: 'PROJ-1' })), /Collaborators of PROJ-1: Login bug \(1\)\n\n- Jo Keks/)
})

test('add_collaborator adds a member by account uuid, and never twice', async () => {
  assert.match(text(await addCollaborator({ workspace: W, object: 'PROJ-1' })), /already follows/)
  assert.equal(mutations().length, 0)
  assert.match(text(await addCollaborator({ workspace: W, object: 'PROJ-1', member: 'Ann' })), /Ann Doe now follows/)
  assert.deepEqual(mutations()[0], { op: 'addCollection', _class: C.Collaborator, space: 'p-1', attachedTo: 'i-1', data: { collaborator: 'acc-2' } })
})

test('remove_collaborator removes the record', async () => {
  assert.match(text(await removeCollaborator({ workspace: W, object: 'PROJ-1' })), /no longer follows/)
  assert.equal(mutations()[0].op, 'removeCollection')
  assert.match(text(await removeCollaborator({ workspace: W, object: 'PROJ-1', member: 'Ann' })), /does not follow/)
})

test('create_public_link creates a read-only link like the share dialog', async () => {
  const out = text(await createPublicLink({ workspace: W, object: 'PROJ-1' }))
  const m = mutations()[0]
  assert.equal(m.op, 'createDoc')
  assert.equal(m._class, C.PublicLink)
  assert.equal(m.data.attachedTo, 'i-1')
  assert.deepEqual(m.data.restrictions, { readonly: true, disableNavigation: true, disableActions: true, disableComments: true })
  assert.equal(decodeURIComponent(m.data.location.fragment), 'view:component:EditDoc|i-1|task:class:Task|content')
  assert.match(out, /URL yet/) // the fake server never fills in the URL
})

test('revoke_public_link respects revokable', async () => {
  await assert.rejects(revokePublicLink({ workspace: W, linkId: 'link-1' }), /not revokable/)
})

test('reachableUrl swaps a localhost origin for HULY_FRONT_URL', () => {
  assert.equal(reachableUrl('http://localhost:8087/guest/ws?token=a', 'https://huly.example.com/'), 'https://huly.example.com/guest/ws?token=a')
  assert.equal(reachableUrl('https://huly.example.com/guest/ws?token=a', 'https://other.example.com'), 'https://huly.example.com/guest/ws?token=a')
  assert.equal(reachableUrl('http://localhost:8087/guest/ws', undefined), 'http://localhost:8087/guest/ws')
})

test('search maps friendly kinds to classes and lists hits', async () => {
  const { searchAll } = await import('../src/tools/search')
  const fake: any = env.clients.get(W)!
  fake.searchResult = { docs: [{ id: 'd-1', title: 'Architecture', doc: { _id: 'd-1', _class: 'document:class:Document' } }], total: 3 }
  const out = text(await searchAll({ workspace: W, query: 'arch', kinds: ['document', 'x:class:Y'], limit: 1 }))
  assert.deepEqual(fake.lastSearch.query, { query: 'arch', classes: ['document:class:Document', 'x:class:Y'] })
  assert.match(out, /## Search "arch" \(1 of 3\)/)
  assert.match(out, /\[Document\] \*\*Architecture\*\* — `d-1`/)
})

test('list_documents shows the full tree', async () => {
  const { listDocuments } = await import('../src/tools/documents')
  const out = text(await listDocuments({ workspace: W, teamspaceId: 'ts-1' } as any))
  assert.match(out, /^- \*\*Root\*\*.*\n  - \*\*Child\*\*.*\n    - \*\*Grandchild\*\*/m)
})

test('update_document renames and moves; refuses moving under its own child', async () => {
  const { updateDocument } = await import('../src/tools/documents')
  await assert.rejects(updateDocument({ workspace: W, documentId: 'd-1', parentId: 'd-3' } as any), /under itself or one of its children/)
  await assert.rejects(updateDocument({ workspace: W, documentId: 'd-1' } as any), /Nothing to change/)
  assert.equal(mutations().length, 0)
  const out = text(await updateDocument({ workspace: W, documentId: 'd-3', title: 'Leaf', parentId: null } as any))
  assert.match(out, /renamed to "Leaf", moved to top level/)
  assert.deepEqual(mutations()[0].data, { title: 'Leaf' })
  assert.equal(mutations()[1].data.parent, 'document:ids:NoParent')
  assert.equal(typeof mutations()[1].data.rank, 'string')
})

test('update_document moving to another teamspace takes the sub-documents along', async () => {
  const { updateDocument } = await import('../src/tools/documents')
  const out = text(await updateDocument({ workspace: W, documentId: 'd-1', teamspaceId: 'ts-2' } as any))
  assert.match(out, /with 2 sub-document/)
  assert.deepEqual(mutations().map((m) => [m.attachedTo, m.data.space]), [['d-1', 'ts-2'], ['d-2', 'ts-2'], ['d-3', 'ts-2']])
})

test('add_document_comment attaches a comment to the document', async () => {
  const { addDocumentComment } = await import('../src/tools/documents')
  await addDocumentComment({ workspace: W, documentId: 'd-1', message: 'Looks good' })
  assert.deepEqual(mutations()[0], { op: 'addCollection', _class: 'chunter:class:ChatMessage', space: 'ts-1', attachedTo: 'd-1', data: { message: 'Looks good' } })
})

test('create_teamspace uses the account uuid for members and owners', async () => {
  const { createTeamspace } = await import('../src/tools/documents')
  await createTeamspace({ workspace: W, name: 'New', isPrivate: true })
  const d: any = mutations()[0].data
  assert.deepEqual([d.members, d.owners], [['acc-1'], ['acc-1']])
})

// ── Cards and custom fields ─────────────────────────────────────────────────
function cardModel (fake: any): void {
  fake.classes = {
    'card:class:Card': { extends: 'core:class:Doc', label: 'card:string:Card' },
    'lead': { extends: 'card:class:Card', label: 'embedded:embedded:Lead' },
    'hot': { extends: 'lead', kind: 2, label: 'embedded:embedded:Hot' },
    'old': { extends: 'card:class:Card', label: 'embedded:embedded:Old', removed: true }
  }
  const attr = (owner: string, name: string, label: string, type: any): any => ({ _id: `a-${name}`, attributeOf: owner, name, label: `embedded:embedded:${label}`, isCustom: true, type })
  fake.customAttrs = {
    lead: [attr('lead', 'customV', 'Value', { _class: 'core:class:TypeNumber' }), attr('lead', 'customS', 'Stage', { _class: 'core:class:EnumOf', of: 'enum-1' })],
    hot: [attr('hot', 'customH', 'Heat', { _class: 'core:class:TypeString' })]
  }
  for (const list of Object.values(fake.customAttrs) as any[][]) for (const a of list) fake.docs.push({ ...a, _class: C.Attribute })
  fake.docs.push(
    { _id: 'enum-1', _class: C.Enum, enumValues: ['New', 'Won'] },
    { _id: 'k-1', _class: 'lead', space: 'card:space:Default', title: 'ACME', parentInfo: [], hot: { customH: 'warm' }, customV: 10 },
    { _id: 'k-2', _class: 'lead', space: 'card:space:Default', title: 'Sub', parent: 'k-1', parentInfo: [{ _id: 'k-1', _class: 'lead', title: 'ACME' }] }
  )
}

test('list_card_types hides removed types and lists tags under their type', async () => {
  const { listCardTypes } = await import('../src/tools/cards')
  cardModel(env.clients.get(W)!)
  const out = text(await listCardTypes({ workspace: W }))
  assert.match(out, /- \*\*Lead\*\* — `lead`\n  tags: Hot/)
  assert.doesNotMatch(out, /Old/)
})

test('create_card validates fields first, then writes type fields on the card and tag fields on the mixin', async () => {
  const { createCard } = await import('../src/tools/cards')
  cardModel(env.clients.get(W)!)
  await assert.rejects(createCard({ workspace: W, type: 'Lead', title: 'X', fields: { Stage: 'Lost' } } as any), /must be one of: New, Won/)
  await assert.rejects(createCard({ workspace: W, type: 'Lead', title: 'X', fields: { Nope: 1 } } as any), /Field 'Nope' not found/)
  assert.equal(mutations().length, 0)
  await createCard({ workspace: W, type: 'lead', title: 'Deal', parentId: 'k-1', tags: ['Hot'], fields: { value: '5', Stage: 'won', Heat: 'hot' } } as any)
  const [create, mixin] = mutations()
  assert.equal(create.op, 'createDoc')
  assert.equal(create._class, 'lead')
  assert.equal(create.data.customV, 5)
  assert.equal(create.data.customS, 'Won')
  assert.equal(create.data.parent, 'k-1')
  assert.deepEqual(create.data.parentInfo, [{ _id: 'k-1', _class: 'lead', title: 'ACME' }])
  assert.deepEqual([mixin.op, mixin._class, mixin.data], ['createMixin', 'hot', { customH: 'hot' }])
})

test('update_card refuses cycles and refreshes the breadcrumb of children on move', async () => {
  const { updateCard } = await import('../src/tools/cards')
  cardModel(env.clients.get(W)!)
  await assert.rejects(updateCard({ workspace: W, cardId: 'k-1', parentId: 'k-2' } as any), /under itself/)
  await updateCard({ workspace: W, cardId: 'k-1', title: 'ACME Inc' } as any)
  assert.deepEqual(mutations()[0].data, { title: 'ACME Inc' })
})

test('get_card shows type, tags and field values', async () => {
  const { getCard } = await import('../src/tools/cards')
  cardModel(env.clients.get(W)!)
  const out = text(await getCard({ workspace: W, cardId: 'k-1' }))
  assert.match(out, /\*\*Type:\*\* Lead/)
  assert.match(out, /\*\*Tags:\*\* Hot/)
  assert.match(out, /\*\*Value:\*\* 10/)
  assert.match(out, /\*\*Heat:\*\* warm/)
  assert.match(out, /Child cards \(1\)\n- Sub/)
})

test('set_custom_fields uses updateDoc for class fields and updateMixin for mixin fields', async () => {
  const { setCustomFields } = await import('../src/tools/fields')
  cardModel(env.clients.get(W)!)
  await assert.rejects(setCustomFields({ workspace: W, object: 'k-1', fields: {} }), /Nothing to set/)
  await setCustomFields({ workspace: W, object: 'k-1', fields: { Value: 7, Heat: 'cold' } })
  assert.deepEqual(mutations().map((m) => [m.op, m._class, m.data]), [['updateDoc', 'lead', { customV: 7 }], ['updateMixin', 'hot', { customH: 'cold' }]])
})

test('create_custom_field creates an enum and the attribute like the settings dialog', async () => {
  const { createCustomField } = await import('../src/tools/fields')
  cardModel(env.clients.get(W)!)
  assert.match(text(await createCustomField({ workspace: W, target: 'Lead', label: 'value', type: 'number' } as any)), /already exists/)
  await createCustomField({ workspace: W, target: 'issue', label: 'Phase', type: 'enum', enumValues: ['A', 'B', 'A'] } as any)
  const [en, at] = mutations()
  assert.deepEqual([en._class, en.space, en.data.enumValues], [C.Enum, 'core:space:Model', ['A', 'B']])
  assert.equal(at._class, C.Attribute)
  assert.equal(at.data.attributeOf, 'tracker:class:Issue')
  assert.equal(at.data.label, 'embedded:embedded:Phase')
  assert.match(at.data.name, /^custom/)
  assert.equal(at.data.type._class, 'core:class:EnumOf')
})

// ── Drive ───────────────────────────────────────────────────────────────────
function driveData (fake: any): void {
  fake.docs.push(
    { _id: 'dr-1', _class: C.Drive, name: 'Team', archived: false },
    { _id: 'fo-1', _class: C.Folder, space: 'dr-1', title: 'Docs', parent: 'drive:ids:Root', path: [] },
    { _id: 'fo-2', _class: C.Folder, space: 'dr-1', title: 'Sub', parent: 'fo-1', path: ['fo-1'] },
    { _id: 'fi-1', _class: C.File, space: 'dr-1', title: 'a.md', parent: 'fo-2', path: ['fo-2', 'fo-1'], file: 'v-2', version: 2 },
    { _id: 'v-1', _class: C.FileVersion, space: 'dr-1', attachedTo: 'fi-1', version: 1, file: 'blob-1', size: 3, type: 'text/markdown' },
    { _id: 'v-2', _class: C.FileVersion, space: 'dr-1', attachedTo: 'fi-1', version: 2, file: 'blob-2', size: 4, type: 'text/markdown' }
  )
  fake.classes = { [C.DriveResource]: {}, [C.Folder]: { extends: C.DriveResource }, [C.File]: { extends: C.DriveResource } }
}

test('local file paths are off without HULY_FILE_ROOT and cannot escape it', async () => {
  const { localPath } = await import('../src/utils/files')
  assert.throws(() => localPath('x.txt', {}), /HULY_FILE_ROOT/)
  const { mkdtempSync, realpathSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const root = realpathSync(mkdtempSync(`${tmpdir()}/huly-root-`))
  const { join } = await import('node:path')
  assert.equal(localPath('x.txt', { HULY_FILE_ROOT: root }), join(root, 'x.txt'))
  assert.throws(() => localPath('../x.txt', { HULY_FILE_ROOT: root }), /outside HULY_FILE_ROOT/)
  assert.throws(() => localPath('/etc/passwd', { HULY_FILE_ROOT: root }), /outside HULY_FILE_ROOT/)
})

test('list_drive_files shows the folder tree with current versions', async () => {
  const { listDriveFiles } = await import('../src/tools/drive')
  driveData(env.clients.get(W)!)
  const out = text(await listDriveFiles({ workspace: W, drive: 'team', recursive: true } as any))
  assert.match(out, /- 📁 \*\*Docs\*\*.*\n  - 📁 \*\*Sub\*\*.*\n    - a\.md \(4 B, text\/markdown, v2/)
})

test('restore_file_version points the file at the older version', async () => {
  const { restoreFileVersion } = await import('../src/tools/drive')
  driveData(env.clients.get(W)!)
  await restoreFileVersion({ workspace: W, fileId: 'fi-1', version: 1 })
  assert.deepEqual(mutations()[0], { op: 'updateDoc', _class: C.File, space: 'dr-1', attachedTo: 'fi-1', data: { file: 'v-1' } })
})

test('delete_drive_item needs recursive for folders with content and removes versions', async () => {
  const { deleteDriveItem } = await import('../src/tools/drive')
  driveData(env.clients.get(W)!)
  await assert.rejects(deleteDriveItem({ workspace: W, itemId: 'fo-1', recursive: false }), /contains 2 item/)
  assert.equal(mutations().length, 0)
  await deleteDriveItem({ workspace: W, itemId: 'fo-1', recursive: true })
  assert.deepEqual(mutations().map((m) => [m.op, m.attachedTo]), [['removeCollection', 'v-1'], ['removeCollection', 'v-2'], ['removeDoc', 'fi-1'], ['removeDoc', 'fo-2'], ['removeDoc', 'fo-1']])
})

test('update_drive_item refuses to move a folder into its own subfolder', async () => {
  const { updateDriveItem } = await import('../src/tools/drive')
  driveData(env.clients.get(W)!)
  await assert.rejects(updateDriveItem({ workspace: W, itemId: 'fo-1', parentId: 'fo-2' } as any), /into itself/)
})

// ── Issue templates ─────────────────────────────────────────────────────────
test('create_issue_template stores ids for people/components/labels and inline children', async () => {
  const { createIssueTemplate } = await import('../src/tools/templates')
  const fake: any = env.clients.get(W)!
  fake.docs.push(
    { _id: 'cmp-1', _class: tracker.class.Component, space: 'p-1', label: 'Backend' },
    { _id: 'tag-1', _class: 'tags:class:TagElement', targetClass: tracker.class.Issue, title: 'bug' }
  )
  await assert.rejects(createIssueTemplate({ workspace: W, projectIdentifier: 'PROJ', title: 'T', componentLabel: 'Nope' } as any), /Component 'Nope' not found/)
  await assert.rejects(createIssueTemplate({ workspace: W, projectIdentifier: 'PROJ', title: 'T', labels: ['x'] } as any), /Label 'x' not found/)
  assert.equal(mutations().length, 0)
  await createIssueTemplate({ workspace: W, projectIdentifier: 'PROJ', title: ' Release ', priority: 'High', assignee: 'Ann', componentLabel: 'backend', labels: ['bug'], estimation: 2, children: [{ title: 'Bump', priority: 'Low' }] } as any)
  const d = mutations()[0].data
  assert.equal(mutations()[0]._class, tracker.class.IssueTemplate)
  assert.deepEqual([d.title, d.priority, d.assignee, d.component, d.labels, d.estimation], ['Release', 2, 'ann', 'cmp-1', ['tag-1'], 2])
  assert.equal(d.children.length, 1)
  assert.equal(d.children[0].title, 'Bump')
  assert.equal(d.children[0].priority, 4)
  assert.equal(typeof d.children[0].id, 'string')
})

// ── Test management ─────────────────────────────────────────────────────────
test('test runs: one Untested result per case, results set by case name', async () => {
  const TM = await import('../src/tools/testing')
  const fake: any = env.clients.get(W)!
  fake.docs.push(
    { _id: 'tp-1', _class: 'testManagement:class:TestProject', name: 'App' },
    { _id: 'su-1', _class: 'testManagement:class:TestSuite', space: 'tp-1', name: 'Login', parent: 'testManagement:ids:NoParent' },
    { _id: 'su-2', _class: 'testManagement:class:TestSuite', space: 'tp-1', name: 'Reset', parent: 'su-1' },
    { _id: 'tc-1', _class: 'testManagement:class:TestCase', space: 'tp-1', attachedTo: 'su-1', name: 'Valid login' },
    { _id: 'tc-2', _class: 'testManagement:class:TestCase', space: 'tp-1', attachedTo: 'su-2', name: 'Reset mail' },
    { _id: 'tr-1', _class: 'testManagement:class:TestResult', space: 'tp-1', attachedTo: 'run-1', testCase: 'tc-1', name: 'Valid login', status: 0 }
  )
  await TM.createTestRun({ workspace: W, project: 'app', name: 'R', suites: ['Login'] } as any)
  const results = mutations().filter((m) => m._class === 'testManagement:class:TestResult')
  assert.deepEqual(results.map((m) => [m.data.testCase, m.data.status]), [['tc-1', 0], ['tc-2', 0]])
  await assert.rejects(TM.createTestRun({ workspace: W, project: 'app', name: 'R' } as any), /No test cases selected/)
  await TM.setTestResult({ workspace: W, result: 'valid login', runId: 'run-1', status: 'Failed' } as any)
  assert.deepEqual(mutations().at(-1)!.data, { status: 3 })
})
