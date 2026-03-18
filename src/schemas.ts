import { z } from 'zod'

const PriorityEnum = z.enum(['NoPriority', 'Urgent', 'High', 'Medium', 'Low'])

export const GetProjectSchema = z.object({
  identifier: z.string().describe('Project identifier, e.g. "PROJ"')
})

export const ListIssuesSchema = z.object({
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  status: z.string().optional().describe('Filter by status name, e.g. "In Progress"'),
  priority: PriorityEnum.optional().describe('Filter by priority'),
  limit: z.number().int().min(1).max(250).default(50).describe('Max issues to return')
})

export const GetIssueSchema = z.object({
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"')
})

export const CreateIssueSchema = z.object({
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  title: z.string().min(1).describe('Issue title'),
  priority: PriorityEnum.default('NoPriority').describe('Issue priority'),
  statusName: z.string().optional().describe('Status name (defaults to project default)'),
  dueDate: z.string().optional().describe('Due date as ISO 8601 string, e.g. "2026-04-01"')
})

export const DeleteIssueSchema = z.object({
  identifier: z.string().describe('Issue identifier to delete, e.g. "PROJ-123"')
})

export const UpdateIssueSchema = z.object({
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  title: z.string().optional().describe('New title'),
  statusName: z.string().optional().describe('New status name'),
  priority: PriorityEnum.optional().describe('New priority'),
  dueDate: z.string().nullable().optional().describe('New due date (ISO 8601) or null to clear'),
  assignee: z.string().nullable().optional().describe('Assignee name (first/last/full) or null to unassign'),
  componentLabel: z.string().optional().describe('Component name to assign, or null to unassign'),
  milestoneLabel: z.string().nullable().optional().describe('Milestone name to assign, or null to clear')
})

export const AddCommentSchema = z.object({
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  message: z.string().min(1).describe('Comment text')
})

export const ListMilestonesSchema = z.object({
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"')
})

const MilestoneStatusEnum = z.enum(['Planned', 'InProgress', 'Completed', 'Canceled'])

export const CreateMilestoneSchema = z.object({
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  label: z.string().min(1).describe('Milestone name'),
  targetDate: z.string().describe('Target date as ISO 8601 string, e.g. "2026-06-01"'),
  status: MilestoneStatusEnum.default('Planned').describe('Milestone status')
})

export const ListComponentsSchema = z.object({
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"')
})

export const CreateComponentSchema = z.object({
  projectIdentifier: z.string().describe('Project identifier, e.g. "PROJ"'),
  label: z.string().min(1).describe('Component name'),
  description: z.string().optional().describe('Component description'),
  lead: z.string().optional().describe('Lead member name (first/last/full)')
})

export const CreateProjectSchema = z.object({
  name: z.string().min(1).describe('Project name, e.g. "My Project"'),
  identifier: z.string().min(1).max(5).regex(/^[A-Z]+$/).describe('Short ALL-CAPS identifier, e.g. "MYPROJ"'),
  description: z.string().optional().describe('Project description')
})

export const DeleteDocumentSchema = z.object({
  documentId: z.string().describe('Document _id to delete (from list_documents)')
})

export const CreateTeamspaceSchema = z.object({
  name: z.string().min(1).describe('Teamspace name'),
  description: z.string().optional().describe('Optional description'),
  isPrivate: z.boolean().default(false).describe('Whether the teamspace is private (default: false = visible to all members)')
})

export const ListDocumentsSchema = z.object({
  teamspaceId: z.string().describe('Teamspace _id from list_teamspaces')
})

export const GetDocumentSchema = z.object({
  documentId: z.string().describe('Document _id from list_documents')
})

export const CreateDocumentSchema = z.object({
  teamspaceId: z.string().describe('Teamspace _id from list_teamspaces'),
  title: z.string().min(1).describe('Document title'),
  parentId: z.string().optional().describe('Parent document _id (for nested docs); omit for top-level')
})

export const SearchIssuesSchema = z.object({
  query: z.string().min(1).describe('Search query'),
  limit: z.number().int().min(1).max(50).default(20).describe('Max results')
})

// ── Labels ────────────────────────────────────────────────────────────────────
export const ListLabelsSchema = z.object({
  projectIdentifier: z.string().optional().describe('Optional project filter (currently returns all workspace labels)')
})

export const CreateLabelSchema = z.object({
  title: z.string().min(1).describe('Label name'),
  color: z.string().optional().describe('Hex color, e.g. "#FF6B6B" (optional)')
})

export const AddLabelSchema = z.object({
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  labelName: z.string().min(1).describe('Label name to add (auto-created if it does not exist)')
})

export const RemoveLabelSchema = z.object({
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  labelName: z.string().min(1).describe('Label name to remove')
})

// ── Relations ─────────────────────────────────────────────────────────────────
export const AddRelationSchema = z.object({
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  relatedTo: z.string().describe('Related issue identifier, e.g. "PROJ-456"')
})

export const AddBlockedBySchema = z.object({
  identifier: z.string().describe('Issue that is blocked, e.g. "PROJ-123"'),
  blockedBy: z.string().describe('Issue that blocks it, e.g. "PROJ-100"')
})

export const SetParentSchema = z.object({
  identifier: z.string().describe('Child issue identifier, e.g. "PROJ-123"'),
  parentIdentifier: z.string().nullable().optional().describe('Parent issue identifier, or null to clear parent')
})

export const ListCommentsSchema = z.object({
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  limit: z.number().int().min(1).max(100).default(20).describe('Max comments to return')
})

export const LogTimeSchema = z.object({
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  hours: z.number().positive().describe('Hours spent (e.g. 2.5)'),
  description: z.string().optional().describe('What was done (optional note)')
})

export const UpdateDocumentSchema = z.object({
  documentId: z.string().describe('Document _id from list_documents or create_document'),
  markdown: z.string().min(1).describe('Markdown content to set as the document body')
})

export const DeleteCommentSchema = z.object({
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  commentId: z.string().describe('Comment _id from list_comments')
})

export const LinkDocumentSchema = z.object({
  identifier: z.string().describe('Issue identifier, e.g. "PROJ-123"'),
  documentId: z.string().describe('Document _id from list_documents or create_document')
})
