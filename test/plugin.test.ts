// 3.2: Claude Code plugin — hook helpers, repo → project lookup, env normalisation, plugin files.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import tracker from '@hcengineering/tracker'
import { setConnectionManager } from '../src/connection'
import { findProjectForRepo, repoSlug } from '../src/tools/agent'
import { normalizeEnv } from '../src/env'
import { createFakeEnv, PERSONAL } from './helpers'
// @ts-expect-error plain ESM helper of the plugin hooks, no type declarations
import { issueFromBranch, githubSlug, hulyRules } from '../plugin/hooks/lib.mjs'

test('issueFromBranch finds issue ids, not branch-type words', () => {
  assert.equal(issueFromBranch('proj-12-login-bug'), 'PROJ-12')
  assert.equal(issueFromBranch('feat/PROJ-7_x'), 'PROJ-7')
  assert.equal(issueFromBranch('jo/serv-272'), 'SERV-272')
  assert.equal(issueFromBranch('chore/release-3.1.0'), undefined)
  assert.equal(issueFromBranch('feat/v3.2-claude-plugin'), undefined)
  assert.equal(issueFromBranch('main'), undefined)
  assert.equal(issueFromBranch(undefined), undefined)
})

test('githubSlug / repoSlug read https, ssh and plain slugs', () => {
  assert.equal(githubSlug('git@github.com:Owner/Repo.git'), 'Owner/Repo')
  assert.equal(githubSlug('https://github.com/owner/repo/'), 'owner/repo')
  assert.equal(githubSlug('https://gitlab.com/a/b'), undefined)
  assert.equal(repoSlug('git@github.com:Owner/Repo.git'), 'owner/repo')
  assert.equal(repoSlug('Owner/Repo'), 'owner/repo')
})

test('normalizeEnv drops empty and unresolved HULY_* values, keeps others', () => {
  const env: NodeJS.ProcessEnv = { HULY_TOKEN: '', HULY_EMAIL: ' me@example.com ', HULY_ACCOUNTS_URL: '${user_config.huly_accounts_url}', OTHER: '' }
  normalizeEnv(env)
  assert.deepEqual(env, { HULY_EMAIL: 'me@example.com', OTHER: '' })
})

test('normalizeEnv reads plugin options (CLAUDE_PLUGIN_OPTION_HULY_*) and turns annotations on', () => {
  const env: NodeJS.ProcessEnv = {
    CLAUDE_PLUGIN_OPTION_HULY_EMAIL: 'me@example.com',
    CLAUDE_PLUGIN_OPTION_HULY_PASSWORD: 'pw',
    CLAUDE_PLUGIN_OPTION_HULY_TOKEN: '',
    CLAUDE_PLUGIN_OPTION_HULY_WORKSPACE: '${user_config.huly_workspace}',
    CLAUDE_PLUGIN_OPTION_HULY_FRONT_URL: 'https://huly.example.com',
    HULY_FRONT_URL: 'https://explicit.example.com'
  }
  normalizeEnv(env)
  assert.equal(env.HULY_EMAIL, 'me@example.com')
  assert.equal(env.HULY_PASSWORD, 'pw')
  assert.equal(env.HULY_TOKEN, undefined)
  assert.equal(env.HULY_WORKSPACE, undefined)
  assert.equal(env.HULY_FRONT_URL, 'https://explicit.example.com', 'an explicit HULY_* value wins')
  assert.equal(env.HULY_ANNOTATIONS, '1')
  const off: NodeJS.ProcessEnv = { CLAUDE_PLUGIN_OPTION_HULY_EMAIL: '', HULY_ANNOTATIONS: '0' }
  normalizeEnv(off)
  assert.equal(off.HULY_ANNOTATIONS, '0')
  const none: NodeJS.ProcessEnv = { HULY_EMAIL: 'a@b.c' }
  normalizeEnv(none)
  assert.equal(none.HULY_ANNOTATIONS, undefined, 'not a plugin: annotations stay off')
})

