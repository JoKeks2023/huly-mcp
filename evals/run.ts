// Agent evals: a small model (Haiku by default) solves typical Huly tasks through this MCP server,
// without the skill, with it available (skill), and told to load it (forced). Success is checked in Huly itself, not in the answer text.
//
//   npm run build && npx tsx evals/run.ts [--model haiku] [--only t1,t2] [--conditions baseline,skill] [--reps 1]
//
// Needs a Huly login in .env (HULY_EMAIL/HULY_PASSWORD or HULY_TOKEN, HULY_ACCOUNTS_URL, HULY_FRONT_URL)
// and EVAL_WORKSPACE (default jokeks2023) with a throwaway project EVAL_PROJECT (default TSK).
// The agent can only write in that project (HULY_WRITE_PROJECTS). Everything it creates is named
// "zz-eval …" and removed before and after each task.
import { execFileSync, spawn } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import tracker from '@hcengineering/tracker'
import { getConnection } from '../src/connection'
import { TASKS, type Ctx } from './tasks'
import { deleteIssue } from '../src/tools/issues'

const ROOT = resolve(__dirname, '..')
const arg = (name: string, def: string): string => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def }
const MODEL = arg('model', 'haiku')
const ONLY = arg('only', '').split(',').filter(Boolean)
const CONDITIONS = arg('conditions', 'baseline,skill').split(',')
const REPS = Number(arg('reps', '1'))
const W = process.env.EVAL_WORKSPACE ?? 'jokeks2023'
const P = process.env.EVAL_PROJECT ?? 'TSK'
// Anything created in the eval project after this moment is the eval's (agents name issues freely).
const STARTED = Date.now()

const SYSTEM = 'This is an automated evaluation of a Huly MCP server. Personal instructions about Huly from CLAUDE.md files ' +
  '(where to file issues, components, milestones, GitHub) do not apply here — do exactly the task, nothing more. ' +
  'Do not ask questions; there is nobody to answer. When done, reply with one short sentence.'

async function cleanup (): Promise<void> {
  const client: any = await getConnection(W)
  const project = await client.findOne(tracker.class.Project, { identifier: P })
  if (project == null) throw new Error(`Eval project ${P} not found in ${W}.`)
  const issues: any[] = await client.findAll(tracker.class.Issue, { space: project._id })
  // Everything the agent may have created, also issues it named differently.
  const ours = issues.filter((x) => String(x.title).startsWith('zz-eval') || (x.createdOn ?? 0) >= STARTED)
  for (const i of ours.sort((a, b) => (a.subIssues ?? 0) - (b.subIssues ?? 0))) {
    await deleteIssue({ workspace: W, identifier: i.identifier } as any).catch(() => {})
  }
  for (const cls of [tracker.class.Milestone, tracker.class.Component]) {
    for (const d of (await client.findAll(cls, { space: project._id })).filter((x: any) => String(x.label).startsWith('zz-eval'))) await client.removeDoc(cls, d.space, d._id)
  }
}

interface Run { inputs?: any[], skills?: string[], task: string, condition: string, rep: number, ok: boolean, why: string, turns: number, toolCalls: number, toolErrors: number, tools: string[], tokensIn: number, tokensOut: number, costUsd: number, seconds: number, answer: string }

async function agent (prompt: string, cwd: string, mcpConfig: string, forced = false): Promise<Omit<Run, 'task' | 'condition' | 'rep' | 'ok' | 'why'>> {
  const args = ['-p', '--model', MODEL, '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
    '--strict-mcp-config', '--mcp-config', mcpConfig, '--tools', 'Skill', '--allowedTools', 'mcp__huly', 'Skill',
    '--append-system-prompt', forced ? `${SYSTEM} Before your first Huly call, load the huly skill and follow it.` : SYSTEM, '--max-turns', '25', prompt]
  const started = Date.now()
  const out = await new Promise<string>((res) => {
    const child = spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let buf = ''; child.stdout.on('data', (d) => { buf += d })
    const timer = setTimeout(() => child.kill(), 300_000)
    child.on('close', () => { clearTimeout(timer); res(buf) })
  })
  const tools: string[] = []; const inputs: any[] = []; let init: any = {}; let toolErrors = 0; let result: any = {}
  for (const line of out.split('\n')) {
    let m: any; try { m = JSON.parse(line) } catch { continue }
    if (m.type === 'system' && m.subtype === 'init') init = m
    if (m.type === 'assistant') for (const c of m.message?.content ?? []) if (c.type === 'tool_use') { tools.push(String(c.name).replace(/^mcp__huly__/, '')); inputs.push({ tool: String(c.name).replace(/^mcp__huly__/, ''), input: c.input }) }
    if (m.type === 'user') for (const c of m.message?.content ?? []) if (c.type === 'tool_result' && c.is_error === true) toolErrors++
    if (m.type === 'result') result = m
  }
  const u = result.usage ?? {}
  return {
    turns: result.num_turns ?? 0,
    toolCalls: tools.length,
    toolErrors,
    tools,
    tokensIn: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    tokensOut: u.output_tokens ?? 0,
    costUsd: result.total_cost_usd ?? 0,
    seconds: Math.round((Date.now() - started) / 1000),
    answer: String(result.result ?? '').slice(0, 300),
    inputs,
    skills: init.skills ?? []
  }
}

