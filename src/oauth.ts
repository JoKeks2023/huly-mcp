// "Log in with Huly" for the HTTP server: an OAuth 2.1 authorization server in front of /mcp.
//
// The protocol parts (client registration, PKCE, token endpoint, metadata) come from the MCP SDK.
// This file is the provider: a login page (e-mail + password, or a one-time code for Google/GitHub
// accounts) and the tokens. Everything is stateless and sealed with AES-256-GCM under
// MCP_OAUTH_SECRET: clients, pending logins, codes and tokens carry their own data, so no database
// is needed and logins survive restarts. The Huly password is never stored — only the Huly
// account token from the login, and only inside the sealed tokens.
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto'
import type { Request, Response } from 'express'
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { InvalidGrantError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { getClient as getAccountClient } from '@hcengineering/account-client'

export const ACCESS_TTL_S = 60 * 60
export const REFRESH_TTL_S = 30 * 24 * 60 * 60
const CODE_TTL_S = 5 * 60
const PENDING_TTL_S = 15 * 60

type Kind = 'client' | 'pending' | 'code' | 'access' | 'refresh'

/** Seal/open small JSON payloads; the kind is part of the payload so a code is never accepted as a token. */
export class Sealer {
  private readonly key: Buffer
  // scrypt, not a plain hash: MCP_OAUTH_SECRET should be random, but if someone uses a passphrase,
  // a stolen token must not make guessing it cheap. Runs once at start-up (~50 ms).
  constructor (secret: string) { this.key = scryptSync(secret, 'huly-mcp-oauth/v2', 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }) }

  seal (kind: Kind, data: Record<string, unknown>, ttlS?: number): string {
    const iv = randomBytes(12)
    const c = createCipheriv('aes-256-gcm', this.key, iv)
    const body = JSON.stringify({ k: kind, d: data, e: ttlS != null ? Math.floor(Date.now() / 1000) + ttlS : undefined })
    const ct = Buffer.concat([c.update(body, 'utf8'), c.final()])
    return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url')
  }

  open<T = Record<string, any>> (kind: Kind, token: string): (T & { exp?: number }) | undefined {
    try {
      const raw = Buffer.from(token, 'base64url')
      if (raw.length < 29) return undefined
      const d = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12))
      d.setAuthTag(raw.subarray(12, 28))
      const body = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'))
      if (body.k !== kind) return undefined
      if (body.e != null && body.e < Math.floor(Date.now() / 1000)) return undefined
      return { ...body.d, exp: body.e }
    } catch { return undefined }
  }
}

/** What the login page needs from Huly's account service. */
export interface HulyLogin {
  password: (email: string, password: string) => Promise<string>
  sendCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<string>
}

