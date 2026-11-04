// Starts the MCP server over stdio like a client would (initialize → tools/list) and checks it answers.
// Usage: node .github/scripts/stdio-smoke.mjs <command> [args…]   e.g. node dist/index.js, or docker run -i …
import { spawn } from 'node:child_process'
const [cmd, ...args] = process.argv.slice(2)
const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, HULY_EMAIL: 'ci@example.com', HULY_PASSWORD: 'x' } })
const send = (msg) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n')
let buf = ''
const timer = setTimeout(() => { console.error('::error::No tools/list answer within 30 s'); child.kill(); process.exit(1) }, 30_000)
child.stdout.on('data', (d) => {
  buf += d
  for (;;) {
    const i = buf.indexOf('\n'); if (i < 0) break
    const line = buf.slice(0, i); buf = buf.slice(i + 1)
    let msg; try { msg = JSON.parse(line) } catch { continue }
    if (msg.id === 1) {
      console.log(`initialize: ${msg.result?.serverInfo?.name} ${msg.result?.serverInfo?.version}`)
      send({ method: 'notifications/initialized' })
      send({ id: 2, method: 'tools/list' })
    } else if (msg.id === 2) {
      const n = msg.result?.tools?.length ?? 0
      console.log(`tools/list: ${n} tools, ${JSON.stringify(msg.result?.tools ?? []).length} chars`)
      clearTimeout(timer); child.kill()
      process.exit(n >= 50 ? 0 : 1)
    }
  }
})
child.on('exit', (code) => { if (code != null && code !== 0) { console.error(`::error::Server exited with ${code}`); process.exit(1) } })
send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ci-smoke', version: '0' } } })
