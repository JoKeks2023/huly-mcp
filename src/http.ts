// `huly-mcp-selfhost http`: the MCP server over Streamable HTTP, for teams and remote clients.
//
// One MCP session per client. A session either brings its own Huly login in headers
// (X-Huly-Token, or X-Huly-Email + X-Huly-Password; optional X-Huly-Workspace) or uses the
// server's own credentials (HULY_* env) — the latter only behind MCP_AUTH_TOKEN, so an open
// port never acts as the server's account. Each session keeps its connections; idle sessions close.
import http from 'node:http'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { createServer } from './server'
import { createConnectionManager, getConnectionManager, withConnectionManager, prewarm, type WorkspaceConnectionManager } from './connection'

export interface HttpOptions {
  port: number
  host: string
  env: NodeJS.ProcessEnv
  /** Tests: build the manager for a set of credentials. */
  createManager?: (creds: Credentials) => WorkspaceConnectionManager
  idleMs?: number
  log?: (line: string) => void
}

export interface Credentials { email?: string, password?: string, token?: string, workspace?: string }

interface Session {
  transport: StreamableHTTPServerTransport
  manager: WorkspaceConnectionManager
  own: boolean
  lastSeen: number
}

const MAX_BODY = 4 * 1024 * 1024

const header = (req: http.IncomingMessage, name: string): string | undefined => {
  const v = req.headers[name]
  const s = Array.isArray(v) ? v[0] : v
  return s != null && s.trim() !== '' ? s.trim() : undefined
}

/** Credentials sent by the client, if any. */
export function headerCredentials (req: http.IncomingMessage): Credentials | undefined {
  const token = header(req, 'x-huly-token')
  const email = header(req, 'x-huly-email')
  const password = header(req, 'x-huly-password')
  const workspace = header(req, 'x-huly-workspace')
  if (token != null) return { token, workspace }
  if (email != null || password != null) {
    if (email == null || password == null) throw new HttpError(400, 'Send both X-Huly-Email and X-Huly-Password (or X-Huly-Token).')
    return { email, password, workspace }
  }
  return undefined
}

class HttpError extends Error {
  constructor (readonly status: number, message: string) { super(message) }
}

function bearerOk (req: http.IncomingMessage, expected: string): boolean {
  const got = /^Bearer\s+(.+)$/i.exec(header(req, 'authorization') ?? '')?.[1] ?? ''
  const a = Buffer.from(got); const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function readJson (req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new HttpError(413, 'Request body too large.')
    chunks.push(chunk as Buffer)
  }
  if (size === 0) return undefined
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new HttpError(400, 'Body is not valid JSON.') }
}

function sendError (res: http.ServerResponse, status: number, message: string): void {
  if (res.headersSent) return
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }))
}

export function allowedHosts (value: string | undefined, port: number): string[] | undefined {
  const hosts = (value ?? '').split(',').map((h) => h.trim()).filter((h) => h !== '')
  if (hosts.length === 0) return undefined
  const all = [...hosts, 'localhost', '127.0.0.1']
  return [...new Set(all.flatMap((h) => h.includes(':') ? [h] : [h, `${h}:${port}`]))]
}

