import { z } from 'zod'

// Every tool names its workspace. Entity IDs (issue identifiers, document IDs, …)
// are only unique within a workspace, so the workspace is part of their identity.
// Mutations always require it; reads may omit it only when exactly one
// workspace is available.
const WorkspaceArg = z.string().min(1).describe('Workspace slug/name/id')
const ReadWorkspaceArg = z.string().min(1).optional().describe('Workspace slug/name/id (optional if only one)')

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
  identifier: z.string().describe('Project key')
})

export const ListIssuesSchema = z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: z.string().describe('Project key'),
  status: z.string().optional().describe('Status name'),
  priority: PriorityEnum.optional().describe('Filter by priority'),
  milestoneLabel: z.string().min(1).nullable().optional().describe('Milestone name; null = none'),
  componentLabel: z.string().min(1).nullable().optional().describe('Component name; null = none'),
  labelName: z.string().min(1).optional().describe('Filter by label name'),
  assignee: z.string().min(1).nullable().optional().describe('Person name; null = unassigned'),
  parentIdentifier: z.string().min(1).nullable().optional().describe('Direct sub-issues of this issue; null = top-level only'),
  limit: z.number().int().min(1).max(250).default(50)
})

export const GetIssueSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().describe('Issue id')
})

export const CreateIssueSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project key'),
  title: z.string().min(1).describe('Issue title'),
  description: z.string().optional().describe('Issue description as Markdown (headings, bold, code, lists, tables, mermaid supported)'),
  priority: PriorityEnum.default('NoPriority').describe('Issue priority'),
  statusName: z.string().optional().describe('Default: project default'),
  dueDate: z.string().optional().describe('Due date as ISO 8601 string, e.g. "2026-04-01"')
})

export const DeleteIssueSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue identifier to delete, e.g. "PROJ-123"')
})

export const UpdateIssueSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  title: z.string().optional(),
  description: z.string().optional().describe('Markdown, replaces existing'),
  statusName: z.string().optional(),
  priority: PriorityEnum.optional(),
  dueDate: z.string().nullable().optional().describe('null clears'),
  assignee: z.string().nullable().optional().describe('Person name; null clears'),
  componentLabel: z.string().nullable().optional().describe('Component name; null clears'),
  milestoneLabel: z.string().nullable().optional().describe('Milestone name; null clears')
})

export const AddCommentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  message: z.string().min(1)
})

export const ListMilestonesSchema = z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: z.string().describe('Project key')
})

const MilestoneStatusEnum = z.enum(['Planned', 'InProgress', 'Completed', 'Canceled'])

export const CreateMilestoneSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project key'),
  label: z.string().min(1),
  targetDate: z.string().describe('ISO date'),
  status: MilestoneStatusEnum.default('Planned')
})

export const GetMilestoneSchema = z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: z.string().describe('Project key'),
  label: z.string().min(1)
})

export const UpdateMilestoneSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project key'),
  label: z.string().min(1),
  newLabel: z.string().min(1).optional(),
  targetDate: z.string().optional().describe('ISO date'),
  status: MilestoneStatusEnum.optional(),
  description: z.string().nullable().optional().describe('Markdown; null clears')
})

export const DeleteMilestoneSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project key'),
  label: z.string().min(1),
  moveIssuesTo: z.string().min(1).optional().describe('Move its issues here; omitted = issues lose the milestone')
})

export const ListComponentsSchema = z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: z.string().describe('Project key')
})

export const CreateComponentSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project key'),
  label: z.string().min(1),
  description: z.string().optional(),
  lead: z.string().optional().describe('Person name')
})

export const UpdateComponentSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project key'),
  label: z.string().min(1),
  newLabel: z.string().min(1).optional(),
  description: z.string().nullable().optional().describe('Markdown; null clears'),
  lead: z.string().nullable().optional().describe('Person name; null clears')
})

export const DeleteComponentSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project key'),
  label: z.string().min(1),
  moveIssuesTo: z.string().min(1).optional().describe('Move its issues here; omitted = issues lose the component')
})

