import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFakeEnv, PERSONAL, ACME } from './helpers'

test('logs in once at account level and discovers workspaces via getUserWorkspaces()', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [PERSONAL, ACME] })

  const list = await manager.listWorkspaces()
  assert.deepEqual(list.map((w) => [w.name, w.url, w.uuid]), [
    ['JoKeks2023', 'jokeks2023', PERSONAL.uuid],
    ['ACME', 'acme', ACME.uuid]
  ])

  await manager.getWorkspace('jokeks2023')
  await manager.getWorkspace('acme')
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
  const { manager, calls } = createFakeEnv({ workspaces: [PERSONAL, ACME] })

  const a1 = await manager.getWorkspace('acme')
  assert.deepEqual(calls.selectWorkspace.map((c) => c.slug), ['acme'])

  // Same workspace addressed by slug, name (any case) and UUID → same connection.
  const a2 = await manager.getWorkspace('ACME')
  const a3 = await manager.getWorkspace(ACME.uuid)
  assert.equal(a1.client, a2.client)
  assert.equal(a1.client, a3.client)
  assert.equal(calls.opened.length, 1)
  assert.deepEqual(calls.selectWorkspace.map((c) => c.slug), ['acme'])
})

test('concurrent first use of a workspace opens only one connection', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [PERSONAL, ACME] })
  const [x, y] = await Promise.all([manager.getWorkspace('acme'), manager.getWorkspace('acme')])
  assert.equal(x.client, y.client)
  assert.equal(calls.opened.length, 1)
})

test('connections are isolated per workspace (endpoint, token, workspace-scoped account client)', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [PERSONAL, ACME] })

  const p = await manager.getWorkspace('jokeks2023')
  const a = await manager.getWorkspace('acme')

  assert.notEqual(p.client, a.client)
  assert.equal(p.wsToken, 'ws-token-jokeks2023')
  assert.equal(a.wsToken, 'ws-token-acme')
  assert.equal(p.workspaceUuid, PERSONAL.uuid)
  assert.equal(a.workspaceUuid, ACME.uuid)
  assert.deepEqual(calls.opened.map((o) => [o.endpoint, o.token]), [
    ['ws://huly/jokeks2023', 'ws-token-jokeks2023'],
    ['ws://huly/acme', 'ws-token-acme']
  ])

  // Workspace-level account client carries the workspace token, not the account token.
  await a.accountClient.getWorkspaceMembers()
  await p.accountClient.getWorkspaceMembers()
  assert.deepEqual(calls.getWorkspaceMembersTokens, ['ws-token-acme', 'ws-token-jokeks2023'])
})

test('unknown workspace errors with the available list after one refresh', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [PERSONAL, ACME] })
  await assert.rejects(manager.getWorkspace('nope'), (err: Error) => {
    assert.match(err.message, /Unknown workspace 'nope'/)
    assert.match(err.message, /jokeks2023 \(JoKeks2023\)/)
    assert.match(err.message, /acme \(ACME\)/)
    return true
  })
  assert.equal(calls.getUserWorkspaces, 2)
  assert.equal(calls.selectWorkspace.length, 0)
})

test('a workspace joined after discovery is found via refresh', async () => {
  const env = createFakeEnv({ workspaces: [PERSONAL] })
  await env.manager.listWorkspaces()
  env.workspaces.push(ACME)
  const a = await env.manager.getWorkspace('acme')
  assert.equal(a.workspace.uuid, ACME.uuid)
})

test('omitting workspace works only when exactly one is available', async () => {
  const multi = createFakeEnv({ workspaces: [PERSONAL, ACME] })
  await assert.rejects(multi.manager.getWorkspace(), /Multiple workspaces available — pass 'workspace' explicitly/)
  assert.equal(multi.calls.opened.length, 0)

  const single = createFakeEnv({ workspaces: [ACME] })
  assert.equal((await single.manager.getWorkspace()).workspace.url, 'acme')
})

test('no "last used" fallback: using a workspace does not make it the default', async () => {
  const { manager } = createFakeEnv({ workspaces: [PERSONAL, ACME] })
  await manager.getWorkspace('acme')
  await assert.rejects(manager.getWorkspace(), /Multiple workspaces available/)
})

