import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import contact from '@hcengineering/contact'
import document from '@hcengineering/document'
import { setConnectionManager } from '../src/connection'
import { createServer } from '../src/server'
import { listProjects } from '../src/tools/projects'
import { getIssue, updateIssue } from '../src/tools/issues'
import { getDocument } from '../src/tools/documents'
import { getOrganization } from '../src/tools/organizations'
import { logTime } from '../src/tools/log-time'
import { createMilestone, getMilestone, updateMilestone, deleteMilestone } from '../src/tools/milestones'
import { updateComponent, deleteComponent } from '../src/tools/components'
import task from '@hcengineering/task'
import { listMembers } from '../src/tools/members'
import { listWorkspaces } from '../src/tools/workspaces'
import * as schemas from '../src/schemas'
import { createFakeEnv, PERSONAL, ACME, type FakeDoc } from './helpers'

// Both workspaces deliberately contain a project "PROJ" and an issue "PROJ-1" with the
// same _id — entity identity is (workspace, id), never id alone.
function workspaceData (label: string): FakeDoc[] {
  return [
    { _id: 'project-1', _class: tracker.class.Project, identifier: 'PROJ', name: `${label} project`, sequence: 1 },
    { _id: 'status-1', _class: tracker.class.IssueStatus, name: `${label} Todo` },
    {
      _id: 'issue-1',
      _class: tracker.class.Issue,
      space: 'project-1',
      identifier: 'PROJ-1',
      title: `${label} issue`,
      status: 'status-1',
      priority: 0,
      estimation: 0,
      reportedTime: 0,
      description: `blob-${label}`
    },
    { _id: 'member-1', _class: contact.class.Person, name: `me,${label}` },
    { _id: 'member-1', _class: contact.mixin.Employee, name: `me,${label}`, active: true },
    { _id: 'social-id', _class: contact.class.SocialIdentity, attachedTo: 'member-1', type: 'email' },
    { _id: 'doc-1', _class: document.class.Document, space: 'ts-1', title: `${label} doc`, content: `content-${label}` },
    { _id: 'org-1', _class: contact.class.Organization, name: `${label} org`, description: `org-desc-${label}` }
  ]
}

function text (result: { content: Array<{ text: string }> }): string {
  return result.content[0].text
}

let env: ReturnType<typeof createFakeEnv>
const savedFrontUrl = process.env.HULY_FRONT_URL
const savedFetch = globalThis.fetch

beforeEach(() => {
  env = createFakeEnv({
    workspaces: [PERSONAL, ACME],
    data: { jokeks2023: workspaceData('Personal'), acme: workspaceData('ACME') }
  })
  setConnectionManager(env.manager)
  delete process.env.HULY_FRONT_URL
})

afterEach(async () => {
  await env.manager.closeAll()
  setConnectionManager(null)
  if (savedFrontUrl === undefined) delete process.env.HULY_FRONT_URL
  else process.env.HULY_FRONT_URL = savedFrontUrl
  globalThis.fetch = savedFetch
})

test('list_workspaces returns name, slug and id', async () => {
  const out = text(await listWorkspaces({}))
  assert.match(out, /\*\*JoKeks2023\*\* — slug: `jokeks2023` — id: `11111111-aaaa-4000-8000-000000000001`/)
  assert.match(out, /\*\*ACME\*\* — slug: `acme` — id: `22222222-bbbb-4000-8000-000000000002`/)
})

test('read tools route to the named workspace', async () => {
  assert.match(text(await listProjects({ workspace: 'jokeks2023' })), /Personal project/)
  assert.match(text(await listProjects({ workspace: 'acme' })), /ACME project/)
  assert.doesNotMatch(text(await listProjects({ workspace: 'acme' })), /Personal/)
})

test('read tools without workspace fail when several are available', async () => {
  await assert.rejects(listProjects({}), /Multiple workspaces available/)
  assert.equal(env.calls.opened.length, 0)
})

