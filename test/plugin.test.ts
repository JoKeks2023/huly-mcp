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
  assert.match(mcp.mcpServers.huly.args.join(' '), new RegExp(`huly-mcp-selfhost@\\^${pkg.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
})

test('hulyRules: a "## Huly" section in CLAUDE.md, .claude/CLAUDE.md or AGENTS.md counts as set', () => {
  const dir = (): string => mkdtempSync(join(tmpdir(), 'huly-rules-'))
  assert.equal(hulyRules(dir()), undefined)
  const plain = dir(); writeFileSync(join(plain, 'CLAUDE.md'), '# Repo\n\n## Build\nnpm test\n')
  assert.equal(hulyRules(plain), 'none')
  const nested = dir(); mkdirSync(join(nested, '.claude')); writeFileSync(join(nested, '.claude', 'CLAUDE.md'), '## Huly\nNot used in this repository.\n')
  assert.equal(hulyRules(nested), 'set')
  const agents = dir(); writeFileSync(join(agents, 'CLAUDE.md'), '# x\n'); writeFileSync(join(agents, 'AGENTS.md'), '## Huly\n- Workspace `w`\n')
  assert.equal(hulyRules(agents), 'set')
})