test('a blank workspace never falls back to the single available one', async () => {
  const { manager, calls } = createFakeEnv({ workspaces: [ACME] })
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
  const other = { uuid: '55555555-eeee-4000-8000-000000000005', url: 'acme-archive', name: 'acme' }
  const { manager } = createFakeEnv({ workspaces: [ACME, other] })
  assert.equal((await manager.getWorkspace('acme')).workspace.uuid, ACME.uuid)
})

test('legacy HULY_WORKSPACE restricts the server to that workspace', async () => {
  const { manager } = createFakeEnv({ workspaces: [PERSONAL, ACME], restrictTo: 'acme' })
  assert.deepEqual((await manager.listWorkspaces()).map((w) => w.url), ['acme'])
  assert.equal((await manager.getWorkspace()).workspace.url, 'acme')
  await assert.rejects(manager.getWorkspace('jokeks2023'), /Unknown workspace/)

  const bad = createFakeEnv({ workspaces: [PERSONAL], restrictTo: 'acme' })
  await assert.rejects(bad.manager.listWorkspaces(), /HULY_WORKSPACE='acme' is not accessible/)
})

test('HULY_TOKEN (account-level) supports discovery and selectWorkspace with that token', async () => {
  const { manager, calls } = createFakeEnv({
    workspaces: [PERSONAL, ACME],
    token: 'sso-token',
    tokenInfo: { account: 'account-1', socialId: 'social-id', token: 'sso-token' }
  })
  assert.equal((await manager.listWorkspaces()).length, 2)
  await manager.getWorkspace('acme')
  assert.equal(calls.login, 0)
  assert.deepEqual(calls.getUserWorkspacesTokens, ['sso-token'])
  assert.deepEqual(calls.selectWorkspace, [{ slug: 'acme', token: 'sso-token' }])
})

test('HULY_TOKEN (workspace-scoped) falls back to its own workspace if enumeration is refused', async () => {
  const { manager, calls } = createFakeEnv({
    workspaces: [PERSONAL, ACME],
    token: 'ws-scoped',
    getUserWorkspacesFails: true,
    tokenInfo: { account: 'account-1', socialId: 'social-id', token: 'ws-scoped-inner', workspace: ACME.uuid, workspaceUrl: 'acme', endpoint: 'ws://huly/acme', role: 'USER' }
  })
  assert.deepEqual((await manager.listWorkspaces()).map((w) => w.uuid), [ACME.uuid])
  const a = await manager.getWorkspace('acme')
  assert.equal(a.wsToken, 'ws-scoped-inner')
  assert.equal(calls.selectWorkspace.length, 0)
})

test('invalid HULY_TOKEN is reported', async () => {
  const { manager } = createFakeEnv({ workspaces: [PERSONAL], token: 'expired', tokenInfo: null })
  await assert.rejects(manager.listWorkspaces(), /HULY_TOKEN is invalid, expired or revoked\. API token: create a new one/)
})

test('closeAll closes every connection and the next call reconnects', async () => {
  const { manager, clients, calls } = createFakeEnv({ workspaces: [PERSONAL, ACME] })
  await manager.getWorkspace('jokeks2023')
  await manager.getWorkspace('acme')

  await manager.closeAll()
  assert.equal(clients.get('jokeks2023')?.closed, true)
  assert.equal(clients.get('acme')?.closed, true)

  await manager.getWorkspace('acme')
  assert.equal(calls.opened.length, 3)
  assert.equal(calls.login, 2)
})

test('closeAll during an in-flight call leaves no open connection behind', async () => {
  // Call started before discovery finished.
  const early = createFakeEnv({ workspaces: [PERSONAL, ACME] })
  const beforeResolve = early.manager.getWorkspace('acme')
  await early.manager.closeAll()
  await assert.rejects(beforeResolve, /connections were closed/)
  assert.equal(early.calls.opened.length, 0)

  // Call whose connection was already opening.
  let release!: () => void
  const late = createFakeEnv({ workspaces: [PERSONAL, ACME], openGate: new Promise<void>((resolve) => { release = resolve }) })
  const opening = late.manager.getWorkspace('acme')
  while (late.calls.opened.length === 0) await new Promise((resolve) => setImmediate(resolve))
  const closing = late.manager.closeAll()
  release()
  await closing
  await assert.rejects(opening, /connections were closed/)
  assert.equal(late.clients.get('acme')?.closed, true)
})