test('same entity id in two workspaces resolves per workspace', async () => {
  const personal = text(await getIssue({ workspace: 'jokeks2023', identifier: 'PROJ-1' }))
  const acme = text(await getIssue({ workspace: 'ACME', identifier: 'PROJ-1' }))
  assert.match(personal, /PROJ-1: Personal issue/)
  assert.match(personal, /Personal Todo/)
  assert.match(acme, /PROJ-1: ACME issue/)
  assert.match(acme, /ACME Todo/)
})

// get_issue / get_organization fetch their description blob from front's /files. The workspace
// token must travel only in the Authorization header — never as `token=` in the URL or in the output.
function mockFront (expectedToken: string, text: string): Array<{ url: string, headers: Record<string, string> }> {
  const requests: Array<{ url: string, headers: Record<string, string> }> = []
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const headers = { ...(init?.headers as Record<string, string> | undefined) }
    requests.push({ url: String(url), headers })
    const body = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
    return headers.Authorization === `Bearer ${expectedToken}` ? new Response(body, { status: 200 }) : new Response('', { status: 401 })
  }) as typeof fetch
  return requests
}

for (const { tool, run, blob } of [
  { tool: 'get_issue', run: async () => await getIssue({ workspace: 'acme', identifier: 'PROJ-1' }), blob: 'blob-ACME' },
  { tool: 'get_organization', run: async () => await getOrganization({ workspace: 'acme', organizationId: 'org-1' }), blob: 'org-desc-ACME' }
]) {
  test(`${tool}: description is fetched with a Bearer header, never a token in the URL or result`, async () => {
    process.env.HULY_FRONT_URL = 'https://front.example'
    const requests = mockFront('ws-token-acme', 'Loaded description')

    const out = text(await run())

    assert.equal(requests.length, 1)
    assert.match(requests[0].url, new RegExp(`file=${blob}`))
    assert.match(requests[0].url, new RegExp(`workspace=${ACME.uuid}`))
    assert.doesNotMatch(requests[0].url, /token=/i)
    assert.ok(!requests[0].url.includes('ws-token-'), 'request URL contains a workspace token')
    assert.equal(requests[0].headers.Authorization, 'Bearer ws-token-acme')

    assert.match(out, /\*\*Description:\*\*\nLoaded description/)
    assert.doesNotMatch(out, /token=/i)
    assert.ok(!out.includes('ws-token-'), 'tool result contains a workspace token')
  })
}

test('mutation lands only in the named workspace', async () => {
  await logTime({ workspace: 'jokeks2023', identifier: 'PROJ-1', hours: 2, description: 'x' })
  await createMilestone({ workspace: 'acme', projectIdentifier: 'PROJ', label: 'M1', targetDate: '2026-12-01', status: 'Planned' })

  const personal = env.clients.get('jokeks2023')!.mutations
  const acme = env.clients.get('acme')!.mutations
  assert.deepEqual(personal.map((m) => [m.op, m._class]), [['addCollection', tracker.class.TimeSpendReport]])
  assert.equal((personal[0].data as any).employee, 'member-1')
  assert.deepEqual(acme.map((m) => [m.op, m._class]), [['createDoc', tracker.class.Milestone]])
})

test('mutation after using another workspace still goes to the named one', async () => {
  await listProjects({ workspace: 'acme' })
  await updateIssue({ workspace: 'jokeks2023', identifier: 'PROJ-1', title: 'renamed' })
  assert.equal(env.clients.get('acme')!.mutations.length, 0)
  assert.deepEqual(env.clients.get('jokeks2023')!.mutations.map((m) => m.op), ['updateDoc'])
})

test('mutation with unknown workspace fails without touching any workspace', async () => {
  await assert.rejects(
    logTime({ workspace: 'acmes', identifier: 'PROJ-1', hours: 1 }),
    /Unknown workspace 'acmes'/
  )
  assert.equal(env.calls.opened.length, 0)
})

test('list_members uses the workspace-scoped account client', async () => {
  assert.match(text(await listMembers({ workspace: 'acme' })), /member-via-ws-token-acme/)
  assert.deepEqual(env.calls.getWorkspaceMembersTokens, ['ws-token-acme'])
})

