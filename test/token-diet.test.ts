// Token diet: pinned workspace (no workspace argument), validation limits not advertised but enforced.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js'
import { createServer, stripLimits } from '../src/server'
import { setConnectionManager } from '../src/connection'
import { createFakeEnv, PERSONAL, ACME } from './helpers'

async function connect (options: { toolsets?: string, workspace?: string, dynamic?: boolean }, onChange?: () => void): Promise<Client> {
  const server = createServer(options)
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const client = new Client({ name: 'diet', version: '0' })
  if (onChange != null) client.setNotificationHandler(ToolListChangedNotificationSchema, async () => { onChange() })
  await client.connect(clientSide)
  return client
}

let env: ReturnType<typeof createFakeEnv> | undefined
afterEach(async () => {
  await env?.manager.closeAll()
  setConnectionManager(null)
  env = undefined
})

test('stripLimits removes numeric validation keywords only', () => {
  const schema = { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }, name: { type: 'string', minLength: 1 }, maximum: { type: 'string' } } }
  stripLimits(schema)
  assert.deepEqual(schema.properties, { limit: { type: 'integer', default: 10 }, name: { type: 'string' }, maximum: { type: 'string' } })
})

test('tools/list advertises no limits, but they are still enforced', async () => {
  env = createFakeEnv({ workspaces: [PERSONAL], data: { jokeks2023: [] } })
  setConnectionManager(env.manager)
  const client = await connect({ toolsets: 'all', workspace: '' })
  const { tools } = await client.listTools()
  assert.doesNotMatch(JSON.stringify(tools), /"(minLength|maximum|minimum|exclusiveMinimum)"/)
  const res: any = await client.callTool({ name: 'list_notifications', arguments: { limit: 0 } })
  assert.equal(res.isError, true)
  assert.match(res.content[0].text, /limit|>=|too_small|greater/i)
  await client.close()
})

test('pinned workspace: no workspace argument, calls run in the pinned workspace, smaller tools/list', async () => {
  env = createFakeEnv({
    workspaces: [PERSONAL, ACME],
    data: {
      jokeks2023: [{ _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Mine' }],
      acme: [{ _id: 'p-2', _class: tracker.class.Project, identifier: 'ACM', name: 'Theirs' }]
    }
  })
  setConnectionManager(env.manager)
  const open = await connect({ toolsets: '', workspace: '' })
  const pinned = await connect({ toolsets: '', workspace: 'jokeks2023' })
  const a = (await open.listTools()).tools
  const b = (await pinned.listTools()).tools
  assert.equal(a.length, b.length)
  assert.ok(b.every((t: any) => t.inputSchema.properties?.workspace == null && !(t.inputSchema.required ?? []).includes('workspace')))
  assert.ok(JSON.stringify(b).length < JSON.stringify(a).length - 5000)
  assert.match(pinned.getInstructions() ?? '', /All tools work in workspace 'jokeks2023'/)
  assert.doesNotMatch(pinned.getInstructions() ?? '', /Reads may omit it/)

  // Without pinning, two workspaces are ambiguous; pinned, the call goes to the pinned one.
  const res: any = await pinned.callTool({ name: 'list_projects', arguments: {} })
  assert.notEqual(res.isError, true, res.content?.[0]?.text)
  assert.match(res.content[0].text, /PROJ/)
  assert.doesNotMatch(res.content[0].text, /ACM/)
  const amb: any = await open.callTool({ name: 'list_projects', arguments: {} })
  assert.equal(amb.isError, true)
  await open.close(); await pinned.close()
})

test('list_comments: newest n in chronological order, long ones shortened unless full', async () => {
  const chunter = 'chunter:class:ChatMessage'
  const long = 'x'.repeat(2000)
  env = createFakeEnv({
    workspaces: [PERSONAL],
    data: {
      jokeks2023: [
        { _id: 'i-1', _class: tracker.class.Issue, identifier: 'PROJ-1', title: 'T' },
        { _id: 'sid', _class: 'contact:class:SocialIdentity', attachedTo: 'me' },
        { _id: 'me', _class: 'contact:class:Person', name: 'Keks,Jo' },
        ...[1, 2, 3, 4].map((n) => ({ _id: `c-${n}`, _class: chunter, attachedTo: 'i-1', createdBy: 'sid', createdOn: Date.UTC(2026, 10, n), message: n === 4 ? long : `comment ${n}` }))
      ]
    }
  })
  setConnectionManager(env.manager)
  const { listComments } = await import('../src/tools/comments')
  // The fake ignores sort; the server returns newest first — emulate by checking the shown set and order.
  const out = (await listComments({ identifier: 'PROJ-1', limit: 10 } as any) as any).content[0].text as string
  assert.match(out, /## Comments on PROJ-1 \(4\)/)
  assert.ok(out.indexOf('comment 1') < out.indexOf('comment 3'))
  assert.match(out, /x… _\[500 more chars — list_comments full: true\]_/)
  const full = (await listComments({ identifier: 'PROJ-1', limit: 10, full: true } as any) as any).content[0].text as string
  assert.ok(full.includes(long))
  const two = (await listComments({ identifier: 'PROJ-1', limit: 2 } as any) as any).content[0].text as string
  assert.match(two, /\(newest 2 of 4\)/)
})

test('dynamic toolsets: start small, enable_toolsets lists and loads more, client is notified', async () => {
  let changes = 0
  const client = await connect({ toolsets: 'agent', workspace: '', dynamic: true }, () => { changes++ })
  const names = async (): Promise<string[]> => (await client.listTools()).tools.map((t: any) => t.name)
  const before = await names()
  assert.ok(before.includes('enable_toolsets') && before.includes('my_day') && before.includes('list_workspaces'))
  assert.ok(!before.includes('list_events'))
  assert.match(client.getInstructions() ?? '', /load on demand: enable_toolsets/)
  const list: any = await client.callTool({ name: 'enable_toolsets', arguments: {} })
  assert.match(list.content[0].text, /- \*\*calendar\*\* \(\d+\): list_events,/)
  assert.doesNotMatch(list.content[0].text, /\*\*agent\*\*/)
  const bad: any = await client.callTool({ name: 'enable_toolsets', arguments: { toolsets: ['nope'] } })
  assert.equal(bad.isError, true)
  const res: any = await client.callTool({ name: 'enable_toolsets', arguments: { toolsets: ['Calendar'] } })
  assert.match(res.content[0].text, /Loaded \d+ tool\(s\): list_events/)
  await new Promise((r) => setTimeout(r, 20))
  assert.ok(changes > 0, 'client got tools/list_changed')
  const after = await names()
  assert.ok(after.includes('list_events') && after.includes('create_event'))
  assert.match(((await client.callTool({ name: 'enable_toolsets', arguments: { toolsets: ['calendar'] } })) as any).content[0].text, /Already loaded/)
  // Without the switch there is no enable_toolsets
  const plain = await connect({ toolsets: 'agent', workspace: '' })
  assert.ok(!(await plain.listTools()).tools.some((t: any) => t.name === 'enable_toolsets'))
  await client.close(); await plain.close()
})
