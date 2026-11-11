// "Log in with Huly": the full OAuth flow a client like Claude runs, against the HTTP server.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import net from 'node:net'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { startHttpServer, type Credentials } from '../src/http'
import { HulyOAuthProvider, Sealer, type HulyLogin } from '../src/oauth'
import { createFakeEnv, PERSONAL, ACME } from './helpers'

const login: HulyLogin = {
  password: async (email, pw) => { if (pw !== 'right') throw new Error('Invalid credentials'); return `huly-token-${email}` },
  sendCode: async () => {},
  verifyCode: async (email, code) => { if (code !== '123456') throw new Error('Invalid code'); return `huly-token-${email}` }
}

async function freePort (): Promise<number> {
  return await new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)) }) })
}

async function withOAuthServer (fn: (base: URL, made: Credentials[]) => Promise<void>): Promise<void> {
  const port = await freePort()
  const base = new URL(`http://localhost:${port}`)
  const made: Credentials[] = []
  const server = startHttpServer({
    port, host: '127.0.0.1', env: {}, log: () => {},
    oauth: { publicUrl: base, provider: new HulyOAuthProvider(new Sealer('x'.repeat(40)), login) },
    createManager: (c) => { made.push(c); return createFakeEnv({ workspaces: c.token === 'huly-token-ann@example.com' ? [PERSONAL] : [ACME] }).manager }
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  try { await fn(base, made) } finally { await new Promise((resolve) => server.close(resolve)) }
}

const b64url = (b: Buffer): string => b.toString('base64url')

async function authorize (base: URL, form: Record<string, string>): Promise<{ clientId: string, verifier: string, location: string | null, status: number, html: string, pending: string }> {
  const reg = await (await fetch(new URL('/register', base), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Test App', redirect_uris: ['http://localhost:9/cb'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }) })).json() as any
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const q = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: 'http://localhost:9/cb', code_challenge: challenge, code_challenge_method: 'S256', state: 'st-1' })
  const page = await (await fetch(new URL(`/authorize?${q.toString()}`, base))).text()
  const pending = /name="pending" value="([^"]+)"/.exec(page)?.[1] ?? ''
  const res = await fetch(new URL('/oauth/login', base), { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ pending, ...form }).toString() })
  return { clientId: reg.client_id, verifier, location: res.headers.get('location'), status: res.status, html: await res.text(), pending }
}

async function token (base: URL, body: Record<string, string>): Promise<{ status: number, json: any }> {
  const res = await fetch(new URL('/token', base), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() })
  return { status: res.status, json: await res.json() }
}

test('oauth: metadata, register, login page, password login, PKCE token, then MCP as that person', async () => {
  await withOAuthServer(async (base, made) => {
    const meta = await (await fetch(new URL('/.well-known/oauth-authorization-server', base))).json() as any
    assert.equal(meta.issuer, base.href)
    assert.ok(meta.registration_endpoint != null && meta.code_challenge_methods_supported.includes('S256'))
    const unauth = await fetch(new URL('/mcp', base), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    assert.equal(unauth.status, 401)
    assert.match(unauth.headers.get('www-authenticate') ?? '', /resource_metadata=".*oauth-protected-resource/)

    const a = await authorize(base, { action: 'password', email: 'ann@example.com', password: 'right' })
    assert.equal(a.status, 302)
    const loc = new URL(a.location!)
    assert.equal(loc.searchParams.get('state'), 'st-1')
    const code = loc.searchParams.get('code')!
    const t = await token(base, { grant_type: 'authorization_code', code, code_verifier: a.verifier, client_id: a.clientId, redirect_uri: 'http://localhost:9/cb' })
    assert.equal(t.status, 200, JSON.stringify(t.json))
    assert.equal(t.json.token_type.toLowerCase(), 'bearer')
    assert.doesNotMatch(t.json.access_token, /huly-token|ann@example/, 'tokens are sealed, nothing readable inside')

    const client = new Client({ name: 't', version: '0' })
    await client.connect(new StreamableHTTPClientTransport(new URL('/mcp', base), { requestInit: { headers: { authorization: `Bearer ${String(t.json.access_token)}` } } }))
    const r: any = await client.callTool({ name: 'list_workspaces', arguments: {} })
    assert.match(r.content[0].text, /jokeks2023/)
    await client.close()
    assert.deepEqual(made.map((c) => c.token), ['huly-token-ann@example.com'])

    // The code works once; a wrong verifier never.
    assert.equal((await token(base, { grant_type: 'authorization_code', code, code_verifier: a.verifier, client_id: a.clientId, redirect_uri: 'http://localhost:9/cb' })).status, 400)
    // Refresh rotates: the old refresh token is spent.
    const r1 = await token(base, { grant_type: 'refresh_token', refresh_token: t.json.refresh_token, client_id: a.clientId })
    assert.equal(r1.status, 200)
    assert.equal((await token(base, { grant_type: 'refresh_token', refresh_token: t.json.refresh_token, client_id: a.clientId })).status, 400)
  })
})

test('oauth: wrong password and wrong code re-show the page; one-time code login works; PKCE is enforced', async () => {
  await withOAuthServer(async (base) => {
    const wrong = await authorize(base, { action: 'password', email: 'ann@example.com', password: 'nope' })
    assert.equal(wrong.status, 401)
    assert.match(wrong.html, /E-mail or password is wrong/)
    assert.doesNotMatch(wrong.html, /nope/, 'the password is never echoed')

    const send = await authorize(base, { action: 'send-code', email: 'bob@example.com' })
    assert.equal(send.status, 200)
    assert.match(send.html, /We sent a one-time code to <b>bob@example\.com<\/b>/)
    const verify = await fetch(new URL('/oauth/login', base), { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ pending: send.pending, action: 'verify-code', email: 'bob@example.com', code: '123456' }).toString() })
    assert.equal(verify.status, 302)
    const code = new URL(verify.headers.get('location')!).searchParams.get('code')!
    const bad = await token(base, { grant_type: 'authorization_code', code, code_verifier: 'x'.repeat(43), client_id: send.clientId, redirect_uri: 'http://localhost:9/cb' })
    assert.equal(bad.status, 400, 'a wrong PKCE verifier is refused')
  })
})

test('oauth: tampered or foreign tokens are refused; the login page cannot be framed', async () => {
  const sealer = new Sealer('y'.repeat(40))
  const sealed = sealer.seal('access', { hulyToken: 't' }, 60)
  assert.equal(new Sealer('z'.repeat(40)).open('access', sealed), undefined, 'another secret')
  assert.equal(sealer.open('refresh', sealed), undefined, 'an access token is not a refresh token')
  const flipped = Buffer.from(sealed, 'base64url'); flipped[flipped.length - 1] ^= 1
  assert.equal(sealer.open('access', flipped.toString('base64url')), undefined, 'tampered')
  assert.equal(sealer.open('access', sealer.seal('access', {}, -1)), undefined, 'expired')
  await withOAuthServer(async (base) => {
    const a = await authorize(base, { action: 'password', email: 'ann@example.com', password: 'nope' })
    const page = await fetch(new URL('/oauth/login', base), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ pending: a.pending, action: 'password', email: 'a@example.com', password: 'x' }).toString() })
    assert.equal(page.headers.get('x-frame-options'), 'DENY')
    assert.match(page.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/)
    const bogus = await fetch(new URL('/mcp', base), { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer not-a-token' }, body: '{}' })
    assert.equal(bogus.status, 401)
  })
})