// Every tool that changes data must require `workspace`; read tools may leave it optional.
const MUTATION_SCHEMAS = [
  'StartWorkSchema', 'FinishWorkSchema', 'CreateIssueTreeSchema', 'ClaimIssueSchema', 'ReleaseIssueSchema',
  'CreateProjectSchema', 'UpdateProjectSchema', 'CreateIssueSchema', 'UpdateIssueSchema', 'DeleteIssueSchema',
  'BulkUpdateIssuesSchema', 'MoveIssueSchema', 'UpdateCommentSchema', 'UpdateLabelSchema', 'DeleteLabelSchema',
  'RemoveRelationSchema', 'RemoveBlockedBySchema', 'RepairParentLinksSchema',
  'MarkNotificationsReadSchema', 'CreateTodoSchema', 'UpdateTodoSchema', 'DeleteTodoSchema', 'ScheduleTodoSchema',
  'CreateEventSchema', 'UpdateEventSchema', 'DeleteEventSchema',
  'ReplyToMessageSchema', 'UpdateMessageSchema', 'DeleteMessageSchema', 'ReactionSchema', 'ReactionSchema', 'PinMessageSchema',
  'CreatePersonSchema', 'UpdatePersonSchema', 'ContactChannelSchema', 'ContactChannelSchema',
  'GenericCreateSchema', 'GenericUpdateSchema', 'GenericDeleteSchema',
  'AddCommentSchema', 'DeleteCommentSchema', 'LogTimeSchema',
  'CreateLabelSchema', 'AddLabelSchema', 'RemoveLabelSchema',
  'AddRelationSchema', 'AddBlockedBySchema', 'SetParentSchema',
  'CreateMilestoneSchema', 'UpdateMilestoneSchema', 'DeleteMilestoneSchema',
  'CreateComponentSchema', 'UpdateComponentSchema', 'DeleteComponentSchema',
  'CreateTeamspaceSchema', 'CreateDocumentSchema', 'DeleteDocumentSchema', 'UpdateDocumentSchema', 'LinkDocumentSchema',
  'CreateChannelSchema', 'StartDirectMessageSchema', 'SendMessageSchema',
  'AttachFileSchema', 'DeleteAttachmentSchema',
  'CreateIssueStatusSchema', 'CreateOrganizationSchema', 'UpdateOrganizationSchema',
  'AddCollaboratorSchema', 'RemoveCollaboratorSchema', 'CreatePublicLinkSchema', 'RevokePublicLinkSchema', 'AddDocumentCommentSchema',
  'CreateCardSchema', 'UpdateCardSchema', 'DeleteCardSchema', 'CreateCardTypeSchema', 'DeleteCardTypeSchema', 'CreateCustomFieldSchema', 'SetCustomFieldsSchema',
  'CreateDriveSchema', 'CreateFolderSchema', 'UploadFileSchema', 'UpdateDriveItemSchema', 'DeleteDriveItemSchema', 'RestoreFileVersionSchema',
  'CreateIssueTemplateSchema', 'UpdateIssueTemplateSchema', 'DeleteIssueTemplateSchema', 'CreateIssueFromTemplateSchema',
  'CreateTestProjectSchema', 'CreateTestSuiteSchema', 'CreateTestCaseSchema', 'UpdateTestCaseSchema', 'DeleteTestCaseSchema', 'CreateTestPlanSchema', 'CreateTestRunSchema', 'SetTestResultSchema',
  'CreateLabelCategorySchema', 'SetLabelCategorySchema',
  'CreateInviteLinkSchema', 'SendInviteSchema', 'SetMemberRoleSchema',
  'CreateVacancySchema', 'UpdateVacancySchema', 'CreateCandidateSchema', 'CreateApplicationSchema', 'UpdateApplicationSchema', 'DeleteApplicationSchema',
  'CreateLeadSchema', 'UpdateLeadSchema', 'DeleteLeadSchema',
  'CreateDepartmentSchema', 'DeleteDepartmentSchema', 'SetDepartmentSchema', 'CreateTimeOffSchema', 'DeleteTimeOffSchema',
  'CreateInventoryCategorySchema', 'CreateInventoryProductSchema', 'UpdateInventoryItemSchema', 'DeleteInventoryItemSchema',
  'CreateMessageTemplateSchema', 'UpdateMessageTemplateSchema', 'DeleteMessageTemplateSchema',
  'StartProcessSchema', 'CancelExecutionSchema',
  'CreateTrainingSchema', 'AddTrainingQuestionsSchema', 'ReleaseTrainingSchema', 'AssignTrainingSchema', 'CancelTrainingRequestSchema',
  'UpdateTestSuiteSchema', 'DeleteTestSuiteSchema', 'UpdateTestRunSchema', 'DeleteTestRunSchema', 'DeleteTestPlanSchema', 'ImportTestResultsSchema', 'CreateIssueFromTestResultSchema', 'CreateTestCasesSchema'
] as const