export const CreateProjectSchema = z.object({
  workspace: WorkspaceArg,
  name: z.string().min(1).describe('Project name'),
  identifier: z.string().min(1).max(5).regex(/^[A-Z]+$/).describe('ALL-CAPS key, max 5 letters'),
  description: z.string().optional()
})

export const DeleteDocumentSchema = z.object({
  workspace: WorkspaceArg,
  documentId: z.string().describe('Document _id to delete (from list_documents)')
})

export const CreateTeamspaceSchema = z.object({
  workspace: WorkspaceArg,
  name: z.string().min(1),
  description: z.string().optional(),
  isPrivate: z.boolean().default(false).describe('Private teamspace')
})

export const ListDocumentsSchema = z.object({
  workspace: ReadWorkspaceArg,
  teamspaceId: z.string().describe('Teamspace id')
})

export const GetDocumentSchema = z.object({
  workspace: ReadWorkspaceArg,
  documentId: z.string().describe('Document _id from list_documents')
})

export const CreateDocumentSchema = z.object({
  workspace: WorkspaceArg,
  teamspaceId: z.string().describe('Teamspace id'),
  title: z.string().min(1),
  parentId: z.string().optional().describe('Parent document id; omit for top-level')
})

export const SearchIssuesSchema = z.object({
  workspace: ReadWorkspaceArg,
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(20)
})

// ── Labels ────────────────────────────────────────────────────────────────────
export const ListLabelsSchema = z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: z.string().optional().describe('Ignored (labels are workspace-wide)')
})

export const CreateLabelSchema = z.object({
  workspace: WorkspaceArg,
  title: z.string().min(1),
  color: z.string().optional().describe('Hex color, e.g. #FF6B6B')
})

export const AddLabelSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  labelName: z.string().min(1).describe('Label name to add (auto-created if it does not exist)')
})

export const RemoveLabelSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  labelName: z.string().min(1)
})

// ── Relations ─────────────────────────────────────────────────────────────────
export const AddRelationSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  relatedTo: z.string().describe('Related issue id')
})

export const AddBlockedBySchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Blocked issue id'),
  blockedBy: z.string().describe('Issue that blocks it, e.g. "PROJ-100"')
})

export const SetParentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Child issue identifier, e.g. "PROJ-123"'),
  parentIdentifier: z.string().nullable().optional().describe('Parent issue id; null clears')
})

export const ListCommentsSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().describe('Issue id'),
  limit: z.number().int().min(1).max(100).default(20)
})

export const LogTimeSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  hours: z.number().positive().describe('Hours spent (e.g. 2.5)'),
  description: z.string().optional().describe('Note')
})

export const UpdateDocumentSchema = z.object({
  workspace: WorkspaceArg,
  documentId: z.string().describe('Document id'),
  markdown: z.string().min(1).describe('Markdown body')
})

export const DeleteCommentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  commentId: z.string().describe('Comment _id from list_comments')
})

export const LinkDocumentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  documentId: z.string().describe('Document id')
})

// ── Chat (Channels & Direct Messages) ──────────────────────────────────────

export const ListChannelsSchema = z.object({
  workspace: ReadWorkspaceArg,
  includeArchived: z.boolean().default(false).describe('Include archived channels')
})

export const CreateChannelSchema = z.object({
  workspace: WorkspaceArg,
  name: z.string().min(1),
  topic: z.string().optional().describe('Optional channel topic/description'),
  isPrivate: z.boolean().default(false).describe('Invite-only')
})

export const StartDirectMessageSchema = z.object({
  workspace: WorkspaceArg,
  member: z.string().min(1).describe('Person name')
})

export const SendMessageSchema = z.object({
  workspace: WorkspaceArg,
  spaceId: z.string().describe('Channel or direct-message _id, from list_channels/create_channel/start_direct_message'),
  message: z.string().min(1)
})

export const ListMessagesSchema = z.object({
  workspace: ReadWorkspaceArg,
  spaceId: z.string().describe('Channel or direct-message _id'),
  limit: z.number().int().min(1).max(200).default(50)
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
  identifier: z.string().describe('Issue id')
})

