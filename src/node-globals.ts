// Node 25+ defines localStorage and sessionStorage globally (Web Storage, on by default). The Huly client
// takes `typeof sessionStorage !== 'undefined'` as "running in a browser" and then calls
// window.addEventListener — every transactor connection fails with "window is not defined" (#109).
// The server has no use for Web Storage, so hide both before any Huly code runs.
export function hideWebStorage (g: any = globalThis): void {
  for (const name of ['sessionStorage', 'localStorage']) {
    if (typeof g.window !== 'undefined') return // a real browser-like environment: leave it alone
    try {
      Object.defineProperty(g, name, { value: undefined, configurable: true, writable: true, enumerable: false })
    } catch { /* not configurable: nothing to do */ }
  }
}

hideWebStorage()
