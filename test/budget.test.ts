// Toolsets and the context budget: every tool schema is sent to the model in every session
// (Claude Desktop loads all of them up front), so the default set must stay small.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer, parseToolsets } from '../src/server'
import { TOOLS, TOOLSETS, DEFAULT_TOOLSETS } from '../src/registry'

/** Characters of the tools/list payload; ~3.5 characters per token. */
const DEFAULT_BUDGET_CHARS = 35_000

async function listTools (toolsets: string): Promise<any[]> {
  const server = createServer({ toolsets })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const client = new Client({ name: 'budget', version: '0' })
  await client.connect(clientSide)
  const { tools } = await client.listTools()
  await client.close()
  return tools
}

test('default toolsets stay within the context budget', async () => {
  const tools = await listTools('')
  const chars = JSON.stringify(tools).length
  assert.ok(chars <= DEFAULT_BUDGET_CHARS, `default tools/list is ${chars} chars (~${Math.round(chars / 3.5)} tokens), budget ${DEFAULT_BUDGET_CHARS}`)
})

test('tools/list carries no SDK boilerplate', async () => {
  for (const tool of await listTools('all')) {
    assert.equal(tool.inputSchema.$schema, undefined, `${tool.name} has $schema`)
    assert.equal(tool.execution, undefined, `${tool.name} has execution`)
  }
})

test('HULY_TOOLSETS selects toolsets; core is always on', async () => {
  const all = await listTools('all')
  assert.equal(all.length, TOOLS.length)
  const tracker = await listTools('tracker')
  assert.deepEqual(
    tracker.map((t) => t.name).sort(),
    TOOLS.filter((t) => t.toolset === 'tracker' || t.toolset === 'core').map((t) => t.name).sort()
  )
  const defaults = await listTools('')
  assert.equal(defaults.length, TOOLS.filter((t) => t.toolset === 'core' || DEFAULT_TOOLSETS.includes(t.toolset)).length)
  assert.ok(defaults.some((t) => t.name === 'list_workspaces'))
})

test('parseToolsets: case/whitespace tolerant, unknown names fail loudly', () => {
  assert.deepEqual([...parseToolsets(' Tracker , chat ')].sort(), ['chat', 'core', 'tracker'])
  assert.equal(parseToolsets('all').size, TOOLSETS.length)
  assert.throws(() => parseToolsets('tracker,planer'), /Unknown toolset\(s\) in HULY_TOOLSETS: planer\. Available:/)
})

test('every tool belongs to a known toolset and names are unique', () => {
  const names = new Set<string>()
  for (const t of TOOLS) {
    assert.ok((TOOLSETS as readonly string[]).includes(t.toolset), `${t.name}: unknown toolset ${t.toolset}`)
    assert.ok(!names.has(t.name), `duplicate tool ${t.name}`)
    names.add(t.name)
  }
})
