// Entry of the Claude plugin's server (plugin/server, see scripts/plugin-bundle.js): only the stdio MCP server.
// No CLI, watch, http or setup — the plugin never runs them, and they would put process spawning,
// network listeners and download hints into the plugin that the directory validator has to refuse or hold.
import './node-globals' // first: before any Huly client code (#109)
import { runStdio } from './stdio'

runStdio().catch((err) => {
  console.error('Fatal error starting huly-mcp:', err instanceof Error ? err.message : err)
  process.exit(1)
})
