import contact from '@hcengineering/contact'
import { getAccountClient, getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatPersonName } from '../utils/people'
import type { z } from 'zod'
import type { ListMembersSchema } from '../schemas'

export const listMembers = wrapToolHandler<z.infer<typeof ListMembersSchema>>(async (args) => {
  const accountClient = await getAccountClient(args.workspace)
  const members = await accountClient.getWorkspaceMembers()

  if (members.length === 0) return 'No members found in this workspace.'

  // Account members carry only a person UUID — resolve display names from the workspace.
  let nameByUuid = new Map<string, string>()
  try {
    const client = await getConnection(args.workspace)
    const persons: any[] = await client.findAll(contact.class.Person, {})
    nameByUuid = new Map(persons.filter((p) => p.personUuid != null).map((p) => [String(p.personUuid), formatPersonName(p.name)]))
  } catch {
    // Names are a convenience; the member list itself comes from the account service.
  }

  const lines = members.map((m) => {
    const role = String(m.role ?? 'member')
    const name = nameByUuid.get(String(m.person))
    return `- ${name != null && name !== '' ? `**${name}** ` : ''}\`${m.person}\` — role: **${role}**`
  })

  return `## Workspace Members (${members.length})\n\n${lines.join('\n')}`
})
