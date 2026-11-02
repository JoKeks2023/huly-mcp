// Every tool, with the toolset it belongs to. server.ts registers the enabled toolsets.
// Keep descriptions short — every word is sent to the model in every session (see test/budget.test.ts).
import type { z } from 'zod'
import { listWorkspaces } from './tools/workspaces'
import { listProjects, getProject, createProject, updateProject } from './tools/projects'
import { listIssues, getIssue, createIssue, updateIssue, deleteIssue, bulkUpdateIssues, moveIssue, listSubIssues } from './tools/issues'
import { addComment, listComments, deleteComment, updateComment } from './tools/comments'
import { logTime, listTimeReports } from './tools/log-time'
import { listLabels, createLabel, addLabel, removeLabel, updateLabel, deleteLabel } from './tools/labels'
import { addRelation, addBlockedBy, setParent, removeRelation, removeBlockedBy, repairParentLinks } from './tools/relations'
import { listMembers } from './tools/members'
import { listMilestones, createMilestone, getMilestone, updateMilestone, deleteMilestone } from './tools/milestones'
import { listComponents, createComponent, updateComponent, deleteComponent } from './tools/components'
import { listTeamspaces, createTeamspace, listDocuments, getDocument, createDocument, deleteDocument, updateDocument, linkDocument } from './tools/documents'
import { searchIssues } from './tools/search'
import { listChannels, createChannel, startDirectMessage, sendMessage, listMessages } from './tools/channels'
import { attachFile, listAttachments, deleteAttachment } from './tools/attachments'
import { listIssueStatuses, createIssueStatus } from './tools/statuses'
import { listOrganizations, getOrganization, createOrganization, updateOrganization } from './tools/organizations'
import * as S from './schemas'

export const TOOLSETS = ['core', 'tracker', 'documents', 'chat', 'contacts'] as const
export type Toolset = typeof TOOLSETS[number]

/** Enabled when HULY_TOOLSETS is not set. 'core' is always enabled. */
export const DEFAULT_TOOLSETS: Toolset[] = ['tracker', 'documents', 'chat', 'contacts']

export interface ToolDef {
  name: string
  toolset: Toolset
  description: string
  schema: z.ZodObject<any>
  handler: (args: any) => Promise<{ content: Array<{ type: 'text', text: string }> }>
}

