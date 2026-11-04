// Workspace administration: invitations, member roles, settings, project/task types.
// Invites and roles go through the account service (workspace-scoped account client).
import { getAccountClient, getConnection, getWorkspace } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatPersonName, currentAccountUuid } from '../utils/people'
import { reachableUrl } from './sharing'
import type { z } from 'zod'
import type { CreateInviteLinkSchema, SendInviteSchema, SetMemberRoleSchema, GetWorkspaceSettingsSchema, ListProjectTypesSchema } from '../schemas'

export const ROLES = { guest: 'GUEST', user: 'USER', maintainer: 'MAINTAINER', owner: 'OWNER' } as const
const ROLE_NAME: Record<string, string> = { READONLYGUEST: 'read-only guest', DocGuest: 'document guest', GUEST: 'guest', USER: 'user', MAINTAINER: 'maintainer', OWNER: 'owner', ADMIN: 'admin' }

function frontUrl (): string {
  const f = process.env.HULY_FRONT_URL
  if (f == null || f === '') throw new Error('HULY_FRONT_URL is not set — needed to build the invite link.')
  return f.replace(/\/$/, '')
}

export const createInviteLink = wrapToolHandler<z.infer<typeof CreateInviteLinkSchema>>(async (args) => {
  const account: any = await getAccountClient(args.workspace)
  const role = ROLES[args.role ?? 'user']
  const hours = args.expiresHours ?? 48
  if (args.email != null) {
    const link: string = await account.createInviteLink(args.email.trim(), role, false, '', '', undefined, hours)
    return `🔗 Personal invite for ${args.email} as ${args.role ?? 'user'} (one use, ${hours} h):\n${reachableUrl(link)}\nNothing was sent — share the link yourself, or use send_invite.`
  }
  const limit = args.limit ?? 1
  const id: string = await account.createInvite(hours * 3_600_000, args.emailMask ?? '', limit, role)
  const mask = args.emailMask != null && args.emailMask !== '' ? `, only for ${args.emailMask}` : ''
  return `🔗 Invite link as ${args.role ?? 'user'} (${limit} use(s), ${hours} h${mask}):\n${frontUrl()}/login/join?inviteId=${id}`
})

export const sendInvite = wrapToolHandler<z.infer<typeof SendInviteSchema>>(async (args) => {
  const account: any = await getAccountClient(args.workspace)
  const role = ROLES[args.role ?? 'user']
  await account.sendInvite(args.email.trim(), role)
  return `📧 Invitation e-mail sent to ${args.email} (role ${args.role ?? 'user'}).`
})

/** Workspace members with names: account uuid → person name. */
async function membersWithNames (workspace: string | undefined): Promise<Array<{ uuid: string, role: string, name: string }>> {
  const account: any = await getAccountClient(workspace)
  const members: any[] = await account.getWorkspaceMembers()
  const client: any = await getConnection(workspace)
  const persons: any[] = await client.findAll('contact:class:Person', {})
  const names = new Map(persons.filter((p) => p.personUuid != null).map((p) => [String(p.personUuid), formatPersonName(p.name)]))
  return members.map((m) => ({ uuid: String(m.person), role: String(m.role), name: names.get(String(m.person)) ?? '' }))
}

export const setMemberRole = wrapToolHandler<z.infer<typeof SetMemberRoleSchema>>(async (args) => {
  const members = await membersWithNames(args.workspace)
  const q = args.member.trim().toLowerCase()
  const exact = members.filter((m) => m.uuid === args.member.trim() || m.name.toLowerCase() === q)
  const hits = exact.length > 0 ? exact : members.filter((m) => m.name.toLowerCase().includes(q))
  if (hits.length === 0) throw new Error(`Member '${args.member}' not found. Members: ${members.map((m) => m.name || m.uuid).join(', ')}.`)
  if (hits.length > 1) throw new Error(`Member '${args.member}' is ambiguous: ${hits.map((m) => m.name || m.uuid).join(', ')}.`)
  const target = hits[0]
  const role = ROLES[args.role]
  if (target.role === role) return `${target.name || target.uuid} already has role ${args.role}.`
  const account: any = await getAccountClient(args.workspace)
  await account.updateWorkspaceRole(target.uuid, role)
  return `✅ ${target.name || target.uuid}: ${ROLE_NAME[target.role] ?? target.role} → ${args.role}.`
})

