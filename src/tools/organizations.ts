import contact, { type Organization } from '@hcengineering/contact'
import { generateId, type Ref } from '@hcengineering/core'
import { getConnection, getWorkspaceInfo } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { markdownToProseMirror, extractText } from '../utils/markdown'
import { uploadMarkupBlob } from '../utils/storage'
import type { z } from 'zod'
import type { ListOrganizationsSchema, GetOrganizationSchema, CreateOrganizationSchema, UpdateOrganizationSchema } from '../schemas'

export const listOrganizations = wrapToolHandler<z.infer<typeof ListOrganizationsSchema>>(async () => {
  const client = await getConnection()
  const orgs = await client.findAll(contact.class.Organization, {})
  if (orgs.length === 0) return 'No organizations found in this workspace.'

  const lines = orgs.map((o) => `- **${o.name}** (id: \`${o._id}\`)${o.city != null && o.city !== '' ? ` — ${o.city}` : ''}`)
  return `## Organizations (${orgs.length})\n\n${lines.join('\n')}`
})

export const getOrganization = wrapToolHandler<z.infer<typeof GetOrganizationSchema>>(async (args) => {
  const client = await getConnection()
  const org = await client.findOne(contact.class.Organization, { _id: args.organizationId as Ref<Organization> })
  if (org == null) throw new Error(`Organization '${args.organizationId}' not found.`)

  const lines = [`## ${org.name}`, `**ID:** \`${org._id}\``]
  if (org.city != null && org.city !== '') lines.push(`**City:** ${org.city}`)
  lines.push(`**Members linked:** ${org.members ?? 0}`)

  if (org.description != null) {
    const frontUrl = process.env.HULY_FRONT_URL
    if (frontUrl != null && frontUrl !== '') {
      const { wsToken, workspaceUuid } = await getWorkspaceInfo()
      const blobUrl = `${frontUrl}/files?file=${encodeURIComponent(org.description)}&workspace=${workspaceUuid}&token=${wsToken}`
      try {
        const res = await fetch(blobUrl)
        if (res.ok) {
          const text = await res.text()
          try {
            const extracted = extractText(JSON.parse(text))
            if (extracted.length > 0) lines.push(`\n**Description:**\n${extracted}`)
          } catch {
            lines.push(`\n**Description (raw):**\n${text.substring(0, 2000)}`)
          }
        }
      } catch {
        lines.push('\n**Description:** _(fetch failed)_')
      }
    } else {
      lines.push(`\n**Description blob ref:** \`${org.description}\``)
    }
  }

  return lines.join('\n')
})

export const createOrganization = wrapToolHandler<z.infer<typeof CreateOrganizationSchema>>(async (args) => {
  const client = await getConnection()

  const existing = await client.findOne(contact.class.Organization, { name: args.name })
  if (existing != null) return `ℹ️ Organization **"${args.name}"** already exists (id: \`${existing._id}\`).`

  const orgId = generateId<Organization>()
  await client.createDoc(
    contact.class.Organization,
    contact.space.Contacts,
    {
      name: args.name,
      city: args.city ?? '',
      description: null,
      members: 0,
      avatar: null
    } as any,
    orgId
  )

  return `✅ Organization **"${args.name}"** created (id: \`${orgId}\`).`
})

export const updateOrganization = wrapToolHandler<z.infer<typeof UpdateOrganizationSchema>>(async (args) => {
  const client = await getConnection()
  const { wsToken, workspaceUuid } = await getWorkspaceInfo()

  const org = await client.findOne(contact.class.Organization, { _id: args.organizationId as Ref<Organization> })
  if (org == null) throw new Error(`Organization '${args.organizationId}' not found.`)

  const prosemirror = markdownToProseMirror(args.description)
  const blobId = `${org._id}-description-${Date.now()}`
  const uploadedId = await uploadMarkupBlob(wsToken, workspaceUuid, blobId, JSON.stringify(prosemirror))

  await client.updateDoc(contact.class.Organization, org.space, org._id, { description: uploadedId } as any)

  return `✅ Organization **"${org.name}"** description updated.`
})
