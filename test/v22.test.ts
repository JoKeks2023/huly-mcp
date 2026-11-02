// Tools added in 2.2.0: issue filters, bulk update, move, sub-issues, relations/labels/comments
// editing, project update, time reports, and the set_parent fix.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import contact from '@hcengineering/contact'
import task from '@hcengineering/task'
import tags from '@hcengineering/tags'
import chunter from '@hcengineering/chunter'
import { setConnectionManager } from '../src/connection'
import { listIssues, getIssue, bulkUpdateIssues, moveIssue, listSubIssues, updateIssue } from '../src/tools/issues'
import { setParent, removeRelation, removeBlockedBy, repairParentLinks } from '../src/tools/relations'
import { updateComment, listComments } from '../src/tools/comments'
import { logTime } from '../src/tools/log-time'
import { formatPersonName, findPerson } from '../src/utils/people'
import { getConnection } from '../src/connection'
import { updateLabel, deleteLabel } from '../src/tools/labels'
import { updateProject } from '../src/tools/projects'
import { listTimeReports } from '../src/tools/log-time'
import { extractText } from '../src/utils/markdown'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const NP = tracker.ids.NoParent as string
const DAY = 86_400_000

function issue (n: number, extra: Record<string, unknown> = {}): FakeDoc {
  return {
    _id: `i-${n}`, _class: tracker.class.Issue, space: 'p-1', identifier: `PROJ-${n}`, title: `issue ${n}`,
    status: 'st-todo', priority: 0, attachedTo: NP, attachedToClass: tracker.class.Issue, collection: 'subIssues',
    parents: [], relations: [], blockedBy: [], milestone: null, component: null, assignee: null, rank: `0|${n}`, ...extra
  }
}

function data (): FakeDoc[] {
  return [
    { _id: 'p-1', _class: tracker.class.Project, space: 'core:space:Space', identifier: 'PROJ', name: 'Proj', sequence: 6 },
    { _id: 'p-2', _class: tracker.class.Project, space: 'core:space:Space', identifier: 'OTHER', name: 'Other', sequence: 10 },
    { _id: 'st-todo', _class: tracker.class.IssueStatus, name: 'Todo', category: task.statusCategory.ToDo },
    { _id: 'st-done', _class: tracker.class.IssueStatus, name: 'Done', category: task.statusCategory.Won },
    { _id: 'st-cancel', _class: tracker.class.IssueStatus, name: 'Canceled', category: task.statusCategory.Lost },
    { _id: 'ms-1', _class: tracker.class.Milestone, space: 'p-1', label: 'v1' },
    { _id: 'cmp-1', _class: tracker.class.Component, space: 'p-1', label: 'API' },
    { _id: 'm-1', _class: contact.mixin.Employee, name: 'Keks,Jo', active: true },
    { _id: 'm-2', _class: contact.mixin.Employee, name: 'Other,Ann', active: true },
    { _id: 'm-3', _class: contact.mixin.Employee, name: 'Keksberg,Jonas', active: true },
    { _id: 'social-id', _class: contact.class.SocialIdentity, attachedTo: 'm-1', type: 'email' },
    { _id: 'sid-ann', _class: contact.class.SocialIdentity, attachedTo: 'm-2', type: 'email' },
    { _id: 'c-2', _class: chunter.class.ChatMessage, space: 'p-1', attachedTo: 'i-1', message: 'from ann', createdBy: 'sid-ann', createdOn: Date.UTC(2026, 9, 2) },
    { _id: 'tag-1', _class: tags.class.TagElement, space: 'ws', targetClass: tracker.class.Issue, title: 'bug', color: 1 },
    { _id: 'tag-2', _class: tags.class.TagElement, space: 'ws', targetClass: tracker.class.Issue, title: 'ux', color: 2 },
    { _id: 'tr-1', _class: tags.class.TagReference, space: 'p-1', attachedTo: 'i-2', attachedToClass: tracker.class.Issue, collection: 'labels', tag: 'tag-1', title: 'bug' },
    { _id: 'tr-2', _class: tags.class.TagReference, space: 'p-1', attachedTo: 'i-3', attachedToClass: tracker.class.Issue, collection: 'labels', tag: 'tag-1', title: 'bug' },
    // PROJ-1 is an epic with PROJ-2 (attachedTo) and PROJ-3 (legacy: parents only), PROJ-4 under PROJ-2.
    issue(1, { milestone: 'ms-1', assignee: 'm-1' }),
    issue(2, { attachedTo: 'i-1', parents: [{ parentId: 'i-1', identifier: 'PROJ-1', parentTitle: 'issue 1', space: 'p-1' }], status: 'st-done', milestone: 'ms-1', component: 'cmp-1', relations: [{ _id: 'i-5', _class: tracker.class.Issue }], blockedBy: [{ _id: 'i-5', _class: tracker.class.Issue }] }),
    issue(3, { parents: [{ parentId: 'i-1', identifier: 'PROJ-1', parentTitle: 'issue 1', space: 'p-1' }], status: 'st-cancel' }),
    issue(4, { attachedTo: 'i-2', parents: [{ parentId: 'i-2', identifier: 'PROJ-2', parentTitle: 'issue 2', space: 'p-1' }] }),
    issue(5, { relations: [{ _id: 'i-2', _class: tracker.class.Issue }], assignee: 'm-2' }),
    { _id: 'c-1', _class: chunter.class.ChatMessage, space: 'p-1', attachedTo: 'i-1', message: 'old', createdBy: 'social-id', createdOn: Date.UTC(2026, 9, 1) },
    { _id: 'r-1', _class: tracker.class.TimeSpendReport, space: 'p-1', attachedTo: 'i-1', employee: 'm-1', date: Date.UTC(2026, 9, 1, 10), value: 2, description: 'setup' },
    { _id: 'r-2', _class: tracker.class.TimeSpendReport, space: 'p-1', attachedTo: 'i-2', employee: 'm-2', date: Date.UTC(2026, 9, 5, 10), value: 1.5, description: '' },
    { _id: 'r-3', _class: tracker.class.TimeSpendReport, space: 'p-1', attachedTo: 'i-2', employee: 'm-1', date: Date.UTC(2026, 9, 31, 23), value: 3, description: 'late' }
  ]
}