export const DeleteAttachmentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  attachmentId: z.string().describe('Attachment _id from list_attachments')
})

// ── Issue Statuses (custom workflow states) ────────────────────────────────

const StatusCategoryEnum = z.enum(['Backlog', 'Todo', 'InProgress', 'Done', 'Cancelled'])

export const ListIssueStatusesSchema = z.object({
  workspace: ReadWorkspaceArg
})

export const CreateIssueStatusSchema = z.object({
  workspace: WorkspaceArg,
  name: z.string().min(1).describe('Status name'),
  category: StatusCategoryEnum.describe('Status phase'),
  color: z.string().optional().describe('Hex color, e.g. #FF6B6B')
})

// ── Organizations (contacts/CRM) ────────────────────────────────────────────

export const ListOrganizationsSchema = z.object({
  workspace: ReadWorkspaceArg
})

export const GetOrganizationSchema = z.object({
  workspace: ReadWorkspaceArg,
  organizationId: z.string().describe('Organization id')
})

export const CreateOrganizationSchema = z.object({
  workspace: WorkspaceArg,
  name: z.string().min(1),
  city: z.string().optional().describe('City (optional)')
})

export const UpdateOrganizationSchema = z.object({
  workspace: WorkspaceArg,
  organizationId: z.string().describe('Organization id'),
  description: z.string().describe('Markdown, replaces existing')
})

// ── 2.2.0 additions ──────────────────────────────────────────────────────────
const IssueRef = z.string().describe('Issue id')

export const BulkUpdateIssuesSchema = z.object({
  workspace: WorkspaceArg,
  identifiers: z.array(z.string().min(1)).min(1).max(100).describe('Issue ids'),
  statusName: z.string().optional(),
  priority: PriorityEnum.optional(),
  dueDate: z.string().nullable().optional().describe('null clears'),
  assignee: z.string().nullable().optional().describe('Person name; null clears'),
  componentLabel: z.string().nullable().optional().describe('Component name; null clears'),
  milestoneLabel: z.string().nullable().optional().describe('Milestone name; null clears')
})

export const MoveIssueSchema = z.object({
  workspace: WorkspaceArg,
  identifier: IssueRef,
  targetProjectIdentifier: z.string().describe('Target project key'),
  statusName: z.string().optional().describe('Default: keep current')
})

export const ListSubIssuesSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().describe('Parent issue id'),
  depth: z.number().int().min(1).max(10).default(5).describe('Levels')
})

export const RemoveRelationSchema = z.object({
  workspace: WorkspaceArg,
  identifier: IssueRef,
  relatedTo: z.string().describe('Related issue id')
})

export const RemoveBlockedBySchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Blocked issue id'),
  blockedBy: z.string().describe('Blocking issue to remove, e.g. "PROJ-100"')
})

export const UpdateCommentSchema = z.object({
  workspace: WorkspaceArg,
  identifier: IssueRef,
  commentId: z.string().min(1).describe('From list_comments'),
  message: z.string().min(1)
})

export const UpdateLabelSchema = z.object({
  workspace: WorkspaceArg,
  labelName: z.string().min(1),
  newName: z.string().min(1).optional(),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional().describe('Hex color'),
  description: z.string().optional()
})

export const DeleteLabelSchema = z.object({
  workspace: WorkspaceArg,
  labelName: z.string().min(1)
})

export const UpdateProjectSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Project key'),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  defaultAssignee: z.string().nullable().optional().describe('Person name; null clears'),
  defaultStatus: z.string().optional().describe('Status name')
})

export const ListTimeReportsSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().optional().describe('Issue id (without sub-issues)'),
  projectIdentifier: z.string().optional().describe('Project key (all its issues)'),
  member: z.string().optional().describe('Person name'),
  from: z.string().optional().describe('ISO date'),
  to: z.string().optional().describe('ISO date, inclusive'),
  limit: z.number().int().min(1).max(500).default(100)
})

export const RepairParentLinksSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project key'),
  dryRun: z.boolean().default(true).describe('false applies the repair')
})
