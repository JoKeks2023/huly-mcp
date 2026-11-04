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

export const SearchAllSchema = z.object({
  workspace: ReadWorkspaceArg,
  query: z.string().min(1),
  kinds: z.array(z.string()).optional().describe('issue, document, message, card, file, person, organization, test-case, attachment or a class id'),
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
  markdown: z.string().min(1).optional().describe('New body (replaces content)'),
  title: z.string().min(1).optional(),
  parentId: z.string().nullable().optional().describe('Move under this document; null = top level'),
  teamspaceId: z.string().optional().describe('Move to this teamspace')
})

export const ListDocumentCommentsSchema = z.object({
  workspace: ReadWorkspaceArg,
  documentId: z.string(),
  limit: z.number().int().min(1).max(200).default(50)
})

export const AddDocumentCommentSchema = z.object({
  workspace: WorkspaceArg,
  documentId: z.string(),
  message: z.string().min(1)
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

// ── 3.0: inbox, activity, planner, calendar, chat, github, contacts, generic ─
const ToDoPriorityEnum = z.enum(['Urgent', 'High', 'Medium', 'Low', 'NoPriority'])
const ProviderEnum = z.enum(['Email', 'Phone', 'LinkedIn', 'Twitter', 'GitHub', 'Facebook', 'Homepage', 'Whatsapp', 'Skype', 'Telegram', 'Viber', 'Profile'])

export const ListNotificationsSchema = z.object({
  workspace: ReadWorkspaceArg,
  unreadOnly: z.boolean().default(true),
  limit: z.number().int().min(1).max(200).default(30)
})

export const MarkNotificationsReadSchema = z.object({
  workspace: WorkspaceArg,
  object: z.string().optional().describe('Issue id or object id: read all its notifications'),
  notificationIds: z.array(z.string()).optional().describe('From list_notifications'),
  all: z.boolean().optional().describe('Mark everything read'),
  archive: z.boolean().default(false).describe('Also archive')
})

export const GetActivitySchema = z.object({
  workspace: ReadWorkspaceArg,
  object: z.string().describe('Issue id (PROJ-1) or object id'),
  limit: z.number().int().min(1).max(200).default(50)
})

export const ListTodosSchema = z.object({
  workspace: ReadWorkspaceArg,
  status: z.enum(['open', 'done', 'all']).default('open'),
  dueBefore: z.string().optional().describe('ISO date'),
  limit: z.number().int().min(1).max(200).default(50)
})

export const CreateTodoSchema = z.object({
  workspace: WorkspaceArg,
  title: z.string().min(1),
  description: z.string().optional().describe('Markdown'),
  dueDate: z.string().optional().describe('ISO date'),
  priority: ToDoPriorityEnum.default('NoPriority'),
  issue: z.string().optional().describe('Issue id to attach the to-do to')
})

export const UpdateTodoSchema = z.object({
  workspace: WorkspaceArg,
  todoId: z.string().describe('From list_todos'),
  title: z.string().min(1).optional(),
  description: z.string().optional().describe('Markdown'),
  dueDate: z.string().nullable().optional(),
  priority: ToDoPriorityEnum.optional(),
  done: z.boolean().optional()
})

export const DeleteTodoSchema = z.object({
  workspace: WorkspaceArg,
  todoId: z.string().describe('From list_todos')
})

export const ScheduleTodoSchema = z.object({
  workspace: WorkspaceArg,
  todoId: z.string().describe('From list_todos'),
  start: z.string().describe('ISO date-time, e.g. 2026-11-03T09:00'),
  durationMinutes: z.number().int().min(5).max(1440).default(30)
})

export const ListEventsSchema = z.object({
  workspace: ReadWorkspaceArg,
  from: z.string().optional().describe('ISO date; default today'),
  to: z.string().optional().describe('ISO date, inclusive; default from + 7 days'),
  limit: z.number().int().min(1).max(200).default(50)
})

export const CreateEventSchema = z.object({
  workspace: WorkspaceArg,
  title: z.string().min(1),
  start: z.string().describe('ISO date-time, or date for allDay'),
  end: z.string().optional().describe('ISO date-time; default start + 1h'),
  allDay: z.boolean().default(false),
  location: z.string().optional(),
  description: z.string().optional().describe('Markdown'),
  participants: z.array(z.string()).optional().describe('Person names; you are always included')
})

export const UpdateEventSchema = z.object({
  workspace: WorkspaceArg,
  eventId: z.string().describe('From list_events'),
  title: z.string().min(1).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional().describe('Markdown')
})

export const DeleteEventSchema = z.object({
  workspace: WorkspaceArg,
  eventId: z.string().describe('From list_events')
})

const MessageIdArg = z.string().describe('Message id (list_messages, list_comments, list_thread)')

export const ListThreadSchema = z.object({
  workspace: ReadWorkspaceArg,
  messageId: MessageIdArg,
  limit: z.number().int().min(1).max(200).default(50)
})

export const ReplyToMessageSchema = z.object({
  workspace: WorkspaceArg,
  messageId: MessageIdArg,
  message: z.string().min(1)
})

export const UpdateMessageSchema = z.object({
  workspace: WorkspaceArg,
  messageId: MessageIdArg,
  message: z.string().min(1)
})

export const DeleteMessageSchema = z.object({
  workspace: WorkspaceArg,
  messageId: MessageIdArg
})

export const ReactionSchema = z.object({
  workspace: WorkspaceArg,
  messageId: MessageIdArg,
  emoji: z.string().min(1).describe('e.g. 👍')
})

export const PinMessageSchema = z.object({
  workspace: WorkspaceArg,
  messageId: MessageIdArg,
  pinned: z.boolean().default(true)
})

export const ListPullRequestsSchema = z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: z.string().optional().describe('Project key'),
  issue: z.string().optional().describe('Issue id the PRs belong to'),
  state: z.enum(['open', 'closed', 'merged', 'all']).default('open'),
  limit: z.number().int().min(1).max(200).default(30)
})

