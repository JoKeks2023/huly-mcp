// Issue statuses are workspace-wide documents, but each project type allows only some of them per
// task type ("kind"). Example: a GitHub-synced workspace adds "Review in progress" and "Merged" for
// pull requests only — an issue set to one of those is reset to the default status by Huly later.
import tracker from '@hcengineering/tracker'

/** Statuses an issue of this kind may have in this project (all statuses if the type says nothing). */
export async function allowedIssueStatuses (client: any, project: any, kind?: string): Promise<any[]> {
  const all: any[] = await client.findAll(tracker.class.IssueStatus, {})
  const type = project?.type != null ? await client.findOne('task:class:ProjectType', { _id: project.type }) : undefined
  const entries: Array<{ _id: string, taskType?: string }> = type?.statuses ?? []
  if (entries.length === 0) return all
  const ids = new Set(entries.filter((e) => kind == null || e.taskType == null || e.taskType === kind).map((e) => e._id))
  const allowed = all.filter((s) => ids.has(s._id))
  return allowed.length > 0 ? allowed : all
}

/** The status called `name` that this issue may have; a clear error otherwise. */
export async function resolveIssueStatus (client: any, project: any, kind: string | undefined, name: string): Promise<any> {
  const allowed = await allowedIssueStatuses(client, project, kind)
  const hit = allowed.find((s) => String(s.name).toLowerCase() === name.trim().toLowerCase())
  if (hit != null) return hit
  const elsewhere = ((await client.findAll(tracker.class.IssueStatus, {})) as any[]).some((s) => String(s.name).toLowerCase() === name.trim().toLowerCase())
  const names = [...new Set(allowed.map((s) => s.name))].join(', ')
  throw new Error(elsewhere
    ? `Status '${name}' is not used for issues in ${String(project?.identifier ?? 'this project')} (it belongs to another task type, e.g. pull requests). Available: ${names}.`
    : `Status '${name}' not found. Available: ${names}.`)
}
