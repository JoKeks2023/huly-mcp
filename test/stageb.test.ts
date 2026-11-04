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
