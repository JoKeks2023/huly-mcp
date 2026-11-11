// Repository consistency: the numbers in the docs match the registry, versions agree everywhere,
// and the Claude Code plugin is well-formed. These drift silently when edited by hand.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { TOOLS, TOOLSETS, DEFAULT_TOOLSETS } from '../src/registry'

const ROOT = join(__dirname, '..')
// Windows checkouts may have CRLF line endings.
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n')
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const json = (p: string): any => JSON.parse(read(p))

const total = TOOLS.length
const defaultCount = TOOLS.filter((t) => t.toolset === 'core' || (DEFAULT_TOOLSETS as string[]).includes(t.toolset)).length
const perToolset = (ts: string): number => TOOLS.filter((t) => t.toolset === ts).length

test('README: total, default count and the toolset table match the registry', () => {
  const md = read('README.md')
  assert.match(md, new RegExp(`## Tools \\(${total} total`), `README heading should say ${total} total`)
  const sizes = /\| \| default \((\d+) tools\) \| `all` \((\d+) tools\) \|/.exec(md)
  assert.ok(sizes != null, 'size table header not found')
  assert.equal(Number(sizes[1]), defaultCount, 'size table default count')
  assert.equal(Number(sizes[2]), total, 'size table all count')
  for (const ts of TOOLSETS.filter((t) => t !== 'core')) {
    const row = new RegExp(`^\\| \`${ts}\` \\| *(✓?) *\\| (\\d+) \\|`, 'm').exec(md)
    assert.ok(row != null, `toolset ${ts} missing from the README table`)
    assert.equal(Number(row[2]), perToolset(ts), `README count for toolset ${ts}`)
    assert.equal(row[1] === '✓', (DEFAULT_TOOLSETS as string[]).includes(ts), `README default mark for toolset ${ts}`)
  }
})

test('every tool appears in the README', () => {
  const md = read('README.md')
  const missing = TOOLS.filter((t) => !md.includes(`\`${t.name}\``)).map((t) => t.name)
  assert.deepEqual(missing, [], 'tools not mentioned in README')
})

test('site and Docker Hub text use the registry numbers', () => {
  const site = read('site/index.html')
  const counts = [...site.matchAll(/(\d+) (?:tools|handlers)\b/g), ...site.matchAll(/<b>(\d+)<\/b><span>tools<\/span>/g)].map((m) => Number(m[1]))
  assert.ok(counts.length >= 3, 'tool counts not found on the site')
  assert.deepEqual([...new Set(counts)], [total], 'site tool counts')
  assert.equal(Number(/<b>(\d+)<\/b><span>toolsets</.exec(site)?.[1]), TOOLSETS.length, 'site toolset count')
  assert.equal(Number(/<b>(\d+)<\/b><span>loaded by default</.exec(site)?.[1]), TOOLS.filter((t) => t.toolset === 'core' || (DEFAULT_TOOLSETS as string[]).includes(t.toolset)).length, 'site default count')
  for (const t of TOOLS) assert.ok(site.includes(`<span>${t.name}</span>`) || site.includes(`<span class="w">${t.name}</span>`), `site lists ${t.name}`)
  const hub = /(\d+) tools in toolsets \(`HULY_TOOLSETS`, default (\d+)\)/.exec(read('DOCKERHUB.md'))
  assert.ok(hub != null, 'DOCKERHUB.md tool sentence not found')
  assert.equal(Number(hub[1]), total)
  assert.equal(Number(hub[2]), defaultCount)
})

test('version is the same in package.json, server.json, the plugin and the MCP server', () => {
  const version = json('package.json').version
  const server = json('server.json')
  assert.equal(server.version, version, 'server.json version')
  // The registry namespace is case-sensitive: it must match the GitHub owner exactly.
  assert.match(server.name, /^io\.github\.JoKeks2023\//, 'server.json name uses the exact GitHub owner')
  assert.equal(json('package.json').mcpName, server.name, 'package.json mcpName matches server.json name')
  assert.ok(server.description.length <= 100, `server.json description is ${server.description.length} chars; the MCP registry rejects more than 100`)
  for (const p of server.packages ?? []) assert.equal(p.version, version, `server.json package ${String(p.identifier)} version`)
  assert.equal(json('plugin/.claude-plugin/plugin.json').version, version, 'plugin.json version')
  assert.match(read('src/server.ts'), new RegExp(`name: 'huly-mcp-selfhost', version: '${escapeRe(version)}'`), 'McpServer version in src/server.ts')
})

test('plugin: manifests parse, commands and skills have frontmatter, hook scripts exist', () => {
  const plugin = json('plugin/.claude-plugin/plugin.json')
  assert.equal(plugin.name, 'huly')
  const market = json('.claude-plugin/marketplace.json')
  for (const p of market.plugins) assert.ok(existsSync(join(ROOT, p.source)), `marketplace source ${String(p.source)} exists`)
  const mcp = json('plugin/.mcp.json')
  assert.match(mcp.mcpServers.huly.args.join(' '), /huly-mcp-selfhost@\^?\d+\.\d+\.\d+/)
  const hooks = json('plugin/hooks/hooks.json').hooks
  for (const groups of Object.values<any[]>(hooks)) {
    for (const g of groups) {
      for (const h of g.hooks) {
        for (const a of h.args ?? []) {
          if (typeof a === 'string' && a.includes('${CLAUDE_PLUGIN_ROOT}')) assert.ok(existsSync(join(ROOT, 'plugin', a.replace('${CLAUDE_PLUGIN_ROOT}/', ''))), `hook script ${a} exists`)
        }
      }
    }
  }
  const front = (p: string): string => { const m = /^---\n([\s\S]*?)\n---\n/.exec(read(p)); assert.ok(m != null, `${p} has frontmatter`); return m[1] }
  const skill = front('plugin/skills/huly/SKILL.md')
  assert.match(skill, /^name: huly$/m)
  assert.match(skill, /^description: .{40,}/m)
  for (const c of ['start', 'finish', 'plan', 'standup', 'triage']) assert.match(front(`plugin/commands/${c}.md`), /^description: .+/m, `command ${c} has a description`)
})
