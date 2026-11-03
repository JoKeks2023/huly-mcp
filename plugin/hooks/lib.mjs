// Shared helpers for the Huly plugin hooks. No dependencies, no network: hooks must stay fast.
import { execFileSync } from 'node:child_process'

const NOT_KEYS = new Set(['FEAT', 'FEATURE', 'FIX', 'BUGFIX', 'HOTFIX', 'CHORE', 'RELEASE', 'V', 'DOCS', 'TEST', 'REFACTOR', 'DEPENDABOT', 'RENOVATE'])

/** "PROJ-12" from branch names like "proj-12-login", "feat/PROJ-12_x", "jo/proj-12"; undefined otherwise. */
export function issueFromBranch (branch) {
  if (typeof branch !== 'string') return undefined
  for (const m of branch.matchAll(/(?:^|[/_-])([A-Za-z][A-Za-z0-9]{0,9})-(\d+)(?=$|[-_/])/g)) {
    const key = m[1].toUpperCase()
    if (!NOT_KEYS.has(key)) return `${key}-${m[2]}`
  }
  return undefined
}

/** "owner/name" of a GitHub remote, or undefined. */
export function githubSlug (remote) {
  const m = /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/i.exec(String(remote ?? '').trim())
  return m?.[1]
}

export function git (cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim()
  } catch {
    return undefined
  }
}

export async function readStdin () {
  let data = ''
  for await (const chunk of process.stdin) data += chunk
  try { return JSON.parse(data) } catch { return {} }
}

export function emit (event, context) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } }))
}