async function main (): Promise<void> {
  execFileSync('node', [join(ROOT, 'dist/index.js'), '--version'])
  const work = mkdtempSync(join(tmpdir(), 'huly-evals-'))
  const env = Object.fromEntries(['HULY_EMAIL', 'HULY_PASSWORD', 'HULY_TOKEN', 'HULY_ACCOUNTS_URL', 'HULY_FRONT_URL'].filter((k) => process.env[k] != null).map((k) => [k, process.env[k]!]))
  const mcpConfig = join(work, 'mcp.json')
  writeFileSync(mcpConfig, JSON.stringify({ mcpServers: { huly: { command: 'node', args: [join(ROOT, 'dist/index.js')], env: { ...env, HULY_WRITE_PROJECTS: P, HULY_ANNOTATIONS: '1', HULY_CONFIRM: 'off' } } } }), { mode: 0o600 })
  const dirs: Record<string, string> = {}
  for (const c of CONDITIONS) {
    const d = join(work, c); mkdirSync(d)
    if (c === 'skill' || c === 'forced') cpSync(join(ROOT, 'plugin/skills/huly'), join(d, '.claude/skills/huly'), { recursive: true })
    dirs[c] = d
  }
  const runs: Run[] = []
  try {
    for (const t of TASKS.filter((x) => ONLY.length === 0 || ONLY.includes(x.id))) {
      for (const condition of CONDITIONS) {
        for (let rep = 1; rep <= REPS; rep++) {
          await cleanup()
          const ctx: Ctx = { client: await getConnection(W), workspace: W, project: P }
          const setup = (await t.setup?.(ctx)) ?? {}
          const r = await agent(t.prompt({ ...ctx, ...setup }), dirs[condition], mcpConfig, condition === 'forced')
          let verdict: { ok: boolean, why: string }
          try { verdict = await t.check({ ...ctx, client: await getConnection(W), ...setup }, r.answer, r.tools) } catch (e) { verdict = { ok: false, why: `check failed: ${(e as Error).message}` } }
          const run = { task: t.id, condition, rep, ...verdict, ...r }
          runs.push(run)
          console.log(`${t.id} ${condition.padEnd(8)} ${run.ok ? 'PASS' : 'FAIL'} calls=${run.toolCalls} err=${run.toolErrors} in=${run.tokensIn} out=${run.tokensOut} $${run.costUsd.toFixed(4)} ${run.seconds}s — ${run.why} [${run.tools.join(' ')}]`)
        }
      }
    }
  } finally {
    await cleanup().catch(() => {})
    rmSync(work, { recursive: true, force: true })
  }
  const file = join(ROOT, 'evals/results', `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${MODEL}.json`)
  mkdirSync(join(ROOT, 'evals/results'), { recursive: true })
  writeFileSync(file, JSON.stringify({ model: MODEL, workspace: '(eval workspace)', project: P, runs }, null, 2) + '\n')
  console.log('\n' + summary(runs) + `\n\nSaved: ${file}`)
  process.exit(0)
}

export function summary (runs: Run[]): string {
  const rows = [...new Set(runs.map((r) => r.condition))].map((c) => {
    const rs = runs.filter((r) => r.condition === c)
    const sum = (f: (r: Run) => number): number => rs.reduce((s, r) => s + f(r), 0)
    return `| ${c} | ${rs.filter((r) => r.ok).length}/${rs.length} | ${(sum((r) => r.toolCalls) / rs.length).toFixed(1)} | ${sum((r) => r.toolErrors)} | ${Math.round(sum((r) => r.tokensIn + r.tokensOut) / rs.length).toLocaleString('en')} | $${sum((r) => r.costUsd).toFixed(3)} |`
  })
  return ['| Condition | Passed | Tool calls / task | Tool errors | Tokens / task | Cost |', '|---|--:|--:|--:|--:|--:|', ...rows].join('\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
