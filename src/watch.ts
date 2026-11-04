// `huly-mcp watch`: Huly hands work to an agent.
// Polls for open issues that carry a trigger label or are assigned to the connected account,
// claims each one (claim_issue), runs a command for it — by default `claude -p` — and releases
// the claim afterwards. A state file remembers which issues already ran.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { getWorkspace, closeConnection } from './connection'
import { normalizeEnv } from './env'
import { parseWriteProjects } from './guard'
import { currentPerson } from './utils/people'
import { claimIssue, releaseIssue, CLAIM_LABEL } from './tools/agent'
import { addComment } from './tools/comments'

export const DEFAULT_COMMAND = 'claude -p {prompt} --mcp-config {mcpConfig} --strict-mcp-config --allowedTools mcp__huly --permission-mode acceptEdits'

export const DEFAULT_PROMPT = [
  'Huly issue {issue} ("{title}") in workspace {workspace} was handed to you ({trigger}).',
  'You are the Huly agent "{agent}" and already hold the claim on it.',
  '1. Read everything with get_issue_context {issue}.',
  '2. Do the work in the current directory.',
  '3. Hand back with finish_work: a short summary of what you did and what is left.',
  'If you cannot finish, add a comment that says what is missing, then stop. Never delete anything.'
].join('\n')

export interface WatchOptions {
  workspace?: string
  projects: string[]
  label?: string
  assigned: boolean
  command: string
  prompt: string
  cwd: string
  intervalSec: number
  once: boolean
  dryRun: boolean
  statePath?: string
  timeoutMin: number
  agent: string
  envFile?: string
  /** Script that starts this MCP server (for {mcpConfig}); defaults to the running script. */
  serverEntry?: string
}

export const WATCH_HELP = `Usage: huly-mcp watch [options]

Hands Huly issues to an agent: open issues with --label, or assigned to this account
(--assigned, the default), are claimed, passed to --command and released afterwards.

  --workspace <ws>      Workspace slug/name (required with more than one)
  --project <KEY>       Only these projects (repeat or comma-separate); default: all,
                        limited to HULY_WRITE_PROJECTS when set
  --label <name>        Trigger label (e.g. "claude")
  --assigned            Trigger: assigned to this account (default if no --label)
  --command <cmd>       Command per issue; placeholders {prompt} {issue} {title}
                        {workspace} {agent} {trigger} {mcpConfig}
                        default: ${DEFAULT_COMMAND}
  --prompt <text>       Prompt template (same placeholders, except {prompt})
  --cwd <dir>           Working directory for the command (default: current)
  --interval <sec>      Poll interval (default 60)
  --timeout <min>       Stop a run after this many minutes (default 60)
  --once                One pass, then exit
  --dry-run             Only list what would run
  --state <file>        State file (default ~/.huly-mcp/watch-<workspace>.json)
  --agent <name>        Agent name for claims (default HULY_AGENT_NAME or claude-watch)
  --env-file <file>     Load HULY_* credentials from this file (the agent's own account)
`

/** Splits a command line into words; supports "double" and 'single' quotes. No shell involved. */
export function splitCommand (line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  let started = false
  for (const ch of line) {
    if (quote != null) {
      if (ch === quote) quote = null
      else cur += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      started = true
    } else if (/\s/.test(ch)) {
      if (started || cur !== '') out.push(cur)
      cur = ''
      started = false
    } else {
      cur += ch
    }
  }
  if (quote != null) throw new Error(`Unclosed ${quote} in --command.`)
  if (started || cur !== '') out.push(cur)
  return out
}

/** Replaces {name} placeholders. Unknown placeholders stay as they are. */
export function fill (template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
}

/** KEY=value lines (comments, export prefix and quotes allowed). */
export function parseEnvFile (content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (m == null) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    else v = v.replace(/\s+#.*$/, '')
    out[m[1]] = v
  }
  return out
}