export const TOOLS: ToolDef[] = [
  { name: 'list_workspaces', toolset: 'core', description: 'List accessible workspaces (name, slug, id)', schema: S.ListWorkspacesSchema, handler: listWorkspaces },
  { name: 'list_projects', toolset: 'tracker', description: 'List all projects in a Huly workspace', schema: S.ListProjectsSchema, handler: listProjects },
  { name: 'get_project', toolset: 'tracker', description: 'Get a project by its identifier (e.g. "PROJ")', schema: S.GetProjectSchema, handler: getProject },
  { name: 'create_project', toolset: 'tracker', description: 'Create a tracker project', schema: S.CreateProjectSchema, handler: createProject },
  { name: 'update_project', toolset: 'tracker', description: 'Update project name, description, default assignee/status', schema: S.UpdateProjectSchema, handler: updateProject },
  { name: 'list_issues', toolset: 'tracker', description: 'List issues of a project; filters: status, priority, milestone, component, label, assignee, parent', schema: S.ListIssuesSchema, handler: listIssues },
  { name: 'get_issue', toolset: 'tracker', description: 'Get full details of an issue by identifier (e.g. "PROJ-123")', schema: S.GetIssueSchema, handler: getIssue },
  { name: 'create_issue', toolset: 'tracker', description: 'Create a new issue in a project', schema: S.CreateIssueSchema, handler: createIssue },
  { name: 'update_issue', toolset: 'tracker', description: 'Update issue fields', schema: S.UpdateIssueSchema, handler: updateIssue },
  { name: 'delete_issue', toolset: 'tracker', description: 'Permanently delete an issue by identifier (e.g. "PROJ-123")', schema: S.DeleteIssueSchema, handler: deleteIssue },
  { name: 'bulk_update_issues', toolset: 'tracker', description: 'Apply one change to many issues; validates all first', schema: S.BulkUpdateIssuesSchema, handler: bulkUpdateIssues },
  { name: 'move_issue', toolset: 'tracker', description: 'Move issue (incl. sub-issues, comments, files, time) to another project; gets a new id, component/milestone cleared', schema: S.MoveIssueSchema, handler: moveIssue },
  { name: 'list_sub_issues', toolset: 'tracker', description: 'Sub-issue tree of an issue with progress', schema: S.ListSubIssuesSchema, handler: listSubIssues },
  { name: 'add_comment', toolset: 'tracker', description: 'Add a comment to an issue', schema: S.AddCommentSchema, handler: addComment },
  { name: 'list_comments', toolset: 'tracker', description: 'List comments of an issue (with ids)', schema: S.ListCommentsSchema, handler: listComments },
  { name: 'delete_comment', toolset: 'tracker', description: 'Delete a comment by id', schema: S.DeleteCommentSchema, handler: deleteComment },
  { name: 'update_comment', toolset: 'tracker', description: 'Edit a comment by id', schema: S.UpdateCommentSchema, handler: updateComment },
  { name: 'log_time', toolset: 'tracker', description: 'Log hours spent on an issue', schema: S.LogTimeSchema, handler: logTime },
  { name: 'list_time_reports', toolset: 'tracker', description: 'Logged time for an issue or project, totals per person; person/date filters', schema: S.ListTimeReportsSchema, handler: listTimeReports },
  { name: 'list_labels', toolset: 'tracker', description: 'List all labels in the workspace', schema: S.ListLabelsSchema, handler: listLabels },
  { name: 'create_label', toolset: 'tracker', description: 'Create a new label with an optional hex color', schema: S.CreateLabelSchema, handler: createLabel },
  { name: 'add_label', toolset: 'tracker', description: 'Add label to issue (auto-creates label)', schema: S.AddLabelSchema, handler: addLabel },
  { name: 'remove_label', toolset: 'tracker', description: 'Remove a label from an issue', schema: S.RemoveLabelSchema, handler: removeLabel },
  { name: 'update_label', toolset: 'tracker', description: 'Rename/recolor a label (on every issue)', schema: S.UpdateLabelSchema, handler: updateLabel },
  { name: 'delete_label', toolset: 'tracker', description: 'Delete a label and remove it from every issue', schema: S.DeleteLabelSchema, handler: deleteLabel },
  { name: 'add_relation', toolset: 'tracker', description: 'Mark two issues as related to each other (bidirectional)', schema: S.AddRelationSchema, handler: addRelation },
  { name: 'add_blocked_by', toolset: 'tracker', description: 'Mark an issue as blocked by another issue', schema: S.AddBlockedBySchema, handler: addBlockedBy },
  { name: 'set_parent', toolset: 'tracker', description: 'Set or clear the parent (epic) of an issue', schema: S.SetParentSchema, handler: setParent },
  { name: 'remove_relation', toolset: 'tracker', description: 'Remove the "related" link between two issues', schema: S.RemoveRelationSchema, handler: removeRelation },
  { name: 'remove_blocked_by', toolset: 'tracker', description: 'Remove a "blocked by" link from an issue', schema: S.RemoveBlockedBySchema, handler: removeBlockedBy },
  { name: 'repair_parent_links', toolset: 'tracker', description: 'Fix sub-issues from huly-mcp <=2.1 not shown under their parent (dry run by default)', schema: S.RepairParentLinksSchema, handler: repairParentLinks },
  { name: 'list_members', toolset: 'contacts', description: 'List all members in the workspace', schema: S.ListMembersSchema, handler: listMembers },
  { name: 'list_milestones', toolset: 'tracker', description: 'List milestones for a project', schema: S.ListMilestonesSchema, handler: listMilestones },
  { name: 'create_milestone', toolset: 'tracker', description: 'Create a new milestone in a project with a target date', schema: S.CreateMilestoneSchema, handler: createMilestone },
  { name: 'get_milestone', toolset: 'tracker', description: 'Milestone with progress and open issues', schema: S.GetMilestoneSchema, handler: getMilestone },
  { name: 'update_milestone', toolset: 'tracker', description: 'Update a milestone (name, target date, status, description)', schema: S.UpdateMilestoneSchema, handler: updateMilestone },
  { name: 'delete_milestone', toolset: 'tracker', description: 'Delete milestone; its issues are unassigned or moved (moveIssuesTo)', schema: S.DeleteMilestoneSchema, handler: deleteMilestone },
  { name: 'list_components', toolset: 'tracker', description: 'List components (sub-areas) in a project', schema: S.ListComponentsSchema, handler: listComponents },
  { name: 'create_component', toolset: 'tracker', description: 'Create a new component in a project', schema: S.CreateComponentSchema, handler: createComponent },
  { name: 'update_component', toolset: 'tracker', description: 'Update a component (name, description, lead)', schema: S.UpdateComponentSchema, handler: updateComponent },
  { name: 'delete_component', toolset: 'tracker', description: 'Delete component; its issues are unassigned or moved (moveIssuesTo)', schema: S.DeleteComponentSchema, handler: deleteComponent },
  { name: 'list_teamspaces', toolset: 'documents', description: 'List all document teamspaces in the workspace', schema: S.ListTeamspacesSchema, handler: listTeamspaces },
  { name: 'create_teamspace', toolset: 'documents', description: 'Create a document teamspace', schema: S.CreateTeamspaceSchema, handler: createTeamspace },
  { name: 'list_documents', toolset: 'documents', description: 'List documents in a teamspace', schema: S.ListDocumentsSchema, handler: listDocuments },
  { name: 'get_document', toolset: 'documents', description: 'Document metadata and content', schema: S.GetDocumentSchema, handler: getDocument },
  { name: 'create_document', toolset: 'documents', description: 'Create a new document in a teamspace', schema: S.CreateDocumentSchema, handler: createDocument },
  { name: 'delete_document', toolset: 'documents', description: 'Permanently delete a document by its ID', schema: S.DeleteDocumentSchema, handler: deleteDocument },
  { name: 'update_document', toolset: 'documents', description: 'Replace document content with Markdown', schema: S.UpdateDocumentSchema, handler: updateDocument },
  { name: 'link_document', toolset: 'documents', description: 'Link a document to an issue (Relations panel)', schema: S.LinkDocumentSchema, handler: linkDocument },
  { name: 'search_issues', toolset: 'tracker', description: 'Full-text search across all issues', schema: S.SearchIssuesSchema, handler: searchIssues },
  { name: 'list_channels', toolset: 'chat', description: 'List all channels in the workspace', schema: S.ListChannelsSchema, handler: listChannels },
  { name: 'create_channel', toolset: 'chat', description: 'Create a new channel', schema: S.CreateChannelSchema, handler: createChannel },
  { name: 'start_direct_message', toolset: 'chat', description: 'Start or find a 1:1 DM with a person', schema: S.StartDirectMessageSchema, handler: startDirectMessage },
  { name: 'send_message', toolset: 'chat', description: 'Send a message to a channel or direct message', schema: S.SendMessageSchema, handler: sendMessage },
  { name: 'list_messages', toolset: 'chat', description: 'List messages in a channel or direct message', schema: S.ListMessagesSchema, handler: listMessages },
  { name: 'attach_file', toolset: 'tracker', description: 'Attach a file to an issue (base64-encoded content)', schema: S.AttachFileSchema, handler: attachFile },
  { name: 'list_attachments', toolset: 'tracker', description: 'List files attached to an issue', schema: S.ListAttachmentsSchema, handler: listAttachments },
  { name: 'delete_attachment', toolset: 'tracker', description: 'Delete a file attachment from an issue', schema: S.DeleteAttachmentSchema, handler: deleteAttachment },
  { name: 'list_issue_statuses', toolset: 'tracker', description: 'List all issue statuses (workflow states), grouped by phase', schema: S.ListIssueStatusesSchema, handler: listIssueStatuses },
  { name: 'create_issue_status', toolset: 'tracker', description: 'Create a workspace-wide issue status', schema: S.CreateIssueStatusSchema, handler: createIssueStatus },
  { name: 'list_organizations', toolset: 'contacts', description: 'List all organizations (companies) in the workspace', schema: S.ListOrganizationsSchema, handler: listOrganizations },
  { name: 'get_organization', toolset: 'contacts', description: 'Get details of an organization, including description', schema: S.GetOrganizationSchema, handler: getOrganization },
  { name: 'create_organization', toolset: 'contacts', description: 'Create a new organization (company contact)', schema: S.CreateOrganizationSchema, handler: createOrganization },
  { name: 'update_organization', toolset: 'contacts', description: 'Set the description of an organization from Markdown', schema: S.UpdateOrganizationSchema, handler: updateOrganization }
]
