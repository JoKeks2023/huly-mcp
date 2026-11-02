import { z } from 'zod'

// Every tool names its workspace. Entity IDs (issue identifiers, document IDs, …)
// are only unique within a workspace, so the workspace is part of their identity.
// Mutations always require it; reads may omit it only when exactly one
// workspace is available.
const WorkspaceArg = z.string().min(1).describe('Target workspace (slug, name or ID from list_workspaces). Required for every change.')
const ReadWorkspaceArg = z.string().min(1).optional().describe('Workspace (slug, name or ID from list_workspaces). May be omitted only if exactly one workspace is available.')

const PriorityEnum = z.enum(['NoPriority', 'Urgent', 'High', 'Medium', 'Low'])

export const ListWorkspacesSchema = z.object({})

export const ListProjectsSchema = z.object({
  workspace: ReadWorkspaceArg
})

export const ListMembersSchema = z.object({
  workspace: ReadWorkspaceArg
})

export const ListTeamspacesSchema = z.object({
  workspace: ReadWorkspaceArg
})

export const GetProjectSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().describe('Project identifier, e.g. "PROJ"')
})

export const ListIssuesSchema = z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  status: z.string().optional().describe('Filter by status name, e.g. "In Progress"'),
  priority: PriorityEnum.optional().describe('Filter by priority'),
  milestoneLabel: z.string().min(1).nullable().optional().describe('Filter by milestone name; null = issues without milestone'),
  componentLabel: z.string().min(1).nullable().optional().describe('Filter by component name; null = issues without component'),
  labelName: z.string().min(1).optional().describe('Filter by label name'),
  assignee: z.string().min(1).nullable().optional().describe('Filter by assignee name (first/last/full); null = unassigned'),
  parentIdentifier: z.string().min(1).nullable().optional().describe('Only direct sub-issues of this issue, e.g. "PROJ-1"; null = only top-level issues'),
  limit: z.number().int().min(1).max(250).default(50).describe('Max issues to return')
})

export const GetIssueSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"')
})

export const CreateIssueSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  title: z.string().min(1).describe('Issue title'),
  description: z.string().optional().describe('Issue description as Markdown (headings, bold, code, lists, tables, mermaid supported)'),
  priority: PriorityEnum.default('NoPriority').describe('Issue priority'),
  statusName: z.string().optional().describe('Status name (defaults to project default)'),
  dueDate: z.string().optional().describe('Due date as ISO 8601 string, e.g. "2026-04-01"')
})

export const DeleteIssueSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier to delete, e.g. "PROJ-123"')
})

export const UpdateIssueSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  title: z.string().optional().describe('New title'),
  description: z.string().optional().describe('New description as Markdown (replaces existing content)'),
  statusName: z.string().optional().describe('New status name'),
  priority: PriorityEnum.optional().describe('New priority'),
  dueDate: z.string().nullable().optional().describe('New due date (ISO 8601) or null to clear'),
  assignee: z.string().nullable().optional().describe('Assignee name (first/last/full) or null to unassign'),
  componentLabel: z.string().nullable().optional().describe('Component name to assign, or null to unassign'),
  milestoneLabel: z.string().nullable().optional().describe('Milestone name to assign, or null to clear')
})

export const AddCommentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  message: z.string().min(1).describe('Comment text')
})

export const ListMilestonesSchema = z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"')
})

const MilestoneStatusEnum = z.enum(['Planned', 'InProgress', 'Completed', 'Canceled'])

export const CreateMilestoneSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  label: z.string().min(1).describe('Milestone name'),
  targetDate: z.string().describe('Target date as ISO 8601 string, e.g. "2026-06-01"'),
  status: MilestoneStatusEnum.default('Planned').describe('Milestone status')
})

export const GetMilestoneSchema = z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  label: z.string().min(1).describe('Milestone name')
})

