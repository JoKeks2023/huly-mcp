// Workspace and account administration (toolset "admin"): modules, workspace settings, your
// profile, new workspaces, a template to set a workspace up, and huly_api — the account service
// directly, like `gh api`, limited to a list of methods. Deleting workspaces or accounts, logins,
// passwords and secrets are deliberately not reachable.
import type { z } from 'zod'
import { getAccountClient, getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { redactSecrets } from '../utils/redact'
import { createProject } from './projects'
import { createComponent } from './components'
import { createMilestone } from './milestones'
import { createTeamspace } from './documents'
import { createIssueStatus } from './statuses'
import type * as S from '../schemas'

// ── Modules ───────────────────────────────────────────────────────────────────

/** Modules a person can switch in Huly's Settings → Configure (hidden and system ones are left out). */
async function configurableModules (client: any): Promise<any[]> {
  const all: any[] = await client.findAll('core:class:PluginConfiguration', {})
  return all.filter((c) => c.hidden !== true && c.system !== true).sort((a, b) => String(a.pluginId).localeCompare(String(b.pluginId)))
}

export const listModules = wrapToolHandler<z.infer<typeof S.ListModulesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const mods = await configurableModules(client)
  const on = mods.filter((m) => m.enabled !== false)
  const off = mods.filter((m) => m.enabled === false)
  const fmt = (m: any): string => `\`${String(m.pluginId)}\`${m.beta === true ? ' (beta)' : ''}`
  return `## Modules\n\n**On (${on.length}):** ${on.map(fmt).join(', ')}\n\n**Off (${off.length}):** ${off.map(fmt).join(', ') || '—'}\n\nSwitch with set_module.`
})

export const setModule = wrapToolHandler<z.infer<typeof S.SetModuleSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const mods = await configurableModules(client)
  const m = mods.find((x) => String(x.pluginId).toLowerCase() === args.module.trim().toLowerCase())
  if (m == null) throw new Error(`Module '${args.module}' not found. Available: ${mods.map((x) => x.pluginId).join(', ')}.`)
  if ((m.enabled !== false) === args.enabled) return `\`${String(m.pluginId)}\` is already ${args.enabled ? 'on' : 'off'}.`
  await client.update(m, { enabled: args.enabled })
  return `✅ Module \`${String(m.pluginId)}\` switched ${args.enabled ? 'on' : 'off'} for everyone in the workspace${m.beta === true ? ' (beta module)' : ''}.`
})

// ── Workspace settings ────────────────────────────────────────────────────────

export const updateWorkspaceSettings = wrapToolHandler<z.infer<typeof S.UpdateWorkspaceSettingsSchema>>(async (args) => {
  const account: any = await getAccountClient(args.workspace)
  const done: string[] = []
  if (args.name != null) { await account.updateWorkspaceName(args.name.trim()); done.push(`name → ${args.name.trim()}`) }
  if (args.readOnlyGuests != null) { await account.updateAllowReadOnlyGuests(args.readOnlyGuests); done.push(`read-only guests ${args.readOnlyGuests ? 'allowed' : 'not allowed'}`) }
  if (args.guestSignUp != null) { await account.updateAllowGuestSignUp(args.guestSignUp); done.push(`guest sign-up ${args.guestSignUp ? 'allowed' : 'not allowed'}`) }
  if (args.passwordAgingDays != null) { await account.updatePasswordAgingRule(args.passwordAgingDays); done.push(args.passwordAgingDays > 0 ? `passwords expire after ${args.passwordAgingDays} days` : 'password expiry off') }
  if (done.length === 0) throw new Error('Nothing to change: pass name, readOnlyGuests, guestSignUp or passwordAgingDays.')
  return `✅ Workspace updated: ${done.join('; ')}.`
})

// ── Profile ───────────────────────────────────────────────────────────────────

export const getMyProfile = wrapToolHandler<z.infer<typeof S.GetMyProfileSchema>>(async (args) => {
  const account: any = await getAccountClient(args.workspace)
  const [person, profile, ids]: any[] = await Promise.all([account.getPerson(), account.getUserProfile().catch(() => null), account.getSocialIds().catch(() => [])])
  const lines = [`## ${[person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Your profile'}`]
  if (profile != null) {
    for (const [k, label] of [['bio', 'Bio'], ['city', 'City'], ['country', 'Country'], ['website', 'Website']] as const) if (profile[k] != null && profile[k] !== '') lines.push(`- **${label}:** ${String(profile[k])}`)
    for (const [k, v] of Object.entries(profile.socialLinks ?? {})) lines.push(`- **${k}:** ${String(v)}`)
    lines.push(`- **Public profile:** ${profile.isPublic === true ? 'yes' : 'no'}`)
  }
  const socials = (ids as any[]).filter((s) => s.isDeleted !== true).map((s) => `${String(s.type)}: ${String(s.displayValue ?? s.value)}${s.verifiedOn != null ? '' : ' (unverified)'}`)
  if (socials.length > 0) lines.push('', '**Logins and identities:**', ...socials.map((s) => `- ${s}`))
  return lines.join('\n')
})

