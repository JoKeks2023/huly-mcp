// admin toolset: modules, huly_api allow-lists and confirmation, setup_workspace plan and reuse.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import { setConnectionManager } from '../src/connection'
import { listModules, setModule, hulyApi, setupWorkspace } from '../src/tools/admin'
import { needsConfirmation } from '../src/guard'
import { createFakeEnv, PERSONAL } from './helpers'

const W = 'jokeks2023'
let env: ReturnType<typeof createFakeEnv>
beforeEach(() => {
  env = createFakeEnv({
    workspaces: [PERSONAL],
    data: {
      [W]: [
        { _id: 'pc-hr', _class: 'core:class:PluginConfiguration', pluginId: 'hr', enabled: false, beta: true },
        { _id: 'pc-tracker', _class: 'core:class:PluginConfiguration', pluginId: 'tracker', enabled: true },
        { _id: 'pc-core', _class: 'core:class:PluginConfiguration', pluginId: 'core', enabled: true, system: true },
        { _id: 'p-1', _class: tracker.class.Project, identifier: 'TSK', name: 'Default', space: 'p-1' },
        { _id: 'c-1', _class: tracker.class.Component, space: 'p-1', label: 'API' },
        { _id: 'ts-1', _class: 'document:class:Teamspace', name: 'Docs' }
      ]
    }
  })
  setConnectionManager(env.manager)
})
afterEach(() => { setConnectionManager(null) })
const text = (r: any): string => r.content[0].text

test('modules: system modules hidden; switch one; unknown names list the real ones', async () => {
  const out = text(await listModules({ workspace: W } as any))
  assert.match(out, /On \(1\):\*\* `tracker`/)
  assert.match(out, /Off \(1\):\*\* `hr` \(beta\)/)
  assert.doesNotMatch(out, /`core`/)
  assert.match(text(await setModule({ workspace: W, module: 'HR', enabled: true } as any)), /`hr` switched on/)
  assert.deepEqual(env.clients.get(W)!.mutations.find((m) => m.op === 'update' || m.op === 'updateDoc')?.data, { enabled: true })
  await assert.rejects(setModule({ workspace: W, module: 'nope', enabled: true } as any), /Available: hr, tracker/)
})

test('huly_api: only listed methods; writes are dry runs by default; confirmation only for real writes', async () => {
  await assert.rejects(hulyApi({ workspace: W, method: 'deleteWorkspace' } as any), /not available here/)
  await assert.rejects(hulyApi({ workspace: W, method: 'changePassword', params: ['a', 'b'] } as any), /not available here/)
  assert.match(text(await hulyApi({ workspace: W, method: 'updateWorkspaceName', params: ['New'] } as any)), /Dry run — would call account service `updateWorkspaceName\("New"\)`/)
  assert.equal(needsConfirmation('huly_api', { method: 'getWorkspaceMembers' }), false)
  assert.equal(needsConfirmation('huly_api', { method: 'updateWorkspaceName', dryRun: true }), false)
  assert.equal(needsConfirmation('huly_api', { method: 'updateWorkspaceName', dryRun: false }), true)
  assert.equal(needsConfirmation('set_module', {}), true)
})

test('setup_workspace: dry run shows the plan; the real run reuses what exists', async () => {
  const args = { workspace: W, projects: [{ identifier: 'TSK', name: 'Default', components: [{ label: 'api' }] }], teamspaces: [{ name: 'docs' }] }
  assert.match(text(await setupWorkspace(args as any)), /Plan for jokeks2023 \(dry run\)[\s\S]*component "api"[\s\S]*teamspace "docs"/)
  const out = text(await setupWorkspace({ ...args, dryRun: false } as any))
  assert.match(out, /project TSK: exists, reused/)
  assert.match(out, /TSK component api: exists, reused/)
  assert.match(out, /teamspace docs: exists, reused/)
  assert.equal(env.clients.get(W)!.mutations.length, 0)
})
