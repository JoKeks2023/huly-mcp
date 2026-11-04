// Lists Huly modules (class id prefixes in the server's data model) that no tool touches yet.
// Known non-goals are listed in .github/huly-modules-ignore.txt. Writes modules-report.md;
// exits 0 always (the workflow decides whether to open an issue: modules-new.txt is non-empty).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getConnection } from '../../src/connection'
import { normalizeEnv } from '../../src/env'

function sourceText (dir: string): string {
  return readdirSync(dir, { withFileTypes: true }).map((e) => e.isDirectory() ? sourceText(join(dir, e.name)) : e.name.endsWith('.ts') ? readFileSync(join(dir, e.name), 'utf8') : '').join('\n')
}

async function main (): Promise<void> {
  const ws = process.env.HULY_SMOKE_WORKSPACE
  if (ws == null || ws === '') { console.log('HULY_SMOKE_WORKSPACE is not set — skipping.'); process.exit(0) }
  normalizeEnv()
  const client: any = await getConnection(ws)
  const h = client.getHierarchy()
  const classes: string[] = h.getDescendants('core:class:Doc')
  const modules = new Map<string, string[]>()
  for (const c of classes) {
    const [mod, kind] = String(c).split(':')
    if (kind !== 'class' && kind !== 'mixin') continue
    modules.set(mod, [...(modules.get(mod) ?? []), c])
  }
  const src = sourceText('src')
  const used = (mod: string): boolean => src.includes(`'${mod}:`) || src.includes(`"${mod}:`) || src.includes(`@hcengineering/${mod}'`)
  const ignore = new Set(readFileSync('.github/huly-modules-ignore.txt', 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter((l) => l !== ''))
  const ignored = (m: string): boolean => [...ignore].some((i) => i.endsWith('*') ? m.startsWith(i.slice(0, -1)) : i === m)
  const fresh = [...modules.keys()].filter((m) => !used(m) && !ignored(m)).sort()
  const lines = [`## Huly modules without tools (${fresh.length})`, '', `Model has ${modules.size} modules; ${[...modules.keys()].filter(used).length} are used by tools, ${[...modules.keys()].filter(ignored).length} are ignored on purpose.`, '']
  for (const m of fresh) lines.push(`- **${m}** — ${modules.get(m)!.slice(0, 8).map((c) => `\`${c}\``).join(', ')}${modules.get(m)!.length > 8 ? ', …' : ''}`)
  if (fresh.length > 0) lines.push('', 'Add tools, or add the module to `.github/huly-modules-ignore.txt` with a reason.')
  writeFileSync('modules-report.md', lines.join('\n') + '\n')
  writeFileSync('modules-new.txt', fresh.join('\n'))
  console.log(lines.join('\n'))
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