export function parseWatchArgs (argv: string[], env: NodeJS.ProcessEnv = process.env): WatchOptions {
  const opts: WatchOptions = {
    projects: [],
    assigned: false,
    command: DEFAULT_COMMAND,
    prompt: DEFAULT_PROMPT,
    cwd: process.cwd(),
    intervalSec: 60,
    once: false,
    dryRun: false,
    timeoutMin: 60,
    agent: env.HULY_AGENT_NAME ?? 'claude-watch'
  }
  const value = (i: number, flag: string): string => {
    const v = argv[i + 1]
    if (v == null || v.startsWith('--')) throw new Error(`${flag} needs a value.`)
    return v
  }
  const number = (v: string, flag: string, min: number): number => {
    const n = Number(v)
    if (!Number.isFinite(n) || n < min) throw new Error(`${flag} must be a number ≥ ${min}.`)
    return n
  }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    switch (flag) {
      case '--workspace': opts.workspace = value(i, flag); i++; break
      case '--project': opts.projects.push(...value(i, flag).split(',').map((p) => p.trim().toUpperCase()).filter((p) => p !== '')); i++; break
      case '--label': opts.label = value(i, flag); i++; break
      case '--assigned': opts.assigned = true; break
      case '--command': opts.command = value(i, flag); i++; break
      case '--prompt': opts.prompt = value(i, flag); i++; break
      case '--cwd': opts.cwd = resolve(value(i, flag)); i++; break
      case '--interval': opts.intervalSec = number(value(i, flag), flag, 5); i++; break
      case '--timeout': opts.timeoutMin = number(value(i, flag), flag, 1); i++; break
      case '--once': opts.once = true; break
      case '--dry-run': opts.dryRun = true; break
      case '--state': opts.statePath = resolve(value(i, flag)); i++; break
      case '--agent': opts.agent = value(i, flag).replace(/\s+/g, '-'); i++; break
      case '--env-file': opts.envFile = resolve(value(i, flag)); i++; break
      default: throw new Error(`Unknown option '${flag}'. See huly-mcp watch --help.`)
    }
  }
  if (opts.label == null) opts.assigned = true
  if (splitCommand(opts.command).length === 0) throw new Error('--command is empty.')
  return opts
}

// ── State ─────────────────────────────────────────────────────────────────────

export interface RunRecord { identifier: string, trigger: string, ranAt: number, result: string }
export type WatchState = Record<string, RunRecord>

export function loadState (path: string): WatchState {
  if (!existsSync(path)) return {}
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { throw new Error(`State file ${path} is not valid JSON — fix or delete it.`) }
}

export function saveState (path: string, state: WatchState): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(state, null, 2) + '\n')
}

// ── Finding work ──────────────────────────────────────────────────────────────

export interface Candidate { issue: any, trigger: 'label' | 'assigned', since: number }

/**
 * Open issues that match a trigger and have not run yet. An issue runs again only when its
 * trigger label was added again after the last run (remove + add the label to retry).
 */
export async function findCandidates (client: any, opts: Pick<WatchOptions, 'projects' | 'label' | 'assigned'>, state: WatchState): Promise<Candidate[]> {
  const projects: any[] = await client.findAll(tracker.class.Project, opts.projects.length > 0 ? { identifier: { $in: opts.projects } } : {})
  const missing = opts.projects.filter((p) => !projects.some((x) => x.identifier === p))
  if (missing.length > 0) throw new Error(`Project(s) not found: ${missing.join(', ')}.`)
  const spaces = new Set(projects.map((p) => p._id))
  const statuses: any[] = await client.findAll(tracker.class.IssueStatus, {})
  const closed = new Set(statuses.filter((s) => s.category === task.statusCategory.Won || s.category === task.statusCategory.Lost).map((s) => s._id))
  const open = (i: any): boolean => spaces.has(i.space) && !closed.has(i.status)

  const found = new Map<string, Candidate>()
  if (opts.label != null) {
    const want = opts.label.toLowerCase()
    const refs: any[] = (await client.findAll('tags:class:TagReference', { attachedToClass: tracker.class.Issue }))
      .filter((r: any) => String(r.title ?? '').toLowerCase() === want)
    if (refs.length > 0) {
      const issues: any[] = await client.findAll(tracker.class.Issue, { _id: { $in: refs.map((r) => r.attachedTo) } })
      for (const issue of issues.filter(open)) {
        const ref = refs.find((r) => r.attachedTo === issue._id)
        found.set(issue._id, { issue, trigger: 'label', since: ref?.createdOn ?? ref?.modifiedOn ?? 0 })
      }
    }
  }
  if (opts.assigned) {
    const me = await currentPerson(client)
    const issues: any[] = await client.findAll(tracker.class.Issue, { assignee: me._id })
    for (const issue of issues.filter(open)) if (!found.has(issue._id)) found.set(issue._id, { issue, trigger: 'assigned', since: 0 })
  }
  return [...found.values()]
    .filter((c) => { const prev = state[c.issue._id]; return prev == null || (c.trigger === 'label' && c.since > prev.ranAt) })
    .sort((a, b) => (a.issue.createdOn ?? 0) - (b.issue.createdOn ?? 0))
}

