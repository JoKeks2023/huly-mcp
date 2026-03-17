import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listProjects, getProject, createProject } from './tools/projects'
import { listIssues, getIssue, createIssue, updateIssue, deleteIssue } from './tools/issues'
import { addComment, listComments, deleteComment } from './tools/comments'
import { logTime } from './tools/log-time'
import { listMembers } from './tools/members'
import { listMilestones, createMilestone } from './tools/milestones'
import { listTeamspaces, listDocuments, getDocument, createDocument, updateDocument, linkDocument } from './tools/documents'
import { searchIssues } from './tools/search'
import { listLabels, createLabel, addLabel, removeLabel } from './tools/labels'
import { addRelation, addBlockedBy, setParent } from './tools/relations'
import { listComponents, createComponent } from './tools/components'
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
  CreateComponentSchema
} from './schemas'

export function createServer (): McpServer {
  const server = new McpServer({ name: 'huly-mcp', version: '0.4.0' })

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
  server.tool('list_documents', 'List documents in a teamspace', ListDocumentsSchema.shape, listDocuments)
  server.tool('get_document', 'Get metadata and content of a document (content requires HULY_FRONT_URL env)', GetDocumentSchema.shape, getDocument)
  server.tool('create_document', 'Create a new document in a teamspace', CreateDocumentSchema.shape, createDocument)
  server.tool('update_document', 'Set or replace the content of a document from Markdown (supports headings, paragraphs, code blocks, tables, bullet lists)', UpdateDocumentSchema.shape, updateDocument)
  server.tool('link_document', 'Link a Huly document to an issue — appears in the Relations panel on the issue', LinkDocumentSchema.shape, linkDocument)

  // Search
  server.tool('search_issues', 'Full-text search across all issues', SearchIssuesSchema.shape, searchIssues)

  return server
}