export function startHttpServer (opts: HttpOptions): http.Server {
  const env = opts.env
  const log = opts.log ?? ((line: string) => { console.error(`huly-mcp http: ${line}`) })
  const authToken = (env.MCP_AUTH_TOKEN ?? '').trim()
  const serverCreds = (env.HULY_TOKEN ?? '') !== '' || ((env.HULY_EMAIL ?? '') !== '' && (env.HULY_PASSWORD ?? '') !== '')
  const sharedAllowed = serverCreds && authToken !== ''
  const make = opts.createManager ?? ((c: Credentials) => createConnectionManager(c, env))
  const hosts = allowedHosts(env.MCP_ALLOWED_HOSTS, opts.port)
  const sessions = new Map<string, Session>()

  if (serverCreds && authToken === '') log('the server has its own Huly credentials but MCP_AUTH_TOKEN is not set — they are not used; clients must send their own (X-Huly-Token or X-Huly-Email/X-Huly-Password).')

  const closeSession = async (id: string): Promise<void> => {
    const s = sessions.get(id)
    if (s == null) return
    sessions.delete(id)
    await s.transport.close().catch(() => {})
    if (s.own) await s.manager.closeAll().catch(() => {})
  }

  const idleMs = opts.idleMs ?? 30 * 60_000
  const sweeper = setInterval(() => {
    const cutoff = Date.now() - idleMs
    for (const [id, s] of sessions) if (s.lastSeen < cutoff) void closeSession(id)
  }, Math.min(idleMs, 60_000))
  sweeper.unref()

  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://local')
      if (url.pathname === '/healthz') { res.writeHead(204).end(); return }
      if (url.pathname !== '/mcp') { sendError(res, 404, 'Not found. The MCP endpoint is /mcp.'); return }
      if (authToken !== '' && !bearerOk(req, authToken)) {
        res.setHeader('www-authenticate', 'Bearer')
        sendError(res, 401, 'Missing or wrong bearer token (MCP_AUTH_TOKEN).'); return
      }

      const sessionId = header(req, 'mcp-session-id')
      const body = req.method === 'POST' ? await readJson(req) : undefined
      const existing = sessionId != null ? sessions.get(sessionId) : undefined
      if (existing != null) {
        existing.lastSeen = Date.now()
        await withConnectionManager(existing.manager, async () => { await existing.transport.handleRequest(req, res, body) })
        return
      }
      if (sessionId != null) { sendError(res, 404, 'Unknown or expired session — start a new one.'); return }
      if (req.method !== 'POST' || !isInitializeRequest(body)) { sendError(res, 400, 'No session: send an initialize request first.'); return }

      const creds = headerCredentials(req)
      if (creds == null && !sharedAllowed) {
        sendError(res, 401, serverCreds
          ? 'Send your Huly login: X-Huly-Token, or X-Huly-Email and X-Huly-Password. (The server credentials need MCP_AUTH_TOKEN.)'
          : 'Send your Huly login: X-Huly-Token, or X-Huly-Email and X-Huly-Password.')
        return
      }
      const own = creds != null
      const manager = own ? make(creds) : getConnectionManager()
      const pinned = creds?.workspace ?? (own ? undefined : env.HULY_WORKSPACE)
      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        allowedHosts: hosts,
        enableDnsRebindingProtection: hosts != null,
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, manager, own, lastSeen: Date.now() })
          if (own) void withConnectionManager(manager, async () => await prewarm({ ...creds, HULY_EMAIL: creds.email, HULY_PASSWORD: creds.password, HULY_TOKEN: creds.token }))
        }
      })
      transport.onclose = () => { if (transport.sessionId != null) void closeSession(transport.sessionId) }
      const mcp = withConnectionManager(manager, () => createServer({ workspace: pinned }))
      await mcp.connect(transport)
      await withConnectionManager(manager, async () => { await transport.handleRequest(req, res, body) })
    })().catch((e: unknown) => {
      if (e instanceof HttpError) sendError(res, e.status, e.message)
      else { log(`request failed: ${(e as Error).message}`); sendError(res, 500, 'Internal error.') }
    })
  })

  server.on('close', () => {
    clearInterval(sweeper)
    for (const id of [...sessions.keys()]) void closeSession(id)
  })
  return server
}

export async function runHttp (argv: string[]): Promise<void> {
  const arg = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`)
    if (i >= 0) return argv[i + 1]
    return argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  }
  if (argv.includes('--help')) {
    console.log(`huly-mcp-selfhost http [--port 8000] [--host 127.0.0.1]

MCP over Streamable HTTP at /mcp (health check: /healthz).
  MCP_AUTH_TOKEN     bearer token clients must send (needed to use the server's own HULY_* login)
  MCP_ALLOWED_HOSTS  host names clients use (DNS-rebinding protection), e.g. huly-mcp.example.com
Clients can send their own Huly login: X-Huly-Token, or X-Huly-Email + X-Huly-Password; X-Huly-Workspace pins one.`)
    return
  }
  const port = Number(arg('port') ?? process.env.MCP_PORT ?? 8000)
  const host = arg('host') ?? process.env.MCP_HOST ?? '127.0.0.1'
  const server = startHttpServer({ port, host, env: process.env })
  await new Promise<void>((resolve) => server.listen(port, host, resolve))
  console.error(`huly-mcp http: listening on http://${host}:${port}/mcp`)
  const stop = (): void => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref() }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}