// ── Running ───────────────────────────────────────────────────────────────────

export interface RunDeps {
  client: any
  workspace: string
  /** Runs argv in cwd with env; resolves with the exit code (null when killed). */
  exec: (argv: string[], cwd: string, env: NodeJS.ProcessEnv, timeoutMs: number) => Promise<number | null>
  log: (line: string) => void
  env: NodeJS.ProcessEnv
  now?: () => number
}

/** MCP config for the child Claude: this server, same credentials (inherited env), one workspace. */
export function writeMcpConfig (dir: string, entry: string, env: Record<string, string>): string {
  const path = join(dir, 'mcp.json')
  writeFileSync(path, JSON.stringify({ mcpServers: { huly: { command: process.execPath, args: [entry], env } } }, null, 2), { mode: 0o600 })
  return path
}

export async function processIssue (c: Candidate, opts: WatchOptions, deps: RunDeps): Promise<RunRecord | undefined> {
  const { issue } = c
  const id: string = issue.identifier
  const ws = deps.workspace
  try {
    await claimIssue({ workspace: ws, identifier: id, agent: opts.agent, minutes: opts.timeoutMin + 5, force: false } as any)
  } catch (e) {
    deps.log(`skip ${id}: ${(e as Error).message.replace(/^Huly MCP: /, '')}`)
    return undefined
  }

  const childEnv: NodeJS.ProcessEnv = {
    ...deps.env,
    HULY_WORKSPACE: ws,
    HULY_AGENT_NAME: opts.agent,
    HULY_CONFIRM: deps.env.HULY_CONFIRM ?? 'strict',
    HULY_ISSUE: id,
    HULY_ISSUE_TITLE: String(issue.title ?? '')
  }
  const vars: Record<string, string> = { issue: id, title: String(issue.title ?? ''), workspace: ws, agent: opts.agent, trigger: c.trigger === 'label' ? `label "${opts.label ?? ''}"` : 'assigned to you' }
  vars.prompt = fill(opts.prompt, vars)

  let tmp: string | undefined
  let code: number | null
  try {
    if (opts.command.includes('{mcpConfig}')) {
      tmp = mkdtempSync(join(tmpdir(), 'huly-watch-'))
      const pass: Record<string, string> = {}
      for (const k of ['HULY_WORKSPACE', 'HULY_AGENT_NAME', 'HULY_CONFIRM', 'HULY_TOOLSETS', 'HULY_WRITE_PROJECTS', 'HULY_AUDIT_LOG']) if (childEnv[k] != null) pass[k] = childEnv[k]!
      vars.mcpConfig = writeMcpConfig(tmp, opts.serverEntry ?? process.argv[1], pass)
    }
    const argv = splitCommand(opts.command).map((w) => fill(w, vars))
    deps.log(`run ${id} (${c.trigger}): ${argv[0]} …`)
    code = await deps.exec(argv, opts.cwd, childEnv, opts.timeoutMin * 60_000)
  } catch (e) {
    deps.log(`run ${id} failed to start: ${(e as Error).message}`)
    code = -1
  } finally {
    if (tmp != null) rmSync(tmp, { recursive: true, force: true })
  }

  const result = code === 0 ? 'ok' : code == null ? `timeout after ${opts.timeoutMin} min` : `exit ${code}`
  if (code !== 0) {
    await addComment({ workspace: ws, identifier: id, message: `🤖 Agent run by **${opts.agent}** ended: ${result}. The issue is free again.` } as any)
  }
  // finish_work releases the claim; release it here when the run did not.
  const labels: any[] = await deps.client.findAll('tags:class:TagReference', { attachedTo: issue._id })
  if (labels.some((l) => l.title === CLAIM_LABEL)) await releaseIssue({ workspace: ws, identifier: id, agent: opts.agent } as any)
  deps.log(`done ${id}: ${result}`)
  return { identifier: id, trigger: c.trigger, ranAt: (deps.now ?? Date.now)(), result }
}

