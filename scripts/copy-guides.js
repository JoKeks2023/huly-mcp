#!/usr/bin/env node
// Build step: the plugin skill files are the one source for the agent guides. They are copied to
// dist/guides/ (without the skill frontmatter) so every MCP client can read them as huly://guide/*.
'use strict'
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const src = path.join(root, 'plugin', 'skills', 'huly')
const out = path.join(root, 'dist', 'guides')
const GUIDES = { workflow: 'SKILL.md', costs: 'costs.md', onboarding: 'onboarding.md' }

fs.mkdirSync(out, { recursive: true })
for (const [name, file] of Object.entries(GUIDES)) {
  const text = fs.readFileSync(path.join(src, file), 'utf8').replace(/^---\n[\s\S]*?\n---\n+/, '')
  fs.writeFileSync(path.join(out, `${name}.md`), text)
}
console.log(`guides: ${Object.keys(GUIDES).length} copied to dist/guides`)