export const UpdateMilestoneSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  label: z.string().min(1).describe('Current milestone name'),
  newLabel: z.string().min(1).optional().describe('New milestone name'),
  targetDate: z.string().optional().describe('New target date as ISO 8601 string, e.g. "2026-06-01"'),
  status: MilestoneStatusEnum.optional().describe('New milestone status'),
  description: z.string().nullable().optional().describe('New description as Markdown, or null to clear')
})

export const DeleteMilestoneSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  label: z.string().min(1).describe('Milestone name to delete'),
  moveIssuesTo: z.string().min(1).optional().describe('Milestone name to move its issues to. If omitted, the issues keep existing but lose their milestone.')
})

export const ListComponentsSchema = z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"')
})

export const CreateComponentSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  label: z.string().min(1).describe('Component name'),
  description: z.string().optional().describe('Component description'),
  lead: z.string().optional().describe('Lead member name (first/last/full)')
})

export const UpdateComponentSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  label: z.string().min(1).describe('Current component name'),
  newLabel: z.string().min(1).optional().describe('New component name'),
  description: z.string().nullable().optional().describe('New description as Markdown, or null to clear'),
  lead: z.string().nullable().optional().describe('Lead member name (first/last/full), or null to clear')
})

export const DeleteComponentSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  label: z.string().min(1).describe('Component name to delete'),
  moveIssuesTo: z.string().min(1).optional().describe('Component name to move its issues to. If omitted, the issues keep existing but lose their component.')
})

export const CreateProjectSchema = z.object({
  workspace: WorkspaceArg,
  name: z.string().min(1).describe('Project name, e.g. "My Project"'),
  identifier: z.string().min(1).max(5).regex(/^[A-Z]+$/).describe('Short ALL-CAPS identifier, e.g. "MYPROJ"'),
  description: z.string().optional().describe('Project description')
})

export const DeleteDocumentSchema = z.object({
  workspace: WorkspaceArg,
  documentId: z.string().describe('Document _id to delete (from list_documents)')
})

export const CreateTeamspaceSchema = z.object({
  workspace: WorkspaceArg,
  name: z.string().min(1).describe('Teamspace name'),
  description: z.string().optional().describe('Optional description'),
  isPrivate: z.boolean().default(false).describe('Whether the teamspace is private (default: false = visible to all members)')
})

export const ListDocumentsSchema = z.object({
  workspace: ReadWorkspaceArg,
  teamspaceId: z.string().describe('Teamspace _id from list_teamspaces')
})

export const GetDocumentSchema = z.object({
  workspace: ReadWorkspaceArg,
  documentId: z.string().describe('Document _id from list_documents')
})

export const CreateDocumentSchema = z.object({
  workspace: WorkspaceArg,
  teamspaceId: z.string().describe('Teamspace _id from list_teamspaces'),
  title: z.string().min(1).describe('Document title'),
  parentId: z.string().optional().describe('Parent document _id (for nested docs); omit for top-level')
})

export const SearchIssuesSchema = z.object({
  workspace: ReadWorkspaceArg,
  query: z.string().min(1).describe('Search query'),
  limit: z.number().int().min(1).max(50).default(20).describe('Max results')
})

// ── Labels ────────────────────────────────────────────────────────────────────
export const ListLabelsSchema = z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: z.string().optional().describe('Optional project filter (currently returns all workspace labels)')
})

export const CreateLabelSchema = z.object({
  workspace: WorkspaceArg,
  title: z.string().min(1).describe('Label name'),
  color: z.string().optional().describe('Hex color, e.g. "#FF6B6B" (optional)')
})

export const AddLabelSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  labelName: z.string().min(1).describe('Label name to add (auto-created if it does not exist)')
})

export const RemoveLabelSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  labelName: z.string().min(1).describe('Label name to remove')
})

// ── Relations ─────────────────────────────────────────────────────────────────
export const AddRelationSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  relatedTo: z.string().describe('Related issue identifier, e.g. "PROJ-456"')
})