test('every mutation schema requires workspace', () => {
  for (const name of MUTATION_SCHEMAS) {
    const shape = (schemas as any)[name].shape
    assert.ok(shape.workspace !== undefined, `${name} has no workspace field`)
    assert.equal(shape.workspace.isOptional(), false, `${name}.workspace must be required`)
  }
  const parsed = schemas.LogTimeSchema.safeParse({ identifier: 'PROJ-1', hours: 1 })
  assert.equal(parsed.success, false)
})

test('every registered tool except list_workspaces accepts workspace', () => {
  const server = createServer({ toolsets: 'all' })
  const tools = (server as any)._registeredTools as Record<string, { inputSchema?: any }>
  const names = Object.keys(tools)
  assert.ok(names.includes('list_workspaces'))
  for (const name of names) {
    if (name === 'list_workspaces') continue
    const shape = tools[name].inputSchema?.shape
    assert.ok(shape?.workspace !== undefined, `${name} does not accept workspace`)
  }
  const mutationTools = names.filter((n) => /^(create|update|delete|add|remove|set|log|link|send|attach|start|bulk|move|repair|mark|reply|pin|schedule|generic|finish|claim|release(?!_notes)|revoke|upload|restore|cancel|import|assign)_/.test(n))
  assert.equal(mutationTools.length, MUTATION_SCHEMAS.length)
  for (const name of mutationTools) {
    assert.equal(tools[name].inputSchema.shape.workspace.isOptional(), false, `${name}.workspace must be required`)
  }
})

test('get_document never exposes the workspace token, but still loads content with it', async () => {
  process.env.HULY_FRONT_URL = 'https://front.example'
  const requests: Array<{ url: string, headers: Record<string, string> }> = []
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requests.push({ url: String(url), headers: { ...(init?.headers as Record<string, string>) } })
    const authorized = (init?.headers as Record<string, string> | undefined)?.Authorization === 'Bearer ws-token-acme'
    const body = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Secret-free body' }] }] })
    return authorized ? new Response(body, { status: 200 }) : new Response('', { status: 401 })
  }) as typeof fetch

  const out = text(await getDocument({ workspace: 'acme', documentId: 'doc-1' }))

  // Content is still fetched and rendered…
  assert.match(out, /\*\*Content:\*\*\nSecret-free body/)
  // …via one request carrying the token only in the Authorization header of the right workspace.
  assert.equal(requests.length, 1)
  assert.equal(requests[0].headers.Authorization, 'Bearer ws-token-acme')
  assert.match(requests[0].url, /file=content-ACME/)
  assert.match(requests[0].url, new RegExp(`workspace=${ACME.uuid}`))
  assert.doesNotMatch(requests[0].url, /token/i)
  // The tool result never contains a token, in any form.
  assert.doesNotMatch(out, /token=/i)
  assert.ok(!out.includes('ws-token-acme'), 'tool result contains the workspace token')
  assert.ok(!out.includes('ws-token-jokeks2023'), 'tool result contains another workspace token')
})

