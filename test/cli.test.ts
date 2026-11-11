// Command line: parameters from the schemas, values by type, the same guard as the MCP server.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { setConnectionManager, getConnection } from '../src/connection'
import { runCli, parseArgv, paramsOf, coerce, findTool, complete, toolHelp, type Io } from '../src/cli'
import { createFakeEnv, PERSONAL } from './helpers'

const W = 'jokeks2023'

function io (over: Partial<Io> = {}): Io & { stdout: string, stderr: string } {
  const r: any = { stdout: '', stderr: '' }
  return Object.assign(r, {
    env: { HULY_WORKSPACE: W },
    out: (t: string) => { r.stdout += t },
    err: (t: string) => { r.stderr += t },
    readFile: (p: string) => { if (p === 'notes.md') return '# Notes\n\nfrom a file'; throw new Error(`ENOENT ${p}`) }
  }, over)
}

beforeEach(() => {
  setConnectionManager(createFakeEnv({
    workspaces: [PERSONAL],
    data: {
      [W]: [
        { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', space: 'p-1', sequence: 1 },
        { _id: 'st-todo', _class: tracker.class.IssueStatus, name: 'Todo', category: task.statusCategory.ToDo },
        { _id: 'tt', _class: task.class.TaskType, name: 'Issue' },
        { _id: 'i-1', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-1', title: 'Login is slow', status: 'st-todo', priority: 0, parents: [] }
      ]
    }
  }).manager)
})
afterEach(() => { setConnectionManager(null) })

test('parameters come from the schema: kinds, enums, defaults, required', () => {
  const p = new Map(paramsOf(findTool('list-issues')!).map((x) => [x.name, x]))
  assert.equal(p.get('projectIdentifier')?.required, true)
  assert.deepEqual(p.get('priority')?.enum, ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'])
  assert.equal(p.get('limit')?.default, 50)
  assert.ok(p.get('assignee')?.kinds.has('null'))
  const bulk = new Map(paramsOf(findTool('bulk_update_issues')!).map((x) => [x.name, x]))
  assert.ok(bulk.get('identifiers')?.kinds.has('array'))
})

test('values are coerced by type; wrong values are usage errors', () => {
  const p = new Map(paramsOf(findTool('list_issues')!).map((x) => [x.name, x]))
  assert.equal(coerce(p.get('limit')!, ['20']), 20)
  assert.throws(() => coerce(p.get('limit')!, ['many']), /--limit expects a/)
  assert.equal(coerce(p.get('assignee')!, ['null']), null)
  assert.throws(() => coerce(p.get('priority')!, ['Hgh']), /not allowed\. Use one of: .*Did you mean High\?/)
  const bulk = new Map(paramsOf(findTool('bulk_update_issues')!).map((x) => [x.name, x]))
  assert.deepEqual(coerce(bulk.get('identifiers')!, ['A-1', 'A-2']), ['A-1', 'A-2'])
  assert.deepEqual(coerce(bulk.get('identifiers')!, ['["A-1","A-2"]']), ['A-1', 'A-2'])
})

test('argv: flags with and without =, --no-x, globals, positionals', () => {
  const a = parseArgv(['list_issues', '--project-identifier=PROJ', '--limit', '5', '-w', 'acme', '--format', 'json', '-y'])
  assert.equal(a.command, 'list_issues')
  assert.deepEqual(a.flags.get('project-identifier'), ['PROJ'])
  assert.deepEqual(a.flags.get('limit'), ['5'])
  assert.equal(a.workspace, 'acme')
  assert.equal(a.format, 'json')
  assert.equal(a.yes, true)
  assert.deepEqual(parseArgv(['x', '--no-skip-duplicates']).flags.get('skip-duplicates'), ['false'])
})

test('runs a read with a positional value and prints the tool text', async () => {
  const r = io()
  assert.equal(await runCli(['get_issue', 'PROJ-1'], r), 0)
  assert.match(r.stdout, /## PROJ-1: Login is slow/)
  const j = io()
  assert.equal(await runCli(['list-issues', '--project', 'PROJ', '--format', 'json'], j), 0, 'dashes and aliases work')
  const parsed = JSON.parse(j.stdout)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.tool, 'list_issues')
  assert.match(parsed.text, /PROJ-1/)
})

test('writes: --<param>-file reads a text value; the workspace comes from HULY_WORKSPACE', async () => {
  const r = io()
  assert.equal(await runCli(['create_issue', '--project', 'PROJ', '--title-file', 'notes.md'], r), 0, r.stderr)
  const add = ((await getConnection(W)) as any).mutations.find((m: any) => m.op === 'addCollection' && m._class === tracker.class.Issue)
  assert.equal(add.data.title, '# Notes\n\nfrom a file')
  const both = io()
  assert.equal(await runCli(['create_issue', '--project', 'PROJ', '--title', 'x', '--title-file', 'notes.md'], both), 2)
  assert.match(both.stderr, /Pass either --title or --title-file, not both/)
  const missingFile = io()
  assert.equal(await runCli(['create_issue', '--project', 'PROJ', '--title-file', 'nope.md'], missingFile), 2)
  assert.match(missingFile.stderr, /--title-file: cannot read nope\.md/)
})

test('usage errors exit 2 with a hint; tool errors exit 1', async () => {
  const unknownTool = io()
  assert.equal(await runCli(['get-isue', 'PROJ-1'], unknownTool), 2)
  assert.match(unknownTool.stderr, /Did you mean get_issue/)
  const unknownFlag = io()
  assert.equal(await runCli(['list_issues', '--project', 'PROJ', '--limitt', '3'], unknownFlag), 2)
  assert.match(unknownFlag.stderr, /Unknown option --limitt for list_issues\. Did you mean --limit\?/)
  const missing = io({ env: {} })
  assert.equal(await runCli(['create_issue', '--project', 'PROJ', '--title', 'x'], missing), 2)
  assert.match(missing.stderr, /--workspace is required for changes/)
  const notFound = io()
  assert.equal(await runCli(['get_issue', 'PROJ-99'], notFound), 1)
  assert.match(notFound.stderr, /Issue 'PROJ-99' not found/)
})

test('hard-to-undo tools: refused without a terminal, asked in one, run with --yes', async () => {
  const noTty = io()
  assert.equal(await runCli(['delete_issue', 'PROJ-1'], noTty), 1)
  assert.match(noTty.stderr, /hard to undo\. Run it in a terminal to confirm, or pass --yes/)
  assert.equal(((await getConnection(W)) as any).mutations.length, 0)

  const asked: string[] = []
  const declined = io({ confirm: async (m) => { asked.push(m); return false } })
  assert.equal(await runCli(['delete_issue', 'PROJ-1'], declined), 1)
  assert.match(asked[0], /delete issue in workspace jokeks2023\?\nidentifier: "PROJ-1"/)
  assert.equal(((await getConnection(W)) as any).mutations.length, 0)

  const yes = io()
  assert.equal(await runCli(['delete_issue', 'PROJ-1', '--yes'], yes), 0)
  assert.match(yes.stdout, /Deleted \*\*PROJ-1\*\*/)
})

test('help and tool list', async () => {
  const h = io()
  assert.equal(await runCli([], h), 0)
  assert.match(h.stdout, /huly-mcp <tool> \[<value>\] \[--param value …\]/)
  const help = toolHelp(findTool('manage_notifications')!)
  assert.match(help, /--action <pin\|unpin\|hide\|unhide\|unread\|unarchive\|follow\|unfollow>/)
  assert.match(help, /Usage: huly-mcp manage_notifications \[options\]/)
  const list = io()
  assert.equal(await runCli(['tools', 'notification'], list), 0)
  assert.match(list.stdout, /manage_notifications/)
  assert.doesNotMatch(list.stdout, /list_issues/)
})

test('completion: commands, tool flags and enum values', () => {
  assert.ok(complete(['huly-mcp'], 'list_iss').includes('list_issues'))
  assert.deepEqual(complete(['huly-mcp', 'list_issues'], '--pri'), ['--priority'])
  assert.deepEqual(complete(['huly-mcp', 'list_issues', '--priority'], 'H'), ['High'])
  assert.ok(complete(['huly-mcp', 'help'], 'get_is').includes('get_issue'))
})
