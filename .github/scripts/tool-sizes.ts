// Measures the tools/list payload of a checkout (default: this one) for the token report.
// Usage: npx tsx .github/scripts/tool-sizes.ts [repo root]  → JSON on stdout
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

async function main (): Promise<void> {
  const root = resolve(process.argv[2] ?? '.')
  const { createServer } = await import(pathToFileURL(resolve(root, 'src/server.ts')).href)
  const out: Record<string, { tools: number, chars: number }> = {}
  for (const [key, toolsets, workspace] of [['default', '', ''], ['default pinned', '', 'ws'], ['all', 'all', ''], ['all pinned', 'all', 'ws']]) {
    // Older checkouts ignore the workspace option; their pinned value then equals the unpinned one.
    const server = createServer({ toolsets, workspace })
    const [a, b] = InMemoryTransport.createLinkedPair()
    await server.connect(b)
    const client = new Client({ name: 'sizes', version: '0' })
    await client.connect(a)
    const { tools } = await client.listTools()
    out[key] = { tools: tools.length, chars: JSON.stringify(tools).length }
    await client.close()
  }
  process.stdout.write(JSON.stringify(out))
  process.exit(0)
}
void main()
