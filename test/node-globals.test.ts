// #109: Node 25+ exposes Web Storage globals that make the Huly client think it runs in a browser.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hideWebStorage } from '../src/node-globals'

test('Web Storage globals are hidden so the Huly client takes its Node path (#109)', () => {
  // The real process (Node 25+ in CI defines them; the import hid them).
  assert.equal(typeof (globalThis as any).sessionStorage, 'undefined')
  assert.equal(typeof (globalThis as any).localStorage, 'undefined')
  // An environment that defines them like Node 25+ (getter on the global object).
  const g: any = {}
  Object.defineProperty(g, 'sessionStorage', { get: () => ({ getItem: () => null }), configurable: true })
  Object.defineProperty(g, 'localStorage', { get: () => ({}), configurable: true })
  hideWebStorage(g)
  assert.equal(typeof g.sessionStorage, 'undefined')
  assert.equal(typeof g.localStorage, 'undefined')
  // A browser-like environment keeps them.
  const b: any = { window: {}, sessionStorage: {} }
  hideWebStorage(b)
  assert.equal(typeof b.sessionStorage, 'object')
})
