#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server'
import { closeConnection } from './connection'
import { normalizeEnv } from './env'
import { runWatch } from './watch'

async function main (): Promise<void> {
  if (process.argv[2] === 'watch') {
    await runWatch(process.argv.slice(3))
    return
  }
  normalizeEnv()
  const server = createServer()
  const transport = new StdioServerTransport()

  process.on('SIGINT', async () => {
    await closeConnection()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    await closeConnection()
    process.exit(0)
  })

  await server.connect(transport)
  // Process stays alive — connection maintained until shutdown
}

main().catch((err) => {
  console.error('Fatal error starting huly-mcp:', err instanceof Error ? err.message : err)
  process.exit(1)
})