export function accountServiceLogin (accountsUrl: string): HulyLogin {
  const client = async (): Promise<any> => getAccountClient(accountsUrl)
  return {
    password: async (email, password) => {
      const info = await (await client()).login(email, password)
      if (info?.token == null) throw new Error('Login failed.')
      return info.token
    },
    sendCode: async (email) => { await (await client()).loginOtp(email) },
    verifyCode: async (email, code) => {
      const info = await (await client()).validateOtp(email, code)
      if (info?.token == null) throw new Error('Invalid or expired code.')
      return info.token
    }
  }
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

export function loginPage (opts: { pending: string, client: string, step: 'start' | 'code', email?: string, error?: string, notice?: string }): string {
  const e = esc(opts.email ?? '')
  const form = opts.step === 'code'
    ? `<p class="hint">We sent a one-time code to <b>${e}</b>.</p>
      <label>Code<input name="code" inputmode="numeric" autocomplete="one-time-code" required autofocus></label>
      <input type="hidden" name="email" value="${e}">
      <button name="action" value="verify-code">Log in</button>
      <button class="link" name="action" value="send-code" formnovalidate>Send a new code</button>`
    : `<label>E-mail<input name="email" type="email" autocomplete="username" value="${e}" required autofocus></label>
      <label>Password<input name="password" type="password" autocomplete="current-password"></label>
      <button name="action" value="password">Log in</button>
      <div class="or"><span>Google or GitHub account?</span></div>
      <button class="secondary" name="action" value="send-code" formnovalidate>E-mail me a one-time code</button>`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Log in with Huly</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f6f4; --card:#fff; --ink:#111; --muted:#5b5a56; --line:#dddcd7; --accent:#2a78d6; --err:#c0392b }
  @media (prefers-color-scheme: dark) { :root { --bg:#111; --card:#1b1b1a; --ink:#f0efec; --muted:#b3b2aa; --line:#383835; --accent:#3987e5; --err:#ec6a5e } }
  * { box-sizing: border-box } body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--bg); color:var(--ink); font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif }
  main { width:min(380px,92vw); background:var(--card); border:1px solid var(--line); border-radius:14px; padding:28px }
  h1 { font-size:20px; margin:0 0 4px } .sub { color:var(--muted); margin:0 0 20px; font-size:14px }
  label { display:block; font-size:14px; margin:0 0 14px } input { display:block; width:100%; margin-top:6px; padding:10px 12px; font:inherit; color:inherit; background:transparent; border:1px solid var(--line); border-radius:8px }
  input:focus { outline:2px solid var(--accent); outline-offset:1px }
  button { width:100%; padding:11px; font:inherit; font-weight:600; border:0; border-radius:8px; background:var(--accent); color:#fff; cursor:pointer }
  button.secondary { background:transparent; color:var(--ink); border:1px solid var(--line); font-weight:500 } button.link { background:none; color:var(--accent); font-weight:500; margin-top:8px }
  .or { display:flex; align-items:center; gap:10px; color:var(--muted); font-size:13px; margin:18px 0 10px } .or::before,.or::after { content:""; flex:1; border-top:1px solid var(--line) }
  .err { color:var(--err); font-size:14px; margin:0 0 14px } .hint { color:var(--muted); font-size:14px; margin:0 0 14px } .foot { color:var(--muted); font-size:12px; margin:18px 0 0 }
</style></head>
<body><main>
  <h1>Log in with Huly</h1>
  <p class="sub"><b>${esc(opts.client)}</b> wants to work in your Huly workspaces as you.</p>
  ${opts.error != null ? `<p class="err" role="alert">${esc(opts.error)}</p>` : ''}${opts.notice != null ? `<p class="hint">${esc(opts.notice)}</p>` : ''}
  <form method="post" action="/oauth/login">
    <input type="hidden" name="pending" value="${esc(opts.pending)}">
    ${form}
  </form>
  <p class="foot">Your password goes only to your Huly server and is not stored. You can disconnect any time in your AI app.</p>
</main></body></html>`
}

/** Failed logins per IP — a brake on password guessing. */
class Throttle {
  private readonly hits = new Map<string, number[]>()
  constructor (private readonly max: number, private readonly windowMs: number) {}
  blocked (key: string): boolean {
    const now = Date.now()
    const list = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs)
    this.hits.set(key, list)
    return list.length >= this.max
  }

  fail (key: string): void { this.hits.set(key, [...(this.hits.get(key) ?? []), Date.now()]) }
}

export class HulyOAuthProvider implements OAuthServerProvider {
  readonly skipLocalPkceValidation = false
  private readonly revoked = new Set<string>()
  private readonly throttle = new Throttle(10, 10 * 60_000)

  constructor (private readonly sealer: Sealer, private readonly login: HulyLogin) {}

  get clientsStore (): OAuthRegisteredClientsStore {
    return {
      getClient: (clientId: string) => this.sealer.open<OAuthClientInformationFull>('client', clientId) as OAuthClientInformationFull | undefined,
      // The client id is the sealed registration itself — nothing to store.
      registerClient: (client) => {
        const issuedAt = Math.floor(Date.now() / 1000)
        const id = this.sealer.seal('client', { ...client, client_id_issued_at: issuedAt, nonce: randomUUID() })
        return { ...client, client_id: id, client_id_issued_at: issuedAt }
      }
    }
  }

  async authorize (client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const pending = this.sealer.seal('pending', {
      clientId: client.client_id, redirectUri: params.redirectUri, state: params.state, codeChallenge: params.codeChallenge,
      scopes: params.scopes ?? [], resource: params.resource?.href
    }, PENDING_TTL_S)
    sendPage(res, 200, loginPage({ pending, client: client.client_name ?? 'An AI app', step: 'start' }))
  }

  /** POST /oauth/login — the login form. */
  async handleLogin (req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, string>
    const p = this.sealer.open('pending', String(body.pending ?? ''))
    if (p == null) { sendPage(res, 400, simplePage('This login link expired', 'Start again from your AI app.')); return }
    const client = this.clientsStore.getClient(String(p.clientId)) as OAuthClientInformationFull | undefined
    const name = client?.client_name ?? 'An AI app'
    const email = String(body.email ?? '').trim()
    const ip = req.ip ?? 'unknown'
    const page = (step: 'start' | 'code', error?: string, notice?: string): void => {
      sendPage(res, error != null ? 401 : 200, loginPage({ pending: body.pending, client: name, step, email, error, notice }))
    }
    if (this.throttle.blocked(ip)) { page('start', 'Too many attempts. Wait a few minutes and try again.'); return }
    try {
      let hulyToken: string
      switch (body.action) {
        case 'send-code':
          if (email === '') { page('start', 'Enter your e-mail first.'); return }
          await this.login.sendCode(email)
          page('code'); return
        case 'verify-code':
          hulyToken = await this.login.verifyCode(email, String(body.code ?? '').trim())
          break
        default:
          if (email === '' || String(body.password ?? '') === '') { page('start', 'Enter your e-mail and password — or use a one-time code.'); return }
          hulyToken = await this.login.password(email, String(body.password))
      }
      const code = this.sealer.seal('code', { clientId: p.clientId, redirectUri: p.redirectUri, codeChallenge: p.codeChallenge, scopes: p.scopes, resource: p.resource, hulyToken, email, nonce: randomUUID() }, CODE_TTL_S)
      const target = new URL(String(p.redirectUri))
      target.searchParams.set('code', code)
      if (p.state != null) target.searchParams.set('state', String(p.state))
      res.redirect(302, target.href)
    } catch (e) {
      this.throttle.fail(ip)
      const message = (e as Error).message
      page(body.action === 'verify-code' ? 'code' : 'start', /invalid|password|credential|not found|unauthorized|forbidden/i.test(message)
        ? (body.action === 'verify-code' ? 'That code is wrong or expired.' : 'E-mail or password is wrong.')
        : `Huly did not answer: ${message}`)
    }
  }

  async challengeForAuthorizationCode (client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const c = this.sealer.open('code', authorizationCode)
    if (c == null || c.clientId !== client.client_id) throw new InvalidGrantError('Invalid or expired authorization code.')
    return String(c.codeChallenge)
  }

  async exchangeAuthorizationCode (client: OAuthClientInformationFull, authorizationCode: string, _verifier?: string, redirectUri?: string): Promise<OAuthTokens> {
    const c = this.sealer.open('code', authorizationCode)
    if (c == null || c.clientId !== client.client_id) throw new InvalidGrantError('Invalid or expired authorization code.')
    if (redirectUri != null && redirectUri !== c.redirectUri) throw new InvalidGrantError('redirect_uri does not match.')
    if (this.revoked.has(hash(authorizationCode))) throw new InvalidGrantError('Authorization code already used.')
    this.revoked.add(hash(authorizationCode))
    return this.issue(client.client_id, String(c.hulyToken), String(c.email ?? ''), c.scopes ?? [], c.resource)
  }

  async exchangeRefreshToken (client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const r = this.sealer.open('refresh', refreshToken)
    if (r == null || r.clientId !== client.client_id || this.revoked.has(hash(refreshToken))) throw new InvalidGrantError('Invalid or expired refresh token.')
    this.revoked.add(hash(refreshToken)) // rotation: each refresh token works once
    return this.issue(client.client_id, String(r.hulyToken), String(r.email ?? ''), r.scopes ?? [], r.resource)
  }

  async verifyAccessToken (token: string): Promise<AuthInfo> {
    const a = this.sealer.open('access', token)
    if (a == null || this.revoked.has(hash(token))) throw new InvalidTokenError('Invalid or expired access token.')
    return { token, clientId: String(a.clientId), scopes: a.scopes ?? [], expiresAt: a.exp, resource: a.resource != null ? new URL(String(a.resource)) : undefined, extra: { hulyToken: a.hulyToken, email: a.email } }
  }

  async revokeToken (_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    this.revoked.add(hash(request.token))
  }

  private issue (clientId: string, hulyToken: string, email: string, scopes: string[], resource?: string): OAuthTokens {
    const data = { clientId, hulyToken, email, scopes, resource }
    return {
      access_token: this.sealer.seal('access', data, ACCESS_TTL_S),
      token_type: 'bearer',
      expires_in: ACCESS_TTL_S,
      refresh_token: this.sealer.seal('refresh', { ...data, nonce: randomUUID() }, REFRESH_TTL_S),
      scope: scopes.join(' ')
    }
  }
}

const hash = (s: string): string => createHash('sha256').update(s).digest('base64url')

function sendPage (res: Response, status: number, html: string): void {
  res.status(status)
    .set('content-type', 'text/html; charset=utf-8')
    .set('cache-control', 'no-store')
    .set('x-frame-options', 'DENY')
    .set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'")
    .set('referrer-policy', 'no-referrer')
    .send(html)
}

function simplePage (title: string, text: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="font:16px -apple-system,sans-serif;padding:40px"><h1 style="font-size:20px">${esc(title)}</h1><p>${esc(text)}</p></body></html>`
}
