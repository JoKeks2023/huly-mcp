// Live smoke test against a real Huly workspace (nightly in CI, against a sandbox workspace).
// 1. Every read tool that needs nothing but the workspace is called once.
// 2. With HULY_SMOKE_PROJECT set: a write round trip (issue, comment, update, sub-issue, time, delete)
//    on throwaway data, cleaned up in finally.
// Writes a Markdown report to smoke-report.md and exits 1 if anything failed.
// Env: HULY_EMAIL/HULY_PASSWORD or HULY_TOKEN, HULY_ACCOUNTS_URL, HULY_FRONT_URL, HULY_SMOKE_WORKSPACE.
import { writeFileSync } from 'node:fs'
import { TOOLS } from '../../src/registry'
import { isMutation } from '../../src/guard'
import { normalizeEnv } from '../../src/env'

const W = process.env.HULY_SMOKE_WORKSPACE
const PROJECT = process.env.HULY_SMOKE_PROJECT
// Reads that are slow or need data a sandbox may not have are still called; "not found"-style
// answers count as a pass (the tool ran and answered), thrown errors and timeouts count as failures.
// list_time_reports needs an issue or a project (exactly one), which the schema cannot express.
const SKIP = new Set(['list_workspaces', 'list_time_reports'])

interface Result { tool: string, ok: boolean, ms: number, note: string }
const results: Result[] = []

async function run (tool: string, args: Record<string, unknown>): Promise<string> {
  const def = TOOLS.find((t) => t.name === tool)
  if (def == null) throw new Error(`unknown tool ${tool}`)
  const t0 = Date.now()
  try {
    const parsed = def.schema.parse({ workspace: W, ...args })
    const res: any = await Promise.race([def.handler(parsed as any), new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout after 60 s')), 60_000))])
    const text = String(res?.content?.[0]?.text ?? '')
    const ok = res?.isError !== true
    results.push({ tool, ok, ms: Date.now() - t0, note: ok ? '' : text.slice(0, 200) })
    if (!ok) throw new Error(text)
    return text
  } catch (e) {
    if (results.at(-1)?.tool !== tool || results.at(-1)?.ok === true) results.push({ tool, ok: false, ms: Date.now() - t0, note: (e as Error).message.slice(0, 200) })
    throw e
  }
}

async function reads (): Promise<void> {
  for (const def of TOOLS) {
    if (SKIP.has(def.name) || isMutation(def)) continue
    const required = Object.entries(def.schema.shape).filter(([k, v]: [string, any]) => k !== 'workspace' && !v.isOptional())
    if (required.length > 0) continue
    await run(def.name, {}).catch(() => {})
  }
}

async function writes (): Promise<void> {
  if (PROJECT == null || PROJECT === '') return
  const ids: string[] = []
  const idOf = (text: string): string => { const m = new RegExp(`${PROJECT}-\\d+`).exec(text); if (m == null) throw new Error(`no issue id in: ${text.slice(0, 120)}`); return m[0] }
  try {
    ids.push(idOf(await run('create_issue', { projectIdentifier: PROJECT, title: `zz-ci-smoke ${new Date().toISOString()}`, description: '**CI smoke** — deleted at the end of the run.' })))
    await run('get_issue', { identifier: ids[0] })
    await run('add_comment', { identifier: ids[0], message: 'smoke comment' })
    await run('list_comments', { identifier: ids[0] })
    await run('update_issue', { identifier: ids[0], priority: 'Low' })
    ids.push(idOf(await run('create_issue', { projectIdentifier: PROJECT, title: 'zz-ci-smoke child' })))
    await run('set_parent', { identifier: ids[1], parentIdentifier: ids[0] })
    await run('list_sub_issues', { identifier: ids[0] })
    await run('log_time', { identifier: ids[0], hours: 0.25 })
    await run('get_issue_context', { identifier: ids[0] })
    await run('list_issues', { projectIdentifier: PROJECT, status: 'all', limit: 5 })
    await run('project_report', { projectIdentifier: PROJECT })
  } catch { /* recorded in results */ } finally {
    for (const id of ids.reverse()) await run('delete_issue', { identifier: id }).catch(() => {})
  }
}

async function main (): Promise<void> {
  if (W == null || W === '') { console.log('::warning::Live smoke test skipped: the sandbox secrets (HULY_SMOKE_WORKSPACE, …) are not set — nothing was tested against a real Huly.'); process.exit(0) }
  normalizeEnv()
  await reads()
  await writes()
  const failed = results.filter((r) => !r.ok)
  const lines = [
    `## Live smoke test — ${failed.length === 0 ? '✅ all passed' : `❌ ${failed.length} failed`}`,
    '',
    `${results.length} tool calls against the sandbox workspace${PROJECT != null && PROJECT !== '' ? ` (writes in ${PROJECT})` : ' (reads only)'}.`,
    ''
  ]
  if (failed.length > 0) lines.push('| Tool | Error |', '|---|---|', ...failed.map((r) => `| \`${r.tool}\` | ${r.note.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`), '')
  const slow = results.filter((r) => r.ok && r.ms > 5000)
  if (slow.length > 0) lines.push(`Slow (> 5 s): ${slow.map((r) => `\`${r.tool}\` ${(r.ms / 1000).toFixed(1)} s`).join(', ')}`, '')
  writeFileSync('smoke-report.md', lines.join('\n') + '\n')
  console.log(lines.join('\n'))
  process.exit(failed.length > 0 ? 1 : 0)
}
void main()
