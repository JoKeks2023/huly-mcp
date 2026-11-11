#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server'
import { closeConnection, prewarm } from './connection'
import { normalizeEnv } from './env'
import { runWatch } from './watch'
import { runJUnit } from './junit-cli'
import { runHttp } from './http'
import { main as runCliMain } from './cli'
import { routeConsoleToStderr } from './utils/redact'

async function main (): Promise<void> {
  if (process.argv[2] === 'watch') {
    await runWatch(process.argv.slice(3))
    return
  }
  const sub = process.argv[2]
  if (sub != null && !['watch', 'junit', 'setup', 'http'].includes(sub)) {
    // Anything else is the command line: huly-mcp tools | help | <tool> --param value …
    // The Huly SDK logs model details to the console; in a terminal that is noise. HULY_DEBUG=1 keeps it (on stderr).
    if (['1', 'true', 'yes'].includes(String(process.env.HULY_DEBUG ?? '').toLowerCase())) routeConsoleToStderr()
    else console.log = console.info = console.debug = console.warn = console.error = () => {}
    process.exit(await runCliMain(process.argv.slice(2)))
  }
  if (process.argv[2] === 'http') {
    normalizeEnv()
    routeConsoleToStderr()
    await runHttp(process.argv.slice(3))
    return
  }
  if (process.argv[2] === 'setup') {
    // `npx huly-mcp-selfhost setup`: the token wizard for SSO accounts (scripts/setup.js ships in the package).
    process.env.HULY_SETUP_RUN = '1'
    require('../scripts/setup.js')
    return
  }
  if (process.argv[2] === 'junit') {
    await runJUnit(process.argv.slice(3))
    process.exit()
  }
  normalizeEnv()
  // stdout is the JSON-RPC channel. Huly's client logs to it ("Client: onConnect 1"),
  // which breaks strict MCP clients and makes mcp-proxy log parse errors. Send it to stderr,
  // with session tokens masked (Huly logs its websocket URL including the token).
  routeConsoleToStderr()
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
  // Log in and open the (single) workspace now, not on the first tool call.
  void prewarm()
  // Process stays alive — connection maintained until shutdown
}

main().catch((err) => {
  console.error('Fatal error starting huly-mcp:', err instanceof Error ? err.message : err)
  process.exit(1)
})
