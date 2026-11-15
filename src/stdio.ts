// The stdio MCP server — what `huly-mcp` with no subcommand runs, and all the Claude plugin ships (src/plugin.ts).
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server'
import { closeConnection, prewarm } from './connection'
import { normalizeEnv } from './env'
import { routeConsoleToStderr } from './utils/redact'

export async function runStdio (): Promise<void> {
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
