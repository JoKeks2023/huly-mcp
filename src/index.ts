#!/usr/bin/env node
import './node-globals' // first: before any Huly client code (#109)
import { normalizeEnv } from './env'
import { runWatch } from './watch'
import { runJUnit } from './junit-cli'
import { runHttp } from './http'
import { main as runCliMain } from './cli'
import { routeConsoleToStderr } from './utils/redact'
import { runStdio } from './stdio'

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
  await runStdio()
}

main().catch((err) => {
  console.error('Fatal error starting huly-mcp:', err instanceof Error ? err.message : err)
  process.exit(1)
})