test('find_project_for_repo maps a GitHub repo to the linked project', async () => {
  const env = createFakeEnv({
    workspaces: [PERSONAL],
    data: {
      jokeks2023: [
        { _id: 'repo-1', _class: 'github:class:GithubIntegrationRepository', resourcePath: 'Owner/Repo' },
        { _id: 'repo-2', _class: 'github:class:GithubIntegrationRepository', resourcePath: 'owner/other' },
        { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', 'github:mixin:GithubProject': { repositories: ['repo-1'] } },
        { _id: 'p-2', _class: tracker.class.Project, identifier: 'TSK', name: 'Default' }
      ]
    }
  })
  setConnectionManager(env.manager)
  const hit = (await findProjectForRepo({ repository: 'git@github.com:owner/repo.git' } as any)).content[0].text
  assert.match(hit, /workspace `jokeks2023` · project \*\*PROJ\*\* \(Proj\)/)
  const miss = (await findProjectForRepo({ repository: 'owner/other' } as any)).content[0].text
  assert.match(miss, /No Huly project is linked/)
  await assert.rejects(findProjectForRepo({ repository: 'not a repo' } as any), /not a GitHub repository/)
})

test('plugin files: marketplace points to the plugin, MCP env covers every setting', () => {
  const market = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'))
  const manifest = JSON.parse(readFileSync('plugin/.claude-plugin/plugin.json', 'utf8'))
  const mcp = JSON.parse(readFileSync('plugin/.mcp.json', 'utf8'))
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.equal(market.plugins[0].source, './plugin')
  assert.equal(market.plugins[0].name, manifest.name)
  assert.equal(manifest.version, pkg.version, 'plugin version follows the package version')
  const env = mcp.mcpServers.huly.env
  for (const key of Object.keys(manifest.userConfig)) {
    assert.ok(Object.values(env).includes(`\${user_config.${key}}`), `${key} is not passed to the server`)
  }
  assert.match(mcp.mcpServers.huly.args.join(' '), new RegExp(`huly-mcp-selfhost@${pkg.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), 'exact version: the plugin directory blocks ranges')
})

test('hulyRules: a "## Huly" section in CLAUDE.md, .claude/CLAUDE.md, CLAUDE.local.md or AGENTS.md counts as set', () => {
  const dir = (): string => mkdtempSync(join(tmpdir(), 'huly-rules-'))
  assert.equal(hulyRules(dir()), undefined)
  const plain = dir(); writeFileSync(join(plain, 'CLAUDE.md'), '# Repo\n\n## Build\nnpm test\n')
  assert.equal(hulyRules(plain), 'none')
  const nested = dir(); mkdirSync(join(nested, '.claude')); writeFileSync(join(nested, '.claude', 'CLAUDE.md'), '## Huly\nNot used in this repository.\n')
  assert.equal(hulyRules(nested), 'set')
  const agents = dir(); writeFileSync(join(agents, 'CLAUDE.md'), '# x\n'); writeFileSync(join(agents, 'AGENTS.md'), '## Huly\n- Workspace `w`\n')
  assert.equal(hulyRules(agents), 'set')
  const local = dir(); writeFileSync(join(local, 'CLAUDE.md'), '# x\n'); writeFileSync(join(local, 'CLAUDE.local.md'), '## Huly\n- Efficiency: Minimal.\n')
  assert.equal(hulyRules(local), 'set')
})

test('setup wizard: Huly address → accounts/front URL; --url argument', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolveUrls, urlArg } = require('../scripts/setup.js')
  assert.deepEqual(resolveUrls(''), { accounts: 'https://account.huly.app', front: undefined })
  assert.deepEqual(resolveUrls('https://huly.app'), { accounts: 'https://account.huly.app', front: undefined })
  assert.deepEqual(resolveUrls('https://huly.example.com/'), { accounts: 'https://huly.example.com/_accounts', front: 'https://huly.example.com' })
  assert.deepEqual(resolveUrls('https://huly.example.com/_accounts'), { accounts: 'https://huly.example.com/_accounts', front: 'https://huly.example.com' })
  assert.throws(() => resolveUrls('huly.example.com'), /Not a URL/)
  assert.equal(urlArg(['setup', '--url', 'https://a.example']), 'https://a.example')
  assert.equal(urlArg(['--url=https://b.example']), 'https://b.example')
  assert.equal(urlArg(['setup']), undefined)
})

test('skill: one huly skill whose links point to existing files', () => {
  for (const f of ['SKILL.md', 'costs.md', 'onboarding.md', 'features.md']) assert.ok(readFileSync(join('plugin/skills/huly', f), 'utf8').length > 200, f)
  const skill = readFileSync('plugin/skills/huly/SKILL.md', 'utf8')
  for (const [, link] of skill.matchAll(/\]\(([\w-]+\.md)\)/g)) assert.ok(readFileSync(join('plugin/skills/huly', link), 'utf8'), `${link} exists`)
  assert.match(readFileSync('plugin/commands/setup.md', 'utf8'), /CLAUDE\.local\.md/)
})

test('skill guides name only tools and toolsets that exist', async () => {
  const { TOOLS, TOOLSETS } = await import('../src/registry')
  const names = new Set([...TOOLS.map((t) => t.name), 'enable_toolsets'])
  const toolsetOf = new Map(TOOLS.map((t) => [t.name, t.toolset as string]))
  for (const f of ['SKILL.md', 'costs.md', 'onboarding.md', 'features.md']) {
    const text = readFileSync(join('plugin/skills/huly', f), 'utf8')
    for (const [, word] of text.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)) {
      if (/^(generic|huly|user|claude)_/.test(word) && !names.has(word)) continue // generic_* pattern, env-like words
      assert.ok(names.has(word), `${f}: unknown tool ${word}`)
    }
  }
  // Table rows in features.md: every "tool (toolset)" pairing is right.
  const features = readFileSync('plugin/skills/huly/features.md', 'utf8')
  for (const row of features.split('\n').filter((l) => l.startsWith('| ') && l.includes('`'))) {
    const cell = row.split('|')[3] ?? ''
    const sets = [...cell.matchAll(/\(([a-z-]+(?:, [a-z-]+)*)\)/g)].flatMap((m) => m[1].split(', '))
    for (const s of sets) assert.ok((TOOLSETS as readonly string[]).includes(s), `features.md: unknown toolset ${s}`)
    for (const [, tool] of cell.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)) {
      if (!toolsetOf.has(tool)) continue
      assert.ok(sets.includes(toolsetOf.get(tool)!), `features.md: ${tool} is in toolset ${toolsetOf.get(tool)}, row says ${sets.join(', ')}`)
    }
  }
})