/** One poll: find candidates and run them one after another. */
export async function watchOnce (opts: WatchOptions, deps: RunDeps, state: WatchState, save: (s: WatchState) => void): Promise<number> {
  const candidates = await findCandidates(deps.client, opts, state)
  if (opts.dryRun) {
    for (const c of candidates) deps.log(`would run ${c.issue.identifier as string} (${c.trigger}): ${c.issue.title as string}`)
    if (candidates.length === 0) deps.log('nothing to do')
    return candidates.length
  }
  for (const c of candidates) {
    const record = await processIssue(c, opts, deps)
    if (record != null) { state[c.issue._id] = record; save(state) }
  }
  return candidates.length
}

function execChild (argv: string[], cwd: string, env: NodeJS.ProcessEnv, timeoutMs: number): Promise<number | null> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(argv[0], argv.slice(1), { cwd, env, stdio: ['ignore', 'inherit', 'inherit'] })
    let killed = false
    const timer = setTimeout(() => { killed = true; child.kill('SIGTERM') }, timeoutMs)
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.on('exit', (code) => { clearTimeout(timer); resolvePromise(killed ? null : code) })
  })
}

export async function runWatch (argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) { process.stdout.write(WATCH_HELP); return }
  const opts = parseWatchArgs(argv)
  if (opts.envFile != null) {
    const vars = parseEnvFile(readFileSync(opts.envFile, 'utf8'))
    for (const [k, v] of Object.entries(vars)) process.env[k] = v
  }
  normalizeEnv()
  const allowed = parseWriteProjects(process.env.HULY_WRITE_PROJECTS)
  if (allowed != null) {
    const outside = opts.projects.filter((p) => !allowed.has(p))
    if (outside.length > 0) throw new Error(`--project ${outside.join(', ')} is outside HULY_WRITE_PROJECTS (${[...allowed].join(', ')}).`)
    if (opts.projects.length === 0) opts.projects = [...allowed]
  }

  const conn = await getWorkspace(opts.workspace)
  const ws = conn.workspace.url
  const me = await currentPerson(conn.client)
  const statePath = opts.statePath ?? join(homedir(), '.huly-mcp', `watch-${ws}.json`)
  const state = loadState(statePath)
  const log = (line: string): void => { process.stderr.write(`[${new Date().toISOString()}] ${line}\n`) }
  const triggers = [opts.label != null ? `label "${opts.label}"` : undefined, opts.assigned ? `assigned to ${me.name}` : undefined].filter((t) => t != null).join(' or ')
  log(`watching ${ws}${opts.projects.length > 0 ? ` (${opts.projects.join(', ')})` : ''} as ${me.name}, agent "${opts.agent}": ${triggers}${opts.dryRun ? ' — dry run' : ''}`)

  let stop = false
  const onSignal = (): void => { stop = true; log('stopping after the current run…') }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  const deps: RunDeps = { client: conn.client, workspace: ws, exec: execChild, log, env: process.env }
  try {
    while (!stop) {
      try { await watchOnce(opts, deps, state, (s) => saveState(statePath, s)) } catch (e) { log(`poll failed: ${(e as Error).message}`); if (opts.once || opts.dryRun) process.exitCode = 1 }
      if (opts.once || opts.dryRun) break
      for (let waited = 0; waited < opts.intervalSec * 1000 && !stop; waited += 500) await new Promise((r) => setTimeout(r, 500))
    }
  } finally {
    await closeConnection()
  }
}
