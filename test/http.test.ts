// HTTP mode: bearer token, per-session Huly logins from headers, server credentials only behind MCP_AUTH_TOKEN.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { startHttpServer, allowedHosts, type Credentials } from '../src/http'
import { setConnectionManager } from '../src/connection'
import { createFakeEnv, PERSONAL, ACME } from './helpers'

async function withServer (env: NodeJS.ProcessEnv, fn: (url: URL, made: Credentials[]) => Promise<void>): Promise<void> {
  const made: Credentials[] = []
  const server = startHttpServer({
    port: 0, host: '127.0.0.1', env, log: () => {},
    createManager: (c) => { made.push(c); return createFakeEnv({ workspaces: c.email === 'ann@example.com' ? [PERSONAL] : [ACME] }).manager }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`)
  try { await fn(url, made) } finally { await new Promise((resolve) => server.close(resolve)) }
}

async function workspacesAs (url: URL, headers: Record<string, string>): Promise<string> {
  const client = new Client({ name: 't', version: '0' })
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers } }))
  const r: any = await client.callTool({ name: 'list_workspaces', arguments: {} })
  await client.close()
  return r.content[0].text
}

test('http: each session uses the Huly login from its own headers', async () => {
  await withServer({}, async (url, made) => {
    assert.match(await workspacesAs(url, { 'X-Huly-Email': 'ann@example.com', 'X-Huly-Password': 'pw' }), /jokeks2023/)
    assert.match(await workspacesAs(url, { 'X-Huly-Token': 'bob-token' }), /acme/)
    assert.deepEqual(made.map((c) => c.email ?? c.token), ['ann@example.com', 'bob-token'])
  })
})

test('http: without credentials 401; server credentials only with MCP_AUTH_TOKEN and the right bearer', async () => {
  const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } }
  const post = async (url: URL, headers: Record<string, string>): Promise<Response> =>
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(init) })
  await withServer({ HULY_EMAIL: 'srv@example.com', HULY_PASSWORD: 'pw' }, async (url) => {
    const r = await post(url, {})
    assert.equal(r.status, 401)
    assert.match(await r.text(), /server credentials need MCP_AUTH_TOKEN/)
  })
  setConnectionManager(createFakeEnv({ workspaces: [PERSONAL] }).manager)
  try {
    await withServer({ HULY_EMAIL: 'srv@example.com', HULY_PASSWORD: 'pw', MCP_AUTH_TOKEN: 's3cret' }, async (url) => {
      assert.equal((await post(url, {})).status, 401, 'no bearer')
      assert.equal((await post(url, { authorization: 'Bearer wrong' })).status, 401)
      assert.match(await workspacesAs(url, { authorization: 'Bearer s3cret' }), /jokeks2023/)
      const health = await fetch(new URL('/healthz', url))
      assert.equal(health.status, 204)
    })
  } finally { setConnectionManager(null) }
})

test('http: half a login is a clear 400, unknown session 404', async () => {
  await withServer({}, async (url) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-huly-email': 'a@example.com' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } }) })
    assert.equal(r.status, 400)
    const s = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-session-id': 'nope' }, body: '{}' })
    assert.equal(s.status, 404)
  })
})

test('allowedHosts adds the port and loopback', () => {
  assert.equal(allowedHosts('', 8000), undefined)
  assert.deepEqual(allowedHosts('huly-mcp.example.com', 8000), ['huly-mcp.example.com', 'huly-mcp.example.com:8000', 'localhost', 'localhost:8000', '127.0.0.1', '127.0.0.1:8000'])
})
