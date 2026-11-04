// Every tool, with the toolset it belongs to. server.ts registers the enabled toolsets.
// Keep descriptions short — every word is sent to the model in every session (see test/budget.test.ts).
import type { z } from 'zod'
import { listWorkspaces } from './tools/workspaces'
import { listProjects, getProject, createProject, updateProject } from './tools/projects'
import { listIssues, getIssue, createIssue, updateIssue, deleteIssue, bulkUpdateIssues, moveIssue, listSubIssues } from './tools/issues'
import { addComment, listComments, deleteComment, updateComment } from './tools/comments'
import { logTime, listTimeReports } from './tools/log-time'
import { listLabels, createLabel, addLabel, removeLabel, updateLabel, deleteLabel, listLabelCategories, createLabelCategory, setLabelCategory } from './tools/labels'
import { addRelation, addBlockedBy, setParent, removeRelation, removeBlockedBy, repairParentLinks } from './tools/relations'
import { listMembers } from './tools/members'
import { listMilestones, createMilestone, getMilestone, updateMilestone, deleteMilestone } from './tools/milestones'
import { listComponents, createComponent, updateComponent, deleteComponent } from './tools/components'
import { listTeamspaces, createTeamspace, listDocuments, getDocument, createDocument, deleteDocument, updateDocument, linkDocument, listDocumentComments, addDocumentComment } from './tools/documents'
import { searchIssues, searchAll } from './tools/search'
import { listChannels, createChannel, startDirectMessage, sendMessage, listMessages, listThread, replyToMessage, updateMessage, deleteMessage, addReaction, removeReaction, pinMessage } from './tools/channels'
import { listNotifications, markNotificationsRead } from './tools/inbox'
import { getActivity } from './tools/activity'
import { listTodos, createTodo, updateTodo, deleteTodo, scheduleTodo } from './tools/planner'
import { listEvents, createEvent, updateEvent, deleteEvent } from './tools/calendar'
import { listPullRequests, getPullRequest } from './tools/github'
import { listPersons, getPerson, createPerson, updatePerson, addContactChannel, removeContactChannel } from './tools/contacts'
import { listClasses, describeClass, queryDocuments, genericCreate, genericUpdate, genericDelete } from './tools/generic'
import { attachFile, listAttachments, deleteAttachment } from './tools/attachments'
import { listIssueStatuses, createIssueStatus } from './tools/statuses'
import { listOrganizations, getOrganization, createOrganization, updateOrganization } from './tools/organizations'
import { getIssueContext, startWork, finishWork, createIssueTree, changesSince, claimIssue, releaseIssue, findProjectForRepo } from './tools/agent'
import { listCollaborators, addCollaborator, removeCollaborator, createPublicLink, listPublicLinks, revokePublicLink } from './tools/sharing'
import { listCardTypes, listCards, getCard, createCard, updateCard, deleteCard, createCardType, deleteCardType } from './tools/cards'
import { createInviteLink, sendInvite, setMemberRole, getWorkspaceSettings, listProjectTypes } from './tools/workspace-admin'
import * as REC from './tools/recruiting'
import * as CRM from './tools/crm'
import * as HRT from './tools/hr'
import * as INVT from './tools/inventory'
import * as MTT from './tools/message-templates'
import * as MEET from './tools/meetings'
import * as QMST from './tools/qms'
import * as PROC from './tools/process'
import * as SURV from './tools/surveys'
import { listCustomFields, createCustomField, setCustomFields } from './tools/fields'
import { listDrives, listDriveFiles, createFolder, uploadFile, downloadFile, updateDriveItem, deleteDriveItem, listFileVersions, restoreFileVersion, createDrive } from './tools/drive'
import { listIssueTemplates, getIssueTemplate, createIssueTemplate, updateIssueTemplate, deleteIssueTemplate, createIssueFromTemplate } from './tools/templates'
import * as TM from './tools/testing'
import { listProducts, getProduct } from './tools/products'
import * as S from './schemas'

export const TOOLSETS = ['core', 'agent', 'tracker', 'tracker-admin', 'documents', 'chat', 'contacts', 'inbox', 'activity', 'planner', 'calendar', 'github', 'generic', 'generic-write', 'collaboration', 'cards', 'fields', 'drive', 'templates', 'testing', 'products', 'members', 'recruiting', 'crm', 'hr', 'inventory', 'meetings', 'qms', 'process', 'surveys'] as const
export type Toolset = typeof TOOLSETS[number]