export const updateMyProfile = wrapToolHandler<z.infer<typeof S.UpdateMyProfileSchema>>(async (args) => {
  const account: any = await getAccountClient(args.workspace)
  const done: string[] = []
  if (args.firstName != null || args.lastName != null) {
    const person = await account.getPerson()
    await account.changeUsername(args.firstName ?? person.firstName ?? '', args.lastName ?? person.lastName ?? '')
    done.push('name')
  }
  const profile: Record<string, unknown> = {}
  for (const k of ['bio', 'city', 'country', 'website', 'socialLinks', 'isPublic'] as const) if (args[k] !== undefined) profile[k] = args[k]
  if (Object.keys(profile).length > 0) { await account.setMyProfile(profile); done.push(...Object.keys(profile)) }
  if (done.length === 0) throw new Error('Nothing to change: pass firstName, lastName, bio, city, country, website, socialLinks or isPublic.')
  return `✅ Profile updated — changed: ${done.join(', ')}.`
})

// ── New workspace ─────────────────────────────────────────────────────────────

export const createWorkspace = wrapToolHandler<z.infer<typeof S.CreateWorkspaceSchema>>(async (args) => {
  const account: any = await getAccountClient()
  const info: any = await account.createWorkspace(args.name.trim(), args.region)
  return `✅ Workspace **${args.name.trim()}** created${info?.workspaceUrl != null ? ` (slug \`${String(info.workspaceUrl)}\`)` : ''}. Huly sets it up in the background — it can take a minute before tools can use it. You are its owner.`
})

// ── huly_api: the account service directly ────────────────────────────────────

/** Methods that only read. */
export const API_READ = ['getProviders', 'getUserWorkspaces', 'getWorkspaceInfo', 'getWorkspacesInfo', 'getRegionInfo', 'getPerson', 'getPersonInfo', 'getSocialIds', 'getWorkspaceMembers', 'getUserProfile', 'getInviteInfo', 'isReadOnlyGuest', 'getMailboxOptions', 'getMailboxes', 'listIntegrations', 'getIntegration', 'findPersonBySocialKey', 'findPersonBySocialId', 'findSocialIdBySocialKey', 'findFullSocialIdBySocialKey', 'findFullSocialIds', 'getAccountInfo', 'checkPasswordAging', 'canMergeSpecifiedPersons'] as const
/** Methods that change something: dry run by default, and they ask first where the client can ask. */
export const API_WRITE = ['updateWorkspaceName', 'updateAllowReadOnlyGuests', 'updateAllowGuestSignUp', 'updatePasswordAgingRule', 'changeUsername', 'setMyProfile', 'sendInvite', 'resendInvite', 'createInvite', 'createInviteLink', 'createAccessLink', 'updateWorkspaceRole', 'createWorkspace', 'createMailbox', 'deleteMailbox', 'updateSocialId'] as const

export const hulyApi = wrapToolHandler<z.infer<typeof S.HulyApiSchema>>(async (args) => {
  const method = args.method.trim()
  const params = args.params ?? []
  const isRead = (API_READ as readonly string[]).includes(method)
  const isWrite = (API_WRITE as readonly string[]).includes(method)
  if (!isRead && !isWrite) {
    throw new Error(`Method '${method}' is not available here. Read: ${API_READ.join(', ')}. Write: ${API_WRITE.join(', ')}. (Deleting workspaces/accounts, logins, passwords and secrets are deliberately excluded.)`)
  }
  if (isWrite && args.dryRun !== false) {
    return `Dry run — would call account service \`${method}(${params.map((p) => JSON.stringify(p)).join(', ')})\`. Run again with dryRun: false to do it.`
  }
  const account: any = await getAccountClient(args.workspace)
  if (typeof account[method] !== 'function') throw new Error(`This Huly version's account service has no method '${method}'.`)
  const result = await account[method](...params)
  const text = result === undefined ? '(no result)' : JSON.stringify(redactSecrets(result), null, 2)
  return `\`${method}\`${isWrite ? ' done' : ''}:\n\n\`\`\`json\n${text.length > 20_000 ? `${text.slice(0, 20_000)}\n… (${text.length} chars, shortened)` : text}\n\`\`\``
})

