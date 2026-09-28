import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFakeEnv, PERSONAL, AVMS } from './helpers'

test('logs in once at account level and discovers workspaces via getUserWorkspaces()', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [PERSONAL, AVMS] })

  const list = await manager.listWorkspaces()
  assert.deepEqual(list.map((w) => [w.name, w.url, w.uuid]), [
    ['JoKeks2023', 'jokeks2023', PERSONAL.uuid],
    ['AVMS', 'avms', AVMS.uuid]
  ])

  await manager.getWorkspace('jokeks2023')
  await manager.getWorkspace('avms')
  await manager.listWorkspaces()

  assert.equal(calls.login, 1)
  assert.equal(calls.getUserWorkspaces, 1)
  // Discovery and selectWorkspace run on the account-level token, never a workspace token.
  assert.deepEqual(calls.getUserWorkspacesTokens, ['account-token'])
  assert.deepEqual(calls.selectWorkspace.map((c) => c.token), ['account-token', 'account-token'])
})

test('login failure surfaces and is retried on the next call', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [PERSONAL] })
  ;(manager as any).opts.password = 'wrong'
  await assert.rejects(manager.listWorkspaces(), /Invalid credentials/)
  ;(manager as any).opts.password = 'pw'
  assert.equal((await manager.listWorkspaces()).length, 1)
  assert.equal(calls.login, 2)
})

test('missing credentials give a clear error', async () => {
  const { manager } = createFakeEnv({ workspaces: [PERSONAL] })
  ;(manager as any).opts.email = undefined
  await assert.rejects(manager.listWorkspaces(), /HULY_TOKEN .* or both HULY_EMAIL and HULY_PASSWORD/)
})

test('one cached connection per workspace; selectWorkspace only for the requested one', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [PERSONAL, AVMS] })

  const a1 = await manager.getWorkspace('avms')
  assert.deepEqual(calls.selectWorkspace.map((c) => c.slug), ['avms'])

  // Same workspace addressed by slug, name (any case) and UUID → same connection.
  const a2 = await manager.getWorkspace('AVMS')
  const a3 = await manager.getWorkspace(AVMS.uuid)
  assert.equal(a1.client, a2.client)
  assert.equal(a1.client, a3.client)
  assert.equal(calls.opened.length, 1)
  assert.deepEqual(calls.selectWorkspace.map((c) => c.slug), ['avms'])
})

test('concurrent first use of a workspace opens only one connection', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [PERSONAL, AVMS] })
  const [x, y] = await Promise.all([manager.getWorkspace('avms'), manager.getWorkspace('avms')])
  assert.equal(x.client, y.client)
  assert.equal(calls.opened.length, 1)
})

test('connections are isolated per workspace (endpoint, token, workspace-scoped account client)', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [PERSONAL, AVMS] })

  const p = await manager.getWorkspace('jokeks2023')
  const a = await manager.getWorkspace('avms')

  assert.notEqual(p.client, a.client)
  assert.equal(p.wsToken, 'ws-token-jokeks2023')
  assert.equal(a.wsToken, 'ws-token-avms')
  assert.equal(p.workspaceUuid, PERSONAL.uuid)
  assert.equal(a.workspaceUuid, AVMS.uuid)
  assert.deepEqual(calls.opened.map((o) => [o.endpoint, o.token]), [
    ['ws://huly/jokeks2023', 'ws-token-jokeks2023'],
    ['ws://huly/avms', 'ws-token-avms']
  ])

  // Workspace-level account client carries the workspace token, not the account token.
  await a.accountClient.getWorkspaceMembers()
  await p.accountClient.getWorkspaceMembers()
  assert.deepEqual(calls.getWorkspaceMembersTokens, ['ws-token-avms', 'ws-token-jokeks2023'])
})

test('unknown workspace errors with the available list after one refresh', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [PERSONAL, AVMS] })
  await assert.rejects(manager.getWorkspace('nope'), (err: Error) => {
    assert.match(err.message, /Unknown workspace 'nope'/)
    assert.match(err.message, /jokeks2023 \(JoKeks2023\)/)
    assert.match(err.message, /avms \(AVMS\)/)
    return true
  })
  assert.equal(calls.getUserWorkspaces, 2)
  assert.equal(calls.selectWorkspace.length, 0)
})

test('a workspace joined after discovery is found via refresh', async () => {
  const env = createFakeEnv({ workspaces: [PERSONAL] })
  await env.manager.listWorkspaces()
  env.workspaces.push(AVMS)
  const a = await env.manager.getWorkspace('avms')
  assert.equal(a.workspace.uuid, AVMS.uuid)
})

test('omitting workspace works only when exactly one is available', async () => {
  const multi = createFakeEnv({ workspaces: [PERSONAL, AVMS] })
  await assert.rejects(multi.manager.getWorkspace(), /Multiple workspaces available — pass 'workspace' explicitly/)
  assert.equal(multi.calls.opened.length, 0)

  const single = createFakeEnv({ workspaces: [AVMS] })
  assert.equal((await single.manager.getWorkspace()).workspace.url, 'avms')
})

test('no "last used" fallback: using a workspace does not make it the default', async () => {
  const { manager } = createFakeEnv({ workspaces: [PERSONAL, AVMS] })
  await manager.getWorkspace('avms')
  await assert.rejects(manager.getWorkspace(), /Multiple workspaces available/)
})

test('a blank workspace never falls back to the single available one', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [AVMS] })
  await assert.rejects(manager.getWorkspace(''), /must not be empty/)
  await assert.rejects(manager.getWorkspace('   '), /must not be empty/)
  assert.equal(calls.opened.length, 0)
})