/** Enabled when HULY_TOOLSETS is not set. 'core' is always enabled. */
export const DEFAULT_TOOLSETS: Toolset[] = ['agent', 'tracker', 'documents', 'chat', 'contacts', 'inbox', 'activity', 'planner', 'generic']

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
  { name: 'create_project', toolset: 'tracker-admin', description: 'Create a tracker project', schema: S.CreateProjectSchema, handler: createProject },
  { name: 'update_project', toolset: 'tracker-admin', description: 'Update project name, description, default assignee/status', schema: S.UpdateProjectSchema, handler: updateProject },
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
  { name: 'update_label', toolset: 'tracker-admin', description: 'Rename/recolor a label (on every issue)', schema: S.UpdateLabelSchema, handler: updateLabel },
  { name: 'delete_label', toolset: 'tracker-admin', description: 'Delete a label and remove it from every issue', schema: S.DeleteLabelSchema, handler: deleteLabel },
  { name: 'add_relation', toolset: 'tracker', description: 'Mark two issues as related to each other (bidirectional)', schema: S.AddRelationSchema, handler: addRelation },
  { name: 'add_blocked_by', toolset: 'tracker', description: 'Mark an issue as blocked by another issue', schema: S.AddBlockedBySchema, handler: addBlockedBy },
  { name: 'set_parent', toolset: 'tracker', description: 'Set or clear the parent (epic) of an issue', schema: S.SetParentSchema, handler: setParent },
  { name: 'remove_relation', toolset: 'tracker', description: 'Remove the "related" link between two issues', schema: S.RemoveRelationSchema, handler: removeRelation },
  { name: 'remove_blocked_by', toolset: 'tracker', description: 'Remove a "blocked by" link from an issue', schema: S.RemoveBlockedBySchema, handler: removeBlockedBy },
  { name: 'repair_parent_links', toolset: 'tracker-admin', description: 'Fix sub-issues from huly-mcp <=2.1 not shown under their parent (dry run by default)', schema: S.RepairParentLinksSchema, handler: repairParentLinks },
  { name: 'list_members', toolset: 'contacts', description: 'List all members in the workspace', schema: S.ListMembersSchema, handler: listMembers },
  { name: 'list_milestones', toolset: 'tracker', description: 'List milestones for a project', schema: S.ListMilestonesSchema, handler: listMilestones },
  { name: 'create_milestone', toolset: 'tracker', description: 'Create a new milestone in a project with a target date', schema: S.CreateMilestoneSchema, handler: createMilestone },
  { name: 'get_milestone', toolset: 'tracker', description: 'Milestone with progress and open issues', schema: S.GetMilestoneSchema, handler: getMilestone },
  { name: 'update_milestone', toolset: 'tracker', description: 'Update a milestone (name, target date, status, description)', schema: S.UpdateMilestoneSchema, handler: updateMilestone },
  { name: 'delete_milestone', toolset: 'tracker-admin', description: 'Delete milestone; its issues are unassigned or moved (moveIssuesTo)', schema: S.DeleteMilestoneSchema, handler: deleteMilestone },
  { name: 'list_components', toolset: 'tracker', description: 'List components (sub-areas) in a project', schema: S.ListComponentsSchema, handler: listComponents },
  { name: 'create_component', toolset: 'tracker', description: 'Create a new component in a project', schema: S.CreateComponentSchema, handler: createComponent },
  { name: 'update_component', toolset: 'tracker', description: 'Update a component (name, description, lead)', schema: S.UpdateComponentSchema, handler: updateComponent },
  { name: 'delete_component', toolset: 'tracker-admin', description: 'Delete component; its issues are unassigned or moved (moveIssuesTo)', schema: S.DeleteComponentSchema, handler: deleteComponent },
  { name: 'list_teamspaces', toolset: 'documents', description: 'List all document teamspaces in the workspace', schema: S.ListTeamspacesSchema, handler: listTeamspaces },
  { name: 'create_teamspace', toolset: 'documents', description: 'Create a document teamspace', schema: S.CreateTeamspaceSchema, handler: createTeamspace },
  { name: 'list_documents', toolset: 'documents', description: 'List documents in a teamspace', schema: S.ListDocumentsSchema, handler: listDocuments },
  { name: 'get_document', toolset: 'documents', description: 'Document metadata and content', schema: S.GetDocumentSchema, handler: getDocument },
  { name: 'create_document', toolset: 'documents', description: 'Create a new document in a teamspace', schema: S.CreateDocumentSchema, handler: createDocument },
  { name: 'delete_document', toolset: 'documents', description: 'Permanently delete a document by its ID', schema: S.DeleteDocumentSchema, handler: deleteDocument },
  { name: 'update_document', toolset: 'documents', description: 'Replace content (Markdown), rename or move a document', schema: S.UpdateDocumentSchema, handler: updateDocument },
  { name: 'list_document_comments', toolset: 'collaboration', description: 'Comments on a document', schema: S.ListDocumentCommentsSchema, handler: listDocumentComments },
  { name: 'add_document_comment', toolset: 'collaboration', description: 'Comment on a document', schema: S.AddDocumentCommentSchema, handler: addDocumentComment },
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
  { name: 'create_issue_status', toolset: 'tracker-admin', description: 'Create a workspace-wide issue status', schema: S.CreateIssueStatusSchema, handler: createIssueStatus },
  { name: 'list_organizations', toolset: 'contacts', description: 'List all organizations (companies) in the workspace', schema: S.ListOrganizationsSchema, handler: listOrganizations },
  { name: 'get_organization', toolset: 'contacts', description: 'Get details of an organization, including description', schema: S.GetOrganizationSchema, handler: getOrganization },
  { name: 'create_organization', toolset: 'contacts', description: 'Create a new organization (company contact)', schema: S.CreateOrganizationSchema, handler: createOrganization },
  { name: 'update_organization', toolset: 'contacts', description: 'Set the description of an organization from Markdown', schema: S.UpdateOrganizationSchema, handler: updateOrganization },  // Chat: threads, editing, reactions, pins (channel messages and issue comments)
  { name: 'list_thread', toolset: 'chat', description: 'Message with its thread replies', schema: S.ListThreadSchema, handler: listThread },
  { name: 'reply_to_message', toolset: 'chat', description: 'Reply in the thread of a message or comment', schema: S.ReplyToMessageSchema, handler: replyToMessage },
  { name: 'update_message', toolset: 'chat', description: 'Edit a message or thread reply', schema: S.UpdateMessageSchema, handler: updateMessage },
  { name: 'delete_message', toolset: 'chat', description: 'Delete a message or thread reply', schema: S.DeleteMessageSchema, handler: deleteMessage },
  { name: 'add_reaction', toolset: 'chat', description: 'React to a message/comment with an emoji', schema: S.ReactionSchema, handler: addReaction },
  { name: 'remove_reaction', toolset: 'chat', description: 'Remove your emoji reaction', schema: S.ReactionSchema, handler: removeReaction },
  { name: 'pin_message', toolset: 'chat', description: 'Pin or unpin a message', schema: S.PinMessageSchema, handler: pinMessage },
  // Inbox
  { name: 'list_notifications', toolset: 'inbox', description: 'Your inbox notifications, grouped by issue/PR/document', schema: S.ListNotificationsSchema, handler: listNotifications },
  { name: 'mark_notifications_read', toolset: 'inbox', description: 'Mark notifications read (by object, ids or all); optionally archive', schema: S.MarkNotificationsReadSchema, handler: markNotificationsRead },
  // Activity
  { name: 'get_activity', toolset: 'activity', description: 'Change history and comments of an issue or object', schema: S.GetActivitySchema, handler: getActivity },
  // Planner
  { name: 'list_todos', toolset: 'planner', description: 'Your planner to-dos', schema: S.ListTodosSchema, handler: listTodos },
  { name: 'create_todo', toolset: 'planner', description: 'Create a to-do, optionally on an issue', schema: S.CreateTodoSchema, handler: createTodo },
  { name: 'update_todo', toolset: 'planner', description: 'Update a to-do or mark it done', schema: S.UpdateTodoSchema, handler: updateTodo },
  { name: 'delete_todo', toolset: 'planner', description: 'Delete a to-do', schema: S.DeleteTodoSchema, handler: deleteTodo },
  { name: 'schedule_todo', toolset: 'planner', description: 'Block time for a to-do in your calendar', schema: S.ScheduleTodoSchema, handler: scheduleTodo },
  // Calendar
  { name: 'list_events', toolset: 'calendar', description: 'Calendar events and work slots in a date range', schema: S.ListEventsSchema, handler: listEvents },
  { name: 'create_event', toolset: 'calendar', description: 'Create a calendar event', schema: S.CreateEventSchema, handler: createEvent },
  { name: 'update_event', toolset: 'calendar', description: 'Update a calendar event', schema: S.UpdateEventSchema, handler: updateEvent },
  { name: 'delete_event', toolset: 'calendar', description: 'Delete a calendar event', schema: S.DeleteEventSchema, handler: deleteEvent },
  // GitHub (read-only)
  { name: 'list_pull_requests', toolset: 'github', description: 'GitHub pull requests synced to Huly; filter by project, issue, state', schema: S.ListPullRequestsSchema, handler: listPullRequests },
  { name: 'get_pull_request', toolset: 'github', description: 'Pull request with reviews, review comments and linked issue', schema: S.GetPullRequestSchema, handler: getPullRequest },
  // Contacts (persons)
  { name: 'list_persons', toolset: 'contacts', description: 'Contact persons with their channels', schema: S.ListPersonsSchema, handler: listPersons },
  { name: 'get_person', toolset: 'contacts', description: 'Person details, channels, organizations', schema: S.GetPersonSchema, handler: getPerson },
  { name: 'create_person', toolset: 'contacts', description: 'Create a contact person', schema: S.CreatePersonSchema, handler: createPerson },
  { name: 'update_person', toolset: 'contacts', description: 'Update a contact person', schema: S.UpdatePersonSchema, handler: updatePerson },
  { name: 'add_contact_channel', toolset: 'contacts', description: 'Add email/phone/… to a person', schema: S.ContactChannelSchema, handler: addContactChannel },
  { name: 'remove_contact_channel', toolset: 'contacts', description: 'Remove email/phone/… from a person', schema: S.ContactChannelSchema, handler: removeContactChannel },
  // Agent workflow
  { name: 'get_issue_context', toolset: 'agent', description: 'Issue with description, sub-issues, blockers, PRs, comments, branch name', schema: S.GetIssueContextSchema, handler: getIssueContext },
  { name: 'start_work', toolset: 'agent', description: 'Pick up issue: In Progress, assign me, return context', schema: S.StartWorkSchema, handler: startWork },
  { name: 'finish_work', toolset: 'agent', description: 'Hand back: summary comment, link PR, status to review', schema: S.FinishWorkSchema, handler: finishWork },
  { name: 'create_issue_tree', toolset: 'agent', description: 'Plan → epic + sub-issues with blockers; skips duplicates; dry run first', schema: S.CreateIssueTreeSchema, handler: createIssueTree },
  { name: 'changes_since', toolset: 'agent', description: 'Issues/PRs changed since a time: fields, comments, who', schema: S.ChangesSinceSchema, handler: changesSince },
  { name: 'claim_issue', toolset: 'agent', description: 'Lease an issue so parallel agents skip it', schema: S.ClaimIssueSchema, handler: claimIssue },
  { name: 'find_project_for_repo', toolset: 'agent', description: 'Huly workspace + project linked to a GitHub repo', schema: S.FindProjectForRepoSchema, handler: findProjectForRepo },
  { name: 'release_issue', toolset: 'agent', description: 'Release an agent claim', schema: S.ReleaseIssueSchema, handler: releaseIssue },
  // Generic access to any class
  { name: 'search', toolset: 'generic', description: 'Fulltext search across everything (issues, docs, messages, cards, files …)', schema: S.SearchAllSchema, handler: searchAll },
  { name: 'list_classes', toolset: 'generic', description: 'Huly data classes (for modules without dedicated tools)', schema: S.ListClassesSchema, handler: listClasses },
  { name: 'describe_class', toolset: 'generic', description: 'Attributes and types of a class', schema: S.DescribeClassSchema, handler: describeClass },
  { name: 'query_documents', toolset: 'generic', description: 'Read documents of any class (secrets redacted)', schema: S.QueryDocumentsSchema, handler: queryDocuments },
  { name: 'generic_create', toolset: 'generic-write', description: 'Create a document of any class (dry run by default)', schema: S.GenericCreateSchema, handler: genericCreate },
  { name: 'generic_update', toolset: 'generic-write', description: 'Update a document of any class (dry run by default)', schema: S.GenericUpdateSchema, handler: genericUpdate },
  { name: 'generic_delete', toolset: 'generic-write', description: 'Delete a document of any class (dry run; needs confirm)', schema: S.GenericDeleteSchema, handler: genericDelete },
  { name: 'list_collaborators', toolset: 'collaboration', description: 'Who follows an issue or document', schema: S.ListCollaboratorsSchema, handler: listCollaborators },
  { name: 'add_collaborator', toolset: 'collaboration', description: 'Follow an issue/document (you or a member) to get its notifications', schema: S.AddCollaboratorSchema, handler: addCollaborator },
  { name: 'remove_collaborator', toolset: 'collaboration', description: 'Stop following an issue/document', schema: S.RemoveCollaboratorSchema, handler: removeCollaborator },
  { name: 'create_public_link', toolset: 'collaboration', description: 'Read-only guest link for an issue/document (anyone with the link can read)', schema: S.CreatePublicLinkSchema, handler: createPublicLink },
  { name: 'list_public_links', toolset: 'collaboration', description: 'Public guest links', schema: S.ListPublicLinksSchema, handler: listPublicLinks },
  { name: 'revoke_public_link', toolset: 'collaboration', description: 'Revoke a public link', schema: S.RevokePublicLinkSchema, handler: revokePublicLink },
  { name: 'list_card_types', toolset: 'cards', description: 'Card types (MasterTags) and their tags', schema: S.ListCardTypesSchema, handler: listCardTypes },
  { name: 'list_cards', toolset: 'cards', description: 'List cards by type, parent or title', schema: S.ListCardsSchema, handler: listCards },
  { name: 'get_card', toolset: 'cards', description: 'Card with fields, tags, children and content', schema: S.GetCardSchema, handler: getCard },
  { name: 'create_card', toolset: 'cards', description: 'Create a card (type, content, parent, tags, fields)', schema: S.CreateCardSchema, handler: createCard },
  { name: 'update_card', toolset: 'cards', description: 'Edit, move or tag a card; set fields', schema: S.UpdateCardSchema, handler: updateCard },
  { name: 'delete_card', toolset: 'cards', description: 'Delete a card without children', schema: S.DeleteCardSchema, handler: deleteCard },
  { name: 'create_card_type', toolset: 'cards', description: 'New card type or tag', schema: S.CreateCardTypeSchema, handler: createCardType },
  { name: 'delete_card_type', toolset: 'cards', description: 'Delete an unused card type or tag', schema: S.DeleteCardTypeSchema, handler: deleteCardType },
  { name: 'list_custom_fields', toolset: 'fields', description: 'Custom fields of issues/cards/classes, or values on one object', schema: S.ListCustomFieldsSchema, handler: listCustomFields },
  { name: 'create_custom_field', toolset: 'fields', description: 'Add a custom field to issues, a project type, card type or class', schema: S.CreateCustomFieldSchema, handler: createCustomField },
  { name: 'set_custom_fields', toolset: 'fields', description: 'Set custom field values on an issue, card or document', schema: S.SetCustomFieldsSchema, handler: setCustomFields },
  { name: 'list_drives', toolset: 'drive', description: 'Drives with file counts', schema: S.ListDrivesSchema, handler: listDrives },
  { name: 'create_drive', toolset: 'drive', description: 'Create a drive', schema: S.CreateDriveSchema, handler: createDrive },
  { name: 'list_drive_files', toolset: 'drive', description: 'Folder tree of a drive with files, sizes, versions', schema: S.ListDriveFilesSchema, handler: listDriveFiles },
  { name: 'create_folder', toolset: 'drive', description: 'Create a drive folder', schema: S.CreateFolderSchema, handler: createFolder },
  { name: 'upload_file', toolset: 'drive', description: 'Upload a file to a drive (same name → new version)', schema: S.UploadFileSchema, handler: uploadFile },
  { name: 'download_file', toolset: 'drive', description: 'Read a drive file (text inline, binary base64) or save it locally', schema: S.DownloadFileSchema, handler: downloadFile },
  { name: 'update_drive_item', toolset: 'drive', description: 'Rename or move a file/folder', schema: S.UpdateDriveItemSchema, handler: updateDriveItem },
  { name: 'delete_drive_item', toolset: 'drive', description: 'Delete a file or folder (folders with content need recursive)', schema: S.DeleteDriveItemSchema, handler: deleteDriveItem },
  { name: 'list_file_versions', toolset: 'drive', description: 'Versions of a drive file', schema: S.ListFileVersionsSchema, handler: listFileVersions },
  { name: 'restore_file_version', toolset: 'drive', description: 'Make an older file version current', schema: S.RestoreFileVersionSchema, handler: restoreFileVersion },
  { name: 'list_issue_templates', toolset: 'templates', description: 'Issue templates', schema: S.ListIssueTemplatesSchema, handler: listIssueTemplates },
  { name: 'get_issue_template', toolset: 'templates', description: 'Issue template with its sub-issues', schema: S.GetIssueTemplateSchema, handler: getIssueTemplate },
  { name: 'create_issue_template', toolset: 'templates', description: 'Create an issue template (with sub-issues)', schema: S.CreateIssueTemplateSchema, handler: createIssueTemplate },
  { name: 'update_issue_template', toolset: 'templates', description: 'Update an issue template', schema: S.UpdateIssueTemplateSchema, handler: updateIssueTemplate },
  { name: 'delete_issue_template', toolset: 'templates', description: 'Delete an issue template', schema: S.DeleteIssueTemplateSchema, handler: deleteIssueTemplate },
  { name: 'create_issue_from_template', toolset: 'templates', description: 'New issue (and sub-issues) from a template', schema: S.CreateIssueFromTemplateSchema, handler: createIssueFromTemplate },
  { name: 'list_test_projects', toolset: 'testing', description: 'Test projects with case/run counts', schema: S.ListTestProjectsSchema, handler: TM.listTestProjects },
  { name: 'create_test_project', toolset: 'testing', description: 'Create a test project', schema: S.CreateTestProjectSchema, handler: TM.createTestProject },
  { name: 'list_test_cases', toolset: 'testing', description: 'Suites and test cases of a test project', schema: S.ListTestCasesSchema, handler: TM.listTestCases },
  { name: 'create_test_suite', toolset: 'testing', description: 'Create a (nested) test suite', schema: S.CreateTestSuiteSchema, handler: TM.createTestSuite },
  { name: 'get_test_case', toolset: 'testing', description: 'Test case with steps and latest results', schema: S.GetTestCaseSchema, handler: TM.getTestCase },
  { name: 'create_test_case', toolset: 'testing', description: 'Create a test case in a suite', schema: S.CreateTestCaseSchema, handler: TM.createTestCase },
  { name: 'update_test_case', toolset: 'testing', description: 'Update a test case', schema: S.UpdateTestCaseSchema, handler: TM.updateTestCase },
  { name: 'delete_test_case', toolset: 'testing', description: 'Delete a test case', schema: S.DeleteTestCaseSchema, handler: TM.deleteTestCase },
  { name: 'list_test_plans', toolset: 'testing', description: 'Test plans of a project', schema: S.ListTestPlansSchema, handler: TM.listTestPlans },
  { name: 'create_test_plan', toolset: 'testing', description: 'Test plan from suites and/or cases', schema: S.CreateTestPlanSchema, handler: TM.createTestPlan },
  { name: 'create_test_run', toolset: 'testing', description: 'Start a test run from a plan, suites or cases', schema: S.CreateTestRunSchema, handler: TM.createTestRun },
  { name: 'list_test_runs', toolset: 'testing', description: 'Test runs with pass/fail counts', schema: S.ListTestRunsSchema, handler: TM.listTestRuns },
  { name: 'get_test_run', toolset: 'testing', description: 'Results of a test run', schema: S.GetTestRunSchema, handler: TM.getTestRun },
  { name: 'set_test_result', toolset: 'testing', description: 'Record Passed/Failed/Blocked for a case in a run', schema: S.SetTestResultSchema, handler: TM.setTestResult },
  { name: 'list_products', toolset: 'products', description: 'Products with their active versions', schema: S.ListProductsSchema, handler: listProducts },
  { name: 'get_product', toolset: 'products', description: 'Product with all versions', schema: S.GetProductSchema, handler: getProduct },
  { name: 'list_label_categories', toolset: 'tracker-admin', description: 'Issue label categories with their labels', schema: S.ListLabelCategoriesSchema, handler: listLabelCategories },
  { name: 'create_label_category', toolset: 'tracker-admin', description: 'Create an issue label category', schema: S.CreateLabelCategorySchema, handler: createLabelCategory },
  { name: 'set_label_category', toolset: 'tracker-admin', description: 'Move a label into a category', schema: S.SetLabelCategorySchema, handler: setLabelCategory },
  { name: 'list_project_types', toolset: 'tracker-admin', description: 'Project types with task types and their status workflows', schema: S.ListProjectTypesSchema, handler: listProjectTypes },
  { name: 'get_workspace_settings', toolset: 'members', description: 'Workspace info: your role, members per role, invite defaults, integrations', schema: S.GetWorkspaceSettingsSchema, handler: getWorkspaceSettings },
  { name: 'create_invite_link', toolset: 'members', description: 'Create an invite link (personal for an e-mail, or with use limit/e-mail mask); sends nothing', schema: S.CreateInviteLinkSchema, handler: createInviteLink },
  { name: 'send_invite', toolset: 'members', description: 'Send an invitation e-mail to join the workspace', schema: S.SendInviteSchema, handler: sendInvite },
  { name: 'set_member_role', toolset: 'members', description: 'Change a member\'s workspace role', schema: S.SetMemberRoleSchema, handler: setMemberRole },
  { name: 'list_vacancies', toolset: 'recruiting', description: 'Vacancies with application counts per status', schema: S.ListVacanciesSchema, handler: REC.listVacancies },
  { name: 'create_vacancy', toolset: 'recruiting', description: 'Create a vacancy', schema: S.CreateVacancySchema, handler: REC.createVacancy },
  { name: 'update_vacancy', toolset: 'recruiting', description: 'Rename, describe, set location/due date, archive a vacancy', schema: S.UpdateVacancySchema, handler: REC.updateVacancy },
  { name: 'list_candidates', toolset: 'recruiting', description: 'Candidates (talents) with title and application count', schema: S.ListCandidatesSchema, handler: REC.listCandidates },
  { name: 'create_candidate', toolset: 'recruiting', description: 'Create a candidate (person with title, e-mail, onsite/remote)', schema: S.CreateCandidateSchema, handler: REC.createCandidate },
  { name: 'list_applications', toolset: 'recruiting', description: 'Applications (APP-n) by vacancy/status', schema: S.ListApplicationsSchema, handler: REC.listApplications },
  { name: 'create_application', toolset: 'recruiting', description: 'Apply a candidate to a vacancy', schema: S.CreateApplicationSchema, handler: REC.createApplication },
  { name: 'update_application', toolset: 'recruiting', description: 'Move an application to a status or assign a recruiter', schema: S.UpdateApplicationSchema, handler: REC.updateApplication },
  { name: 'delete_application', toolset: 'recruiting', description: 'Delete an application', schema: S.DeleteApplicationSchema, handler: REC.deleteApplication },
  { name: 'list_leads', toolset: 'crm', description: 'Leads (LEAD-n) by funnel/status with customer', schema: S.ListLeadsSchema, handler: CRM.listLeads },
  { name: 'list_customers', toolset: 'crm', description: 'Customers with lead counts', schema: S.ListCustomersSchema, handler: CRM.listCustomers },
  { name: 'create_lead', toolset: 'crm', description: 'Create a lead for a customer (optionally creating the customer)', schema: S.CreateLeadSchema, handler: CRM.createLead },
  { name: 'update_lead', toolset: 'crm', description: 'Rename, move to a status or assign a lead', schema: S.UpdateLeadSchema, handler: CRM.updateLead },
  { name: 'delete_lead', toolset: 'crm', description: 'Delete a lead', schema: S.DeleteLeadSchema, handler: CRM.deleteLead },
  { name: 'list_departments', toolset: 'hr', description: 'Department tree with team leads and members', schema: S.ListDepartmentsSchema, handler: HRT.listDepartments },
  { name: 'create_department', toolset: 'hr', description: 'Create a department', schema: S.CreateDepartmentSchema, handler: HRT.createDepartment },
  { name: 'delete_department', toolset: 'hr', description: 'Delete a department without sub-departments', schema: S.DeleteDepartmentSchema, handler: HRT.deleteDepartment },
  { name: 'set_department', toolset: 'hr', description: 'Move a member to a department', schema: S.SetDepartmentSchema, handler: HRT.setDepartment },
  { name: 'list_time_off', toolset: 'hr', description: 'Vacation, sick days, PTO, overtime, remote days in a date range', schema: S.ListTimeOffSchema, handler: HRT.listTimeOff },
  { name: 'create_time_off', toolset: 'hr', description: 'Record vacation/sick/PTO/overtime/remote days', schema: S.CreateTimeOffSchema, handler: HRT.createTimeOff },
  { name: 'delete_time_off', toolset: 'hr', description: 'Delete a time-off entry', schema: S.DeleteTimeOffSchema, handler: HRT.deleteTimeOff },
  { name: 'list_inventory', toolset: 'inventory', description: 'Inventory tree: categories, products, variants (SKU)', schema: S.ListInventorySchema, handler: INVT.listInventory },
  { name: 'create_inventory_category', toolset: 'inventory', description: 'Create an inventory category', schema: S.CreateInventoryCategorySchema, handler: INVT.createInventoryCategory },
  { name: 'create_inventory_product', toolset: 'inventory', description: 'Create a product (with variants) in a category', schema: S.CreateInventoryProductSchema, handler: INVT.createInventoryProduct },
  { name: 'update_inventory_item', toolset: 'inventory', description: 'Rename, change SKU or move an inventory item', schema: S.UpdateInventoryItemSchema, handler: INVT.updateInventoryItem },
  { name: 'delete_inventory_item', toolset: 'inventory', description: 'Delete a category, product or variant', schema: S.DeleteInventoryItemSchema, handler: INVT.deleteInventoryItem },
  { name: 'list_message_templates', toolset: 'templates', description: 'Message templates by category', schema: S.ListMessageTemplatesSchema, handler: MTT.listMessageTemplates },
  { name: 'get_message_template', toolset: 'templates', description: 'Full text and placeholders of a message template', schema: S.GetMessageTemplateSchema, handler: MTT.getMessageTemplate },
  { name: 'create_message_template', toolset: 'templates', description: 'Create a message template', schema: S.CreateMessageTemplateSchema, handler: MTT.createMessageTemplate },
  { name: 'update_message_template', toolset: 'templates', description: 'Change a message template', schema: S.UpdateMessageTemplateSchema, handler: MTT.updateMessageTemplate },
  { name: 'delete_message_template', toolset: 'templates', description: 'Delete a message template', schema: S.DeleteMessageTemplateSchema, handler: MTT.deleteMessageTemplate },
  { name: 'list_meetings', toolset: 'meetings', description: 'Office rooms and meeting minutes', schema: S.ListMeetingsSchema, handler: MEET.listMeetings },
  { name: 'get_meeting', toolset: 'meetings', description: 'Meeting minutes: participants, notes, action items, transcript', schema: S.GetMeetingSchema, handler: MEET.getMeeting },
  { name: 'list_controlled_documents', toolset: 'qms', description: 'Controlled (QMS) documents per space with version and state', schema: S.ListControlledDocumentsSchema, handler: QMST.listControlledDocuments },
  { name: 'get_controlled_document', toolset: 'qms', description: 'Controlled document: state, people, requests, versions, content', schema: S.GetControlledDocumentSchema, handler: QMST.getControlledDocument },
  { name: 'list_trainings', toolset: 'qms', description: 'Trainings (latest revision)', schema: S.ListTrainingsSchema, handler: QMST.listTrainings },
  { name: 'get_training', toolset: 'qms', description: 'Training questions and trainee results', schema: S.GetTrainingSchema, handler: QMST.getTraining },
  { name: 'list_processes', toolset: 'process', description: 'Process definitions: states and transitions', schema: S.ListProcessesSchema, handler: PROC.listProcesses },
  { name: 'list_executions', toolset: 'process', description: 'Running/finished process executions with current state', schema: S.ListExecutionsSchema, handler: PROC.listExecutions },
  { name: 'start_process', toolset: 'process', description: 'Run a process on a card', schema: S.StartProcessSchema, handler: PROC.startProcess },
  { name: 'cancel_execution', toolset: 'process', description: 'Cancel a running process execution', schema: S.CancelExecutionSchema, handler: PROC.cancelExecution },
  { name: 'list_surveys', toolset: 'surveys', description: 'Surveys with poll counts', schema: S.ListSurveysSchema, handler: SURV.listSurveys },
  { name: 'get_survey', toolset: 'surveys', description: 'Survey questions with aggregated poll answers', schema: S.GetSurveySchema, handler: SURV.getSurvey }
]