// ── Set a workspace up from a template ────────────────────────────────────────

const ok = (r: any): string => String(r?.content?.[0]?.text ?? '').split('\n')[0]

export const setupWorkspace = wrapToolHandler<z.infer<typeof S.SetupWorkspaceSchema>>(async (args) => {
  const ws = args.workspace
  const plan: string[] = []
  for (const m of args.modules?.enable ?? []) plan.push(`module ${m} on`)
  for (const m of args.modules?.disable ?? []) plan.push(`module ${m} off`)
  for (const s of args.statuses ?? []) plan.push(`issue status "${s.name}" (${s.category})${s.projectIdentifier != null ? ` for ${s.projectIdentifier}'s workflow` : ''}`)
  for (const p of args.projects ?? []) {
    plan.push(`project ${p.identifier} "${p.name}"`)
    for (const c of p.components ?? []) plan.push(`  component "${c.label}"`)
    for (const m of p.milestones ?? []) plan.push(`  milestone "${m.label}" → ${m.targetDate}`)
  }
  for (const t of args.teamspaces ?? []) plan.push(`teamspace "${t.name}"`)
  if (plan.length === 0) throw new Error('Empty template: pass modules, statuses, projects or teamspaces.')
  if (args.dryRun !== false) return `## Plan for ${ws} (dry run)\n\n${plan.map((l) => `- ${l}`).join('\n')}\n\nRun again with dryRun: false. Existing projects, components, milestones and statuses are reused, not duplicated.`

  const log: string[] = []
  const step = async (label: string, fn: () => Promise<any>): Promise<void> => {
    try { log.push(`- ${label}: ${ok(await fn())}`) } catch (e) { log.push(`- ${label}: ⚠️ ${(e as Error).message.replace(/^Huly MCP: /, '')}`) }
  }
  for (const m of args.modules?.enable ?? []) await step(`module ${m}`, async () => await setModule({ workspace: ws, module: m, enabled: true } as any))
  for (const m of args.modules?.disable ?? []) await step(`module ${m}`, async () => await setModule({ workspace: ws, module: m, enabled: false } as any))
  const client: any = await getConnection(ws)
  const exists = (what: string): { content: Array<{ text: string }> } => ({ content: [{ text: `exists, reused (${what})` }] })
  for (const p of args.projects ?? []) {
    await step(`project ${p.identifier}`, async () => (await client.findOne('tracker:class:Project', { identifier: p.identifier })) != null
      ? exists('project')
      : await createProject({ workspace: ws, identifier: p.identifier, name: p.name, description: p.description } as any))
  }
  for (const s of args.statuses ?? []) {
    await step(`status ${s.name}`, async () => await createIssueStatus({ workspace: ws, name: s.name, category: s.category, projectIdentifier: s.projectIdentifier ?? args.projects?.[0]?.identifier } as any))
  }
  for (const p of args.projects ?? []) {
    const project = await client.findOne('tracker:class:Project', { identifier: p.identifier })
    const labels = async (cls: string): Promise<Set<string>> => new Set(project == null ? [] : ((await client.findAll(cls, { space: project._id })) as any[]).map((d) => String(d.label).toLowerCase()))
    const comps = await labels('tracker:class:Component')
    const miles = await labels('tracker:class:Milestone')
    for (const c of p.components ?? []) await step(`${p.identifier} component ${c.label}`, async () => comps.has(c.label.toLowerCase()) ? exists('component') : await createComponent({ workspace: ws, projectIdentifier: p.identifier, label: c.label, description: c.description } as any))
    for (const m of p.milestones ?? []) await step(`${p.identifier} milestone ${m.label}`, async () => miles.has(m.label.toLowerCase()) ? exists('milestone') : await createMilestone({ workspace: ws, projectIdentifier: p.identifier, label: m.label, targetDate: m.targetDate, status: 'Planned' } as any))
  }
  const spaces = new Set(((await client.findAll('document:class:Teamspace', {})) as any[]).map((t) => String(t.name).toLowerCase()))
  for (const t of args.teamspaces ?? []) await step(`teamspace ${t.name}`, async () => spaces.has(t.name.toLowerCase()) ? exists('teamspace') : await createTeamspace({ workspace: ws, name: t.name, description: t.description, isPrivate: false } as any))
  return `## ${ws} set up\n\n${log.join('\n')}`
})
