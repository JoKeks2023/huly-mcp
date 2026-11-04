// Prints the README changelog section of one version ("### 3.1.0 — 2026-11-06" up to the next "### ").
// Usage: node .github/scripts/changelog-section.mjs 3.1.0
import { readFileSync } from 'node:fs'
const version = process.argv[2]
const lines = readFileSync('README.md', 'utf8').split('\n')
const start = lines.findIndex((l) => l.startsWith(`### ${version} `) || l === `### ${version}`)
if (start < 0) { console.error(`No changelog section "### ${version}" in README.md`); process.exit(1) }
let end = lines.findIndex((l, i) => i > start && (l.startsWith('### ') || l.startsWith('## ')))
if (end < 0) end = lines.length
process.stdout.write(lines.slice(start + 1, end).join('\n').trim() + '\n')