let env: ReturnType<typeof createFakeEnv>
beforeEach(() => {
  env = createFakeEnv({ workspaces: [PERSONAL], data: { jokeks2023: data() } })
  setConnectionManager(env.manager)
})
afterEach(async () => {
  await env.manager.closeAll()
  setConnectionManager(null)
})

const text = (r: { content: Array<{ text: string }> }): string => r.content[0].text
const muts = (): any[] => env.clients.get(W)!.mutations

test('extractText keeps inline marks on one line (#5)', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a ' }, { type: 'text', text: 'b', marks: [{ type: 'bold' }] }, { type: 'text', text: ' c' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'next' }] }] }
  assert.equal(extractText(doc), 'a b c\nnext')
})

test('list_issues filters by milestone, component, label, assignee and parent', async () => {
  const ids = async (args: Record<string, unknown>): Promise<string[]> =>
    [...text(await listIssues({ projectIdentifier: 'PROJ', limit: 50, ...args } as any)).matchAll(/\*\*(PROJ-\d+)\*\*/g)].map((m) => m[1]).sort()
  assert.deepEqual(await ids({ milestoneLabel: 'v1' }), ['PROJ-1', 'PROJ-2'])
  assert.deepEqual(await ids({ milestoneLabel: null }), ['PROJ-3', 'PROJ-4', 'PROJ-5'])
  assert.deepEqual(await ids({ componentLabel: 'API' }), ['PROJ-2'])
  assert.deepEqual(await ids({ labelName: 'bug' }), ['PROJ-2', 'PROJ-3'])
  assert.deepEqual(await ids({ assignee: 'jo keks' }), ['PROJ-1'])
  assert.deepEqual(await ids({ assignee: null }), ['PROJ-2', 'PROJ-3', 'PROJ-4'])
  assert.deepEqual(await ids({ parentIdentifier: 'PROJ-1' }), ['PROJ-2'])
  assert.deepEqual(await ids({ parentIdentifier: null }), ['PROJ-1', 'PROJ-3', 'PROJ-5'])
  assert.deepEqual(await ids({ milestoneLabel: 'v1', labelName: 'bug' }), ['PROJ-2'])
  await assert.rejects(listIssues({ projectIdentifier: 'PROJ', limit: 50, milestoneLabel: 'nope' }), /Milestone 'nope' not found/)
})

test('get_issue shows assignee, milestone, component, labels, parent and links', async () => {
  const out = text(await getIssue({ identifier: 'PROJ-2' }))
  assert.match(out, /\*\*Milestone:\*\* v1/)
  assert.match(out, /\*\*Component:\*\* API/)
  assert.match(out, /\*\*Labels:\*\* bug/)
  assert.match(out, /\*\*Parent:\*\* PROJ-1 — issue 1/)
  assert.match(out, /\*\*Blocked by:\*\* PROJ-5/)
  assert.match(out, /\*\*Related:\*\* PROJ-5/)
  assert.match(text(await getIssue({ identifier: 'PROJ-1' })), /\*\*Assignee:\*\* Jo Keks/)
})

