var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var registry_exports = {};
__export(registry_exports, {
  DEFAULT_TOOLSETS: () => DEFAULT_TOOLSETS,
  TOOLS: () => TOOLS,
  TOOLSETS: () => TOOLSETS
});
module.exports = __toCommonJS(registry_exports);
var import_workspaces = require("./tools/workspaces.js");
var import_diagnostics = require("./tools/diagnostics.js");
var import_undo = require("./tools/undo.js");
var import_projects = require("./tools/projects.js");
var import_issues = require("./tools/issues.js");
var import_comments = require("./tools/comments.js");
var import_log_time = require("./tools/log-time.js");
var import_labels = require("./tools/labels.js");
var import_relations = require("./tools/relations.js");
var import_members = require("./tools/members.js");
var import_milestones = require("./tools/milestones.js");
var import_components = require("./tools/components.js");
var import_documents = require("./tools/documents.js");
var import_search = require("./tools/search.js");
var import_channels = require("./tools/channels.js");
var import_inbox = require("./tools/inbox.js");
var import_activity = require("./tools/activity.js");
var import_planner = require("./tools/planner.js");
var import_calendar = require("./tools/calendar.js");
var import_github = require("./tools/github.js");
var import_contacts = require("./tools/contacts.js");
var import_generic = require("./tools/generic.js");
var import_attachments = require("./tools/attachments.js");
var import_statuses = require("./tools/statuses.js");
var import_organizations = require("./tools/organizations.js");
var import_agent = require("./tools/agent.js");
var import_sharing = require("./tools/sharing.js");
var import_cards = require("./tools/cards.js");
var import_workspace_admin = require("./tools/workspace-admin.js");
var REC = __toESM(require("./tools/recruiting.js"));
var CRM = __toESM(require("./tools/crm.js"));
var HRT = __toESM(require("./tools/hr.js"));
var INVT = __toESM(require("./tools/inventory.js"));
var MTT = __toESM(require("./tools/message-templates.js"));
var MEET = __toESM(require("./tools/meetings.js"));
var QMST = __toESM(require("./tools/qms.js"));
var TRN = __toESM(require("./tools/training.js"));
var ADM = __toESM(require("./tools/admin.js"));
var COV = __toESM(require("./tools/coverage.js"));
var PROC = __toESM(require("./tools/process.js"));
var SURV = __toESM(require("./tools/surveys.js"));
var import_fields = require("./tools/fields.js");
var import_drive = require("./tools/drive.js");
var import_templates = require("./tools/templates.js");
var TM = __toESM(require("./tools/testing.js"));
var TA = __toESM(require("./tools/test-automation.js"));
var import_overview = require("./tools/overview.js");
var import_products = require("./tools/products.js");
var S = __toESM(require("./schemas.js"));
const TOOLSETS = ["core", "agent", "tracker", "tracker-admin", "documents", "chat", "contacts", "inbox", "activity", "planner", "calendar", "github", "generic", "generic-write", "collaboration", "cards", "fields", "drive", "templates", "testing", "products", "members", "recruiting", "crm", "hr", "inventory", "meetings", "qms", "process", "surveys", "admin"];
const DEFAULT_TOOLSETS = ["agent", "tracker", "documents", "chat", "contacts", "inbox", "activity", "planner", "generic"];
const TOOLS = [
  { name: "list_workspaces", toolset: "core", description: "List accessible workspaces (name, slug, id)", schema: S.ListWorkspacesSchema, handler: import_workspaces.listWorkspaces },
  { name: "undo_changes", toolset: "core", description: "Undo your last changes made through this server (creates, edits, deletes). Dry run first", schema: S.UndoChangesSchema, handler: import_undo.undoChanges },
  { name: "check_setup", toolset: "core", description: "Diagnose the setup: version and updates, login, workspaces, front URL, settings (no secrets)", schema: S.CheckSetupSchema, handler: import_diagnostics.checkSetup },
  { name: "list_projects", toolset: "tracker", description: "List all projects in a Huly workspace", schema: S.ListProjectsSchema, handler: import_projects.listProjects },
  { name: "get_project", toolset: "tracker", description: 'Project by key (e.g. "PROJ"): name, description, issue count, statuses', schema: S.GetProjectSchema, handler: import_projects.getProject },
  { name: "create_project", toolset: "tracker-admin", description: "Create a tracker project", schema: S.CreateProjectSchema, handler: import_projects.createProject },
  { name: "update_project", toolset: "tracker-admin", description: "Update project name, description, default assignee/status", schema: S.UpdateProjectSchema, handler: import_projects.updateProject },
  { name: "list_issues", toolset: "tracker", description: "List issues of a project; filters: status, priority, milestone, component, label, assignee, parent, blocked, due", schema: S.ListIssuesSchema, handler: import_issues.listIssues },
  { name: "get_issue", toolset: "tracker", description: "Issue fields: status, assignee, priority, dates, description. Sub-issues, blockers, PRs, comments: get_issue_context", schema: S.GetIssueSchema, handler: import_issues.getIssue },
  { name: "create_issue", toolset: "tracker", description: "Create a new issue in a project", schema: S.CreateIssueSchema, handler: import_issues.createIssue },
  { name: "update_issue", toolset: "tracker", description: "Update issue fields", schema: S.UpdateIssueSchema, handler: import_issues.updateIssue },
  { name: "delete_issue", toolset: "tracker", description: 'Permanently delete an issue by identifier (e.g. "PROJ-123")', schema: S.DeleteIssueSchema, handler: import_issues.deleteIssue },
  { name: "bulk_update_issues", toolset: "tracker", description: "Apply one change to many issues; validates all first", schema: S.BulkUpdateIssuesSchema, handler: import_issues.bulkUpdateIssues },
  { name: "move_issue", toolset: "tracker", description: "Move issue (incl. sub-issues, comments, files, time) to another project; gets a new id, component/milestone cleared", schema: S.MoveIssueSchema, handler: import_issues.moveIssue },
  { name: "list_sub_issues", toolset: "tracker", description: "Sub-issue tree of an issue with progress", schema: S.ListSubIssuesSchema, handler: import_issues.listSubIssues },
  { name: "add_comment", toolset: "tracker", description: "Add a comment to an issue", schema: S.AddCommentSchema, handler: import_comments.addComment },
  { name: "list_comments", toolset: "tracker", description: "List comments of an issue (with ids)", schema: S.ListCommentsSchema, handler: import_comments.listComments },
  { name: "delete_comment", toolset: "tracker", description: "Permanently delete a comment on an issue (commentId from list_comments); to edit: update_comment", schema: S.DeleteCommentSchema, handler: import_comments.deleteComment },
  { name: "update_comment", toolset: "tracker", description: "Edit a comment by id", schema: S.UpdateCommentSchema, handler: import_comments.updateComment },
  { name: "log_time", toolset: "tracker", description: "Log hours spent on an issue", schema: S.LogTimeSchema, handler: import_log_time.logTime },
  { name: "list_time_reports", toolset: "tracker", description: "Logged time for an issue or project, totals per person; person/date filters", schema: S.ListTimeReportsSchema, handler: import_log_time.listTimeReports },
  { name: "timesheet", toolset: "tracker", description: "Hours of a week by day and project; gaps marked", schema: S.TimesheetSchema, handler: import_log_time.timesheet },
  { name: "list_labels", toolset: "tracker", description: "List all labels in the workspace", schema: S.ListLabelsSchema, handler: import_labels.listLabels },
  { name: "create_label", toolset: "tracker", description: "Create a workspace-wide label (optional hex color); an existing title is reused. Tag an issue: add_label", schema: S.CreateLabelSchema, handler: import_labels.createLabel },
  { name: "add_label", toolset: "tracker", description: "Add label to issue (auto-creates label)", schema: S.AddLabelSchema, handler: import_labels.addLabel },
  { name: "remove_label", toolset: "tracker", description: "Remove a label from an issue", schema: S.RemoveLabelSchema, handler: import_labels.removeLabel },
  { name: "update_label", toolset: "tracker-admin", description: "Rename/recolor a label (on every issue)", schema: S.UpdateLabelSchema, handler: import_labels.updateLabel },
  { name: "delete_label", toolset: "tracker-admin", description: "Delete a label and remove it from every issue", schema: S.DeleteLabelSchema, handler: import_labels.deleteLabel },
  { name: "add_relation", toolset: "tracker", description: "Mark two issues as related to each other (bidirectional)", schema: S.AddRelationSchema, handler: import_relations.addRelation },
  { name: "add_blocked_by", toolset: "tracker", description: "Mark an issue as blocked by another issue", schema: S.AddBlockedBySchema, handler: import_relations.addBlockedBy },
  { name: "set_parent", toolset: "tracker", description: "Set or clear the parent (epic) of an issue", schema: S.SetParentSchema, handler: import_relations.setParent },
  { name: "remove_relation", toolset: "tracker", description: 'Remove the "related" link between two issues', schema: S.RemoveRelationSchema, handler: import_relations.removeRelation },
  { name: "remove_blocked_by", toolset: "tracker", description: 'Remove a "blocked by" link from an issue', schema: S.RemoveBlockedBySchema, handler: import_relations.removeBlockedBy },
  { name: "repair_parent_links", toolset: "tracker-admin", description: "Fix sub-issues from huly-mcp <=2.1 not shown under their parent (dry run by default)", schema: S.RepairParentLinksSchema, handler: import_relations.repairParentLinks },
  { name: "list_members", toolset: "contacts", description: "List all members in the workspace", schema: S.ListMembersSchema, handler: import_members.listMembers },
  { name: "list_milestones", toolset: "tracker", description: "List milestones for a project", schema: S.ListMilestonesSchema, handler: import_milestones.listMilestones },
  { name: "create_milestone", toolset: "tracker", description: "Create a new milestone in a project with a target date", schema: S.CreateMilestoneSchema, handler: import_milestones.createMilestone },
  { name: "get_milestone", toolset: "tracker", description: "Milestone with progress and open issues", schema: S.GetMilestoneSchema, handler: import_milestones.getMilestone },
  { name: "update_milestone", toolset: "tracker", description: "Update a milestone (name, target date, status, description)", schema: S.UpdateMilestoneSchema, handler: import_milestones.updateMilestone },
  { name: "delete_milestone", toolset: "tracker-admin", description: "Delete milestone; its issues are unassigned or moved (moveIssuesTo)", schema: S.DeleteMilestoneSchema, handler: import_milestones.deleteMilestone },
  { name: "list_components", toolset: "tracker", description: "List components (sub-areas) in a project", schema: S.ListComponentsSchema, handler: import_components.listComponents },
  { name: "create_component", toolset: "tracker", description: "Create a component (sub-area) in a project; issues get it via componentLabel. Change it: update_component", schema: S.CreateComponentSchema, handler: import_components.createComponent },
  { name: "update_component", toolset: "tracker", description: "Update a component (name, description, lead)", schema: S.UpdateComponentSchema, handler: import_components.updateComponent },
  { name: "delete_component", toolset: "tracker-admin", description: "Delete component; its issues are unassigned or moved (moveIssuesTo)", schema: S.DeleteComponentSchema, handler: import_components.deleteComponent },
  { name: "list_teamspaces", toolset: "documents", description: "List document teamspaces with their ids (teamspaceId for list_documents, create_document)", schema: S.ListTeamspacesSchema, handler: import_documents.listTeamspaces },
  { name: "create_teamspace", toolset: "documents", description: "Create a document teamspace", schema: S.CreateTeamspaceSchema, handler: import_documents.createTeamspace },
  { name: "list_documents", toolset: "documents", description: "List documents in a teamspace", schema: S.ListDocumentsSchema, handler: import_documents.listDocuments },
  { name: "get_document", toolset: "documents", description: "Document metadata and content", schema: S.GetDocumentSchema, handler: import_documents.getDocument },
  { name: "create_document", toolset: "documents", description: "Create an empty document in a teamspace (optionally under a parent); body: update_document", schema: S.CreateDocumentSchema, handler: import_documents.createDocument },
  { name: "delete_document", toolset: "documents", description: "Permanently delete a document by its ID", schema: S.DeleteDocumentSchema, handler: import_documents.deleteDocument },
  { name: "update_document", toolset: "documents", description: "Replace content (Markdown), rename or move a document", schema: S.UpdateDocumentSchema, handler: import_documents.updateDocument },
  { name: "list_document_comments", toolset: "collaboration", description: "Comments on a document", schema: S.ListDocumentCommentsSchema, handler: import_documents.listDocumentComments },
  { name: "add_document_comment", toolset: "collaboration", description: "Comment on a document", schema: S.AddDocumentCommentSchema, handler: import_documents.addDocumentComment },
  { name: "link_document", toolset: "documents", description: "Link a document to an issue (Relations panel)", schema: S.LinkDocumentSchema, handler: import_documents.linkDocument },
  { name: "search_issues", toolset: "tracker", description: "Full-text search in issues of all projects, with status. Docs, messages, files too: search", schema: S.SearchIssuesSchema, handler: import_search.searchIssues },
  { name: "list_channels", toolset: "chat", description: "List all channels in the workspace", schema: S.ListChannelsSchema, handler: import_channels.listChannels },
  { name: "create_channel", toolset: "chat", description: "Create a new channel", schema: S.CreateChannelSchema, handler: import_channels.createChannel },
  { name: "start_direct_message", toolset: "chat", description: "Start or find a 1:1 DM with a person", schema: S.StartDirectMessageSchema, handler: import_channels.startDirectMessage },
  { name: "send_message", toolset: "chat", description: "Send a message to a channel or direct message", schema: S.SendMessageSchema, handler: import_channels.sendMessage },
  { name: "list_messages", toolset: "chat", description: "List messages in a channel or direct message", schema: S.ListMessagesSchema, handler: import_channels.listMessages },
  { name: "attach_file", toolset: "tracker", description: "Attach a file to an issue (base64-encoded content)", schema: S.AttachFileSchema, handler: import_attachments.attachFile },
  { name: "list_attachments", toolset: "tracker", description: "List files attached to an issue", schema: S.ListAttachmentsSchema, handler: import_attachments.listAttachments },
  { name: "delete_attachment", toolset: "tracker", description: "Permanently delete a file attached to an issue (attachmentId from list_attachments)", schema: S.DeleteAttachmentSchema, handler: import_attachments.deleteAttachment },
  { name: "list_issue_statuses", toolset: "tracker", description: "List all issue statuses (workflow states), grouped by phase", schema: S.ListIssueStatusesSchema, handler: import_statuses.listIssueStatuses },
  { name: "create_issue_status", toolset: "tracker-admin", description: "Add an issue status to the workflow of a project type (creates it or reuses one of that name)", schema: S.CreateIssueStatusSchema, handler: import_statuses.createIssueStatus },
  { name: "list_organizations", toolset: "contacts", description: "List all organizations (companies) in the workspace", schema: S.ListOrganizationsSchema, handler: import_organizations.listOrganizations },
  { name: "get_organization", toolset: "contacts", description: "Organization (company) by id from list_organizations: city, linked members, description", schema: S.GetOrganizationSchema, handler: import_organizations.getOrganization },
  { name: "create_organization", toolset: "contacts", description: "Create a new organization (company contact)", schema: S.CreateOrganizationSchema, handler: import_organizations.createOrganization },
  { name: "update_organization", toolset: "contacts", description: "Update an organization: name, city, description (Markdown)", schema: S.UpdateOrganizationSchema, handler: import_organizations.updateOrganization },
  // Chat: threads, editing, reactions, pins (channel messages and issue comments)
  { name: "list_thread", toolset: "chat", description: "Message with its thread replies", schema: S.ListThreadSchema, handler: import_channels.listThread },
  { name: "reply_to_message", toolset: "chat", description: "Reply in the thread of a message or comment", schema: S.ReplyToMessageSchema, handler: import_channels.replyToMessage },
  { name: "update_message", toolset: "chat", description: "Edit a message or thread reply", schema: S.UpdateMessageSchema, handler: import_channels.updateMessage },
  { name: "delete_message", toolset: "chat", description: "Delete a message or thread reply", schema: S.DeleteMessageSchema, handler: import_channels.deleteMessage },
  { name: "add_reaction", toolset: "chat", description: "Add your emoji reaction to a message or comment (no-op if already there); undo: remove_reaction", schema: S.ReactionSchema, handler: import_channels.addReaction },
  { name: "remove_reaction", toolset: "chat", description: "Remove your emoji reaction", schema: S.ReactionSchema, handler: import_channels.removeReaction },
  { name: "pin_message", toolset: "chat", description: "Pin a message or comment in its channel; pinned=false unpins", schema: S.PinMessageSchema, handler: import_channels.pinMessage },
  // Inbox
  { name: "list_notifications", toolset: "inbox", description: "Your inbox notifications, grouped by issue/PR/document", schema: S.ListNotificationsSchema, handler: import_inbox.listNotifications },
  { name: "triage_inbox", toolset: "inbox", description: "Unread items with what changed since last read: new comments, fields, status. Overview of my day: my_day", schema: S.TriageInboxSchema, handler: import_overview.triageInbox },
  { name: "mark_notifications_read", toolset: "inbox", description: "Mark notifications read (by object, ids or all); optionally archive", schema: S.MarkNotificationsReadSchema, handler: import_inbox.markNotificationsRead },
  { name: "manage_notifications", toolset: "inbox", description: "Inbox for one object: pin, hide, mark unread, unarchive, follow/unfollow (and the undo of each)", schema: S.ManageNotificationsSchema, handler: import_inbox.manageNotifications },
  // Activity
  { name: "get_activity", toolset: "activity", description: "Change history of an issue or object: who changed what and when, with comments. Current state: get_issue", schema: S.GetActivitySchema, handler: import_activity.getActivity },
  // Planner
  { name: "list_todos", toolset: "planner", description: "List your own planner to-dos: open by default, in planner order; filter by status or due date", schema: S.ListTodosSchema, handler: import_planner.listTodos },
  { name: "create_todo", toolset: "planner", description: "Create a to-do, optionally on an issue", schema: S.CreateTodoSchema, handler: import_planner.createTodo },
  { name: "update_todo", toolset: "planner", description: "Update a to-do or mark it done", schema: S.UpdateTodoSchema, handler: import_planner.updateTodo },
  { name: "delete_todo", toolset: "planner", description: "Delete a to-do", schema: S.DeleteTodoSchema, handler: import_planner.deleteTodo },
  { name: "schedule_todo", toolset: "planner", description: "Block time for a to-do in your calendar", schema: S.ScheduleTodoSchema, handler: import_planner.scheduleTodo },
  // Calendar
  { name: "list_events", toolset: "calendar", description: "Calendar events and work slots in a date range", schema: S.ListEventsSchema, handler: import_calendar.listEvents },
  { name: "create_event", toolset: "calendar", description: "Create a calendar event", schema: S.CreateEventSchema, handler: import_calendar.createEvent },
  { name: "update_event", toolset: "calendar", description: "Update a calendar event", schema: S.UpdateEventSchema, handler: import_calendar.updateEvent },
  { name: "delete_event", toolset: "calendar", description: "Delete a calendar event", schema: S.DeleteEventSchema, handler: import_calendar.deleteEvent },
  // GitHub (read-only)
  { name: "list_pull_requests", toolset: "github", description: "GitHub pull requests synced to Huly; filter by project, issue, state", schema: S.ListPullRequestsSchema, handler: import_github.listPullRequests },
  { name: "get_pull_request", toolset: "github", description: "Pull request with reviews, review comments and linked issue", schema: S.GetPullRequestSchema, handler: import_github.getPullRequest },
  // Contacts (persons)
  { name: "list_persons", toolset: "contacts", description: "Contact persons with their channels", schema: S.ListPersonsSchema, handler: import_contacts.listPersons },
  { name: "get_person", toolset: "contacts", description: "Person details, channels, organizations", schema: S.GetPersonSchema, handler: import_contacts.getPerson },
  { name: "create_person", toolset: "contacts", description: "Create a contact person", schema: S.CreatePersonSchema, handler: import_contacts.createPerson },
  { name: "update_person", toolset: "contacts", description: "Update a contact person", schema: S.UpdatePersonSchema, handler: import_contacts.updatePerson },
  { name: "add_contact_channel", toolset: "contacts", description: "Add email/phone/\u2026 to a person", schema: S.ContactChannelSchema, handler: import_contacts.addContactChannel },
  { name: "remove_contact_channel", toolset: "contacts", description: "Remove email/phone/\u2026 from a person", schema: S.ContactChannelSchema, handler: import_contacts.removeContactChannel },
  // Agent workflow
  { name: "get_issue_context", toolset: "agent", description: "Everything before working on an issue: description, sub-issues, blockers, PRs, comments, branch name. Just the fields: get_issue", schema: S.GetIssueContextSchema, handler: import_agent.getIssueContext },
  { name: "start_work", toolset: "agent", description: "Pick up issue: In Progress, assign me, return context", schema: S.StartWorkSchema, handler: import_agent.startWork },
  { name: "finish_work", toolset: "agent", description: "Hand back: summary comment, link PR, status to review", schema: S.FinishWorkSchema, handler: import_agent.finishWork },
  { name: "create_issue_tree", toolset: "agent", description: "Plan \u2192 epic + sub-issues with blockers; skips duplicates; dry run first", schema: S.CreateIssueTreeSchema, handler: import_agent.createIssueTree },
  { name: "my_day", toolset: "agent", description: "Today for me: calendar, to-dos, my issues, reviews, unread inbox. Since the last working day: standup", schema: S.MyDaySchema, handler: import_overview.myDay },
  { name: "issues_from_document", toolset: "agent", description: "Spec \u2192 epic + sub-issues from a document's open checklist items (else its sections); links the doc. Dry run first", schema: S.IssuesFromDocumentSchema, handler: import_agent.issuesFromDocument },
  { name: "issues_from_meeting", toolset: "agent", description: "Meeting notes \u2192 issues: action items with @assignee and due date; links the doc. Dry run first", schema: S.IssuesFromMeetingSchema, handler: import_agent.issuesFromMeeting },
  { name: "standup", toolset: "agent", description: "Standup: what I did since the last working day, today, blockers. Today's calendar and to-dos: my_day", schema: S.StandupSchema, handler: import_overview.standup },
  { name: "release_notes", toolset: "agent", description: "Release notes from a milestone: features, fixes, PRs, still open", schema: S.ReleaseNotesSchema, handler: import_overview.releaseNotes },
  { name: "project_report", toolset: "agent", description: "One project over a period: done, new, blocked, overdue, PRs, milestones, time. My own work: standup", schema: S.ProjectReportSchema, handler: import_overview.projectReport },
  { name: "changes_since", toolset: "agent", description: "Issues/PRs changed since a time: fields, comments, who", schema: S.ChangesSinceSchema, handler: import_agent.changesSince },
  { name: "claim_issue", toolset: "agent", description: "Lease an issue so parallel agents skip it. start_work with claimAs claims and picks up in one call", schema: S.ClaimIssueSchema, handler: import_agent.claimIssue },
  { name: "find_project_for_repo", toolset: "agent", description: "Huly workspace + project linked to a GitHub repo", schema: S.FindProjectForRepoSchema, handler: import_agent.findProjectForRepo },
  { name: "release_issue", toolset: "agent", description: "Release an agent claim", schema: S.ReleaseIssueSchema, handler: import_agent.releaseIssue },
  // Generic access to any class
  { name: "search", toolset: "generic", description: "Fulltext search across all content (issues, docs, messages, cards, files \u2026); issues only, with status: search_issues", schema: S.SearchAllSchema, handler: import_search.searchAll },
  { name: "list_classes", toolset: "generic", description: "Huly data classes (for modules without dedicated tools)", schema: S.ListClassesSchema, handler: import_generic.listClasses },
  { name: "describe_class", toolset: "generic", description: "Attributes and types of a class", schema: S.DescribeClassSchema, handler: import_generic.describeClass },
  { name: "query_documents", toolset: "generic", description: "Read documents of any class (secrets redacted)", schema: S.QueryDocumentsSchema, handler: import_generic.queryDocuments },
  { name: "generic_create", toolset: "generic-write", description: "Create a document of any class (dry run by default)", schema: S.GenericCreateSchema, handler: import_generic.genericCreate },
  { name: "generic_update", toolset: "generic-write", description: "Update a document of any class (dry run by default)", schema: S.GenericUpdateSchema, handler: import_generic.genericUpdate },
  { name: "generic_delete", toolset: "generic-write", description: "Delete a document of any class (dry run; needs confirm)", schema: S.GenericDeleteSchema, handler: import_generic.genericDelete },
  { name: "list_collaborators", toolset: "collaboration", description: "Who follows an issue or document", schema: S.ListCollaboratorsSchema, handler: import_sharing.listCollaborators },
  { name: "add_collaborator", toolset: "collaboration", description: "Follow an issue/document (you or a member) to get its notifications", schema: S.AddCollaboratorSchema, handler: import_sharing.addCollaborator },
  { name: "remove_collaborator", toolset: "collaboration", description: "Stop following an issue/document", schema: S.RemoveCollaboratorSchema, handler: import_sharing.removeCollaborator },
  { name: "create_public_link", toolset: "collaboration", description: "Read-only guest link for an issue/document (anyone with the link can read)", schema: S.CreatePublicLinkSchema, handler: import_sharing.createPublicLink },
  { name: "list_public_links", toolset: "collaboration", description: "Public guest links", schema: S.ListPublicLinksSchema, handler: import_sharing.listPublicLinks },
  { name: "revoke_public_link", toolset: "collaboration", description: "Revoke a public link", schema: S.RevokePublicLinkSchema, handler: import_sharing.revokePublicLink },
  { name: "list_card_types", toolset: "cards", description: "Card types (MasterTags) and their tags", schema: S.ListCardTypesSchema, handler: import_cards.listCardTypes },
  { name: "list_cards", toolset: "cards", description: "List cards by type, parent or title", schema: S.ListCardsSchema, handler: import_cards.listCards },
  { name: "get_card", toolset: "cards", description: "Card with fields, tags, children and content", schema: S.GetCardSchema, handler: import_cards.getCard },
  { name: "create_card", toolset: "cards", description: "Create a card (type, content, parent, tags, fields)", schema: S.CreateCardSchema, handler: import_cards.createCard },
  { name: "update_card", toolset: "cards", description: "Edit, move or tag a card; set fields", schema: S.UpdateCardSchema, handler: import_cards.updateCard },
  { name: "delete_card", toolset: "cards", description: "Delete a card without children", schema: S.DeleteCardSchema, handler: import_cards.deleteCard },
  { name: "create_card_type", toolset: "cards", description: "New card type or tag", schema: S.CreateCardTypeSchema, handler: import_cards.createCardType },
  { name: "delete_card_type", toolset: "cards", description: "Delete an unused card type or tag", schema: S.DeleteCardTypeSchema, handler: import_cards.deleteCardType },
  { name: "list_custom_fields", toolset: "fields", description: "Custom fields of issues/cards/classes, or values on one object", schema: S.ListCustomFieldsSchema, handler: import_fields.listCustomFields },
  { name: "create_custom_field", toolset: "fields", description: "Add a custom field to issues, a project type, card type or class", schema: S.CreateCustomFieldSchema, handler: import_fields.createCustomField },
  { name: "set_custom_fields", toolset: "fields", description: "Set custom field values on an issue, card or document", schema: S.SetCustomFieldsSchema, handler: import_fields.setCustomFields },
  { name: "list_drives", toolset: "drive", description: "Drives with file counts", schema: S.ListDrivesSchema, handler: import_drive.listDrives },
  { name: "create_drive", toolset: "drive", description: "Create a drive", schema: S.CreateDriveSchema, handler: import_drive.createDrive },
  { name: "list_drive_files", toolset: "drive", description: "Folder tree of a drive with files, sizes, versions", schema: S.ListDriveFilesSchema, handler: import_drive.listDriveFiles },
  { name: "create_folder", toolset: "drive", description: "Create a drive folder", schema: S.CreateFolderSchema, handler: import_drive.createFolder },
  { name: "upload_file", toolset: "drive", description: "Upload a file to a drive (same name \u2192 new version)", schema: S.UploadFileSchema, handler: import_drive.uploadFile },
  { name: "download_file", toolset: "drive", description: "Read a drive file (text inline, binary base64) or save it locally", schema: S.DownloadFileSchema, handler: import_drive.downloadFile },
  { name: "update_drive_item", toolset: "drive", description: "Rename or move a file/folder", schema: S.UpdateDriveItemSchema, handler: import_drive.updateDriveItem },
  { name: "delete_drive_item", toolset: "drive", description: "Delete a file or folder (folders with content need recursive)", schema: S.DeleteDriveItemSchema, handler: import_drive.deleteDriveItem },
  { name: "list_file_versions", toolset: "drive", description: "Versions of a drive file", schema: S.ListFileVersionsSchema, handler: import_drive.listFileVersions },
  { name: "restore_file_version", toolset: "drive", description: "Make an older file version current", schema: S.RestoreFileVersionSchema, handler: import_drive.restoreFileVersion },
  { name: "list_issue_templates", toolset: "templates", description: "Issue templates", schema: S.ListIssueTemplatesSchema, handler: import_templates.listIssueTemplates },
  { name: "get_issue_template", toolset: "templates", description: "Issue template with its sub-issues", schema: S.GetIssueTemplateSchema, handler: import_templates.getIssueTemplate },
  { name: "create_issue_template", toolset: "templates", description: "Create an issue template (with sub-issues)", schema: S.CreateIssueTemplateSchema, handler: import_templates.createIssueTemplate },
  { name: "update_issue_template", toolset: "templates", description: "Update an issue template", schema: S.UpdateIssueTemplateSchema, handler: import_templates.updateIssueTemplate },
  { name: "delete_issue_template", toolset: "templates", description: "Delete an issue template", schema: S.DeleteIssueTemplateSchema, handler: import_templates.deleteIssueTemplate },
  { name: "create_issue_from_template", toolset: "templates", description: "New issue (and sub-issues) from a template", schema: S.CreateIssueFromTemplateSchema, handler: import_templates.createIssueFromTemplate },
  { name: "list_test_projects", toolset: "testing", description: "Test projects with case/run counts", schema: S.ListTestProjectsSchema, handler: TM.listTestProjects },
  { name: "create_test_project", toolset: "testing", description: "Create a test project", schema: S.CreateTestProjectSchema, handler: TM.createTestProject },
  { name: "list_test_cases", toolset: "testing", description: "Suites and test cases of a test project", schema: S.ListTestCasesSchema, handler: TM.listTestCases },
  { name: "create_test_suite", toolset: "testing", description: "Create a (nested) test suite", schema: S.CreateTestSuiteSchema, handler: TM.createTestSuite },
  { name: "get_test_case", toolset: "testing", description: "Test case with steps and latest results", schema: S.GetTestCaseSchema, handler: TM.getTestCase },
  { name: "create_test_case", toolset: "testing", description: "Create a test case in a suite", schema: S.CreateTestCaseSchema, handler: TM.createTestCase },
  { name: "update_test_case", toolset: "testing", description: "Update a test case", schema: S.UpdateTestCaseSchema, handler: TM.updateTestCase },
  { name: "delete_test_case", toolset: "testing", description: "Delete a test case", schema: S.DeleteTestCaseSchema, handler: TM.deleteTestCase },
  { name: "list_test_plans", toolset: "testing", description: "Test plans of a project", schema: S.ListTestPlansSchema, handler: TM.listTestPlans },
  { name: "create_test_plan", toolset: "testing", description: "Test plan from suites and/or cases", schema: S.CreateTestPlanSchema, handler: TM.createTestPlan },
  { name: "create_test_run", toolset: "testing", description: "Start a test run from a plan, suites or cases", schema: S.CreateTestRunSchema, handler: TM.createTestRun },
  { name: "list_test_runs", toolset: "testing", description: "Test runs with pass/fail counts", schema: S.ListTestRunsSchema, handler: TM.listTestRuns },
  { name: "get_test_run", toolset: "testing", description: "Results of a test run", schema: S.GetTestRunSchema, handler: TM.getTestRun },
  { name: "set_test_result", toolset: "testing", description: "Record Passed/Failed/Blocked for a case in a run", schema: S.SetTestResultSchema, handler: TM.setTestResult },
  { name: "create_test_cases", toolset: "testing", description: "Create many test cases in a suite at once", schema: S.CreateTestCasesSchema, handler: TA.createTestCases },
  { name: "update_test_suite", toolset: "testing", description: "Rename, describe or move a suite", schema: S.UpdateTestSuiteSchema, handler: TM.updateTestSuite },
  { name: "delete_test_suite", toolset: "testing", description: "Delete a suite (recursive: with its cases)", schema: S.DeleteTestSuiteSchema, handler: TM.deleteTestSuite },
  { name: "update_test_run", toolset: "testing", description: "Rename a run, set due date or description", schema: S.UpdateTestRunSchema, handler: TM.updateTestRun },
  { name: "delete_test_run", toolset: "testing", description: "Delete a test run with its results", schema: S.DeleteTestRunSchema, handler: TM.deleteTestRun },
  { name: "delete_test_plan", toolset: "testing", description: "Delete a test plan", schema: S.DeleteTestPlanSchema, handler: TM.deleteTestPlan },
  { name: "import_test_results", toolset: "testing", description: "Import a JUnit XML report as a test run (CI results)", schema: S.ImportTestResultsSchema, handler: TA.importTestResults },
  { name: "get_test_report", toolset: "testing", description: "Failing, flaky, blocked and never-run cases over recent runs", schema: S.GetTestReportSchema, handler: TA.getTestReport },
  { name: "test_coverage", toolset: "testing", description: "Which issues of a project or milestone have test cases, with the latest result of each", schema: S.TestCoverageSchema, handler: COV.testCoverage },
  { name: "link_test_case", toolset: "testing", description: "Link a test case to an issue (Related)", schema: S.LinkTestCaseSchema, handler: COV.linkTestCase },
  { name: "release_check", toolset: "testing", description: "Is a milestone ready to ship: open and blocked issues, open PRs, failing or missing tests, target date \u2014 with a verdict", schema: S.ReleaseCheckSchema, handler: COV.releaseCheck },
  { name: "create_issue_from_test_result", toolset: "testing", description: "File a bug from a failed test result (steps + failure, linked)", schema: S.CreateIssueFromTestResultSchema, handler: TA.createIssueFromTestResult },
  { name: "list_products", toolset: "products", description: "Products with their active versions", schema: S.ListProductsSchema, handler: import_products.listProducts },
  { name: "get_product", toolset: "products", description: "Product with all versions", schema: S.GetProductSchema, handler: import_products.getProduct },
  { name: "list_label_categories", toolset: "tracker-admin", description: "Issue label categories with their labels", schema: S.ListLabelCategoriesSchema, handler: import_labels.listLabelCategories },
  { name: "create_label_category", toolset: "tracker-admin", description: "Create an issue label category", schema: S.CreateLabelCategorySchema, handler: import_labels.createLabelCategory },
  { name: "set_label_category", toolset: "tracker-admin", description: "Move a label into a category", schema: S.SetLabelCategorySchema, handler: import_labels.setLabelCategory },
  { name: "list_project_types", toolset: "tracker-admin", description: "Project types with task types and their status workflows", schema: S.ListProjectTypesSchema, handler: import_workspace_admin.listProjectTypes },
  { name: "list_modules", toolset: "admin", description: "Workspace modules (apps) and whether they are on", schema: S.ListModulesSchema, handler: ADM.listModules },
  { name: "set_module", toolset: "admin", description: "Switch a workspace module on or off for everyone (Settings \u2192 Configure)", schema: S.SetModuleSchema, handler: ADM.setModule },
  { name: "update_workspace_settings", toolset: "admin", description: "Workspace name, guest access, password expiry", schema: S.UpdateWorkspaceSettingsSchema, handler: ADM.updateWorkspaceSettings },
  { name: "get_my_profile", toolset: "admin", description: "Your name, profile and login identities", schema: S.GetMyProfileSchema, handler: ADM.getMyProfile },
  { name: "update_my_profile", toolset: "admin", description: "Change your name, bio, city, website, social links", schema: S.UpdateMyProfileSchema, handler: ADM.updateMyProfile },
  { name: "create_workspace", toolset: "admin", description: "Create a new workspace (you become owner); then setup_workspace", schema: S.CreateWorkspaceSchema, handler: ADM.createWorkspace },
  { name: "setup_workspace", toolset: "admin", description: "Set a workspace up from a template: modules, statuses, projects with components and milestones, teamspaces. Dry run first; reuses what exists", schema: S.SetupWorkspaceSchema, handler: ADM.setupWorkspace },
  { name: "huly_api", toolset: "admin", description: "Call an account-service method directly (like gh api): read methods, and writes with dry run. Deletes, logins and secrets are excluded", schema: S.HulyApiSchema, handler: ADM.hulyApi },
  { name: "get_workspace_settings", toolset: "members", description: "Workspace info: your role, members per role, invite defaults, integrations", schema: S.GetWorkspaceSettingsSchema, handler: import_workspace_admin.getWorkspaceSettings },
  { name: "create_invite_link", toolset: "members", description: "Create an invite link (personal for an e-mail, or with use limit/e-mail mask); sends nothing", schema: S.CreateInviteLinkSchema, handler: import_workspace_admin.createInviteLink },
  { name: "send_invite", toolset: "members", description: "Send an invitation e-mail to join the workspace", schema: S.SendInviteSchema, handler: import_workspace_admin.sendInvite },
  { name: "set_member_role", toolset: "members", description: "Change a member's workspace role", schema: S.SetMemberRoleSchema, handler: import_workspace_admin.setMemberRole },
  { name: "list_vacancies", toolset: "recruiting", description: "Vacancies with application counts per status", schema: S.ListVacanciesSchema, handler: REC.listVacancies },
  { name: "create_vacancy", toolset: "recruiting", description: "Create a vacancy", schema: S.CreateVacancySchema, handler: REC.createVacancy },
  { name: "update_vacancy", toolset: "recruiting", description: "Rename, describe, set location/due date, archive a vacancy", schema: S.UpdateVacancySchema, handler: REC.updateVacancy },
  { name: "list_candidates", toolset: "recruiting", description: "Candidates (talents) with title and application count", schema: S.ListCandidatesSchema, handler: REC.listCandidates },
  { name: "create_candidate", toolset: "recruiting", description: "Create a candidate (person with title, e-mail, onsite/remote)", schema: S.CreateCandidateSchema, handler: REC.createCandidate },
  { name: "list_applications", toolset: "recruiting", description: "Applications (APP-n) by vacancy/status", schema: S.ListApplicationsSchema, handler: REC.listApplications },
  { name: "create_application", toolset: "recruiting", description: "Apply a candidate to a vacancy", schema: S.CreateApplicationSchema, handler: REC.createApplication },
  { name: "update_application", toolset: "recruiting", description: "Move an application to a status or assign a recruiter", schema: S.UpdateApplicationSchema, handler: REC.updateApplication },
  { name: "delete_application", toolset: "recruiting", description: "Delete an application", schema: S.DeleteApplicationSchema, handler: REC.deleteApplication },
  { name: "list_leads", toolset: "crm", description: "Leads (LEAD-n) by funnel/status with customer", schema: S.ListLeadsSchema, handler: CRM.listLeads },
  { name: "list_customers", toolset: "crm", description: "Customers with lead counts", schema: S.ListCustomersSchema, handler: CRM.listCustomers },
  { name: "create_lead", toolset: "crm", description: "Create a lead for a customer (optionally creating the customer)", schema: S.CreateLeadSchema, handler: CRM.createLead },
  { name: "update_lead", toolset: "crm", description: "Rename, move to a status or assign a lead", schema: S.UpdateLeadSchema, handler: CRM.updateLead },
  { name: "delete_lead", toolset: "crm", description: "Delete a lead", schema: S.DeleteLeadSchema, handler: CRM.deleteLead },
  { name: "list_departments", toolset: "hr", description: "Department tree with team leads and members", schema: S.ListDepartmentsSchema, handler: HRT.listDepartments },
  { name: "create_department", toolset: "hr", description: "Create a department", schema: S.CreateDepartmentSchema, handler: HRT.createDepartment },
  { name: "delete_department", toolset: "hr", description: "Delete a department without sub-departments", schema: S.DeleteDepartmentSchema, handler: HRT.deleteDepartment },
  { name: "set_department", toolset: "hr", description: "Move a member to a department", schema: S.SetDepartmentSchema, handler: HRT.setDepartment },
  { name: "list_time_off", toolset: "hr", description: "Vacation, sick days, PTO, overtime, remote days in a date range", schema: S.ListTimeOffSchema, handler: HRT.listTimeOff },
  { name: "create_time_off", toolset: "hr", description: "Record vacation/sick/PTO/overtime/remote days", schema: S.CreateTimeOffSchema, handler: HRT.createTimeOff },
  { name: "delete_time_off", toolset: "hr", description: "Delete a time-off entry", schema: S.DeleteTimeOffSchema, handler: HRT.deleteTimeOff },
  { name: "list_inventory", toolset: "inventory", description: "Inventory tree: categories, products, variants (SKU)", schema: S.ListInventorySchema, handler: INVT.listInventory },
  { name: "create_inventory_category", toolset: "inventory", description: "Create an inventory category", schema: S.CreateInventoryCategorySchema, handler: INVT.createInventoryCategory },
  { name: "create_inventory_product", toolset: "inventory", description: "Create a product (with variants) in a category", schema: S.CreateInventoryProductSchema, handler: INVT.createInventoryProduct },
  { name: "update_inventory_item", toolset: "inventory", description: "Rename, change SKU or move an inventory item", schema: S.UpdateInventoryItemSchema, handler: INVT.updateInventoryItem },
  { name: "delete_inventory_item", toolset: "inventory", description: "Delete a category, product or variant", schema: S.DeleteInventoryItemSchema, handler: INVT.deleteInventoryItem },
  { name: "list_message_templates", toolset: "templates", description: "Message templates by category", schema: S.ListMessageTemplatesSchema, handler: MTT.listMessageTemplates },
  { name: "get_message_template", toolset: "templates", description: "Full text and placeholders of a message template", schema: S.GetMessageTemplateSchema, handler: MTT.getMessageTemplate },
  { name: "create_message_template", toolset: "templates", description: "Create a message template", schema: S.CreateMessageTemplateSchema, handler: MTT.createMessageTemplate },
  { name: "update_message_template", toolset: "templates", description: "Change a message template", schema: S.UpdateMessageTemplateSchema, handler: MTT.updateMessageTemplate },
  { name: "delete_message_template", toolset: "templates", description: "Delete a message template", schema: S.DeleteMessageTemplateSchema, handler: MTT.deleteMessageTemplate },
  { name: "list_meetings", toolset: "meetings", description: "Office rooms and meeting minutes", schema: S.ListMeetingsSchema, handler: MEET.listMeetings },
  { name: "get_meeting", toolset: "meetings", description: "Meeting minutes: participants, notes, action items, transcript", schema: S.GetMeetingSchema, handler: MEET.getMeeting },
  { name: "list_controlled_documents", toolset: "qms", description: "Controlled (QMS) documents per space with version and state", schema: S.ListControlledDocumentsSchema, handler: QMST.listControlledDocuments },
  { name: "get_controlled_document", toolset: "qms", description: "Controlled document: state, people, requests, versions, content", schema: S.GetControlledDocumentSchema, handler: QMST.getControlledDocument },
  { name: "list_trainings", toolset: "qms", description: "Trainings (latest revision)", schema: S.ListTrainingsSchema, handler: QMST.listTrainings },
  { name: "get_training", toolset: "qms", description: "Training questions and trainee results", schema: S.GetTrainingSchema, handler: QMST.getTraining },
  { name: "create_training", toolset: "qms", description: "Create a training draft (code TR-n) with scored or open questions: single, multiple, ordering. Then release_training", schema: S.CreateTrainingSchema, handler: TRN.createTraining },
  { name: "add_training_questions", toolset: "qms", description: "Add questions to a training draft", schema: S.AddTrainingQuestionsSchema, handler: TRN.addTrainingQuestions },
  { name: "release_training", toolset: "qms", description: "Release a training draft so it can be assigned; archives the earlier released revision", schema: S.ReleaseTrainingSchema, handler: TRN.releaseTraining },
  { name: "assign_training", toolset: "qms", description: "Assign a released training to people, with due date and max attempts. Progress: get_training", schema: S.AssignTrainingSchema, handler: TRN.assignTraining },
  { name: "cancel_training_request", toolset: "qms", description: "Cancel a training assignment (id from get_training)", schema: S.CancelTrainingRequestSchema, handler: TRN.cancelTrainingRequest },
  { name: "list_processes", toolset: "process", description: "Process definitions: states and transitions", schema: S.ListProcessesSchema, handler: PROC.listProcesses },
  { name: "list_executions", toolset: "process", description: "Running/finished process executions with current state", schema: S.ListExecutionsSchema, handler: PROC.listExecutions },
  { name: "start_process", toolset: "process", description: "Run a process on a card", schema: S.StartProcessSchema, handler: PROC.startProcess },
  { name: "cancel_execution", toolset: "process", description: "Cancel a running process execution", schema: S.CancelExecutionSchema, handler: PROC.cancelExecution },
  { name: "list_surveys", toolset: "surveys", description: "Surveys with poll counts", schema: S.ListSurveysSchema, handler: SURV.listSurveys },
  { name: "get_survey", toolset: "surveys", description: "Survey questions with aggregated poll answers", schema: S.GetSurveySchema, handler: SURV.getSurvey }
];
