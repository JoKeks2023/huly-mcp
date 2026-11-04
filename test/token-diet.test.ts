// Token diet: pinned workspace (no workspace argument), validation limits not advertised but enforced.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer, stripLimits } from '../src/server'
import { setConnectionManager } from '../src/connection'
import { createFakeEnv, PERSONAL, ACME } from './helpers'

async function connect (options: { toolsets?: string, workspace?: string }): Promise<Client> {
  const server = createServer(options)
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const client = new Client({ name: 'diet', version: '0' })
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
