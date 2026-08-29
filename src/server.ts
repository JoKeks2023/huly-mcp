import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listProjects, getProject, createProject } from './tools/projects'
import { listIssues, getIssue, createIssue, updateIssue, deleteIssue } from './tools/issues'
import { addComment, listComments, deleteComment } from './tools/comments'
import { logTime } from './tools/log-time'
import { listMembers } from './tools/members'
import { listMilestones, createMilestone } from './tools/milestones'
import { listTeamspaces, createTeamspace, listDocuments, getDocument, createDocument, deleteDocument, updateDocument, linkDocument } from './tools/documents'
import { searchIssues } from './tools/search'
import { listLabels, createLabel, addLabel, removeLabel } from './tools/labels'
import { addRelation, addBlockedBy, setParent } from './tools/relations'
import { listComponents, createComponent } from './tools/components'
import { listChannels, createChannel, startDirectMessage, sendMessage, listMessages } from './tools/channels'
import { attachFile, listAttachments, deleteAttachment } from './tools/attachments'
import { listIssueStatuses, createIssueStatus } from './tools/statuses'
import { listOrganizations, getOrganization, createOrganization, updateOrganization } from './tools/organizations'
import {
  GetProjectSchema,
  CreateProjectSchema,
  ListIssuesSchema,
  GetIssueSchema,
  CreateIssueSchema,
  UpdateIssueSchema,
  DeleteIssueSchema,
  AddCommentSchema,
  ListCommentsSchema,
  LogTimeSchema,
  ListMilestonesSchema,
  CreateMilestoneSchema,
  ListDocumentsSchema,
  GetDocumentSchema,
  CreateDocumentSchema,
  UpdateDocumentSchema,
  DeleteCommentSchema,
  LinkDocumentSchema,
  SearchIssuesSchema,
  ListLabelsSchema,
  CreateLabelSchema,
  AddLabelSchema,
  RemoveLabelSchema,
  AddRelationSchema,
  AddBlockedBySchema,
  SetParentSchema,
  ListComponentsSchema,
  CreateComponentSchema,
  CreateTeamspaceSchema,
  DeleteDocumentSchema,
  ListChannelsSchema,
  CreateChannelSchema,
  StartDirectMessageSchema,
  SendMessageSchema,
  ListMessagesSchema,
  AttachFileSchema,
  ListAttachmentsSchema,
  DeleteAttachmentSchema,
  ListIssueStatusesSchema,
  CreateIssueStatusSchema,
  ListOrganizationsSchema,
  GetOrganizationSchema,
  CreateOrganizationSchema,
  UpdateOrganizationSchema
} from './schemas'

const SERVER_INSTRUCTIONS = `
This server manages a Huly workspace (issue tracker, docs, chat) — self-hosted or cloud.

## Projects & issues
- Projects are identified by a short ALL-CAPS key (e.g. "PROJ"), issues by "PROJ-123". Use list_projects
  before create_project if you don't already know the target project's key.
- get_issue returns full details including current status/priority — read it before update_issue rather
  than guessing field values.
- Epics are just issues: set_parent nests one issue under another to build an epic/sub-issue hierarchy.
- Custom issue statuses (list_issue_statuses / create_issue_status) are workspace-global, not per-project —
  check existing statuses before creating a near-duplicate.

## Comments
- list_comments returns comment IDs; delete_comment requires one of those IDs, not an issue identifier.

## Chat
- list_channels / list_messages read existing channels and DMs. start_direct_message matches 'member'
  against person names (substring, case-insensitive) — pass a display name, not an email or account ID.

## Documents
- Documents live in teamspaces (list_teamspaces / create_teamspace first if none exist yet).
- update_document replaces the full body — read the current content with get_document first if you need
  to append or edit rather than overwrite.

## Attachments
- attach_file takes base64-encoded file content (contentBase64), not a URL or local path — read/encode
  the file first. list_attachments before delete_attachment to get the attachment ID.

## General
- Prefer search_issues over list_issues when the user describes an issue by content rather than by project.
- This is a fork with self-hosted fixes (document/description writes, chat, attachments, statuses,
  organizations) not present upstream — see https://github.com/JoKeks2023/huly-mcp for the full tool list.
`.trim()

