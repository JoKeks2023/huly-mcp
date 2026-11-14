// update_organization: name and city without touching the description; nothing to change is an error.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import contact from '@hcengineering/contact'
import { setConnectionManager } from '../src/connection'
import { updateOrganization } from '../src/tools/organizations'
import { createFakeEnv, PERSONAL } from './helpers'

const W = 'jokeks2023'
let env: ReturnType<typeof createFakeEnv>
beforeEach(() => {
  env = createFakeEnv({ workspaces: [PERSONAL], data: { [W]: [{ _id: 'org-1', _class: contact.class.Organization, space: 'contact:space:Contacts', name: 'Acme', city: 'Berlin' }] } })
  setConnectionManager(env.manager)
})
afterEach(() => { setConnectionManager(null) })

test('update_organization: name and city, description untouched', async () => {
  const out = (await updateOrganization({ workspace: W, organizationId: 'org-1', name: 'Acme GmbH', city: 'Hamburg' } as any)).content[0].text
  assert.match(out, /Acme GmbH.*changed: name, city/)
  const m = env.clients.get(W)!.mutations.find((x) => x.op === 'updateDoc')
  assert.deepEqual(m?.data, { name: 'Acme GmbH', city: 'Hamburg' })
})

test('update_organization: nothing to change is an error, nothing written', async () => {
  await assert.rejects(updateOrganization({ workspace: W, organizationId: 'org-1' } as any), /Nothing to change/)
  assert.equal(env.clients.get(W)!.mutations.length, 0)
})
