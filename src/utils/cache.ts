// Reference data cache, one per connection.
//
// Many tools look up the same small, rarely changing data on every call: statuses, people and
// their social ids, projects, milestones, components, labels. standup alone asked for people and
// statuses ~15 times. These queries are answered from memory and dropped as soon as Huly reports
// a change to that class — Huly pushes every transaction of the workspace to each connection
// (client.notify), also those of other people and apps — or when this server writes one itself.
// A query is never older than MAX_AGE_MS even if an event was missed (e.g. during a reconnect).
// HULY_CACHE=0 turns it off.

const CACHED = [
  'core:class:Status',
  'tracker:class:IssueStatus',
  'contact:class:Person',
  'contact:mixin:Employee',
  'contact:class:SocialIdentity',
  'tracker:class:Project',
  'tracker:class:Milestone',
  'tracker:class:Component',
  'tags:class:TagElement'
] as const

/** Classes whose entries share fate: an Employee query returns Person documents. */
const LINKED: Record<string, string[]> = {
  'contact:class:Person': ['contact:mixin:Employee'],
  'contact:mixin:Employee': ['contact:class:Person'],
  'tracker:class:IssueStatus': ['core:class:Status'],
  'core:class:Status': ['tracker:class:IssueStatus']
}

const MAX_AGE_MS = 10 * 60_000
const MAX_ENTRIES = 500

export interface CacheStats { hits: number, misses: number, invalidations: number }

interface Entry { at: number, value: any }

/** A copy, so a caller that sorts or edits the result does not change the cached one. */
function copy (value: any): any {
  if (!Array.isArray(value)) return value
  let docs: any[]
  try { docs = structuredClone([...value]) } catch { docs = value.map((d: any) => ({ ...d })) }
  return Object.assign(docs, { total: (value as any).total, lookupMap: (value as any).lookupMap })
}

export function cachingClient<T extends object> (raw: T, env: NodeJS.ProcessEnv = process.env): T & { cacheStats: CacheStats } {
  const stats: CacheStats = { hits: 0, misses: 0, invalidations: 0 }
  if (['0', 'false', 'no', 'off'].includes(String(env.HULY_CACHE ?? '').toLowerCase())) return Object.assign(raw, { cacheStats: stats })
  const r: any = raw
  const entries = new Map<string, Map<string, Entry>>() // class → query key → entry

  const derived = (cls: string, base: string): boolean => {
    if (cls === base) return true
    try { return r.getHierarchy?.().isDerived(cls, base) === true } catch { return false }
  }
  // Bumped on every invalidation, so a query that was in flight while its class changed is not stored.
  const generation = new Map<string, number>()
  const drop = (cls: string): void => {
    generation.set(cls, (generation.get(cls) ?? 0) + 1)
    if (entries.delete(cls)) stats.invalidations++
  }
  /** Every cached class a transaction can change. */
  const invalidate = (tx: any): void => {
    if (tx == null) return
    for (const inner of tx.txes ?? []) invalidate(inner) // TxApplyIf and other batches
    if (tx.tx != null) invalidate(tx.tx) // collection transactions wrap the real one
    const touched = [tx.objectClass, tx.mixin].filter((c) => typeof c === 'string')
    if (touched.length === 0) return
    for (const c of CACHED) {
      if (touched.some((t) => derived(t, c))) { drop(c); for (const l of LINKED[c] ?? []) drop(l) }
    }
  }

  // Changes from anyone (pushed by Huly) and from this server (its own transactions).
  const previous = r.notify
  r.notify = (...txes: any[]) => {
    for (const tx of txes) invalidate(tx)
    previous?.(...txes)
  }

  return new Proxy(r, {
    get (target, prop, receiver) {
      if (prop === 'cacheStats') return stats
      const orig = Reflect.get(target, prop, receiver)
      if (prop === 'tx' && typeof orig === 'function') {
        return async (tx: any, ...rest: unknown[]) => {
          try { return await orig.call(target, tx, ...rest) } finally { invalidate(tx) }
        }
      }
      if (prop !== 'findAll' || typeof orig !== 'function') return orig
      return async (_class: string, query: unknown, options?: any, ...rest: unknown[]) => {
        // Lookups pull in other classes; those results are not cached.
        if (!(CACHED as readonly string[]).includes(_class) || options?.lookup != null || rest.length > 0) {
          return await orig.call(receiver, _class, query, options, ...rest)
        }
        const key = JSON.stringify([query, options ?? null])
        const now = Date.now()
        const hit = entries.get(_class)?.get(key)
        if (hit != null && now - hit.at < MAX_AGE_MS) { stats.hits++; return copy(hit.value) }
        stats.misses++
        const gen = generation.get(_class) ?? 0
        const value = await orig.call(receiver, _class, query, options)
        if ((generation.get(_class) ?? 0) === gen) {
          if ([...entries.values()].reduce((n, m) => n + m.size, 0) >= MAX_ENTRIES) entries.clear()
          let byQuery = entries.get(_class)
          if (byQuery == null) { byQuery = new Map(); entries.set(_class, byQuery) }
          byQuery.set(key, { at: now, value })
        }
        return copy(value)
      }
    }
  }) as T & { cacheStats: CacheStats }
}
