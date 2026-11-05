/**
 * Huly's client logs its websocket URL on errors ("client websocket error: 2 wss://host/_transactor/<JWT> …").
 * The JWT is a valid workspace session token, so it must not end up in container logs.
 */
const JWT = /eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g

export function redactSecrets (value: unknown): unknown {
  if (typeof value === 'string') return value.replace(JWT, '***')
  if (value instanceof Error) {
    const copy = new Error(redactSecrets(value.message) as string)
    copy.stack = value.stack != null ? redactSecrets(value.stack) as string : undefined
    return copy
  }
  return value
}

/** Server mode: stdout is the JSON-RPC channel, so all console output goes to stderr, with tokens masked. */
export function routeConsoleToStderr (): void {
  const write = console.error.bind(console)
  const log = (...args: unknown[]): void => { write(...args.map(redactSecrets)) }
  console.log = console.info = console.debug = console.warn = console.error = log
}
