import { listWorkspaces as discoverWorkspaces } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type { ListWorkspacesSchema } from '../schemas'

export const listWorkspaces = wrapToolHandler<z.infer<typeof ListWorkspacesSchema>>(async () => {
  const workspaces = await discoverWorkspaces()
  if (workspaces.length === 0) return 'No Huly workspaces are accessible with these credentials.'

  const lines = workspaces.map((w) => {
    const flags = [
      w.isDisabled === true ? 'disabled' : null,
      w.mode != null && w.mode !== 'active' ? `mode: ${w.mode}` : null
    ].filter(Boolean)
    return `- **${w.name}** — slug: \`${w.url}\` — id: \`${w.uuid}\`${flags.length > 0 ? ` (${flags.join(', ')})` : ''}`
  })
  return `## Workspaces (${workspaces.length})\n\n${lines.join('\n')}\n\nPass the slug (or name/id) as \`workspace\` to other tools.`
})