export const AddBlockedBySchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue that is blocked, e.g. "PROJ-123"'),
  blockedBy: z.string().describe('Issue that blocks it, e.g. "PROJ-100"')
})

export const SetParentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Child issue identifier, e.g. "PROJ-123"'),
  parentIdentifier: z.string().nullable().optional().describe('Parent issue identifier, or null to clear parent')
})

export const ListCommentsSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  limit: z.number().int().min(1).max(100).default(20).describe('Max comments to return')
})

export const LogTimeSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  hours: z.number().positive().describe('Hours spent (e.g. 2.5)'),
  description: z.string().optional().describe('What was done (optional note)')
})

export const UpdateDocumentSchema = z.object({
  workspace: WorkspaceArg,
  documentId: z.string().describe('Document _id from list_documents or create_document'),
  markdown: z.string().min(1).describe('Markdown content to set as the document body')
})

export const DeleteCommentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  commentId: z.string().describe('Comment _id from list_comments')
})

export const LinkDocumentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  documentId: z.string().describe('Document _id from list_documents or create_document')
})

// ── Chat (Channels & Direct Messages) ──────────────────────────────────────

export const ListChannelsSchema = z.object({
  workspace: ReadWorkspaceArg,
  includeArchived: z.boolean().default(false).describe('Include archived channels')
})

export const CreateChannelSchema = z.object({
  workspace: WorkspaceArg,
  name: z.string().min(1).describe('Channel name'),
  topic: z.string().optional().describe('Optional channel topic/description'),
  isPrivate: z.boolean().default(false).describe('Whether the channel is private (invite-only)')
})

export const StartDirectMessageSchema = z.object({
  workspace: WorkspaceArg,
  member: z.string().min(1).describe('Name (first/last/full) of the workspace member to message')
})

export const SendMessageSchema = z.object({
  workspace: WorkspaceArg,
  spaceId: z.string().describe('Channel or direct-message _id, from list_channels/create_channel/start_direct_message'),
  message: z.string().min(1).describe('Message text')
})

export const ListMessagesSchema = z.object({
  workspace: ReadWorkspaceArg,
  spaceId: z.string().describe('Channel or direct-message _id'),
  limit: z.number().int().min(1).max(200).default(50).describe('Max messages to return')
})

// ── Attachments ─────────────────────────────────────────────────────────────

export const AttachFileSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier to attach the file to, e.g. "PROJ-123"'),
  filename: z.string().min(1).describe('File name, e.g. "screenshot.png"'),
  contentBase64: z.string().min(1).describe('File content, base64-encoded'),
  mimeType: z.string().default('application/octet-stream').describe('MIME type, e.g. "image/png"')
})

export const ListAttachmentsSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"')
})

export const DeleteAttachmentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  attachmentId: z.string().describe('Attachment _id from list_attachments')
})

// ── Issue Statuses (custom workflow states) ────────────────────────────────

const StatusCategoryEnum = z.enum(['Backlog', 'Todo', 'InProgress', 'Done', 'Cancelled'])

export const ListIssueStatusesSchema = z.object({
  workspace: ReadWorkspaceArg
})

export const CreateIssueStatusSchema = z.object({
  workspace: WorkspaceArg,
  name: z.string().min(1).describe('Status name, e.g. "Waiting for review"'),
  category: StatusCategoryEnum.describe('Which phase this status belongs to (determines grouping/color in the UI)'),
  color: z.string().optional().describe('Hex color, e.g. "#FF6B6B" (optional)')
})

// ── Organizations (contacts/CRM) ────────────────────────────────────────────

export const ListOrganizationsSchema = z.object({
  workspace: ReadWorkspaceArg
})

export const GetOrganizationSchema = z.object({
  workspace: ReadWorkspaceArg,
  organizationId: z.string().describe('Organization _id from list_organizations')
})

