#!/usr/bin/env node
// Builds plugin-remote/ ("huly-remote") from plugin/: the same skill, commands and hooks, but no
// local server — Claude Code connects to a team server over HTTP and the user logs in with Huly
// (OAuth) in the browser. Run after changing anything in plugin/: npm run plugin:remote.
// `--check` only compares (CI): fails if plugin-remote/ is out of date.
'use strict'
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const src = path.join(root, 'plugin')
const dst = path.join(root, 'plugin-remote')
const SHARED = ['skills', 'commands', 'hooks', '.claude-plugin/icon.png']

/** Text files name the commands by plugin: /huly:setup → /huly-remote:setup. */
const adapt = (rel, buf) => /\.(md|mjs|json)$/.test(rel) ? Buffer.from(buf.toString('utf8').replace(/\/huly:/g, '/huly-remote:')) : buf

function manifest () {
  const local = JSON.parse(fs.readFileSync(path.join(src, '.claude-plugin', 'plugin.json'), 'utf8'))
  return {
    name: 'huly-remote',
    version: local.version,
    description: 'Huly for Claude Code through your team server: workflow skill, session/PR hooks and /huly-remote commands — nothing runs on your computer',
    author: local.author,
    homepage: local.homepage,
    repository: local.repository,
    license: local.license,
    keywords: [...local.keywords, 'remote'],
    userConfig: {
      huly_server_url: {
        type: 'string',
        title: 'Huly MCP server URL',
        description: 'Your team server\'s MCP endpoint, e.g. https://huly-mcp.example.com/mcp — you log in with your Huly account in the browser',
        required: true
      }
    }
  }
}

const files = () => ({
  '.claude-plugin/plugin.json': JSON.stringify(manifest(), null, 2) + '\n',
  '.mcp.json': JSON.stringify({ mcpServers: { huly: { type: 'http', url: '${user_config.huly_server_url}' } } }, null, 2) + '\n',
  'README.md': fs.readFileSync(path.join(root, 'scripts', 'plugin-remote-README.md'), 'utf8')
})

function listTree (dir, base = dir) {
  if (!fs.existsSync(dir)) return []
  if (fs.statSync(dir).isFile()) return [path.relative(base, dir)]
  return fs.readdirSync(dir).filter((f) => f !== '.DS_Store').flatMap((f) => listTree(path.join(dir, f), base))
}

if (process.argv.includes('--check')) {
  const problems = []
  for (const s of SHARED) {
    for (const rel of listTree(path.join(src, s), src)) {
      const a = path.join(src, rel); const b = path.join(dst, rel)
      if (!fs.existsSync(b) || !adapt(rel, fs.readFileSync(a)).equals(fs.readFileSync(b))) problems.push(rel)
    }
  }
  for (const [rel, text] of Object.entries(files())) if (!fs.existsSync(path.join(dst, rel)) || fs.readFileSync(path.join(dst, rel), 'utf8') !== text) problems.push(rel)
  if (problems.length > 0) { console.error(`plugin-remote/ is out of date (${problems.join(', ')}) — run: npm run plugin:remote`); process.exit(1) }
  console.log('plugin-remote/ matches plugin/.')
} else {
  fs.rmSync(dst, { recursive: true, force: true })
  for (const s of SHARED) {
    for (const rel of listTree(path.join(src, s), src)) {
      fs.mkdirSync(path.dirname(path.join(dst, rel)), { recursive: true })
      fs.writeFileSync(path.join(dst, rel), adapt(rel, fs.readFileSync(path.join(src, rel))))
    }
  }
  for (const [rel, text] of Object.entries(files())) { fs.mkdirSync(path.dirname(path.join(dst, rel)), { recursive: true }); fs.writeFileSync(path.join(dst, rel), text) }
  console.log('plugin-remote/ written.')
}