test('get_document without a successful fetch still leaks no token', async () => {
  process.env.HULY_FRONT_URL = 'https://front.example'
  globalThis.fetch = (async () => new Response('', { status: 401 })) as unknown as typeof fetch
  const out = text(await getDocument({ workspace: 'jokeks2023', documentId: 'doc-1' }))
  assert.match(out, /Content URL:\*\* https:\/\/front\.example\/files\?file=content-Personal&workspace=/)
  assert.doesNotMatch(out, /token=/i)
  assert.ok(!out.includes('ws-token-'), 'tool result contains a workspace token')

  globalThis.fetch = (async () => { throw new Error('network down') }) as unknown as typeof fetch
  const failed = text(await getDocument({ workspace: 'jokeks2023', documentId: 'doc-1' }))
  assert.ok(!failed.includes('ws-token-'), 'tool result contains a workspace token')
})

// --- Milestones & components: get / update / delete -------------------------

function planningData (): FakeDoc[] {
  return [
    { _id: 'project-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'p', sequence: 3 },
    { _id: 'st-todo', _class: tracker.class.IssueStatus, name: 'Todo', category: task.statusCategory.ToDo },
    { _id: 'st-done', _class: tracker.class.IssueStatus, name: 'Done', category: task.statusCategory.Won },
    { _id: 'st-cancel', _class: tracker.class.IssueStatus, name: 'Canceled', category: task.statusCategory.Lost },
    { _id: 'ms-1', _class: tracker.class.Milestone, space: 'project-1', label: 'v1.0', status: 0, targetDate: Date.UTC(2026, 11, 1), description: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First release' }] }] }) },
    { _id: 'ms-2', _class: tracker.class.Milestone, space: 'project-1', label: 'v1.1', status: 0, targetDate: Date.UTC(2027, 0, 1) },
    { _id: 'cmp-1', _class: tracker.class.Component, space: 'project-1', label: 'API', lead: null, description: 'plain text desc' },
    { _id: 'cmp-2', _class: tracker.class.Component, space: 'project-1', label: 'UI', lead: null },
    { _id: 'member-1', _class: contact.mixin.Employee, name: 'Keks,Jo', active: true },
    { _id: 'i-1', _class: tracker.class.Issue, space: 'project-1', identifier: 'PROJ-1', title: 'open one', status: 'st-todo', milestone: 'ms-1', component: 'cmp-1' },
    { _id: 'i-2', _class: tracker.class.Issue, space: 'project-1', identifier: 'PROJ-2', title: 'done one', status: 'st-done', milestone: 'ms-1', component: 'cmp-1' },
    { _id: 'i-3', _class: tracker.class.Issue, space: 'project-1', identifier: 'PROJ-3', title: 'dropped', status: 'st-cancel', milestone: 'ms-1', component: null }
  ]
}

function usePlanningData (): void {
  env = createFakeEnv({ workspaces: [PERSONAL], data: { jokeks2023: planningData() } })
  setConnectionManager(env.manager)
}

function mutations (): Array<{ op: string, _class: string, attachedTo?: string, data?: any }> {
  return env.clients.get('jokeks2023')!.mutations as any
}

test('get_milestone reports progress, description and open issues', async () => {
  usePlanningData()
  const out = text(await getMilestone({ projectIdentifier: 'PROJ', label: 'v1.0' }))
  assert.match(out, /\*\*Progress:\*\* 1\/2 done \(1 open, 1 canceled\)/)
  assert.match(out, /\*\*Target date:\*\* 2026-12-01/)
  assert.match(out, /First release/)
  assert.match(out, /PROJ-1: open one/)
  assert.doesNotMatch(out, /PROJ-2|PROJ-3/)
})

test('update_milestone changes only the given fields', async () => {
  usePlanningData()
  const out = text(await updateMilestone({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'v1.0', newLabel: 'v1.0 MVP', status: 'InProgress', targetDate: '2026-12-15' }))
  assert.match(out, /v1\.0 MVP/)
  const [m] = mutations()
  assert.equal(m.op, 'updateDoc')
  assert.equal(m.attachedTo, 'ms-1')
  assert.deepEqual(m.data, { label: 'v1.0 MVP', status: 1, targetDate: Date.UTC(2026, 11, 15) })
})

test('update_milestone rejects a name that already exists and bad dates', async () => {
  usePlanningData()
  await assert.rejects(updateMilestone({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'v1.0', newLabel: 'v1.1' }), /already exists/)
  await assert.rejects(updateMilestone({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'v1.0', targetDate: 'soon' }), /Invalid date/)
  await assert.rejects(updateMilestone({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'nope', status: 'Completed' }), /not found/)
  assert.equal(mutations().length, 0)
})

test('update_milestone stores the description as ProseMirror markup', async () => {
  usePlanningData()
  await updateMilestone({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'v1.1', description: 'Hello' })
  const desc = JSON.parse(mutations()[0].data.description)
  assert.equal(desc.type, 'doc')
  assert.match(JSON.stringify(desc), /Hello/)
})

test('markupToText keeps inline marks on one line and separates blocks', async () => {
  const { markupToText, textToMarkup } = await import('../src/utils/format')
  assert.equal(markupToText(textToMarkup('Smoke **test** description')), 'Smoke test description')
  assert.equal(markupToText(textToMarkup('a\n\nb')), 'a\nb')
  assert.equal(markupToText('plain'), 'plain')
  assert.equal(markupToText(null), '')
})

test('delete_milestone unassigns its issues before removing it', async () => {
  usePlanningData()
  const out = text(await deleteMilestone({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'v1.0' }))
  assert.match(out, /3 issue\(s\) no longer have a milestone/)
  const ops = mutations().map((m) => [m.op, m.attachedTo, m.data?.milestone])
  assert.deepEqual(ops, [
    ['updateDoc', 'i-1', null], ['updateDoc', 'i-2', null], ['updateDoc', 'i-3', null],
    ['removeDoc', 'ms-1', undefined]
  ])
})

test('delete_milestone with moveIssuesTo reassigns issues; same target is rejected', async () => {
  usePlanningData()
  await assert.rejects(deleteMilestone({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'v1.0', moveIssuesTo: 'v1.0' }), /different milestone/)
  await assert.rejects(deleteMilestone({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'v1.0', moveIssuesTo: 'v9' }), /not found/)
  assert.equal(mutations().length, 0)
  const out = text(await deleteMilestone({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'v1.0', moveIssuesTo: 'v1.1' }))
  assert.match(out, /3 issue\(s\) moved to \*\*v1\.1\*\*/)
  assert.ok(mutations().filter((m) => m.op === 'updateDoc').every((m) => m.data.milestone === 'ms-2'))
})

test('update_component sets name, description and lead (and clears lead with null)', async () => {
  usePlanningData()
  await updateComponent({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'API', newLabel: 'Backend', lead: 'keks' })
  assert.deepEqual(mutations()[0].data, { label: 'Backend', lead: 'member-1' })
  await updateComponent({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'UI', lead: null })
  assert.deepEqual(mutations()[1].data, { lead: null })
  await assert.rejects(updateComponent({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'UI', lead: 'ghost' }), /Member 'ghost' not found/)
})

test('delete_component unassigns or moves only its own issues', async () => {
  usePlanningData()
  const out = text(await deleteComponent({ workspace: 'jokeks2023', projectIdentifier: 'PROJ', label: 'API', moveIssuesTo: 'UI' }))
  assert.match(out, /2 issue\(s\) moved to \*\*UI\*\*/)
  const ops = mutations().map((m) => [m.op, m.attachedTo, m.data?.component])
  assert.deepEqual(ops, [['updateDoc', 'i-1', 'cmp-2'], ['updateDoc', 'i-2', 'cmp-2'], ['removeDoc', 'cmp-1', undefined]])
})