export const getWorkspaceSettings = wrapToolHandler<z.infer<typeof GetWorkspaceSettingsSchema>>(async (args) => {
  const conn = await getWorkspace(args.workspace)
  const client: any = conn.client
  const [members, invite, integrations, setting] = await Promise.all([
    membersWithNames(args.workspace),
    client.findOne('setting:class:InviteSettings', {}),
    client.findAll('setting:class:Integration', {}),
    client.findOne('setting:class:WorkspaceSetting', {})
  ])
  const me = await currentAccountUuid(client).catch(() => undefined)
  const byRole = new Map<string, number>()
  for (const m of members) byRole.set(m.role, (byRole.get(m.role) ?? 0) + 1)
  const myRole = members.find((m) => m.uuid === me)?.role
  const lines = [
    `## Workspace ${conn.workspace.name}`,
    `- Slug: \`${conn.workspace.url}\` · id \`${conn.workspace.uuid}\``,
    `- Your role: ${myRole != null ? ROLE_NAME[myRole] ?? myRole : 'unknown'}`,
    `- Members: ${members.length} (${[...byRole].map(([r, n]) => `${n} ${ROLE_NAME[r] ?? r}`).join(', ')})`,
    `- Custom logo: ${setting?.icon != null ? 'yes' : 'no'}`,
    `- Invite defaults: ${invite != null ? `expire after ${invite.expirationTime as number} h, limit ${invite.limit as number}${invite.emailMask != null && invite.emailMask !== '' ? `, e-mail mask ${invite.emailMask as string}` : ''}${invite.enabled === false ? ', invites disabled' : ''}` : 'Huly defaults'}`
  ]
  if (integrations.length > 0) {
    lines.push(`- Integrations: ${integrations.map((i: any) => `${String(i.type).split(':').pop() ?? i.type}${i.disabled === true ? ' (disabled)' : ''}${i.value != null && i.value !== '' ? ` — ${String(i.value)}` : ''}`).join('; ')}`)
  } else lines.push('- Integrations: none')
  return lines.join('\n')
})

const label = (v: unknown): string => { const s = String(v ?? ''); return s.includes(':') ? s.split(':').pop() ?? s : s }

export const listProjectTypes = wrapToolHandler<z.infer<typeof ListProjectTypesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const [types, taskTypes, statuses, projects] = await Promise.all([
    client.findAll('task:class:ProjectType', {}),
    client.findAll('task:class:TaskType', {}),
    client.findAll('core:class:Status', {}),
    client.findAll('task:class:Project', {})
  ])
  const statusById = new Map(statuses.map((s: any) => [s._id, s]))
  const out: string[] = [`## Project types (${types.length as number})`]
  for (const t of types) {
    const used = projects.filter((p: any) => p.type === t._id).map((p: any) => p.identifier ?? p.name)
    out.push('', `### ${t.name as string} — ${label(t.descriptor).replace(/Type$/, '')}${t.classic === true ? ' (classic)' : ''} \`${t._id as string}\``)
    out.push(`Used by: ${used.length > 0 ? used.join(', ') : '—'}`)
    for (const tt of taskTypes.filter((x: any) => x.parent === t._id)) {
      const flow = (tt.statuses ?? []).map((id: string) => {
        const s: any = statusById.get(id)
        return s != null ? `${s.name as string} (${label(s.category)})` : id
      })
      out.push(`- **${tt.name as string}** (${label(tt.ofClass)}): ${flow.join(' → ') || 'no statuses'}`)
    }
  }
  return out.join('\n')
})
