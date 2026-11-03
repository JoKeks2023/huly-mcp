// 3.1: agent workflow tools, write scope, audit log, resources and prompts.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import tracker from '@hcengineering/tracker'
import contact from '@hcengineering/contact'
import chunter from '@hcengineering/chunter'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { setConnectionManager, getConnection } from '../src/connection'
import { getIssueContext, startWork, finishWork, createIssueTree, changesSince, claimIssue, releaseIssue, branchName, parseSince, claimState } from '../src/tools/agent'
import { guard, projectsIn, isMutation } from '../src/guard'
import { TOOLS } from '../src/registry'
import { createServer } from '../src/server'
import { C } from '../src/utils/classes'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'
const T0 = Date.UTC(2026, 10, 2, 9)
const text = (r: any): string => r.content[0].text

function data (): FakeDoc[] {
  return [
    { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', sequence: 9 },
    { _id: 'st-todo', _class: tracker.class.IssueStatus, name: 'Todo' },
    { _id: 'st-prog', _class: tracker.class.IssueStatus, name: 'In Progress' },
    { _id: 'st-rev', _class: tracker.class.IssueStatus, name: 'Review in progress' },
    { _id: 'i-1', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-1', title: 'Login bug: Ümlaut & more', status: 'st-todo', priority: 2, attachedTo: tracker.ids.NoParent, parents: [], comments: 1, subIssues: 0, modifiedOn: T0 + 5000, createdOn: T0 - 86_400_000, blockedBy: [{ _id: 'i-2', _class: tracker.class.Issue }] },
    { _id: 'i-3', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-3', title: 'Release', attachedTo: tracker.ids.NoParent, parents: [], blockedBy: [{ _id: 'i-1', _class: tracker.class.Issue }], modifiedOn: 0, createdOn: 0 },
    { _id: 'i-2', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-2', title: 'Auth service', status: 'st-prog', attachedTo: tracker.ids.NoParent, parents: [], modifiedOn: T0 - 999_999_999, createdOn: T0 - 999_999_999 },
    { _id: 'me', _class: contact.class.Person, space: 'contact:space:Contacts', name: 'Keks,Jo', personUuid: 'acc-1' },
    { _id: 'me', _class: contact.mixin.Employee, name: 'Keks,Jo', active: true },
    { _id: 'social-id', _class: contact.class.SocialIdentity, attachedTo: 'me' },
    // Newest first, like the server's descending sort.
    { _id: 'c-2', _class: chunter.class.ChatMessage, space: 'p-1', attachedTo: 'i-1', message: '🤖 Claimed by **bot-a** until 2999-01-01T00:00:00.000Z [huly-claim agent=bot-a until=2999-01-01T00:00:00.000Z]', createdBy: 'social-id', createdOn: T0 + 2000 },
    { _id: 'c-1', _class: chunter.class.ChatMessage, space: 'p-1', attachedTo: 'i-1', message: 'Repro on Safari', createdBy: 'social-id', createdOn: T0 + 1000 },
    { _id: 'u-1', _class: C.DocUpdateMessage, attachedTo: 'i-1', createdBy: 'social-id', createdOn: T0 + 3000, attributeUpdates: { attrKey: 'status' } },
    { _id: 'tag-claim', _class: 'tags:class:TagElement', title: 'agent:working', targetClass: tracker.class.Issue },
    { _id: 'pr-1', _class: C.PullRequest, space: 'p-1', identifier: 'PROJ-7', title: 'Fix login', state: 0, attachedTo: tracker.ids.NoParent, parents: [], 'github:mixin:GithubIssue': { githubNumber: 12, url: 'https://github.com/o/r/pull/12' } }
  ]
}

let env: ReturnType<typeof createFakeEnv>
let client: any
beforeEach(async () => {
  delete process.env.HULY_FRONT_URL
  env = createFakeEnv({ workspaces: [PERSONAL], data: { jokeks2023: data() } })
  setConnectionManager(env.manager)
  client = await getConnection(W)
  client.classes = { [C.PullRequest]: { extends: tracker.class.Issue } }
})

test('branchName: lower-case id + ascii slug of the title', () => {
  assert.equal(branchName('PROJ-1', 'Login bug: Ümlaut & more'), 'proj-1-login-bug-umlaut-more')
  assert.equal(branchName('X-2', '!!!'), 'x-2')
})

test('parseSince: ISO and relative values', () => {
  const now = Date.UTC(2026, 10, 3, 12)
  assert.equal(parseSince('24h', now), now - 86_400_000)
  assert.equal(parseSince('90m', now), now - 5_400_000)
  assert.equal(parseSince('2026-11-01', now), Date.UTC(2026, 10, 1))
  assert.throws(() => parseSince('yesterday', now), /Cannot read since/)
})

test('get_issue_context bundles fields, blockers, comments and a branch name', async () => {
  const out = text(await getIssueContext({ workspace: W, identifier: 'PROJ-1', commentLimit: 20 }))
  assert.match(out, /## PROJ-1: Login bug/)
  assert.match(out, /\*\*Status:\*\* Todo/)
  assert.match(out, /Blocked by:\*\* PROJ-2: Auth service/)
  assert.match(out, /Blocks:\*\* PROJ-3: Release/)
  assert.match(out, /proj-1-login-bug-umlaut-more/)
  assert.match(out, /Repro on Safari/)
  assert.equal(env.clients.get(W)!.mutations.length, 0)
})

test('start_work sets status and assignee in one update', async () => {
  const out = text(await startWork({ workspace: W, identifier: 'PROJ-1', statusName: 'in progress', assignToMe: true }))
  assert.match(out, /Started \*\*PROJ-1\*\* — status In Progress, assigned to Jo Keks/)
  const m = env.clients.get(W)!.mutations
  assert.equal(m.length, 1)
  assert.deepEqual(m[0].data, { status: 'st-prog', assignee: 'me' })
})

test('start_work rejects unknown status and lists the available ones', async () => {
  await assert.rejects(startWork({ workspace: W, identifier: 'PROJ-1', statusName: 'Doing', assignToMe: false }), /Status 'Doing' not found\. Available: Todo, In Progress, Review in progress/)
})

test('finish_work: summary comment, PR by number under the issue, status', async () => {
  const out = text(await finishWork({ workspace: W, identifier: 'PROJ-1', summary: 'Fixed it', pullRequest: '#12', statusName: 'Review in progress' }))
  assert.match(out, /summary comment added/)
  assert.match(out, /PROJ-7 linked as sub-issue/)
  assert.match(out, /status → Review in progress/)
  const m = env.clients.get(W)!.mutations
  assert.ok(m.some((x) => x.op === 'addCollection' && x._class === chunter.class.ChatMessage && String((x.data as any).message).includes('Fixed it')))
  assert.ok(m.some((x) => x._class === C.PullRequest && (x.data as any).attachedTo === 'i-1'))
  assert.ok(m.some((x) => (x.data as any)?.status === 'st-rev'))
})

test('finish_work: unknown PR is a clear error', async () => {
  await assert.rejects(finishWork({ workspace: W, identifier: 'PROJ-1', summary: 'x', pullRequest: '#99', statusName: null }), /not synced to this project yet/)
  assert.equal(env.clients.get(W)!.mutations.length, 0, 'nothing posted when the PR cannot be resolved')
})

test('create_issue_tree dry run: reuses same-title issues, validates #refs, writes nothing', async () => {
  const out = text(await createIssueTree({
    workspace: W,
    projectIdentifier: 'PROJ',
    epic: { title: 'Auth rework' },
    children: [{ title: 'auth service' }, { title: 'Token refresh', blockedBy: ['#1'], componentLabel: 'API' }],
    milestoneLabel: 'v1',
    skipDuplicates: true,
    dryRun: true
  } as any))
  assert.match(out, /Epic: create "Auth rework"/)
  assert.match(out, /#1 "auth service" → reuse existing \*\*PROJ-2\*\*/)
  assert.match(out, /#2 create "Token refresh" · API, v1 · blocked by #1/)
  assert.equal(env.clients.get(W)!.mutations.length, 0)
  await assert.rejects(createIssueTree({ workspace: W, projectIdentifier: 'PROJ', epic: { title: 'E' }, children: [{ title: 'a', blockedBy: ['#1'] }], skipDuplicates: true, dryRun: true } as any), /must point to another child/)
  await assert.rejects(createIssueTree({ workspace: W, projectIdentifier: 'PROJ', children: [{ title: 'a' }], skipDuplicates: true, dryRun: true } as any), /Pass epic/)
})

test('changes_since lists changed fields and new comments', async () => {
  const out = text(await changesSince({ workspace: W, since: new Date(T0).toISOString(), limit: 50 }))
  assert.match(out, /\*\*PROJ-1\*\* \[Todo\] .* changed status · \+2 comment\(s\) \(by Jo Keks\)/)
  assert.doesNotMatch(out, /PROJ-2/)
})

test('claims: active foreign claim blocks, force overrides, expiry frees it', async () => {
  await assert.rejects(claimIssue({ workspace: W, identifier: 'PROJ-1', agent: 'bot-b', minutes: 60, force: false }), /claimed by 'bot-a'/)
  assert.match(text(await claimIssue({ workspace: W, identifier: 'PROJ-1', agent: 'bot-b', minutes: 60, force: true })), /claimed by bot-b/)
  assert.match(text(await claimIssue({ workspace: W, identifier: 'PROJ-1', agent: 'bot-a', minutes: 60, force: false })), /claimed by bot-a/)
  assert.match(text(await releaseIssue({ workspace: W, identifier: 'PROJ-1', agent: 'bot-a' })), /released by bot-a/)
  const past = [{ message: '[huly-claim agent=x until=2000-01-01T00:00:00Z]' }]
  assert.equal(claimState(past), undefined)
  assert.equal(claimState([{ message: '[huly-release agent=x]' }, ...past]), undefined)
  void client
})

test('write scope: project keys are found in nested args, reads are never blocked', () => {
  assert.deepEqual([...projectsIn({ projectIdentifier: 'proj', children: [{ blockedBy: ['WEB-3', '#1'] }], summary: 'mentions SERV-1 inline' })].sort(), ['PROJ', 'WEB'])
  const tool = (n: string): any => TOOLS.find((t) => t.name === n)
  assert.equal(isMutation(tool('update_issue')), true)
  assert.equal(isMutation(tool('get_issue')), false)
})

test('write scope: HULY_WRITE_PROJECTS blocks changes elsewhere; audit log records changes only', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'huly-audit-'))
  const log = join(dir, 'audit.jsonl')
  const envVars = { HULY_WRITE_PROJECTS: 'tsk', HULY_AUDIT_LOG: log }
  const update = guard(TOOLS.find((t) => t.name === 'update_issue')!, envVars)
  await assert.rejects(update({ workspace: W, identifier: 'PROJ-1', title: 'x' }), /touches project\(s\) PROJ, but HULY_WRITE_PROJECTS only allows TSK/)
  const read = guard(TOOLS.find((t) => t.name === 'get_issue_context')!, envVars)
  assert.match(text(await read({ workspace: W, identifier: 'PROJ-1', commentLimit: 0 })), /PROJ-1/)
  const comment = guard(TOOLS.find((t) => t.name === 'add_comment')!, { HULY_AUDIT_LOG: log })
  await comment({ workspace: W, identifier: 'PROJ-1', message: 'y'.repeat(500) })
  const lines = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(lines.length, 1)
  assert.equal(lines[0].tool, 'add_comment')
  assert.equal(lines[0].ok, true)
  assert.match(lines[0].args.message, /… \(500 chars\)/)
})

test('agent toolset exposes huly:// resources and workflow prompts', async () => {
  const server = createServer({ toolsets: 'agent' })
  const [c, s] = InMemoryTransport.createLinkedPair()
  await server.connect(s)
  const mcp = new Client({ name: 't', version: '0' })
  await mcp.connect(c)
  const templates = (await mcp.listResourceTemplates()).resourceTemplates.map((t) => t.uriTemplate).sort()
  assert.deepEqual(templates, ['huly://{workspace}/document/{id}', 'huly://{workspace}/issue/{identifier}'])
  const prompts = (await mcp.listPrompts()).prompts.map((p) => p.name).sort()
  assert.deepEqual(prompts, ['finish', 'plan', 'standup', 'start', 'triage'])
  const issue = await mcp.readResource({ uri: `huly://${W}/issue/PROJ-1` })
  assert.match((issue.contents[0] as any).text, /## PROJ-1: Login bug/)
  const start = await mcp.getPrompt({ name: 'start', arguments: { workspace: W, identifier: 'PROJ-1' } })
  assert.match((start.messages[0].content as any).text, /call start_work/)
  await mcp.close()
})
