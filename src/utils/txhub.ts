// Huly pushes every transaction of the workspace to each connection (client.notify) — also those
// made by other people and apps. One hub per raw client fans them out to the reference cache and
// to resource subscriptions.

export type TxListener = (tx: any) => void

interface Hub { listeners: Set<TxListener> }

/** Installs (once) a notify hook on the raw Huly client and returns its listener set. */
export function txHub (raw: any): Hub {
  if (raw.__hulyTxHub != null) return raw.__hulyTxHub
  const hub: Hub = { listeners: new Set() }
  const previous = raw.notify
  raw.notify = (...txes: any[]) => {
    for (const tx of txes) for (const l of hub.listeners) { try { l(tx) } catch { /* a listener must not break the client */ } }
    previous?.(...txes)
  }
  Object.defineProperty(raw, '__hulyTxHub', { value: hub, enumerable: false })
  return hub
}

/** Listen to a connection's transactions (TxOperations or raw client); returns the unsubscribe. */
export function onTx (client: any, listener: TxListener): () => void {
  const raw = client?.client ?? client
  const hub = txHub(raw.__hulyRaw ?? raw)
  hub.listeners.add(listener)
  return () => { hub.listeners.delete(listener) }
}

/** Every document id a transaction touches: the object, its parent (collections), batched txs. */
export function touchedIds (tx: any, out = new Set<string>()): Set<string> {
  if (tx == null) return out
  for (const k of ['objectId', 'attachedTo']) if (typeof tx[k] === 'string') out.add(tx[k])
  if (tx.tx != null) touchedIds(tx.tx, out)
  for (const inner of tx.txes ?? []) touchedIds(inner, out)
  return out
}
