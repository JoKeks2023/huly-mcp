import tracker from '@hcengineering/tracker'
import contact from '@hcengineering/contact'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate } from '../utils/format'
import type { z } from 'zod'
import type { LogTimeSchema } from '../schemas'
import { generateId } from '@hcengineering/core'

export const logTime = wrapToolHandler<z.infer<typeof LogTimeSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  // Get current user
  const me = await client.findOne(contact.class.Member, {})
  if (me == null) throw new Error('Could not identify current user.')

  const now = new Date().getTime()
  const valueInHours = args.hours

  await client.addCollection(
    tracker.class.TimeSpendReport,
    issue.space,
    issue._id,
    tracker.class.Issue,
    'reports',
    {
      employee: me._id as unknown as any,
      date: now,
      value: valueInHours,
      description: args.description ?? ''
    },
    generateId()
  )

  return `✅ Logged **${args.hours}h** on **${args.identifier}**${args.description ? ` — "${args.description}"` : ''}`
})
