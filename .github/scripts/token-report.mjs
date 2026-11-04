// Turns two tool-sizes.ts outputs (base, head) into a Markdown comment.
// Usage: node .github/scripts/token-report.mjs base.json head.json > comment.md
import { readFileSync } from 'node:fs'
const [base, head] = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, 'utf8')))
const tok = (chars) => Math.round(chars / 3.5)
const sign = (n) => (n > 0 ? `+${n}` : String(n))
const rows = Object.keys(head).map((k) => {
  const b = base[k] ?? { tools: 0, chars: 0 }
  const h = head[k]
  const d = h.chars - b.chars
  const flag = d > 1000 ? ' ⚠️' : d < 0 ? ' ✅' : ''
  return `| ${k} | ${b.tools} → ${h.tools} | ${b.chars.toLocaleString('en')} → ${h.chars.toLocaleString('en')} | ${sign(d)} (≈ ${sign(tok(d))} tokens)${flag} |`
})
console.log(['<!-- huly-mcp-token-report -->', '### Token report: `tools/list`', '', '| Set | Tools | Chars | Change |', '|---|--:|--:|--:|', ...rows, '', '_≈3.5 chars per token. The default set is capped at 40,000 chars by `test/budget.test.ts`._'].join('\n'))
