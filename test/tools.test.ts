import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import contact from '@hcengineering/contact'
import { setConnectionManager } from '../src/connection'
import { createServer } from '../src/server'
import { listProjects } from '../src/tools/projects'
import { getIssue, updateIssue } from '../src/tools/issues'
import { logTime } from '../src/tools/log-time'
import { createMilestone } from '../src/tools/milestones'
import { listMembers } from '../src/tools/members'
import { listWorkspaces } from '../src/tools/workspaces'
import * as schemas from '../src/schemas'
import { createFakeEnv, PERSONAL, AVMS, type FakeDoc } from './helpers'

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
    { _id: 'member-1', _class: contact.class.Member, name: `${label} me` }
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
    workspaces: [PERSONAL, AVMS],
    data: { jokeks2023: workspaceData('Personal'), avms: workspaceData('AVMS') }
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
  assert.match(out, /\*\*AVMS\*\* — slug: `avms` — id: `22222222-bbbb-4000-8000-000000000002`/)
})

test('read tools route to the named workspace', async () => {
  assert.match(text(await listProjects({ workspace: 'jokeks2023' })), /Personal project/)
  assert.match(text(await listProjects({ workspace: 'avms' })), /AVMS project/)
  assert.doesNotMatch(text(await listProjects({ workspace: 'avms' })), /Personal/)
})

test('read tools without workspace fail when several are available', async () => {
  await assert.rejects(listProjects({}), /Multiple workspaces available/)
  assert.equal(env.calls.opened.length, 0)
})

test('same entity id in two workspaces resolves per workspace', async () => {
  const personal = text(await getIssue({ workspace: 'jokeks2023', identifier: 'PROJ-1' }))
  const avms = text(await getIssue({ workspace: 'AVMS', identifier: 'PROJ-1' }))
  assert.match(personal, /PROJ-1: Personal issue/)
  assert.match(personal, /Personal Todo/)
  assert.match(avms, /PROJ-1: AVMS issue/)
  assert.match(avms, /AVMS Todo/)
})

test('blob fetches use the token and uuid of the workspace being queried', async () => {
  process.env.HULY_FRONT_URL = 'https://front.example'
  const urls: string[] = []
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url))
    return new Response('{"type":"doc","content":[]}', { status: 200 })
  }) as typeof fetch

  await getIssue({ workspace: 'avms', identifier: 'PROJ-1' })
  assert.equal(urls.length, 1)
  assert.match(urls[0], /file=blob-AVMS/)
  assert.match(urls[0], new RegExp(`workspace=${AVMS.uuid}`))
  assert.match(urls[0], /token=ws-token-avms/)
})

test('mutation lands only in the named workspace', async () => {
  await logTime({ workspace: 'jokeks2023', identifier: 'PROJ-1', hours: 2, description: 'x' })
  await createMilestone({ workspace: 'avms', projectIdentifier: 'PROJ', label: 'M1', targetDate: '2026-12-01', status: 'Planned' })

  const personal = env.clients.get('jokeks2023')!.mutations
  const avms = env.clients.get('avms')!.mutations
  assert.deepEqual(personal.map((m) => [m.op, m._class]), [['addCollection', tracker.class.TimeSpendReport]])
  assert.equal((personal[0].data as any).employee, 'member-1')
  assert.deepEqual(avms.map((m) => [m.op, m._class]), [['createDoc', tracker.class.Milestone]])
})

test('mutation after using another workspace still goes to the named one', async () => {
  await listProjects({ workspace: 'avms' })
  await updateIssue({ workspace: 'jokeks2023', identifier: 'PROJ-1', title: 'renamed' })
  assert.equal(env.clients.get('avms')!.mutations.length, 0)
  assert.deepEqual(env.clients.get('jokeks2023')!.mutations.map((m) => m.op), ['updateDoc'])
})

test('mutation with unknown workspace fails without touching any workspace', async () => {
  await assert.rejects(
    logTime({ workspace: 'avmss', identifier: 'PROJ-1', hours: 1 }),
    /Unknown workspace 'avmss'/
  )
  assert.equal(env.calls.opened.length, 0)
})

test('list_members uses the workspace-scoped account client', async () => {
  assert.match(text(await listMembers({ workspace: 'avms' })), /member-via-ws-token-avms/)
  assert.deepEqual(env.calls.getWorkspaceMembersTokens, ['ws-token-avms'])
})

// Every tool that changes data must require `workspace`; read tools may leave it optional.
const MUTATION_SCHEMAS = [
  'CreateProjectSchema', 'CreateIssueSchema', 'UpdateIssueSchema', 'DeleteIssueSchema',
  'AddCommentSchema', 'DeleteCommentSchema', 'LogTimeSchema',
  'CreateLabelSchema', 'AddLabelSchema', 'RemoveLabelSchema',
  'AddRelationSchema', 'AddBlockedBySchema', 'SetParentSchema',
  'CreateMilestoneSchema', 'CreateComponentSchema',
  'CreateTeamspaceSchema', 'CreateDocumentSchema', 'DeleteDocumentSchema', 'UpdateDocumentSchema', 'LinkDocumentSchema',
  'CreateChannelSchema', 'StartDirectMessageSchema', 'SendMessageSchema',
  'AttachFileSchema', 'DeleteAttachmentSchema',
  'CreateIssueStatusSchema', 'CreateOrganizationSchema', 'UpdateOrganizationSchema'
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
  const server = createServer()
  const tools = (server as any)._registeredTools as Record<string, { inputSchema?: any }>
  const names = Object.keys(tools)
  assert.ok(names.includes('list_workspaces'))
  for (const name of names) {
    if (name === 'list_workspaces') continue
    const shape = tools[name].inputSchema?.shape
    assert.ok(shape?.workspace !== undefined, `${name} does not accept workspace`)
  }
  const mutationTools = names.filter((n) => /^(create|update|delete|add|remove|set|log|link|send|attach|start)_/.test(n))
  assert.equal(mutationTools.length, MUTATION_SCHEMAS.length)
  for (const name of mutationTools) {
    assert.equal(tools[name].inputSchema.shape.workspace.isOptional(), false, `${name}.workspace must be required`)
  }
})
