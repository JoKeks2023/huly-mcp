// Components and milestones by name: exact (case-insensitive) first, else a unique partial match
// ("Backend" → "API Backend"). Ambiguous or unknown names list the candidates, so one retry works.
import tracker from '@hcengineering/tracker'

const KIND = {
  component: { cls: tracker.class.Component, what: 'Component' },
  milestone: { cls: tracker.class.Milestone, what: 'Milestone' }
} as const

export async function findByLabel (client: any, kind: keyof typeof KIND, space: string, label: string, projectKey?: string): Promise<any> {
  const { cls, what } = KIND[kind]
  const all: any[] = await client.findAll(cls, { space })
  const q = label.trim().toLowerCase()
  const where = projectKey != null ? ` in project ${projectKey}` : ' in this project'
  const exact = all.filter((d) => String(d.label).toLowerCase() === q)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) throw new Error(`${what} name '${label}' is ambiguous${where} (${exact.length} with that name).`)
  const partial = q.length >= 2 ? all.filter((d) => String(d.label).toLowerCase().includes(q)) : []
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) throw new Error(`${what} '${label}' matches several${where}: ${partial.map((d) => d.label).join(', ')}. Use the full name.`)
  const names = all.map((d) => d.label).slice(0, 20)
  throw new Error(`${what} '${label}' not found${where}. ${names.length > 0 ? `Available: ${names.join(', ')}.` : `The project has no ${kind}s yet.`}`)
}