test('bulk_update_issues validates everything before writing', async () => {
  await assert.rejects(bulkUpdateIssues({ workspace: W, identifiers: ['PROJ-1', 'PROJ-99'], statusName: 'Done' }), /PROJ-99' not found\. Nothing was changed/)
  await assert.rejects(bulkUpdateIssues({ workspace: W, identifiers: ['PROJ-1'], milestoneLabel: 'nope' }), /Milestone 'nope' not found/)
  assert.equal(muts().length, 0)
  const out = text(await bulkUpdateIssues({ workspace: W, identifiers: ['PROJ-3', 'PROJ-4', 'PROJ-3'], statusName: 'Done', milestoneLabel: 'v1', componentLabel: null }))
  assert.match(out, /Updated 2 issue\(s\)/)
  assert.deepEqual(muts().map((m) => [m.attachedTo, m.data]), [
    ['i-3', { status: 'st-done', component: null, milestone: 'ms-1' }],
    ['i-4', { status: 'st-done', component: null, milestone: 'ms-1' }]
  ])
})

test('update_issue accepts componentLabel null and rejects bad dates', async () => {
  await updateIssue({ workspace: W, identifier: 'PROJ-2', componentLabel: null })
  assert.deepEqual(muts()[0].data, { component: null })
  await assert.rejects(updateIssue({ workspace: W, identifier: 'PROJ-2', dueDate: 'tomorrow' }), /Invalid date/)
})

test('list_sub_issues shows the tree (attachedTo and legacy parents) with progress', async () => {
  const out = text(await listSubIssues({ identifier: 'PROJ-1', depth: 5 }))
  assert.match(out, /\*\*Progress:\*\* 1\/2 done \(1 canceled\)/)
  assert.match(out, /^- \[x\] \*\*PROJ-2\*\* \[Done\]/m)
  assert.match(out, /^ {2}- \[ \] \*\*PROJ-4\*\* \[Todo\]/m)
  assert.match(out, /^- \[-\] \*\*PROJ-3\*\* \[Canceled\]/m)
  assert.doesNotMatch(text(await listSubIssues({ identifier: 'PROJ-1', depth: 1 })), /PROJ-4/)
  assert.match(text(await listSubIssues({ identifier: 'PROJ-5', depth: 5 })), /has no sub-issues/)
})

test('set_parent writes only attachedTo and rank, like Huly', async () => {
  const out = text(await setParent({ workspace: W, identifier: 'PROJ-5', parentIdentifier: 'PROJ-1' }))
  assert.match(out, /now a sub-issue of \*\*PROJ-1\*\*$/)
  assert.equal(muts().length, 1)
  const [m] = muts()
  assert.equal(m.op, 'update')
  assert.equal(m.attachedTo, 'i-5')
  assert.equal(m.data.attachedTo, 'i-1')
  assert.ok(typeof m.data.rank === 'string')
  assert.equal(m.data.parents, undefined, 'parents are derived by the server')
})

test('set_parent repairs a legacy link without double-counting the parent', async () => {
  // PROJ-3 was linked to PROJ-1 by the old set_parent: parents set, attachedTo NoParent.
  const client = await getConnection(W) as any
  const epic = client.docs.find((d: any) => d._id === 'i-1')
  epic.subIssues = 2
  epic.childInfo = [{ childId: 'i-2' }, { childId: 'i-3' }]
  const out = text(await setParent({ workspace: W, identifier: 'PROJ-3', parentIdentifier: 'PROJ-1' }))
  assert.match(out, /repaired link/)
  assert.deepEqual(muts().map((m) => [m.op, m.attachedTo]), [['updateDoc', 'i-1'], ['update', 'i-3']])
  assert.deepEqual(muts()[0].data, { childInfo: [{ childId: 'i-2' }], subIssues: 1 })
  assert.equal(muts()[1].data.attachedTo, 'i-1')
})

test('set_parent: already linked, cycles, clearing', async () => {
  assert.match(text(await setParent({ workspace: W, identifier: 'PROJ-2', parentIdentifier: 'PROJ-1' })), /already a sub-issue/)
  await assert.rejects(setParent({ workspace: W, identifier: 'PROJ-2', parentIdentifier: 'PROJ-4' }), /cycle/)
  await assert.rejects(setParent({ workspace: W, identifier: 'PROJ-2', parentIdentifier: 'PROJ-2' }), /own parent/)
  assert.equal(muts().length, 0)
  await setParent({ workspace: W, identifier: 'PROJ-2', parentIdentifier: null })
  assert.deepEqual(muts()[0].data, { attachedTo: NP, parents: [] })
  assert.match(text(await setParent({ workspace: W, identifier: 'PROJ-5', parentIdentifier: null })), /has no parent/)
})

test('remove_relation unlinks both sides; remove_blocked_by only the blocked issue', async () => {
  await removeRelation({ workspace: W, identifier: 'PROJ-2', relatedTo: 'PROJ-5' })
  assert.deepEqual(muts().map((m) => [m.attachedTo, m.data.relations]), [['i-2', []], ['i-5', []]])
  assert.match(text(await removeRelation({ workspace: W, identifier: 'PROJ-1', relatedTo: 'PROJ-4' })), /are not related/)
  await removeBlockedBy({ workspace: W, identifier: 'PROJ-2', blockedBy: 'PROJ-5' })
  assert.deepEqual(muts()[2].data, { blockedBy: [] })
  assert.match(text(await removeBlockedBy({ workspace: W, identifier: 'PROJ-1', blockedBy: 'PROJ-5' })), /is not blocked by/)
})

test('update_comment edits only a comment of that issue', async () => {
  await updateComment({ workspace: W, identifier: 'PROJ-1', commentId: 'c-1', message: 'new' })
  assert.equal(muts()[0].op, 'updateCollection')
  assert.equal(muts()[0].data.message, 'new')
  await assert.rejects(updateComment({ workspace: W, identifier: 'PROJ-2', commentId: 'c-1', message: 'x' }), /not found on PROJ-2/)
})

test('update_label renames and recolors, syncing every issue reference', async () => {
  await assert.rejects(updateLabel({ workspace: W, labelName: 'bug', newName: 'ux' }), /already exists/)
  const out = text(await updateLabel({ workspace: W, labelName: 'bug', newName: 'defect', color: '#ff0000' }))
  assert.match(out, /defect.*on 2 issue\(s\)/)
  assert.deepEqual(muts()[0].data, { title: 'defect', color: 0xff0000 })
  assert.deepEqual(muts().slice(1).map((m) => [m.op, m.attachedTo, m.data]), [
    ['updateCollection', 'tr-1', { title: 'defect', color: 0xff0000 }],
    ['updateCollection', 'tr-2', { title: 'defect', color: 0xff0000 }]
  ])
})

test('delete_label removes it from issues first', async () => {
  const out = text(await deleteLabel({ workspace: W, labelName: 'bug' }))
  assert.match(out, /removed from 2 issue\(s\)/)
  assert.deepEqual(muts().map((m) => [m.op, m.attachedTo]), [['removeCollection', 'tr-1'], ['removeCollection', 'tr-2'], ['removeDoc', 'tag-1']])
})

test('update_project sets name, default assignee and default status', async () => {
  await updateProject({ workspace: W, identifier: 'PROJ', name: 'Renamed', defaultAssignee: 'ann', defaultStatus: 'Todo' })
  assert.deepEqual(muts()[0].data, { name: 'Renamed', defaultAssignee: 'm-2', defaultIssueStatus: 'st-todo' })
  await assert.rejects(updateProject({ workspace: W, identifier: 'PROJ', defaultStatus: 'Nope' }), /Status 'Nope' not found/)
})

test('list_time_reports: per issue, per project, member and inclusive date filters', async () => {
  const issueOut = text(await listTimeReports({ identifier: 'PROJ-2', limit: 100 }))
  assert.match(issueOut, /\*\*Total:\*\* 4\.5h in 2 report\(s\)/)
  const proj = text(await listTimeReports({ projectIdentifier: 'PROJ', limit: 100 }))
  assert.match(proj, /\*\*Total:\*\* 6\.5h in 3 report\(s\) — Jo Keks: 5h, Ann Other: 1\.5h/)
  assert.match(proj, /2026-10-01 \*\*2h\*\* PROJ-1 \(Jo Keks\) — setup/)
  assert.match(text(await listTimeReports({ projectIdentifier: 'PROJ', member: 'ann', limit: 100 })), /Total:\*\* 1\.5h/)
  await assert.rejects(listTimeReports({ projectIdentifier: 'PROJ', member: 'keks', limit: 100 }), /ambiguous: Jo Keks, Jonas Keksberg/)
  // A bare "to" date includes that whole day (report at 23:00 on 2026-10-31).
  assert.match(text(await listTimeReports({ projectIdentifier: 'PROJ', from: '2026-10-05', to: '2026-10-31', limit: 100 })), /Total:\*\* 4\.5h in 2/)
  await assert.rejects(listTimeReports({ limit: 10 }), /exactly one of/)
  await assert.rejects(listTimeReports({ identifier: 'PROJ-1', projectIdentifier: 'PROJ', limit: 10 }), /exactly one of/)
})

test('move_issue renumbers the issue and its sub-issues and moves attached docs', async () => {
  const client = await (await import('../src/connection')).getConnection(W) as any
  client.collections[tracker.class.Issue] = [
    { name: 'subIssues', of: tracker.class.Issue },
    { name: 'comments', of: chunter.class.ChatMessage },
    { name: 'reports', of: tracker.class.TimeSpendReport }
  ]
  const out = text(await moveIssue({ workspace: W, identifier: 'PROJ-2', targetProjectIdentifier: 'OTHER', statusName: 'Todo' }))
  assert.match(out, /PROJ-2 → OTHER-11/)
  assert.match(out, /PROJ-4 → OTHER-12/)
  const updates = muts().filter((m) => m.op === 'update')
  const byId = new Map(updates.map((m) => [m.attachedTo, m.data]))
  assert.equal(byId.get('i-2').space, 'p-2')
  assert.equal(byId.get('i-2').identifier, 'OTHER-11')
  assert.equal(byId.get('i-2').status, 'st-todo')
  assert.equal(byId.get('i-2').milestone, null)
  assert.equal(byId.get('i-4').identifier, 'OTHER-12')
  assert.deepEqual(byId.get('r-2'), { space: 'p-2' })
  assert.deepEqual(byId.get('r-3'), { space: 'p-2' })
  // Children are moved before their parent.
  assert.equal(updates[updates.length - 1].attachedTo, 'i-2')
  await assert.rejects(moveIssue({ workspace: W, identifier: 'PROJ-1', targetProjectIdentifier: 'PROJ' }), /already in project/)
})

test('people: Huly names are shown as "First Last" and matched in any form', async () => {
  assert.equal(formatPersonName('Conrad,Joris'), 'Joris Conrad')
  assert.equal(formatPersonName('Plain Name'), 'Plain Name')
  const client = await getConnection(W)
  assert.equal((await findPerson(client, 'Jo Keks'))._id, 'm-1')
  assert.equal((await findPerson(client, 'keks,jo'))._id, 'm-1')
  assert.equal((await findPerson(client, 'ann'))._id, 'm-2')
  await assert.rejects(findPerson(client, 'keks'), /ambiguous/)
  await assert.rejects(findPerson(client, 'nobody'), /not found/)
})

test('log_time books on the person behind the connected account', async () => {
  await logTime({ workspace: W, identifier: 'PROJ-1', hours: 1 })
  assert.equal(muts()[0].data.employee, 'm-1')
})

test('list_comments shows author names via social identities', async () => {
  const out = text(await listComments({ identifier: 'PROJ-1', limit: 50 }))
  assert.match(out, /\*\*Jo Keks\*\* @ 2026-10-01/)
  assert.match(out, /\*\*Ann Other\*\* @ 2026-10-02/)
})

test('repair_parent_links: dry run by default, then re-links legacy sub-issues', async () => {
  const dry = text(await repairParentLinks({ workspace: W, projectIdentifier: 'PROJ', dryRun: true }))
  assert.match(dry, /Dry run: 1 sub-issue\(s\) in PROJ would be re-linked/)
  assert.match(dry, /PROJ-3 → under PROJ-1/)
  assert.equal(muts().length, 0)
  const out = text(await repairParentLinks({ workspace: W, projectIdentifier: 'PROJ', dryRun: false }))
  assert.match(out, /Repaired 1 sub-issue link/)
  const upd = muts().find((m) => m.op === 'update')
  assert.equal(upd.attachedTo, 'i-3')
  assert.equal(upd.data.attachedTo, 'i-1')
})

test('repair_parent_links skips children whose parent was deleted', async () => {
  const client = await getConnection(W) as any
  client.docs.push(issue(6, { parents: [{ parentId: 'gone', identifier: 'PROJ-99', parentTitle: 'x', space: 'p-1' }] }))
  const out = text(await repairParentLinks({ workspace: W, projectIdentifier: 'PROJ', dryRun: false }))
  assert.match(out, /PROJ-6: parent PROJ-99 no longer exists — skipped/)
  assert.match(out, /Repaired 1 sub-issue link\(s\) in PROJ, 1 skipped/)
})