export const GetPullRequestSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().describe('PR id, e.g. PROJ-34')
})

const PersonRef = z.string().describe('Person name or id')

export const ListPersonsSchema = z.object({
  workspace: ReadWorkspaceArg,
  query: z.string().optional().describe('Name filter'),
  employeesOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(500).default(100)
})

export const GetPersonSchema = z.object({
  workspace: ReadWorkspaceArg,
  person: PersonRef
})

export const CreatePersonSchema = z.object({
  workspace: WorkspaceArg,
  firstName: z.string().min(1),
  lastName: z.string().default(''),
  city: z.string().optional(),
  channels: z.array(z.object({ provider: ProviderEnum, value: z.string().min(1) })).optional()
})

export const UpdatePersonSchema = z.object({
  workspace: WorkspaceArg,
  person: PersonRef,
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  city: z.string().optional()
})

export const ContactChannelSchema = z.object({
  workspace: WorkspaceArg,
  person: PersonRef,
  provider: ProviderEnum,
  value: z.string().min(1)
})

export const ListClassesSchema = z.object({
  workspace: ReadWorkspaceArg,
  module: z.string().optional().describe('e.g. recruit, lead, hr, board, drive'),
  withCounts: z.boolean().default(false).describe('Count documents (slower)')
})

export const DescribeClassSchema = z.object({
  workspace: ReadWorkspaceArg,
  className: z.string().describe('e.g. recruit:class:Vacancy')
})

export const QueryDocumentsSchema = z.object({
  workspace: ReadWorkspaceArg,
  className: z.string(),
  query: z.record(z.string(), z.any()).optional().describe('Field equality filter, e.g. {"space":"…"}'),
  fields: z.array(z.string()).optional().describe('Only these fields'),
  limit: z.number().int().min(1).max(200).default(20)
})

export const GenericCreateSchema = z.object({
  workspace: WorkspaceArg,
  className: z.string(),
  space: z.string().describe('Space id the document belongs to'),
  attributes: z.record(z.string(), z.any()),
  attachTo: z.object({ id: z.string(), className: z.string(), collection: z.string() }).optional().describe('For attached docs'),
  dryRun: z.boolean().default(true)
})

export const GenericUpdateSchema = z.object({
  workspace: WorkspaceArg,
  className: z.string(),
  id: z.string(),
  attributes: z.record(z.string(), z.any()),
  dryRun: z.boolean().default(true)
})

export const GenericDeleteSchema = z.object({
  workspace: WorkspaceArg,
  className: z.string(),
  id: z.string(),
  dryRun: z.boolean().default(true),
  confirm: z.boolean().default(false).describe('Must be true to delete')
})

// ── 3.1: agent workflow ──────────────────────────────────────────────────────
export const GetIssueContextSchema = z.object({
  workspace: ReadWorkspaceArg,
  identifier: z.string().describe('Issue id'),
  commentLimit: z.number().int().min(0).max(100).default(20)
})

export const StartWorkSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  statusName: z.string().default('In Progress'),
  assignToMe: z.boolean().default(true),
  claimAs: z.string().optional().describe('Also claim it under this agent name')
})

export const FinishWorkSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  summary: z.string().min(1).describe('Markdown'),
  pullRequest: z.string().optional().describe('#12, URL or Huly id'),
  statusName: z.string().nullable().default('Review in progress').describe('null keeps status')
})

const PlannedIssue = z.object({
  title: z.string().min(1),
  description: z.string().optional().describe('Markdown'),
  priority: PriorityEnum.optional(),
  componentLabel: z.string().optional(),
  milestoneLabel: z.string().optional(),
  assignee: z.string().optional().describe('Person name'),
  labels: z.array(z.string()).optional(),
  blockedBy: z.array(z.string()).optional().describe('"#2" (2nd child) or issue id')
})

