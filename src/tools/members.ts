import { getAccountClient } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type { ListMembersSchema } from '../schemas'

export const listMembers = wrapToolHandler<z.infer<typeof ListMembersSchema>>(async (args) => {
  const accountClient = await getAccountClient(args.workspace)
  const members = await accountClient.getWorkspaceMembers()

  if (members.length === 0) return 'No members found in this workspace.'

  const lines = members.map((m) => {
    const role = String(m.role ?? 'member')
    return `- \`${m.person}\` — role: **${role}**`
  })

  return `## Workspace Members (${members.length})\n\n${lines.join('\n')}`
})