export function createServer (): McpServer {
  const server = new McpServer({ name: 'huly-mcp-selfhost', version: '1.0.0' }, { instructions: SERVER_INSTRUCTIONS })

  // Projects
  server.tool('list_projects', 'List all projects in the Huly workspace', {}, listProjects)
  server.tool('get_project', 'Get a project by its identifier (e.g. "PROJ")', GetProjectSchema.shape, getProject)
  server.tool('create_project', 'Create a new tracker project with a unique ALL-CAPS identifier', CreateProjectSchema.shape, createProject)

  // Issues
  server.tool('list_issues', 'List issues in a project with optional filters', ListIssuesSchema.shape, listIssues)
  server.tool('get_issue', 'Get full details of an issue by identifier (e.g. "PROJ-123")', GetIssueSchema.shape, getIssue)
  server.tool('create_issue', 'Create a new issue in a project', CreateIssueSchema.shape, createIssue)
  server.tool('update_issue', 'Update an existing issue (title, status, priority, due date, assignee, component, milestone)', UpdateIssueSchema.shape, updateIssue)
  server.tool('delete_issue', 'Permanently delete an issue by identifier (e.g. "PROJ-123")', DeleteIssueSchema.shape, deleteIssue)

  // Comments
  server.tool('add_comment', 'Add a comment to an issue', AddCommentSchema.shape, addComment)
  server.tool('list_comments', 'List all comments on an issue (includes comment IDs for use with delete_comment)', ListCommentsSchema.shape, listComments)
  server.tool('delete_comment', 'Delete a specific comment from an issue by its ID (get IDs from list_comments)', DeleteCommentSchema.shape, deleteComment)

  // Time tracking
  server.tool('log_time', 'Log hours spent on an issue', LogTimeSchema.shape, logTime)

  // Labels
  server.tool('list_labels', 'List all labels in the workspace', ListLabelsSchema.shape, listLabels)
  server.tool('create_label', 'Create a new label with an optional hex color', CreateLabelSchema.shape, createLabel)
  server.tool('add_label', 'Add a label to an issue (auto-creates the label if it does not exist)', AddLabelSchema.shape, addLabel)
  server.tool('remove_label', 'Remove a label from an issue', RemoveLabelSchema.shape, removeLabel)

  // Relations
  server.tool('add_relation', 'Mark two issues as related to each other (bidirectional)', AddRelationSchema.shape, addRelation)
  server.tool('add_blocked_by', 'Mark an issue as blocked by another issue', AddBlockedBySchema.shape, addBlockedBy)
  server.tool('set_parent', 'Set or clear the parent (epic) of an issue', SetParentSchema.shape, setParent)

  // Members
  server.tool('list_members', 'List all members in the workspace', {}, listMembers)

  // Milestones
  server.tool('list_milestones', 'List milestones for a project', ListMilestonesSchema.shape, listMilestones)
  server.tool('create_milestone', 'Create a new milestone in a project with a target date', CreateMilestoneSchema.shape, createMilestone)

  // Components
  server.tool('list_components', 'List components (sub-areas) in a project', ListComponentsSchema.shape, listComponents)
  server.tool('create_component', 'Create a new component in a project', CreateComponentSchema.shape, createComponent)

  // Documents
  server.tool('list_teamspaces', 'List all document teamspaces in the workspace', {}, listTeamspaces)
  server.tool('create_teamspace', 'Create a new document teamspace (a top-level folder for documents)', CreateTeamspaceSchema.shape, createTeamspace)
  server.tool('list_documents', 'List documents in a teamspace', ListDocumentsSchema.shape, listDocuments)
  server.tool('get_document', 'Get metadata and content of a document (content requires HULY_FRONT_URL env)', GetDocumentSchema.shape, getDocument)
  server.tool('create_document', 'Create a new document in a teamspace', CreateDocumentSchema.shape, createDocument)
  server.tool('delete_document', 'Permanently delete a document by its ID', DeleteDocumentSchema.shape, deleteDocument)
  server.tool('update_document', 'Set or replace the content of a document from Markdown (supports headings, paragraphs, code blocks, tables, bullet lists)', UpdateDocumentSchema.shape, updateDocument)
  server.tool('link_document', 'Link a Huly document to an issue — appears in the Relations panel on the issue', LinkDocumentSchema.shape, linkDocument)

  // Search
  server.tool('search_issues', 'Full-text search across all issues', SearchIssuesSchema.shape, searchIssues)

  // Chat (Channels & Direct Messages)
  server.tool('list_channels', 'List all channels in the workspace', ListChannelsSchema.shape, listChannels)
  server.tool('create_channel', 'Create a new channel', CreateChannelSchema.shape, createChannel)
  server.tool('start_direct_message', 'Start (or find) a 1:1 direct message with a workspace member', StartDirectMessageSchema.shape, startDirectMessage)
  server.tool('send_message', 'Send a message to a channel or direct message', SendMessageSchema.shape, sendMessage)
  server.tool('list_messages', 'List messages in a channel or direct message', ListMessagesSchema.shape, listMessages)

  // Attachments
  server.tool('attach_file', 'Attach a file to an issue (base64-encoded content)', AttachFileSchema.shape, attachFile)
  server.tool('list_attachments', 'List files attached to an issue', ListAttachmentsSchema.shape, listAttachments)
  server.tool('delete_attachment', 'Delete a file attachment from an issue', DeleteAttachmentSchema.shape, deleteAttachment)

  // Issue Statuses (custom workflow states)
  server.tool('list_issue_statuses', 'List all issue statuses (workflow states), grouped by phase', {}, listIssueStatuses)
  server.tool('create_issue_status', 'Create a new issue status — becomes available in every project immediately', CreateIssueStatusSchema.shape, createIssueStatus)

  // Organizations (contacts/CRM)
  server.tool('list_organizations', 'List all organizations (companies) in the workspace', {}, listOrganizations)
  server.tool('get_organization', 'Get details of an organization, including description', GetOrganizationSchema.shape, getOrganization)
  server.tool('create_organization', 'Create a new organization (company contact)', CreateOrganizationSchema.shape, createOrganization)
  server.tool('update_organization', 'Set the description of an organization from Markdown', UpdateOrganizationSchema.shape, updateOrganization)

  return server
}