test('a failed connection is not cached', async () => {
  const env = createFakeEnv({ workspaces: [PERSONAL, ACME] })
  await env.manager.listWorkspaces()
  const acme = env.workspaces.splice(1, 1)[0] // selectWorkspace now fails for acme
  await assert.rejects(env.manager.getWorkspace('acme'), /Workspace not found/)
  env.workspaces.push(acme)
  assert.equal((await env.manager.getWorkspace('acme')).workspace.uuid, ACME.uuid)
})

test('transactorEndpoint: HULY_TRANSACTOR_URL replaces the public address', async () => {
  const { transactorEndpoint } = await import('../src/connection')
  assert.equal(transactorEndpoint('wss://huly.example.com/_transactor', undefined), 'wss://huly.example.com/_transactor')
  assert.equal(transactorEndpoint('wss://huly.example.com/_transactor', '  '), 'wss://huly.example.com/_transactor')
  assert.equal(transactorEndpoint('wss://huly.example.com/_transactor', 'ws://huly/_transactor/'), 'ws://huly/_transactor')
})

test('prewarm: logs in and opens the only workspace in the background; off, no credentials and failures are quiet', async () => {
  const { prewarm, setConnectionManager, getWorkspace } = await import('../src/connection')
  const creds = { HULY_EMAIL: 'me@example.com', HULY_PASSWORD: 'pw' }
  const one = createFakeEnv({ workspaces: [PERSONAL] })
  setConnectionManager(one.manager)
  assert.equal(await prewarm(creds), 'workspace')
  assert.equal(one.calls.opened.length, 1)
  await getWorkspace() // the first real call reuses the warm connection
  assert.equal(one.calls.opened.length, 1)
  const two = createFakeEnv({ workspaces: [PERSONAL, ACME] })
  setConnectionManager(two.manager)
  assert.equal(await prewarm(creds), 'account')
  assert.equal(two.calls.opened.length, 0, 'several workspaces: only log in, open none')
  assert.equal(await prewarm({ ...creds, HULY_PREWARM: '0' }), 'off')
  assert.equal(await prewarm({}), 'no-credentials')
  const bad = createFakeEnv({ workspaces: [PERSONAL] })
  ;(bad.manager as any).opts.password = 'wrong'
  setConnectionManager(bad.manager)
  assert.equal(await prewarm(creds), 'failed')
  ;(bad.manager as any).opts.password = 'pw'
  assert.equal((await bad.manager.listWorkspaces()).length, 1, 'a failed prewarm does not poison later calls')
  setConnectionManager(null)
})

const jwt = (claims: Record<string, unknown>): string => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`

test('managed API token: stays in its own workspace even if the account has more; expiry is checked up front', async () => {
  const { tokenClaims } = await import('../src/connection')
  const exp = Math.floor(Date.now() / 1000) + 3600
  const api = jwt({ account: 'account-1', workspace: ACME.uuid, extra: { apiTokenId: 'tok-1' }, exp })
  assert.deepEqual(tokenClaims(api), { workspace: ACME.uuid, exp, apiTokenId: 'tok-1' })
  assert.equal(tokenClaims('not-a-jwt'), undefined)

  const { manager, calls } = createFakeEnv({
    workspaces: [PERSONAL, ACME],
    token: api,
    tokenInfo: { account: 'account-1', socialId: 'social-id', token: 'api-inner', workspace: ACME.uuid, workspaceUrl: 'acme', endpoint: 'ws://huly/acme', role: 'USER' }
  })
  assert.deepEqual((await manager.listWorkspaces()).map((w) => w.url), ['acme'])
  assert.deepEqual(calls.getUserWorkspacesTokens, [], 'other workspaces are not enumerated')
  await assert.rejects(manager.getWorkspace('jokeks2023'), /Unknown workspace 'jokeks2023'\. Available: .*acme/)

  const expired = createFakeEnv({ workspaces: [PERSONAL], token: jwt({ exp: Math.floor(Date.now() / 1000) - 60, extra: { apiTokenId: 't' } }), tokenInfo: {} })
  await assert.rejects(expired.manager.listWorkspaces(), /HULY_TOKEN expired on \d{4}-\d{2}-\d{2}\. API token: create a new one in Huly → Settings → API tokens/)
  assert.equal(expired.calls.getLoginInfoByToken, 0)
})
