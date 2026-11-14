// Profiles: fixed logins at /<name>/mcp on one server, each behind its own bearer token.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { startHttpServer, type Credentials } from '../src/http'
import { loadProfiles } from '../src/profiles'
import { createFakeEnv, PERSONAL, ACME } from './helpers'

const TOKEN_A = 'a'.repeat(24)
const env = { MCP_PROFILES: JSON.stringify({ joris: { email: 'ann@example.com', password: 'pw', authToken: TOKEN_A }, anna: { token: 'bob-token-123', public: true, workspace: 'acme' } }) }

async function withServer (fn: (base: URL, made: Credentials[]) => Promise<void>): Promise<void> {
  const made: Credentials[] = []
  const server = startHttpServer({
    port: 0, host: '127.0.0.1', env, log: () => {},
    createManager: (c) => { made.push(c); return createFakeEnv({ workspaces: c.email === 'ann@example.com' ? [PERSONAL] : [ACME] }).manager }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`)
  try { await fn(base, made) } finally { await new Promise((resolve) => server.close(resolve)) }
}

const connect = async (url: URL, headers: Record<string, string> = {}): Promise<{ client: Client, transport: StreamableHTTPClientTransport }> => {
  const client = new Client({ name: 't', version: '0' })
  const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers } })
  await client.connect(transport)
  return { client, transport }
}
const init = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } })
const post = async (url: URL, headers: Record<string, string>): Promise<Response> =>
  await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: init })

test('profiles: each path is one fixed login behind its own token; one connection per profile', async () => {
  await withServer(async (base, made) => {
    assert.deepEqual(made.map((c) => c.email ?? c.token), ['ann@example.com', 'bob-token-123'], 'managers made once, at start')
    const joris = new URL('/joris/mcp', base)
    assert.equal((await post(joris, {})).status, 401)
    assert.equal((await post(joris, { authorization: 'Bearer wrong-token-wrong-token' })).status, 401)
    const a = await connect(joris, { authorization: `Bearer ${TOKEN_A}` })
    assert.match(String(((await a.client.callTool({ name: 'list_workspaces', arguments: {} })) as any).content[0].text), /jokeks2023/)
    // A profile session is not usable on another path.
    const r = await fetch(new URL('/anna/mcp', base), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-session-id': a.transport.sessionId! }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) })
    assert.equal(r.status, 403)
    await a.client.close()
    // Public profile: no token; pinned workspace removes the workspace argument.
    const b = await connect(new URL('/anna/mcp', base))
    const tools: any = await b.client.listTools()
    assert.ok(tools.tools.length > 50)
    assert.equal(tools.tools.find((t: any) => t.name === 'list_issues').inputSchema.properties.workspace, undefined)
    await b.client.close()
    assert.equal(made.length, 2, 'sessions reuse the profile connection')
    assert.equal((await post(new URL('/nobody/mcp', base), {})).status, 404)
  })
})

test('profiles: mistakes in the file are refused with the reason', () => {
  const load = (json: unknown): unknown => loadProfiles({ MCP_PROFILES: JSON.stringify(json) })
  assert.throws(() => load({ joris: { email: 'a@b.c', password: 'x' } }), /set "authToken".*or "public": true/)
  assert.throws(() => load({ joris: { email: 'a@b.c', authToken: 'x'.repeat(16) } }), /give "token", or "email" and "password"/)
  assert.throws(() => load({ 'Joris!': { token: 'x'.repeat(12), public: true } }), /lowercase letters/)
  assert.throws(() => load({ joris: { token: 'x'.repeat(12), public: true, pasword: 'typo' } }), /Profile 'joris'/)
  assert.throws(() => loadProfiles({ MCP_PROFILES: '{nope' }), /not valid JSON/)
  assert.throws(() => loadProfiles({ MCP_PROFILES_FILE: '/x', MCP_PROFILES: '{}' }), /not both/)
  assert.equal(loadProfiles({}).size, 0)
  assert.equal(loadProfiles({ MCP_PROFILES_FILE: '/p.json' }, () => JSON.stringify({ ci: { token: 'x'.repeat(12), public: true } })).get('ci')?.public, true)
})
