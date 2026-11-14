// Reference data cache: answers repeated lookups from memory, drops them on any change.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cachingClient } from '../src/utils/cache'

function fakeRaw (): any {
  const calls: string[] = []
  const data: Record<string, any[]> = {
    'tracker:class:IssueStatus': [{ _id: 's1', name: 'Todo' }],
    'contact:class:Person': [{ _id: 'p1', name: 'Keks,Jo' }],
    'tracker:class:Issue': [{ _id: 'i1', title: 'x' }]
  }
  const raw: any = {
    calls,
    data,
    async findAll (cls: string, _q: unknown, _o?: unknown) { calls.push(cls); return Object.assign([...(data[cls] ?? [])], { total: (data[cls] ?? []).length }) },
    async findOne (cls: string, q: unknown) { return (await this.findAll(cls, q, { limit: 1 }))[0] },
    async tx (_tx: unknown) { return {} },
    getHierarchy: () => ({ isDerived: (a: string, b: string) => a === b || (a === 'tracker:class:IssueStatus' && b === 'core:class:Status') })
  }
  return raw
}

test('cache: repeated reference queries hit memory; other classes and lookups always go to Huly', async () => {
  const raw = fakeRaw()
  const c: any = cachingClient(raw, {})
  await c.findAll('tracker:class:IssueStatus', {})
  await c.findAll('tracker:class:IssueStatus', {})
  await c.findOne('tracker:class:IssueStatus', {}) // findOne → findAll with limit 1: its own key
  await c.findOne('tracker:class:IssueStatus', {})
  assert.deepEqual(raw.calls, ['tracker:class:IssueStatus', 'tracker:class:IssueStatus'])
  await c.findAll('tracker:class:Issue', {})
  await c.findAll('tracker:class:Issue', {})
  await c.findAll('contact:class:Person', {}, { lookup: { x: 'y' } })
  await c.findAll('contact:class:Person', {}, { lookup: { x: 'y' } })
  assert.equal(raw.calls.filter((x: string) => x === 'tracker:class:Issue').length, 2, 'issues are never cached')
  assert.equal(raw.calls.filter((x: string) => x === 'contact:class:Person').length, 2, 'lookups are never cached')
  assert.deepEqual(c.cacheStats, { hits: 2, misses: 2, invalidations: 0 })
})

test('cache: a change pushed by Huly drops the class (and derived/linked ones); results are copies', async () => {
  const raw = fakeRaw()
  const c: any = cachingClient(raw, {})
  const first = await c.findAll('tracker:class:IssueStatus', {})
  first[0].name = 'changed by caller'
  first.sort()
  assert.equal((await c.findAll('tracker:class:IssueStatus', {}))[0].name, 'Todo', 'a caller cannot change the cached value')
  raw.data['tracker:class:IssueStatus'] = [{ _id: 's1', name: 'Todo' }, { _id: 's2', name: 'Done' }]
  raw.notify({ _class: 'core:class:TxCreateDoc', objectClass: 'tracker:class:IssueStatus' })
  assert.equal((await c.findAll('tracker:class:IssueStatus', {})).length, 2)
  // A batch (TxApplyIf) and a collection tx are looked into.
  await c.findAll('contact:class:Person', {})
  await c.findAll('contact:mixin:Employee', {})
  const before = raw.calls.length
  raw.notify({ _class: 'core:class:TxApplyIf', txes: [{ _class: 'core:class:TxUpdateDoc', objectClass: 'contact:class:Person' }] })
  await c.findAll('contact:mixin:Employee', {})
  assert.equal(raw.calls.length, before + 1, 'Employee entries go with Person changes')
})

test('cache: own writes invalidate; a query in flight during a change is not stored; HULY_CACHE=0 is off', async () => {
  const raw = fakeRaw()
  const c: any = cachingClient(raw, {})
  await c.findAll('tracker:class:Project', {})
  await c.tx({ _class: 'core:class:TxUpdateDoc', objectClass: 'tracker:class:Project' })
  await c.findAll('tracker:class:Project', {})
  assert.equal(raw.calls.filter((x: string) => x === 'tracker:class:Project').length, 2)

  // In flight: the change arrives before the answer.
  const slow = fakeRaw()
  const orig = slow.findAll
  slow.findAll = async function (...a: any[]) { const r = await orig.apply(this, a); slow.notify?.({ objectClass: 'tracker:class:Milestone' }); return r }
  const s: any = cachingClient(slow, {})
  await s.findAll('tracker:class:Milestone', {})
  await s.findAll('tracker:class:Milestone', {})
  assert.equal(slow.calls.length, 2, 'the answer that raced a change was not reused')

  const off = fakeRaw()
  const o: any = cachingClient(off, { HULY_CACHE: '0' })
  await o.findAll('tracker:class:IssueStatus', {})
  await o.findAll('tracker:class:IssueStatus', {})
  assert.equal(off.calls.length, 2)
})
