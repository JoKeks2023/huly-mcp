// Agent stage: confirmation of risky tools (elicitation) and `huly-mcp watch`.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import contact from '@hcengineering/contact'
import chunter from '@hcengineering/chunter'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { setConnectionManager, getConnection } from '../src/connection'
import { guard, isRisky, parseConfirmMode, describeCall, type Asker } from '../src/guard'
import { TOOLS, type ToolDef } from '../src/registry'
import { createServer } from '../src/server'
import { splitCommand, fill, parseEnvFile, parseWatchArgs, findCandidates, processIssue, watchOnce, loadState, saveState, DEFAULT_COMMAND, type WatchOptions, type RunDeps } from '../src/watch'
import { createFakeEnv, PERSONAL, type FakeDoc } from './helpers'

const W = 'jokeks2023'

function data (): FakeDoc[] {
  return [
    { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj' },
    { _id: 'p-2', _class: tracker.class.Project, identifier: 'OTHER', name: 'Other' },
    { _id: 'st-todo', _class: tracker.class.IssueStatus, name: 'Todo', category: task.statusCategory.ToDo },
    { _id: 'st-done', _class: tracker.class.IssueStatus, name: 'Done', category: task.statusCategory.Won },
    { _id: 'i-1', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-1', title: 'Labelled', status: 'st-todo', createdOn: 1 },
    { _id: 'i-2', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-2', title: 'Assigned to me', status: 'st-todo', assignee: 'me', createdOn: 2 },
    { _id: 'i-3', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-3', title: 'Done already', status: 'st-done', assignee: 'me', createdOn: 3 },
    { _id: 'i-4', _class: tracker.class.Issue, space: 'p-2', identifier: 'OTHER-1', title: 'Other project', status: 'st-todo', assignee: 'me', createdOn: 4 },
    { _id: 'i-5', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-5', title: 'Claimed elsewhere', status: 'st-todo', assignee: 'me', createdOn: 5 },
    { _id: 'r-1', _class: 'tags:class:TagReference', attachedTo: 'i-1', attachedToClass: tracker.class.Issue, title: 'Claude', createdOn: 1000 },
    { _id: 'r-2', _class: 'tags:class:TagReference', attachedTo: 'i-3', attachedToClass: tracker.class.Issue, title: 'claude', createdOn: 1000 },
    { _id: 'c-5', _class: chunter.class.ChatMessage, attachedTo: 'i-5', message: '[huly-claim agent=someone until=2999-01-01T00:00:00.000Z]', createdOn: 9 },
    { _id: 'tag-claude', _class: 'tags:class:TagElement', title: 'claude', targetClass: tracker.class.Issue },
    { _id: 'tag-claim', _class: 'tags:class:TagElement', title: 'agent:working', targetClass: tracker.class.Issue },
    { _id: 'me', _class: contact.class.Person, name: 'Agent,Claude', personUuid: 'acc-1' },
    { _id: 'social-id', _class: contact.class.SocialIdentity, attachedTo: 'me' }
  ]
}

let env: ReturnType<typeof createFakeEnv>
let client: any
beforeEach(async () => {
  env = createFakeEnv({ workspaces: [PERSONAL], data: { jokeks2023: data() } })
  setConnectionManager(env.manager)
  client = await getConnection(W)
})

// ── Confirmation ──────────────────────────────────────────────────────────────

const fakeTool = (name: string, calls: unknown[]): ToolDef => ({
  name,
  toolset: 'tracker',
  description: '',
  schema: TOOLS.find((t) => t.name === 'delete_issue')!.schema,
  handler: async (args) => { calls.push(args); return { content: [{ type: 'text', text: 'done' }] } }
})
const asker = (canAsk: boolean, answer: boolean, asked: string[]): Asker => ({ canAsk: () => canAsk, ask: async (m) => { asked.push(m); return answer } })

test('isRisky: deletes and structural changes, not small removals', () => {
  for (const n of ['delete_issue', 'delete_document', 'generic_delete', 'generic_update', 'bulk_update_issues', 'move_issue', 'revoke_public_link', 'restore_file_version']) assert.ok(isRisky(n), n)
  for (const n of ['remove_label', 'update_issue', 'create_issue', 'remove_reaction']) assert.ok(!isRisky(n), n)
  const names = new Set(TOOLS.map((t) => t.name))
  for (const n of ['bulk_update_issues', 'move_issue', 'generic_update', 'generic_delete', 'revoke_public_link', 'restore_file_version']) assert.ok(names.has(n), `${n} is a real tool`)
  assert.equal(parseConfirmMode(undefined), 'auto')
  assert.equal(parseConfirmMode(' Strict '), 'strict')
  assert.throws(() => parseConfirmMode('yes'), /auto, off or strict/)
})

test('guard: asks before risky tools; decline cancels, yes runs', async () => {
  const calls: unknown[] = []
  const asked: string[] = []
  const args = { workspace: W, identifier: 'PROJ-1' }
  const no = await guard(fakeTool('delete_issue', calls), {}, asker(true, false, asked))(args)
  assert.match(no.content[0].text, /Cancelled: the user declined delete_issue/)
  assert.equal(calls.length, 0)
  assert.match(asked[0], /Huly: delete issue in workspace jokeks2023\?\nidentifier: "PROJ-1"/)
  const yes = await guard(fakeTool('delete_issue', calls), {}, asker(true, true, asked))(args)
  assert.equal(yes.content[0].text, 'done')
  assert.equal(calls.length, 1)
})

test('guard: auto runs without a capable client, strict refuses, off and dry runs never ask', async () => {
  const calls: unknown[] = []
  const asked: string[] = []
  const args = { workspace: W, identifier: 'PROJ-1' }
  await guard(fakeTool('delete_issue', calls), {}, asker(false, false, asked))(args)
  await guard(fakeTool('delete_issue', calls), {})(args)
  assert.equal(calls.length, 2)
  await assert.rejects(guard(fakeTool('delete_issue', calls), { HULY_CONFIRM: 'strict' }, asker(false, true, asked))(args), /needs a human confirmation/)
  await guard(fakeTool('delete_issue', calls), { HULY_CONFIRM: 'off' }, asker(true, false, asked))(args)
  await guard(fakeTool('generic_delete', calls), {}, asker(true, false, asked))({ ...args, dryRun: true })
  await guard(fakeTool('update_issue', calls), {}, asker(true, false, asked))(args)
  assert.equal(calls.length, 5)
  assert.equal(asked.length, 0)
  const failing: Asker = { canAsk: () => true, ask: async () => { throw new Error('timeout') } }
  await assert.rejects(guard(fakeTool('delete_issue', calls), {}, failing)(args), /could not ask.*Nothing was changed/)
  assert.equal(calls.length, 5)
})

test('describeCall: readable, without workspace and confirm, long values cut', () => {
  const tool = TOOLS.find((t) => t.name === 'generic_delete')!
  const out = describeCall(tool, { workspace: W, _class: 'x:class:Y', id: 'abc', confirm: true, note: 'z'.repeat(500) })
  assert.match(out, /^Huly: generic delete in workspace jokeks2023\?/)
  assert.doesNotMatch(out, /confirm/)
  assert.ok(out.split('\n').every((l) => l.length <= 200))
})

test('elicitation over MCP: a client that declines keeps the comment, accept deletes it', async () => {
  client.docs.push({ _id: 'cm-1', _class: chunter.class.ChatMessage, space: 'p-1', attachedTo: 'i-1', attachedToClass: tracker.class.Issue, collection: 'comments', message: 'x', createdBy: 'social-id' })
  for (const answer of [false, true]) {
    const server = createServer({ toolsets: 'tracker' })
    const [c, s] = InMemoryTransport.createLinkedPair()
    await server.connect(s)
    const mcp = new Client({ name: 't', version: '0' }, { capabilities: { elicitation: { form: {} } } })
    const seen: string[] = []
    mcp.setRequestHandler(ElicitRequestSchema, async (req) => {
      seen.push(req.params.message)
      return answer ? { action: 'accept', content: { confirm: true } } : { action: 'decline' }
    })
    await mcp.connect(c)
    const before = client.mutations.length
    const res: any = await mcp.callTool({ name: 'delete_comment', arguments: { workspace: W, identifier: 'PROJ-1', commentId: 'cm-1' } })
    assert.match(seen[0], /delete comment/)
    if (answer) assert.ok(client.mutations.length > before, 'deleted after yes')
    else { assert.match(res.content[0].text, /Cancelled/); assert.equal(client.mutations.length, before) }
    await mcp.close()
  }
})

// ── watch ─────────────────────────────────────────────────────────────────────

test('splitCommand / fill / parseEnvFile', () => {
  assert.deepEqual(splitCommand(`claude -p {prompt} --x "a b" 'c d' ""`), ['claude', '-p', '{prompt}', '--x', 'a b', 'c d', ''])
  assert.throws(() => splitCommand('a "b'), /Unclosed/)
  assert.equal(fill('{issue}: {title} {unknown}', { issue: 'PROJ-1', title: 'T' }), 'PROJ-1: T {unknown}')
  assert.equal(fill('{a}', { a: '{b}', b: 'x' }), '{b}', 'values are not expanded again')
  assert.deepEqual(parseEnvFile('# c\nexport HULY_EMAIL="a@b"\nHULY_PASSWORD=p#1 # note\nX=\'y z\'\nbad line'), { HULY_EMAIL: 'a@b', HULY_PASSWORD: 'p#1', X: 'y z' })
})

test('parseWatchArgs: defaults and validation', () => {
  const o = parseWatchArgs([], {})
  assert.equal(o.assigned, true)
  assert.equal(o.command, DEFAULT_COMMAND)
  assert.equal(o.agent, 'claude-watch')
  const l = parseWatchArgs(['--label', 'claude', '--project', 'proj, tsk', '--project', 'X', '--interval', '30', '--once', '--agent', 'my bot'], { HULY_AGENT_NAME: 'a' })
  assert.equal(l.assigned, false)
  assert.deepEqual(l.projects, ['PROJ', 'TSK', 'X'])
  assert.equal(l.intervalSec, 30)
  assert.equal(l.agent, 'my-bot')
  assert.equal(parseWatchArgs(['--label', 'c', '--assigned'], {}).assigned, true)
  assert.throws(() => parseWatchArgs(['--interval', '1'], {}), /≥ 5/)
  assert.throws(() => parseWatchArgs(['--label'], {}), /needs a value/)
  assert.throws(() => parseWatchArgs(['--nope'], {}), /Unknown option/)
})

test('findCandidates: label and assignment, open issues only, project filter, rerun on re-added label', async () => {
  const ids = (cs: any[]): string[] => cs.map((c) => `${c.issue.identifier as string}:${c.trigger as string}`)
  assert.deepEqual(ids(await findCandidates(client, { projects: [], label: 'claude', assigned: true }, {})), ['PROJ-1:label', 'PROJ-2:assigned', 'OTHER-1:assigned', 'PROJ-5:assigned'])
  assert.deepEqual(ids(await findCandidates(client, { projects: ['PROJ'], label: 'claude', assigned: false }, {})), ['PROJ-1:label'])
  const ran = { 'i-1': { identifier: 'PROJ-1', trigger: 'label', ranAt: 500, result: 'ok' }, 'i-2': { identifier: 'PROJ-2', trigger: 'assigned', ranAt: 500, result: 'ok' } }
  assert.deepEqual(ids(await findCandidates(client, { projects: ['PROJ'], label: 'claude', assigned: true }, ran)), ['PROJ-1:label', 'PROJ-5:assigned'], 'label re-added after the run → again')
  ran['i-1'].ranAt = 2000
  assert.deepEqual(ids(await findCandidates(client, { projects: ['PROJ'], label: 'claude', assigned: true }, ran)), ['PROJ-5:assigned'])
  await assert.rejects(findCandidates(client, { projects: ['NOPE'], assigned: true }, {}), /not found: NOPE/)
})

function opts (over: Partial<WatchOptions> = {}): WatchOptions {
  return { ...parseWatchArgs(['--project', 'PROJ'], {}), cwd: tmpdir(), serverEntry: '/srv/huly-mcp.js', ...over }
}

test('processIssue: claims, runs the command without a shell, passes identity env and an MCP config', async () => {
  const runs: Array<{ argv: string[], env: NodeJS.ProcessEnv, config: any }> = []
  const deps: RunDeps = {
    client,
    workspace: W,
    env: { HULY_EMAIL: 'agent@x', HULY_TOOLSETS: 'tracker,agent' },
    log: () => {},
    now: () => 4242,
    exec: async (argv, _cwd, e) => {
      const cfgPath = argv[argv.indexOf('--mcp-config') + 1]
      runs.push({ argv, env: e, config: JSON.parse(readFileSync(cfgPath, 'utf8')) })
      return 0
    }
  }
  const [c] = await findCandidates(client, { projects: ['PROJ'], label: 'claude', assigned: false }, {})
  const rec = await processIssue(c, opts({ label: 'claude' }), deps)
  assert.deepEqual(rec, { identifier: 'PROJ-1', trigger: 'label', ranAt: 4242, result: 'ok' })
  const { argv, env: e, config } = runs[0]
  assert.equal(argv[0], 'claude')
  assert.match(argv[2], /^Huly issue PROJ-1 \("Labelled"\) in workspace jokeks2023 was handed to you \(label "claude"\)/)
  assert.equal(e.HULY_CONFIRM, 'strict')
  assert.equal(e.HULY_WORKSPACE, W)
  assert.equal(e.HULY_ISSUE, 'PROJ-1')
  assert.equal(e.HULY_EMAIL, 'agent@x', 'credentials are inherited, not written to the config file')
  assert.deepEqual(config.mcpServers.huly.args, ['/srv/huly-mcp.js'])
  assert.equal(config.mcpServers.huly.env.HULY_EMAIL, undefined)
  assert.equal(config.mcpServers.huly.env.HULY_TOOLSETS, 'tracker,agent')
  assert.ok(!existsSync(argv[argv.indexOf('--mcp-config') + 1]), 'temp config removed after the run')
  const claim = client.mutations.find((m: any) => m.op === 'addCollection' && /huly-claim agent=claude-watch/.test(JSON.stringify(m.data)))
  assert.ok(claim != null, 'claim comment written')
})

test('processIssue: failure comments, foreign claim skips', async () => {
  const deps: RunDeps = { client, workspace: W, env: {}, log: () => {}, exec: async () => 3 }
  const cands = await findCandidates(client, { projects: ['PROJ'], assigned: true }, {})
  const rec = await processIssue(cands.find((c) => c.issue.identifier === 'PROJ-2')!, opts({ command: 'run {issue}' }), deps)
  assert.equal(rec?.result, 'exit 3')
  assert.ok(client.mutations.some((m: any) => /ended: exit 3/.test(JSON.stringify(m.data))))
  const logs: string[] = []
  const skipped = await processIssue(cands.find((c) => c.issue.identifier === 'PROJ-5')!, opts(), { ...deps, log: (l) => logs.push(l) })
  assert.equal(skipped, undefined)
  assert.match(logs[0], /skip PROJ-5: .*claimed by 'someone'/)
  const timedOut = await processIssue(cands.find((c) => c.issue.identifier === 'PROJ-2')!, opts({ command: 'run' }), { ...deps, exec: async () => null })
  assert.equal(timedOut?.result, 'timeout after 60 min')
})

test('watchOnce: dry run changes nothing; real run records state', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'watch-'))
  const path = join(dir, 'state.json')
  const logs: string[] = []
  const deps: RunDeps = { client, workspace: W, env: {}, log: (l) => logs.push(l), exec: async () => 0 }
  const n = await watchOnce(opts({ dryRun: true }), deps, {}, () => assert.fail('dry run saves nothing'))
  assert.equal(n, 2)
  assert.equal(client.mutations.length, 0)
  assert.match(logs.join('\n'), /would run PROJ-2 \(assigned\)/)
  const state = loadState(path)
  await watchOnce(opts({ command: 'true' }), deps, state, (s) => saveState(path, s))
  assert.deepEqual(Object.keys(loadState(path)), ['i-2'], 'PROJ-5 (claimed elsewhere) is not recorded, so it is retried later')
  assert.equal(await watchOnce(opts({ dryRun: true }), deps, loadState(path), () => {}), 1)
})
