// check_setup: one call that says whether this server is configured right and up to date.
// Never prints secrets — only which settings are present and which hosts are used.
import { readFileSync } from 'fs'
import { join } from 'path'
import type { z } from 'zod'
import { listWorkspaces, getWorkspace, tokenClaims } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { CheckSetupSchema } from '../schemas'

const TIMEOUT_MS = 5_000

export function packageVersion (): string {
  try { return JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')).version } catch { return 'unknown' }
}

/** Host of a URL, never its path, query or credentials. */
export function hostOf (url: string | undefined): string | undefined {
  if (url == null || url.trim() === '') return undefined
  try { const u = new URL(url); return `${u.protocol}//${u.host}` } catch { return '(not a URL)' }
}

/** 3.10.2 > 3.9.0; non-numeric parts compare as 0. */
export function isNewer (latest: string, current: string): boolean {
  const a = latest.split('.').map((n) => parseInt(n, 10) || 0)
  const b = current.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}

async function latestVersion (): Promise<string | undefined> {
  try {
    const res = await fetch('https://registry.npmjs.org/huly-mcp-selfhost/latest', { signal: AbortSignal.timeout(TIMEOUT_MS) })
    return res.ok ? (await res.json() as { version?: string }).version : undefined
  } catch { return undefined }
}

async function reachable (url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
    return res.status < 500 ? 'ok' : `HTTP ${res.status}`
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } }
    return err.name === 'TimeoutError' ? `no answer within ${TIMEOUT_MS / 1000}s` : (err.cause?.code ?? err.message)
  }
}

export async function checkSetupReport (args: z.infer<typeof CheckSetupSchema>, env: NodeJS.ProcessEnv): Promise<string> {
  const set = (k: string): boolean => (env[k] ?? '').trim() !== ''
  const lines: string[] = []
  const ok = (t: string): void => { lines.push(`✅ ${t}`) }
  const warn = (t: string): void => { lines.push(`⚠️ ${t}`) }
  const fail = (t: string): void => { lines.push(`❌ ${t}`) }

  const version = packageVersion()
  const [latest, frontStatus] = await Promise.all([
    args.skipVersionCheck === true ? Promise.resolve(undefined) : latestVersion(),
    set('HULY_FRONT_URL') ? reachable(env.HULY_FRONT_URL as string) : Promise.resolve(undefined)
  ])
  if (latest != null && isNewer(latest, version)) warn(`Version ${version} — ${latest} is available (npx -y huly-mcp-selfhost@latest, or update the plugin / Docker image)`)
  else ok(`Version ${version}${latest != null ? ' (latest)' : ''}, Node.js ${process.versions.node}`)

  const claims = set('HULY_TOKEN') ? tokenClaims(env.HULY_TOKEN) : undefined
  const auth = set('HULY_TOKEN') ? (claims?.apiTokenId != null ? 'API token' : 'token') : (set('HULY_EMAIL') && set('HULY_PASSWORD')) ? 'e-mail + password' : undefined
  if (auth == null) fail('No credentials: set HULY_TOKEN, or HULY_EMAIL and HULY_PASSWORD (Google/GitHub login: npx huly-mcp-selfhost setup)')
  const accounts = hostOf(env.HULY_ACCOUNTS_URL) ?? 'https://account.huly.app (Huly Cloud)'
  lines.push(`ℹ️ Login: ${auth ?? '—'} · accounts ${accounts}${set('HULY_TRANSACTOR_URL') ? ` · transactor ${hostOf(env.HULY_TRANSACTOR_URL) ?? ''}` : ''}`)

  if (claims?.exp != null) {
    const days = Math.floor((claims.exp * 1000 - Date.now()) / 86_400_000)
    const date = new Date(claims.exp * 1000).toISOString().slice(0, 10)
    if (days < 0) fail(`Token expired on ${date}`)
    else if (days < 14) warn(`Token expires on ${date} (in ${days} day(s)) — create a new one in time`)
    else ok(`Token valid until ${date}`)
  }

  if (auth != null) {
    try {
      const workspaces = await listWorkspaces()
      if (workspaces.length === 0) fail('Logged in, but the account has no workspace')
      else ok(`Logged in · ${workspaces.length} workspace(s): ${workspaces.slice(0, 8).map((w) => w.url).join(', ')}${workspaces.length > 8 ? ', …' : ''}`)
      const target = args.workspace ?? (workspaces.length === 1 ? workspaces[0].url : undefined)
      if (target != null) {
        const t0 = Date.now()
        await getWorkspace(target)
        ok(`Workspace ${target} connected (${Date.now() - t0} ms)`)
      }
    } catch (e) {
      fail(`Login or connection failed: ${(e as Error).message}`)
    }
  }

  if (frontStatus == null) {
    if (set('HULY_ACCOUNTS_URL')) warn('HULY_FRONT_URL is not set — self-hosted: descriptions, documents and files need it')
  } else if (frontStatus === 'ok') ok(`Front service ${hostOf(env.HULY_FRONT_URL) ?? ''} reachable (descriptions, documents, files)`)
  else fail(`Front service ${hostOf(env.HULY_FRONT_URL) ?? ''} not reachable: ${frontStatus}`)

  const opts = [
    set('HULY_WORKSPACE') ? `pinned workspace ${env.HULY_WORKSPACE as string}` : 'all workspaces',
    `toolsets ${set('HULY_TOOLSETS') ? env.HULY_TOOLSETS as string : 'default'}`,
    set('HULY_DYNAMIC_TOOLSETS') ? 'load on demand' : null,
    set('HULY_WRITE_PROJECTS') ? `writes only in ${env.HULY_WRITE_PROJECTS as string}` : null,
    set('HULY_AUDIT_LOG') ? 'audit log on' : null,
    set('HULY_ANNOTATIONS') ? 'annotations on' : null
  ].filter(Boolean)
  lines.push(`ℹ️ Settings: ${opts.join(' · ')}`)
  return `## Setup check\n\n${lines.join('\n')}`
}

export const checkSetup = wrapToolHandler<z.infer<typeof CheckSetupSchema>>(async (args) => await checkSetupReport(args, process.env))