export const CreateIssueTreeSchema = z.object({
  workspace: WorkspaceArg,
  projectIdentifier: z.string().describe('Project key'),
  epic: PlannedIssue.pick({ title: true, description: true, priority: true, labels: true }).optional().describe('New epic'),
  epicIdentifier: z.string().optional().describe('Or an existing epic'),
  children: z.array(PlannedIssue).min(1).max(50),
  componentLabel: z.string().optional().describe('Default for children'),
  milestoneLabel: z.string().optional().describe('Default for children'),
  skipDuplicates: z.boolean().default(true).describe('Reuse same-title issues'),
  dryRun: z.boolean().default(true)
})

export const ChangesSinceSchema = z.object({
  workspace: ReadWorkspaceArg,
  since: z.string().describe('ISO date/time or relative: 90m, 24h, 7d'),
  projectIdentifiers: z.array(z.string()).optional().describe('Default: all projects'),
  limit: z.number().int().min(1).max(200).default(50)
})

export const ClaimIssueSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  agent: z.string().optional().describe('Default: HULY_AGENT_NAME or claude'),
  minutes: z.number().int().min(5).max(1440).default(120).describe('Lease length'),
  force: z.boolean().default(false).describe('Take over a foreign claim')
})

export const ReleaseIssueSchema = z.object({
  workspace: WorkspaceArg,
  identifier: z.string().describe('Issue id'),
  agent: z.string().optional()
})

export const FindProjectForRepoSchema = z.object({
  workspace: ReadWorkspaceArg.describe('Default: search all workspaces'),
  repository: z.string().describe('owner/name, GitHub URL or git remote')
})

// ── Sharing: collaborators and public links ─────────────────────────────────
const ObjectArg = z.string().describe('Issue id (PROJ-12) or document id')

export const ListCollaboratorsSchema = z.object({ workspace: ReadWorkspaceArg, object: ObjectArg })

export const AddCollaboratorSchema = z.object({
  workspace: WorkspaceArg,
  object: ObjectArg,
  member: z.string().optional().describe('Name; default: you')
})

export const RemoveCollaboratorSchema = AddCollaboratorSchema

export const CreatePublicLinkSchema = z.object({ workspace: WorkspaceArg, object: ObjectArg })

export const ListPublicLinksSchema = z.object({
  workspace: ReadWorkspaceArg,
  object: ObjectArg.optional().describe('Default: all links'),
  limit: z.number().int().min(1).max(200).default(50)
})

export const RevokePublicLinkSchema = z.object({ workspace: WorkspaceArg, linkId: z.string() })

// ── Cards ───────────────────────────────────────────────────────────────────
const FieldValues = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).describe('Field name → value')

export const ListCardTypesSchema = z.object({ workspace: ReadWorkspaceArg })

export const ListCardsSchema = z.object({
  workspace: ReadWorkspaceArg,
  type: z.string().optional().describe('Card type name or id'),
  parentId: z.string().nullable().optional().describe('Children of this card; null = top level'),
  query: z.string().optional().describe('Title contains'),
  limit: z.number().int().min(1).max(200).default(50)
})

export const GetCardSchema = z.object({ workspace: ReadWorkspaceArg, cardId: z.string() })

export const CreateCardSchema = z.object({
  workspace: WorkspaceArg,
  type: z.string().describe('Card type name or id'),
  title: z.string().min(1),
  content: z.string().optional().describe('Markdown'),
  parentId: z.string().optional(),
  space: z.string().optional().describe('Card space id; default: Default'),
  tags: z.array(z.string()).optional(),
  fields: FieldValues.optional()
})

export const UpdateCardSchema = z.object({
  workspace: WorkspaceArg,
  cardId: z.string(),
  title: z.string().min(1).optional(),
  content: z.string().optional().describe('Markdown; replaces content'),
  parentId: z.string().nullable().optional().describe('Move under this card; null = top level'),
  addTags: z.array(z.string()).optional(),
  fields: FieldValues.optional()
})

export const DeleteCardSchema = z.object({ workspace: WorkspaceArg, cardId: z.string() })

export const CreateCardTypeSchema = z.object({
  workspace: WorkspaceArg,
  name: z.string().min(1),
  kind: z.enum(['type', 'tag']).default('type'),
  parentType: z.string().optional().describe('Subtype of / tag for this type')
})

export const DeleteCardTypeSchema = z.object({ workspace: WorkspaceArg, type: z.string().describe('Card type or tag') })

// ── Custom fields ───────────────────────────────────────────────────────────
const FieldTarget = z.string().describe('"issue", project key, card type/tag or class id')

export const ListCustomFieldsSchema = z.object({
  workspace: ReadWorkspaceArg,
  target: FieldTarget.optional(),
  object: z.string().optional().describe('Show values of this issue/card instead')
})

export const CreateCustomFieldSchema = z.object({
  workspace: WorkspaceArg,
  target: FieldTarget,
  label: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date', 'markup', 'enum', 'ref']),
  enumValues: z.array(z.string()).optional(),
  refClass: z.string().optional().describe('For ref, e.g. contact:mixin:Employee')
})

export const SetCustomFieldsSchema = z.object({
  workspace: WorkspaceArg,
  object: z.string().describe('Issue id, card id or document id'),
  fields: FieldValues
})