test('ambiguous workspace names are rejected; slug/uuid still work', async () => {
  const one = { uuid: '33333333-cccc-4000-8000-000000000003', url: 'team-a', name: 'Team' }
  const two = { uuid: '44444444-dddd-4000-8000-000000000004', url: 'team-b', name: 'Team' }
  const { manager } = createFakeEnv({ workspaces: [one, two] })
  await assert.rejects(manager.getWorkspace('team'), /ambiguous/)
  assert.equal((await manager.getWorkspace('team-a')).workspace.uuid, one.uuid)
  assert.equal((await manager.getWorkspace(two.uuid)).workspace.uuid, two.uuid)
})

test('slug match wins over a different workspace with that name', async () => {
  const other = { uuid: '55555555-eeee-4000-8000-000000000005', url: 'avms-archive', name: 'avms' }
  const { manager } = createFakeEnv({ workspaces: [AVMS, other] })
  assert.equal((await manager.getWorkspace('avms')).workspace.uuid, AVMS.uuid)
})

test('legacy HULY_WORKSPACE restricts the server to that workspace', async () => {
  const { manager } = createFakeEnv({ workspaces: [PERSONAL, AVMS], restrictTo: 'avms' })
  assert.deepEqual((await manager.listWorkspaces()).map((w) => w.url), ['avms'])
  assert.equal((await manager.getWorkspace()).workspace.url, 'avms')
  await assert.rejects(manager.getWorkspace('jokeks2023'), /Unknown workspace/)

  const bad = createFakeEnv({ workspaces: [PERSONAL], restrictTo: 'avms' })
  await assert.rejects(bad.manager.listWorkspaces(), /HULY_WORKSPACE='avms' is not accessible/)
})

test('HULY_TOKEN (account-level) supports discovery and selectWorkspace with that token', async () => {
  const { manager, calls } = createFakeEnv({
    workspaces: [PERSONAL, AVMS],
    token: 'sso-token',
    tokenInfo: { account: 'account-1', socialId: 'social-id', token: 'sso-token' }
  })
  assert.equal((await manager.listWorkspaces()).length, 2)
  await manager.getWorkspace('avms')
  assert.equal(calls.login, 0)
  assert.deepEqual(calls.getUserWorkspacesTokens, ['sso-token'])
  assert.deepEqual(calls.selectWorkspace, [{ slug: 'avms', token: 'sso-token' }])
})

test('HULY_TOKEN (workspace-scoped) falls back to its own workspace if enumeration is refused', async () => {
  const { manager, calls } = createFakeEnv({
    workspaces: [PERSONAL, AVMS],
    token: 'ws-scoped',
    getUserWorkspacesFails: true,
    tokenInfo: { account: 'account-1', socialId: 'social-id', token: 'ws-scoped-inner', workspace: AVMS.uuid, workspaceUrl: 'avms', endpoint: 'ws://huly/avms', role: 'USER' }
  })
  assert.deepEqual((await manager.listWorkspaces()).map((w) => w.uuid), [AVMS.uuid])
  const a = await manager.getWorkspace('avms')
  assert.equal(a.wsToken, 'ws-scoped-inner')
  assert.equal(calls.selectWorkspace.length, 0)
})

test('invalid HULY_TOKEN is reported', async () => {
  const { manager } = createFakeEnv({ workspaces: [PERSONAL], token: 'expired', tokenInfo: null })
  await assert.rejects(manager.listWorkspaces(), /HULY_TOKEN is invalid or expired/)
})

test('closeAll closes every connection and the next call reconnects', async () => {
  const { manager, clients, calls } = createFakeEnv({ workspaces: [PERSONAL, AVMS] })
  await manager.getWorkspace('jokeks2023')
  await manager.getWorkspace('avms')

  await manager.closeAll()
  assert.equal(clients.get('jokeks2023')?.closed, true)
  assert.equal(clients.get('avms')?.closed, true)

  await manager.getWorkspace('avms')
  assert.equal(calls.opened.length, 3)
  assert.equal(calls.login, 2)
})

test('closeAll during an in-flight call leaves no open connection behind', async () => {
  // Call started before discovery finished.
  const early = createFakeEnv({ workspaces: [PERSONAL, AVMS] })
  const beforeResolve = early.manager.getWorkspace('avms')
  await early.manager.closeAll()
  await assert.rejects(beforeResolve, /connections were closed/)
  assert.equal(early.calls.opened.length, 0)

  // Call whose connection was already opening.
  let release!: () => void
  const late = createFakeEnv({ workspaces: [PERSONAL, AVMS], openGate: new Promise<void>((resolve) => { release = resolve }) })
  const opening = late.manager.getWorkspace('avms')
  while (late.calls.opened.length === 0) await new Promise((resolve) => setImmediate(resolve))
  const closing = late.manager.closeAll()
  release()
  await closing
  await assert.rejects(opening, /connections were closed/)
  assert.equal(late.clients.get('avms')?.closed, true)
})

test('a failed connection is not cached', async () => {
  const env = createFakeEnv({ workspaces: [PERSONAL, AVMS] })
  await env.manager.listWorkspaces()
  const avms = env.workspaces.splice(1, 1)[0] // selectWorkspace now fails for avms
  await assert.rejects(env.manager.getWorkspace('avms'), /Workspace not found/)
  env.workspaces.push(avms)
  assert.equal((await env.manager.getWorkspace('avms')).workspace.uuid, AVMS.uuid)
})