export const CreateOrganizationSchema = z.object({
  workspace: WorkspaceArg,
  name: z.string().min(1).describe('Organization name'),
  city: z.string().optional().describe('City (optional)')
})

export const UpdateOrganizationSchema = z.object({
  workspace: WorkspaceArg,
  organizationId: z.string().describe('Organization _id from list_organizations'),
  description: z.string().describe('New description as Markdown (replaces existing content)')
})

// ── 2.2.0 additions ──────────────────────────────────────────────────────────
const IssueRef = z.string().describe('Issue identifier, e.g. "PROJ-123"')

export const BulkUpdateIssuesSchema = z.object({
  workspace: WorkspaceArg,
  identifiers: z.array(z.string().min(1)).min(1).max(100).describe('Issue identifiers to update, e.g. ["PROJ-1", "PROJ-2"]'),
  statusName: z.string().optional().describe('New status name'),
  priority: PriorityEnum.optional().describe('New priority'),
  dueDate: z.string().nullable().optional().describe('New due date (ISO 8601) or null to clear'),
  assignee: z.string().nullable().optional().describe('Assignee name (first/last/full) or null to unassign'),
  componentLabel: z.string().nullable().optional().describe('Component name to assign, or null to unassign'),
  milestoneLabel: z.string().nullable().optional().describe('Milestone name to assign, or null to clear')
})

export const MoveIssueSchema = z.object({
  workspace: WorkspaceArg,
  identifier: IssueRef,
  targetProjectIdentifier: z.string().describe('Project to move the issue to, e.g. "OTHER"'),
  statusName: z.string().optional().describe('Status in the target project (default: keep current status)')
})

export const ListSubIssuesSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().describe('Parent issue (epic) identifier, e.g. "PROJ-1"'),
  depth: z.number().int().min(1).max(10).default(5).describe('How many levels of sub-issues to show')
})

export const RemoveRelationSchema = z.object({
  workspace: WorkspaceArg,
  identifier: IssueRef,
  relatedTo: z.string().describe('Related issue identifier to unlink, e.g. "PROJ-456"')
})

export const RemoveBlockedBySchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue that is blocked, e.g. "PROJ-123"'),
  blockedBy: z.string().describe('Blocking issue to remove, e.g. "PROJ-100"')
})

export const UpdateCommentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: IssueRef,
  commentId: z.string().min(1).describe('Comment ID (from list_comments)'),
  message: z.string().min(1).describe('New comment text')
})

export const UpdateLabelSchema = z.object({
  workspace: WorkspaceArg,
  labelName: z.string().min(1).describe('Current label name'),
  newName: z.string().min(1).optional().describe('New label name'),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional().describe('New hex color, e.g. "#FF6B6B"'),
  description: z.string().optional().describe('New label description')
})

export const DeleteLabelSchema = z.object({
  workspace: WorkspaceArg,
  labelName: z.string().min(1).describe('Label name to delete — it is removed from every issue that has it')
})

export const UpdateProjectSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  name: z.string().min(1).optional().describe('New project name'),
  description: z.string().optional().describe('New project description'),
  defaultAssignee: z.string().nullable().optional().describe('Default assignee for new issues (member name), or null to clear'),
  defaultStatus: z.string().optional().describe('Default status name for new issues')
})

export const ListTimeReportsSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().optional().describe('Issue identifier — list reports of this issue (sub-issues not included)'),
  projectIdentifier: z.string().optional().describe('Project identifier — list reports of all issues in this project'),
  member: z.string().optional().describe('Only reports of this member (name)'),
  from: z.string().optional().describe('Only reports on/after this date (ISO 8601)'),
  to: z.string().optional().describe('Only reports on/before this date (ISO 8601)'),
  limit: z.number().int().min(1).max(500).default(100).describe('Max reports to list')
})

export const RepairParentLinksSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  dryRun: z.boolean().default(true).describe('Only list what would be repaired (default). Set false to apply.')
})
