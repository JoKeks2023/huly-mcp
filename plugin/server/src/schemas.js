var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var schemas_exports = {};
__export(schemas_exports, {
  AddBlockedBySchema: () => AddBlockedBySchema,
  AddCollaboratorSchema: () => AddCollaboratorSchema,
  AddCommentSchema: () => AddCommentSchema,
  AddDocumentCommentSchema: () => AddDocumentCommentSchema,
  AddLabelSchema: () => AddLabelSchema,
  AddRelationSchema: () => AddRelationSchema,
  AddTrainingQuestionsSchema: () => AddTrainingQuestionsSchema,
  AssignTrainingSchema: () => AssignTrainingSchema,
  AttachFileSchema: () => AttachFileSchema,
  BulkUpdateIssuesSchema: () => BulkUpdateIssuesSchema,
  CancelExecutionSchema: () => CancelExecutionSchema,
  CancelTrainingRequestSchema: () => CancelTrainingRequestSchema,
  ChangesSinceSchema: () => ChangesSinceSchema,
  CheckSetupSchema: () => CheckSetupSchema,
  ClaimIssueSchema: () => ClaimIssueSchema,
  ContactChannelSchema: () => ContactChannelSchema,
  CreateApplicationSchema: () => CreateApplicationSchema,
  CreateCandidateSchema: () => CreateCandidateSchema,
  CreateCardSchema: () => CreateCardSchema,
  CreateCardTypeSchema: () => CreateCardTypeSchema,
  CreateChannelSchema: () => CreateChannelSchema,
  CreateComponentSchema: () => CreateComponentSchema,
  CreateCustomFieldSchema: () => CreateCustomFieldSchema,
  CreateDepartmentSchema: () => CreateDepartmentSchema,
  CreateDocumentSchema: () => CreateDocumentSchema,
  CreateDriveSchema: () => CreateDriveSchema,
  CreateEventSchema: () => CreateEventSchema,
  CreateFolderSchema: () => CreateFolderSchema,
  CreateInventoryCategorySchema: () => CreateInventoryCategorySchema,
  CreateInventoryProductSchema: () => CreateInventoryProductSchema,
  CreateInviteLinkSchema: () => CreateInviteLinkSchema,
  CreateIssueFromTemplateSchema: () => CreateIssueFromTemplateSchema,
  CreateIssueFromTestResultSchema: () => CreateIssueFromTestResultSchema,
  CreateIssueSchema: () => CreateIssueSchema,
  CreateIssueStatusSchema: () => CreateIssueStatusSchema,
  CreateIssueTemplateSchema: () => CreateIssueTemplateSchema,
  CreateIssueTreeSchema: () => CreateIssueTreeSchema,
  CreateLabelCategorySchema: () => CreateLabelCategorySchema,
  CreateLabelSchema: () => CreateLabelSchema,
  CreateLeadSchema: () => CreateLeadSchema,
  CreateMessageTemplateSchema: () => CreateMessageTemplateSchema,
  CreateMilestoneSchema: () => CreateMilestoneSchema,
  CreateOrganizationSchema: () => CreateOrganizationSchema,
  CreatePersonSchema: () => CreatePersonSchema,
  CreateProjectSchema: () => CreateProjectSchema,
  CreatePublicLinkSchema: () => CreatePublicLinkSchema,
  CreateTeamspaceSchema: () => CreateTeamspaceSchema,
  CreateTestCaseSchema: () => CreateTestCaseSchema,
  CreateTestCasesSchema: () => CreateTestCasesSchema,
  CreateTestPlanSchema: () => CreateTestPlanSchema,
  CreateTestProjectSchema: () => CreateTestProjectSchema,
  CreateTestRunSchema: () => CreateTestRunSchema,
  CreateTestSuiteSchema: () => CreateTestSuiteSchema,
  CreateTimeOffSchema: () => CreateTimeOffSchema,
  CreateTodoSchema: () => CreateTodoSchema,
  CreateTrainingSchema: () => CreateTrainingSchema,
  CreateVacancySchema: () => CreateVacancySchema,
  CreateWorkspaceSchema: () => CreateWorkspaceSchema,
  DeleteApplicationSchema: () => DeleteApplicationSchema,
  DeleteAttachmentSchema: () => DeleteAttachmentSchema,
  DeleteCardSchema: () => DeleteCardSchema,
  DeleteCardTypeSchema: () => DeleteCardTypeSchema,
  DeleteCommentSchema: () => DeleteCommentSchema,
  DeleteComponentSchema: () => DeleteComponentSchema,
  DeleteDepartmentSchema: () => DeleteDepartmentSchema,
  DeleteDocumentSchema: () => DeleteDocumentSchema,
  DeleteDriveItemSchema: () => DeleteDriveItemSchema,
  DeleteEventSchema: () => DeleteEventSchema,
  DeleteInventoryItemSchema: () => DeleteInventoryItemSchema,
  DeleteIssueSchema: () => DeleteIssueSchema,
  DeleteIssueTemplateSchema: () => DeleteIssueTemplateSchema,
  DeleteLabelSchema: () => DeleteLabelSchema,
  DeleteLeadSchema: () => DeleteLeadSchema,
  DeleteMessageSchema: () => DeleteMessageSchema,
  DeleteMessageTemplateSchema: () => DeleteMessageTemplateSchema,
  DeleteMilestoneSchema: () => DeleteMilestoneSchema,
  DeleteTestCaseSchema: () => DeleteTestCaseSchema,
  DeleteTestPlanSchema: () => DeleteTestPlanSchema,
  DeleteTestRunSchema: () => DeleteTestRunSchema,
  DeleteTestSuiteSchema: () => DeleteTestSuiteSchema,
  DeleteTimeOffSchema: () => DeleteTimeOffSchema,
  DeleteTodoSchema: () => DeleteTodoSchema,
  DescribeClassSchema: () => DescribeClassSchema,
  DownloadFileSchema: () => DownloadFileSchema,
  FindProjectForRepoSchema: () => FindProjectForRepoSchema,
  FinishWorkSchema: () => FinishWorkSchema,
  GenericCreateSchema: () => GenericCreateSchema,
  GenericDeleteSchema: () => GenericDeleteSchema,
  GenericUpdateSchema: () => GenericUpdateSchema,
  GetActivitySchema: () => GetActivitySchema,
  GetCardSchema: () => GetCardSchema,
  GetControlledDocumentSchema: () => GetControlledDocumentSchema,
  GetDocumentSchema: () => GetDocumentSchema,
  GetIssueContextSchema: () => GetIssueContextSchema,
  GetIssueSchema: () => GetIssueSchema,
  GetIssueTemplateSchema: () => GetIssueTemplateSchema,
  GetMeetingSchema: () => GetMeetingSchema,
  GetMessageTemplateSchema: () => GetMessageTemplateSchema,
  GetMilestoneSchema: () => GetMilestoneSchema,
  GetMyProfileSchema: () => GetMyProfileSchema,
  GetOrganizationSchema: () => GetOrganizationSchema,
  GetPersonSchema: () => GetPersonSchema,
  GetProductSchema: () => GetProductSchema,
  GetProjectSchema: () => GetProjectSchema,
  GetPullRequestSchema: () => GetPullRequestSchema,
  GetSurveySchema: () => GetSurveySchema,
  GetTestCaseSchema: () => GetTestCaseSchema,
  GetTestReportSchema: () => GetTestReportSchema,
  GetTestRunSchema: () => GetTestRunSchema,
  GetTrainingSchema: () => GetTrainingSchema,
  GetWorkspaceSettingsSchema: () => GetWorkspaceSettingsSchema,
  HulyApiSchema: () => HulyApiSchema,
  ImportTestResultsSchema: () => ImportTestResultsSchema,
  IssuesFromDocumentSchema: () => IssuesFromDocumentSchema,
  IssuesFromMeetingSchema: () => IssuesFromMeetingSchema,
  LinkDocumentSchema: () => LinkDocumentSchema,
  LinkTestCaseSchema: () => LinkTestCaseSchema,
  ListApplicationsSchema: () => ListApplicationsSchema,
  ListAttachmentsSchema: () => ListAttachmentsSchema,
  ListCandidatesSchema: () => ListCandidatesSchema,
  ListCardTypesSchema: () => ListCardTypesSchema,
  ListCardsSchema: () => ListCardsSchema,
  ListChannelsSchema: () => ListChannelsSchema,
  ListClassesSchema: () => ListClassesSchema,
  ListCollaboratorsSchema: () => ListCollaboratorsSchema,
  ListCommentsSchema: () => ListCommentsSchema,
  ListComponentsSchema: () => ListComponentsSchema,
  ListControlledDocumentsSchema: () => ListControlledDocumentsSchema,
  ListCustomFieldsSchema: () => ListCustomFieldsSchema,
  ListCustomersSchema: () => ListCustomersSchema,
  ListDepartmentsSchema: () => ListDepartmentsSchema,
  ListDocumentCommentsSchema: () => ListDocumentCommentsSchema,
  ListDocumentsSchema: () => ListDocumentsSchema,
  ListDriveFilesSchema: () => ListDriveFilesSchema,
  ListDrivesSchema: () => ListDrivesSchema,
  ListEventsSchema: () => ListEventsSchema,
  ListExecutionsSchema: () => ListExecutionsSchema,
  ListFileVersionsSchema: () => ListFileVersionsSchema,
  ListInventorySchema: () => ListInventorySchema,
  ListIssueStatusesSchema: () => ListIssueStatusesSchema,
  ListIssueTemplatesSchema: () => ListIssueTemplatesSchema,
  ListIssuesSchema: () => ListIssuesSchema,
  ListLabelCategoriesSchema: () => ListLabelCategoriesSchema,
  ListLabelsSchema: () => ListLabelsSchema,
  ListLeadsSchema: () => ListLeadsSchema,
  ListMeetingsSchema: () => ListMeetingsSchema,
  ListMembersSchema: () => ListMembersSchema,
  ListMessageTemplatesSchema: () => ListMessageTemplatesSchema,
  ListMessagesSchema: () => ListMessagesSchema,
  ListMilestonesSchema: () => ListMilestonesSchema,
  ListModulesSchema: () => ListModulesSchema,
  ListNotificationsSchema: () => ListNotificationsSchema,
  ListOrganizationsSchema: () => ListOrganizationsSchema,
  ListPersonsSchema: () => ListPersonsSchema,
  ListProcessesSchema: () => ListProcessesSchema,
  ListProductsSchema: () => ListProductsSchema,
  ListProjectTypesSchema: () => ListProjectTypesSchema,
  ListProjectsSchema: () => ListProjectsSchema,
  ListPublicLinksSchema: () => ListPublicLinksSchema,
  ListPullRequestsSchema: () => ListPullRequestsSchema,
  ListSubIssuesSchema: () => ListSubIssuesSchema,
  ListSurveysSchema: () => ListSurveysSchema,
  ListTeamspacesSchema: () => ListTeamspacesSchema,
  ListTestCasesSchema: () => ListTestCasesSchema,
  ListTestPlansSchema: () => ListTestPlansSchema,
  ListTestProjectsSchema: () => ListTestProjectsSchema,
  ListTestRunsSchema: () => ListTestRunsSchema,
  ListThreadSchema: () => ListThreadSchema,
  ListTimeOffSchema: () => ListTimeOffSchema,
  ListTimeReportsSchema: () => ListTimeReportsSchema,
  ListTodosSchema: () => ListTodosSchema,
  ListTrainingsSchema: () => ListTrainingsSchema,
  ListVacanciesSchema: () => ListVacanciesSchema,
  ListWorkspacesSchema: () => ListWorkspacesSchema,
  LogTimeSchema: () => LogTimeSchema,
  ManageNotificationsSchema: () => ManageNotificationsSchema,
  MarkNotificationsReadSchema: () => MarkNotificationsReadSchema,
  MoveIssueSchema: () => MoveIssueSchema,
  MyDaySchema: () => MyDaySchema,
  PinMessageSchema: () => PinMessageSchema,
  ProjectReportSchema: () => ProjectReportSchema,
  QueryDocumentsSchema: () => QueryDocumentsSchema,
  ReactionSchema: () => ReactionSchema,
  ReleaseCheckSchema: () => ReleaseCheckSchema,
  ReleaseIssueSchema: () => ReleaseIssueSchema,
  ReleaseNotesSchema: () => ReleaseNotesSchema,
  ReleaseTrainingSchema: () => ReleaseTrainingSchema,
  RemoveBlockedBySchema: () => RemoveBlockedBySchema,
  RemoveCollaboratorSchema: () => RemoveCollaboratorSchema,
  RemoveLabelSchema: () => RemoveLabelSchema,
  RemoveRelationSchema: () => RemoveRelationSchema,
  RepairParentLinksSchema: () => RepairParentLinksSchema,
  ReplyToMessageSchema: () => ReplyToMessageSchema,
  RestoreFileVersionSchema: () => RestoreFileVersionSchema,
  RevokePublicLinkSchema: () => RevokePublicLinkSchema,
  ScheduleTodoSchema: () => ScheduleTodoSchema,
  SearchAllSchema: () => SearchAllSchema,
  SearchIssuesSchema: () => SearchIssuesSchema,
  SendInviteSchema: () => SendInviteSchema,
  SendMessageSchema: () => SendMessageSchema,
  SetCustomFieldsSchema: () => SetCustomFieldsSchema,
  SetDepartmentSchema: () => SetDepartmentSchema,
  SetLabelCategorySchema: () => SetLabelCategorySchema,
  SetMemberRoleSchema: () => SetMemberRoleSchema,
  SetModuleSchema: () => SetModuleSchema,
  SetParentSchema: () => SetParentSchema,
  SetTestResultSchema: () => SetTestResultSchema,
  SetupWorkspaceSchema: () => SetupWorkspaceSchema,
  StandupSchema: () => StandupSchema,
  StartDirectMessageSchema: () => StartDirectMessageSchema,
  StartProcessSchema: () => StartProcessSchema,
  StartWorkSchema: () => StartWorkSchema,
  TestCoverageSchema: () => TestCoverageSchema,
  TimesheetSchema: () => TimesheetSchema,
  TrainingQuestionSchema: () => TrainingQuestionSchema,
  TriageInboxSchema: () => TriageInboxSchema,
  UndoChangesSchema: () => UndoChangesSchema,
  UpdateApplicationSchema: () => UpdateApplicationSchema,
  UpdateCardSchema: () => UpdateCardSchema,
  UpdateCommentSchema: () => UpdateCommentSchema,
  UpdateComponentSchema: () => UpdateComponentSchema,
  UpdateDocumentSchema: () => UpdateDocumentSchema,
  UpdateDriveItemSchema: () => UpdateDriveItemSchema,
  UpdateEventSchema: () => UpdateEventSchema,
  UpdateInventoryItemSchema: () => UpdateInventoryItemSchema,
  UpdateIssueSchema: () => UpdateIssueSchema,
  UpdateIssueTemplateSchema: () => UpdateIssueTemplateSchema,
  UpdateLabelSchema: () => UpdateLabelSchema,
  UpdateLeadSchema: () => UpdateLeadSchema,
  UpdateMessageSchema: () => UpdateMessageSchema,
  UpdateMessageTemplateSchema: () => UpdateMessageTemplateSchema,
  UpdateMilestoneSchema: () => UpdateMilestoneSchema,
  UpdateMyProfileSchema: () => UpdateMyProfileSchema,
  UpdateOrganizationSchema: () => UpdateOrganizationSchema,
  UpdatePersonSchema: () => UpdatePersonSchema,
  UpdateProjectSchema: () => UpdateProjectSchema,
  UpdateTestCaseSchema: () => UpdateTestCaseSchema,
  UpdateTestRunSchema: () => UpdateTestRunSchema,
  UpdateTestSuiteSchema: () => UpdateTestSuiteSchema,
  UpdateTodoSchema: () => UpdateTodoSchema,
  UpdateVacancySchema: () => UpdateVacancySchema,
  UpdateWorkspaceSettingsSchema: () => UpdateWorkspaceSettingsSchema,
  UploadFileSchema: () => UploadFileSchema
});
module.exports = __toCommonJS(schemas_exports);
var import_zod = require("../vendor/zod/index.cjs");
const WorkspaceArg = import_zod.z.string().min(1);
const ReadWorkspaceArg = import_zod.z.string().min(1).optional();
const PriorityEnum = import_zod.z.enum(["NoPriority", "Urgent", "High", "Medium", "Low"]);
const ListWorkspacesSchema = import_zod.z.object({});
const UndoChangesSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  count: import_zod.z.number().int().min(1).max(20).default(1).describe("How many of your last changes"),
  dryRun: import_zod.z.boolean().default(true).describe("Only show what would be undone"),
  force: import_zod.z.boolean().optional().describe("Undo even if someone changed the object since")
});
const CheckSetupSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  skipVersionCheck: import_zod.z.boolean().optional().describe("Skip asking npm for the latest version")
});
const ListProjectsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg
});
const ListMembersSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg
});
const ListTeamspacesSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg
});
const GetProjectSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  identifier: import_zod.z.string().describe("Project key")
});
const ListIssuesSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  status: import_zod.z.string().optional().describe('Status name, "open" (default) or "all"'),
  priority: PriorityEnum.optional().describe("Filter by priority"),
  milestoneLabel: import_zod.z.string().min(1).nullable().optional().describe("Milestone name; null = none"),
  componentLabel: import_zod.z.string().min(1).nullable().optional().describe("Component name; null = none"),
  labelName: import_zod.z.string().min(1).optional().describe("Filter by label name"),
  assignee: import_zod.z.string().min(1).nullable().optional().describe("Person name; null = unassigned"),
  parentIdentifier: import_zod.z.string().min(1).nullable().optional().describe("Direct sub-issues of this issue; null = top-level only"),
  title: import_zod.z.string().min(1).optional().describe("Title contains this text"),
  due: import_zod.z.enum(["overdue", "set", "none"]).optional().describe("Due date: overdue, set or none"),
  blocked: import_zod.z.boolean().optional().describe("true: only issues waiting for an open blocker"),
  limit: import_zod.z.number().int().min(1).max(250).default(50),
  offset: import_zod.z.number().int().min(0).optional()
});
const GetIssueSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id")
});
const CreateIssueSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  title: import_zod.z.string().min(1).describe("Issue title"),
  description: import_zod.z.string().optional().describe("Issue description as Markdown (headings, bold, code, lists, tables, mermaid supported)"),
  priority: PriorityEnum.default("NoPriority").describe("Issue priority"),
  statusName: import_zod.z.string().optional().describe("Default: project default"),
  dueDate: import_zod.z.string().optional().describe('Due date as ISO 8601 string, e.g. "2026-04-01"'),
  assignee: import_zod.z.string().optional(),
  componentLabel: import_zod.z.string().optional(),
  milestoneLabel: import_zod.z.string().optional(),
  parentIdentifier: import_zod.z.string().optional().describe("Create as sub-issue of this issue (e.g. PROJ-12)")
});
const DeleteIssueSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe('Issue identifier to delete, e.g. "PROJ-123"')
});
const UpdateIssueSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  title: import_zod.z.string().optional(),
  description: import_zod.z.string().optional().describe("Markdown, replaces existing"),
  statusName: import_zod.z.string().optional(),
  priority: PriorityEnum.optional(),
  dueDate: import_zod.z.string().nullable().optional().describe("null clears"),
  assignee: import_zod.z.string().nullable().optional().describe("Person name; null clears"),
  componentLabel: import_zod.z.string().nullable().optional().describe("Component name; null clears"),
  milestoneLabel: import_zod.z.string().nullable().optional().describe("Milestone name; null clears")
});
const AddCommentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  message: import_zod.z.string().min(1)
});
const ListMilestonesSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key")
});
const MilestoneStatusEnum = import_zod.z.enum(["Planned", "InProgress", "Completed", "Canceled"]);
const CreateMilestoneSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  label: import_zod.z.string().min(1),
  targetDate: import_zod.z.string().describe("ISO date"),
  status: MilestoneStatusEnum.default("Planned")
});
const GetMilestoneSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  label: import_zod.z.string().min(1)
});
const UpdateMilestoneSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  label: import_zod.z.string().min(1),
  newLabel: import_zod.z.string().min(1).optional(),
  targetDate: import_zod.z.string().optional().describe("ISO date"),
  status: MilestoneStatusEnum.optional(),
  description: import_zod.z.string().nullable().optional().describe("Markdown; null clears")
});
const DeleteMilestoneSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  label: import_zod.z.string().min(1),
  moveIssuesTo: import_zod.z.string().min(1).optional().describe("Move its issues here; omitted = issues lose the milestone")
});
const ListComponentsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key")
});
const CreateComponentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  label: import_zod.z.string().min(1).describe("Component name"),
  description: import_zod.z.string().optional(),
  lead: import_zod.z.string().optional().describe("Person name")
});
const UpdateComponentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  label: import_zod.z.string().min(1),
  newLabel: import_zod.z.string().min(1).optional(),
  description: import_zod.z.string().nullable().optional().describe("Markdown; null clears"),
  lead: import_zod.z.string().nullable().optional().describe("Person name; null clears")
});
const DeleteComponentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  label: import_zod.z.string().min(1),
  moveIssuesTo: import_zod.z.string().min(1).optional().describe("Move its issues here; omitted = issues lose the component")
});
const CreateProjectSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  name: import_zod.z.string().min(1).describe("Project name"),
  identifier: import_zod.z.string().min(1).max(5).regex(/^[A-Z]+$/).describe("ALL-CAPS key, max 5 letters"),
  description: import_zod.z.string().optional()
});
const DeleteDocumentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  documentId: import_zod.z.string().describe("Document _id to delete (from list_documents)")
});
const CreateTeamspaceSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  name: import_zod.z.string().min(1),
  description: import_zod.z.string().optional(),
  isPrivate: import_zod.z.boolean().default(false).describe("Private teamspace")
});
const ListDocumentsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  teamspaceId: import_zod.z.string().describe("Teamspace id")
});
const GetDocumentSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  documentId: import_zod.z.string().describe("Document _id from list_documents")
});
const CreateDocumentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  teamspaceId: import_zod.z.string().describe("Teamspace id"),
  title: import_zod.z.string().min(1).describe("Document title"),
  parentId: import_zod.z.string().optional().describe("Parent document id; omit for top-level")
});
const SearchIssuesSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  query: import_zod.z.string().min(1),
  limit: import_zod.z.number().int().min(1).max(50).default(20)
});
const SearchAllSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  query: import_zod.z.string().min(1),
  kinds: import_zod.z.array(import_zod.z.string()).optional().describe("issue, document, message, card, file, person, organization, test-case, attachment or a class id"),
  limit: import_zod.z.number().int().min(1).max(50).default(20)
});
const ListLabelsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: import_zod.z.string().optional().describe("Ignored (labels are workspace-wide)")
});
const CreateLabelSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  title: import_zod.z.string().min(1).describe("Label name"),
  color: import_zod.z.string().optional().describe("Hex color, e.g. #FF6B6B")
});
const AddLabelSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  labelName: import_zod.z.string().min(1).describe("Label name to add (auto-created if it does not exist)")
});
const RemoveLabelSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  labelName: import_zod.z.string().min(1)
});
const AddRelationSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  relatedTo: import_zod.z.string().describe("Related issue id")
});
const AddBlockedBySchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Blocked issue id"),
  blockedBy: import_zod.z.string().describe('Issue that blocks it, e.g. "PROJ-100"')
});
const SetParentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe('Child issue identifier, e.g. "PROJ-123"'),
  parentIdentifier: import_zod.z.string().nullable().optional().describe("Parent issue id; null clears")
});
const ListCommentsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  limit: import_zod.z.number().int().min(1).max(100).default(20).describe("Newest n"),
  full: import_zod.z.boolean().optional().describe("Do not shorten long comments")
});
const LogTimeSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  hours: import_zod.z.number().positive().describe("Hours spent (e.g. 2.5)"),
  description: import_zod.z.string().optional().describe("Note")
});
const UpdateDocumentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  documentId: import_zod.z.string().describe("Document id"),
  markdown: import_zod.z.string().min(1).optional().describe("New body (replaces content)"),
  title: import_zod.z.string().min(1).optional(),
  parentId: import_zod.z.string().nullable().optional().describe("Move under this document; null = top level"),
  teamspaceId: import_zod.z.string().optional().describe("Move to this teamspace")
});
const ListDocumentCommentsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  documentId: import_zod.z.string(),
  limit: import_zod.z.number().int().min(1).max(200).default(50)
});
const AddDocumentCommentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  documentId: import_zod.z.string(),
  message: import_zod.z.string().min(1)
});
const DeleteCommentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  commentId: import_zod.z.string().describe("Comment _id from list_comments")
});
const LinkDocumentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  documentId: import_zod.z.string().describe("Document id")
});
const ListChannelsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  includeArchived: import_zod.z.boolean().default(false).describe("Include archived channels")
});
const CreateChannelSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  name: import_zod.z.string().min(1),
  topic: import_zod.z.string().optional().describe("Optional channel topic/description"),
  isPrivate: import_zod.z.boolean().default(false).describe("Invite-only")
});
const StartDirectMessageSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  member: import_zod.z.string().min(1).describe("Person name")
});
const SendMessageSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  spaceId: import_zod.z.string().describe("Channel or direct-message _id, from list_channels/create_channel/start_direct_message"),
  message: import_zod.z.string().min(1)
});
const ListMessagesSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  spaceId: import_zod.z.string().describe("Channel or direct-message _id"),
  limit: import_zod.z.number().int().min(1).max(200).default(50)
});
const AttachFileSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe('Issue identifier to attach the file to, e.g. "PROJ-123"'),
  filename: import_zod.z.string().min(1).describe('File name, e.g. "screenshot.png"'),
  contentBase64: import_zod.z.string().min(1).describe("File content, base64-encoded"),
  mimeType: import_zod.z.string().default("application/octet-stream").describe('MIME type, e.g. "image/png"')
});
const ListAttachmentsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id")
});
const DeleteAttachmentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  attachmentId: import_zod.z.string().describe("Attachment _id from list_attachments")
});
const StatusCategoryEnum = import_zod.z.enum(["Backlog", "Todo", "InProgress", "Done", "Cancelled"]);
const ListIssueStatusesSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg
});
const CreateIssueStatusSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  name: import_zod.z.string().min(1).describe("Status name"),
  category: StatusCategoryEnum.describe("Status phase"),
  color: import_zod.z.string().optional().describe("Hex color, e.g. #FF6B6B"),
  projectIdentifier: import_zod.z.string().optional().describe("Add it to this project's workflow (its project type); default: every tracker project type")
});
const ListOrganizationsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg
});
const GetOrganizationSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  organizationId: import_zod.z.string().describe("Organization id")
});
const CreateOrganizationSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  name: import_zod.z.string().min(1),
  city: import_zod.z.string().optional().describe("City (optional)")
});
const UpdateOrganizationSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  organizationId: import_zod.z.string().describe("Organization id"),
  name: import_zod.z.string().min(1).optional(),
  city: import_zod.z.string().optional(),
  description: import_zod.z.string().optional().describe("Markdown, replaces existing")
});
const IssueRef = import_zod.z.string().describe("Issue id");
const BulkUpdateIssuesSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifiers: import_zod.z.array(import_zod.z.string().min(1)).min(1).max(100).describe("Issue ids"),
  statusName: import_zod.z.string().optional(),
  priority: PriorityEnum.optional(),
  dueDate: import_zod.z.string().nullable().optional().describe("null clears"),
  assignee: import_zod.z.string().nullable().optional().describe("Person name; null clears"),
  componentLabel: import_zod.z.string().nullable().optional().describe("Component name; null clears"),
  milestoneLabel: import_zod.z.string().nullable().optional().describe("Milestone name; null clears")
});
const MoveIssueSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: IssueRef,
  targetProjectIdentifier: import_zod.z.string().describe("Target project key"),
  statusName: import_zod.z.string().optional().describe("Default: keep current")
});
const ListSubIssuesSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  identifier: import_zod.z.string().describe("Parent issue id"),
  depth: import_zod.z.number().int().min(1).max(10).default(5).describe("Levels")
});
const RemoveRelationSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: IssueRef,
  relatedTo: import_zod.z.string().describe("Related issue id")
});
const RemoveBlockedBySchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Blocked issue id"),
  blockedBy: import_zod.z.string().describe('Blocking issue to remove, e.g. "PROJ-100"')
});
const UpdateCommentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: IssueRef,
  commentId: import_zod.z.string().min(1).describe("From list_comments"),
  message: import_zod.z.string().min(1)
});
const UpdateLabelSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  labelName: import_zod.z.string().min(1),
  newName: import_zod.z.string().min(1).optional(),
  color: import_zod.z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional().describe("Hex color"),
  description: import_zod.z.string().optional()
});
const DeleteLabelSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  labelName: import_zod.z.string().min(1)
});
const UpdateProjectSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Project key"),
  name: import_zod.z.string().min(1).optional(),
  description: import_zod.z.string().optional(),
  defaultAssignee: import_zod.z.string().nullable().optional().describe("Person name; null clears"),
  defaultStatus: import_zod.z.string().optional().describe("Status name")
});
const ListTimeReportsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  identifier: import_zod.z.string().optional().describe("Issue id (without sub-issues)"),
  projectIdentifier: import_zod.z.string().optional().describe("Project key (all its issues)"),
  member: import_zod.z.string().optional().describe("Person name"),
  from: import_zod.z.string().optional().describe("ISO date"),
  to: import_zod.z.string().optional().describe("ISO date, inclusive"),
  limit: import_zod.z.number().int().min(1).max(500).default(100)
});
const RepairParentLinksSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  dryRun: import_zod.z.boolean().default(true).describe("false applies the repair")
});
const ToDoPriorityEnum = import_zod.z.enum(["Urgent", "High", "Medium", "Low", "NoPriority"]);
const ProviderEnum = import_zod.z.enum(["Email", "Phone", "LinkedIn", "Twitter", "GitHub", "Facebook", "Homepage", "Whatsapp", "Skype", "Telegram", "Viber", "Profile"]);
const ListNotificationsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  unreadOnly: import_zod.z.boolean().default(true),
  limit: import_zod.z.number().int().min(1).max(200).default(30),
  ids: import_zod.z.boolean().optional().describe("Show notification ids")
});
const MarkNotificationsReadSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  object: import_zod.z.string().optional().describe("Issue id or object id: read all its notifications"),
  notificationIds: import_zod.z.array(import_zod.z.string()).optional().describe("From list_notifications"),
  all: import_zod.z.boolean().optional().describe("Mark everything read"),
  archive: import_zod.z.boolean().default(false).describe("Also archive")
});
const ManageNotificationsSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  object: import_zod.z.string().describe("Issue id or object id"),
  action: import_zod.z.enum(["pin", "unpin", "hide", "unhide", "unread", "unarchive", "follow", "unfollow"])
});
const GetActivitySchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  object: import_zod.z.string().describe("Issue id (PROJ-1) or object id"),
  limit: import_zod.z.number().int().min(1).max(200).default(50)
});
const ListTodosSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  status: import_zod.z.enum(["open", "done", "all"]).default("open"),
  dueBefore: import_zod.z.string().optional().describe("ISO date"),
  limit: import_zod.z.number().int().min(1).max(200).default(50)
});
const CreateTodoSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  title: import_zod.z.string().min(1),
  description: import_zod.z.string().optional().describe("Markdown"),
  dueDate: import_zod.z.string().optional().describe("ISO date"),
  priority: ToDoPriorityEnum.default("NoPriority"),
  issue: import_zod.z.string().optional().describe("Issue id to attach the to-do to")
});
const UpdateTodoSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  todoId: import_zod.z.string().describe("From list_todos"),
  title: import_zod.z.string().min(1).optional(),
  description: import_zod.z.string().optional().describe("Markdown"),
  dueDate: import_zod.z.string().nullable().optional(),
  priority: ToDoPriorityEnum.optional(),
  done: import_zod.z.boolean().optional()
});
const DeleteTodoSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  todoId: import_zod.z.string().describe("From list_todos")
});
const ScheduleTodoSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  todoId: import_zod.z.string().describe("From list_todos"),
  start: import_zod.z.string().describe("ISO date-time, e.g. 2026-11-03T09:00"),
  durationMinutes: import_zod.z.number().int().min(5).max(1440).default(30)
});
const ListEventsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  from: import_zod.z.string().optional().describe("ISO date; default today"),
  to: import_zod.z.string().optional().describe("ISO date, inclusive; default from + 7 days"),
  limit: import_zod.z.number().int().min(1).max(200).default(50)
});
const CreateEventSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  title: import_zod.z.string().min(1),
  start: import_zod.z.string().describe("ISO date-time, or date for allDay"),
  end: import_zod.z.string().optional().describe("ISO date-time; default start + 1h"),
  allDay: import_zod.z.boolean().default(false),
  location: import_zod.z.string().optional(),
  description: import_zod.z.string().optional().describe("Markdown"),
  participants: import_zod.z.array(import_zod.z.string()).optional().describe("Person names; you are always included")
});
const UpdateEventSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  eventId: import_zod.z.string().describe("From list_events"),
  title: import_zod.z.string().min(1).optional(),
  start: import_zod.z.string().optional(),
  end: import_zod.z.string().optional(),
  location: import_zod.z.string().optional(),
  description: import_zod.z.string().optional().describe("Markdown")
});
const DeleteEventSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  eventId: import_zod.z.string().describe("From list_events")
});
const MessageIdArg = import_zod.z.string().describe("Message id (list_messages, list_comments, list_thread)");
const ListThreadSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  messageId: MessageIdArg,
  limit: import_zod.z.number().int().min(1).max(200).default(50)
});
const ReplyToMessageSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  messageId: MessageIdArg,
  message: import_zod.z.string().min(1)
});
const UpdateMessageSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  messageId: MessageIdArg,
  message: import_zod.z.string().min(1)
});
const DeleteMessageSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  messageId: MessageIdArg
});
const ReactionSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  messageId: MessageIdArg,
  emoji: import_zod.z.string().min(1).describe("e.g. \u{1F44D}")
});
const PinMessageSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  messageId: MessageIdArg,
  pinned: import_zod.z.boolean().default(true)
});
const ListPullRequestsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: import_zod.z.string().optional().describe("Project key"),
  issue: import_zod.z.string().optional().describe("Issue id the PRs belong to"),
  state: import_zod.z.enum(["open", "closed", "merged", "all"]).default("open"),
  limit: import_zod.z.number().int().min(1).max(200).default(30)
});
const GetPullRequestSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  identifier: import_zod.z.string().describe("PR id, e.g. PROJ-34")
});
const PersonRef = import_zod.z.string().describe("Person name or id");
const ListPersonsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  query: import_zod.z.string().optional().describe("Name filter"),
  employeesOnly: import_zod.z.boolean().default(false),
  limit: import_zod.z.number().int().min(1).max(500).default(100)
});
const GetPersonSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  person: PersonRef
});
const CreatePersonSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  firstName: import_zod.z.string().min(1),
  lastName: import_zod.z.string().default(""),
  city: import_zod.z.string().optional(),
  channels: import_zod.z.array(import_zod.z.strictObject({ provider: ProviderEnum, value: import_zod.z.string().min(1) })).optional()
});
const UpdatePersonSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  person: PersonRef,
  firstName: import_zod.z.string().min(1).optional(),
  lastName: import_zod.z.string().optional(),
  city: import_zod.z.string().optional()
});
const ContactChannelSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  person: PersonRef,
  provider: ProviderEnum,
  value: import_zod.z.string().min(1)
});
const ListClassesSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  module: import_zod.z.string().optional().describe("e.g. recruit, lead, hr, board, drive"),
  withCounts: import_zod.z.boolean().default(false).describe("Count documents (slower)")
});
const DescribeClassSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  className: import_zod.z.string().describe("e.g. recruit:class:Vacancy")
});
const QueryDocumentsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  className: import_zod.z.string(),
  query: import_zod.z.record(import_zod.z.string(), import_zod.z.any()).optional().describe('Field equality filter, e.g. {"space":"\u2026"}'),
  fields: import_zod.z.array(import_zod.z.string()).optional().describe("Only these fields"),
  limit: import_zod.z.number().int().min(1).max(200).default(20)
});
const GenericCreateSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  className: import_zod.z.string(),
  space: import_zod.z.string().describe("Space id the document belongs to"),
  attributes: import_zod.z.record(import_zod.z.string(), import_zod.z.any()),
  attachTo: import_zod.z.strictObject({ id: import_zod.z.string(), className: import_zod.z.string(), collection: import_zod.z.string() }).optional().describe("For attached docs"),
  dryRun: import_zod.z.boolean().default(true)
});
const GenericUpdateSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  className: import_zod.z.string(),
  id: import_zod.z.string(),
  attributes: import_zod.z.record(import_zod.z.string(), import_zod.z.any()),
  dryRun: import_zod.z.boolean().default(true)
});
const GenericDeleteSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  className: import_zod.z.string(),
  id: import_zod.z.string(),
  dryRun: import_zod.z.boolean().default(true),
  confirm: import_zod.z.boolean().default(false).describe("Must be true to delete")
});
const GetIssueContextSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  commentLimit: import_zod.z.number().int().min(0).max(100).default(20)
});
const StartWorkSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  statusName: import_zod.z.string().default("In Progress"),
  assignToMe: import_zod.z.boolean().default(true),
  claimAs: import_zod.z.string().optional().describe("Also claim it under this agent name")
});
const FinishWorkSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  summary: import_zod.z.string().min(1).describe("Markdown"),
  pullRequest: import_zod.z.string().optional().describe("#12, URL or Huly id"),
  statusName: import_zod.z.string().nullable().default("Review in progress").describe("null keeps status")
});
const PlannedIssue = import_zod.z.strictObject({
  title: import_zod.z.string().min(1),
  description: import_zod.z.string().optional().describe("Markdown"),
  priority: PriorityEnum.optional(),
  componentLabel: import_zod.z.string().optional(),
  milestoneLabel: import_zod.z.string().optional(),
  assignee: import_zod.z.string().optional().describe("Person name"),
  labels: import_zod.z.array(import_zod.z.string()).optional(),
  statusName: import_zod.z.string().optional(),
  blockedBy: import_zod.z.array(import_zod.z.string()).optional().describe('"#2" (2nd child) or issue id')
});
const CreateIssueTreeSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  epic: PlannedIssue.omit({ blockedBy: true }).optional().describe("New epic"),
  epicIdentifier: import_zod.z.string().optional().describe("Or an existing epic"),
  children: import_zod.z.array(PlannedIssue).min(1).max(50),
  componentLabel: import_zod.z.string().optional().describe("Default for epic and children"),
  milestoneLabel: import_zod.z.string().optional().describe("Default for epic and children"),
  skipDuplicates: import_zod.z.boolean().default(true).describe("Reuse same-title issues"),
  dryRun: import_zod.z.boolean().default(true)
});
const IssuesFromDocumentSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  document: import_zod.z.string().describe("Document id or exact title"),
  projectIdentifier: import_zod.z.string().describe("Project key"),
  epicTitle: import_zod.z.string().optional().describe("Default: document title"),
  epicIdentifier: import_zod.z.string().optional().describe("Or an existing epic"),
  componentLabel: import_zod.z.string().optional(),
  milestoneLabel: import_zod.z.string().optional(),
  skipDuplicates: import_zod.z.boolean().default(true),
  dryRun: import_zod.z.boolean().default(true)
});
const IssuesFromMeetingSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  document: import_zod.z.string().describe("Document id or exact title"),
  projectIdentifier: import_zod.z.string().describe("Project key"),
  componentLabel: import_zod.z.string().optional(),
  milestoneLabel: import_zod.z.string().optional(),
  skipDuplicates: import_zod.z.boolean().default(true),
  dryRun: import_zod.z.boolean().default(true)
});
const MyDaySchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  date: import_zod.z.string().optional().describe("YYYY-MM-DD, default today"),
  limit: import_zod.z.number().int().min(1).max(50).default(10).describe("Per section")
});
const TriageInboxSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  limit: import_zod.z.number().int().min(1).max(30).default(10).describe("Items")
});
const ReleaseNotesSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  milestoneLabel: import_zod.z.string().describe("Milestone name")
});
const StandupSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  since: import_zod.z.string().optional().describe("Default: last working day")
});
const ProjectReportSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  since: import_zod.z.string().optional().describe("Default 7d")
});
const ChangesSinceSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  since: import_zod.z.string().describe("ISO date/time or relative: 90m, 24h, 7d"),
  projectIdentifiers: import_zod.z.array(import_zod.z.string()).optional().describe("Default: all projects"),
  limit: import_zod.z.number().int().min(1).max(200).default(50)
});
const ClaimIssueSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  agent: import_zod.z.string().optional().describe("Default: HULY_AGENT_NAME or claude"),
  minutes: import_zod.z.number().int().min(5).max(1440).default(120).describe("Lease length"),
  force: import_zod.z.boolean().default(false).describe("Take over a foreign claim")
});
const ReleaseIssueSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  identifier: import_zod.z.string().describe("Issue id"),
  agent: import_zod.z.string().optional()
});
const FindProjectForRepoSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg.describe("Default: search all workspaces"),
  repository: import_zod.z.string().describe("owner/name, GitHub URL or git remote")
});
const ObjectArg = import_zod.z.string().describe("Issue id (PROJ-12) or document id");
const ListCollaboratorsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, object: ObjectArg });
const AddCollaboratorSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  object: ObjectArg,
  member: import_zod.z.string().optional().describe("Name; default: you")
});
const RemoveCollaboratorSchema = AddCollaboratorSchema;
const CreatePublicLinkSchema = import_zod.z.object({ workspace: WorkspaceArg, object: ObjectArg });
const ListPublicLinksSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  object: ObjectArg.optional().describe("Default: all links"),
  limit: import_zod.z.number().int().min(1).max(200).default(50)
});
const RevokePublicLinkSchema = import_zod.z.object({ workspace: WorkspaceArg, linkId: import_zod.z.string() });
const FieldValues = import_zod.z.record(import_zod.z.string(), import_zod.z.union([import_zod.z.string(), import_zod.z.number(), import_zod.z.boolean(), import_zod.z.null()])).describe("Field name \u2192 value");
const ListCardTypesSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const ListCardsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  type: import_zod.z.string().optional().describe("Card type name or id"),
  parentId: import_zod.z.string().nullable().optional().describe("Children of this card; null = top level"),
  query: import_zod.z.string().optional().describe("Title contains"),
  limit: import_zod.z.number().int().min(1).max(200).default(50)
});
const GetCardSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, cardId: import_zod.z.string() });
const CreateCardSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  type: import_zod.z.string().describe("Card type name or id"),
  title: import_zod.z.string().min(1),
  content: import_zod.z.string().optional().describe("Markdown"),
  parentId: import_zod.z.string().optional(),
  space: import_zod.z.string().optional().describe("Card space id; default: Default"),
  tags: import_zod.z.array(import_zod.z.string()).optional(),
  fields: FieldValues.optional()
});
const UpdateCardSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  cardId: import_zod.z.string(),
  title: import_zod.z.string().min(1).optional(),
  content: import_zod.z.string().optional().describe("Markdown; replaces content"),
  parentId: import_zod.z.string().nullable().optional().describe("Move under this card; null = top level"),
  addTags: import_zod.z.array(import_zod.z.string()).optional(),
  fields: FieldValues.optional()
});
const DeleteCardSchema = import_zod.z.object({ workspace: WorkspaceArg, cardId: import_zod.z.string() });
const CreateCardTypeSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  name: import_zod.z.string().min(1),
  kind: import_zod.z.enum(["type", "tag"]).default("type"),
  parentType: import_zod.z.string().optional().describe("Subtype of / tag for this type")
});
const DeleteCardTypeSchema = import_zod.z.object({ workspace: WorkspaceArg, type: import_zod.z.string().describe("Card type or tag") });
const FieldTarget = import_zod.z.string().describe('"issue", project key, card type/tag or class id');
const ListCustomFieldsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  target: FieldTarget.optional(),
  object: import_zod.z.string().optional().describe("Show values of this issue/card instead")
});
const CreateCustomFieldSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  target: FieldTarget,
  label: import_zod.z.string().min(1),
  type: import_zod.z.enum(["string", "number", "boolean", "date", "markup", "enum", "ref"]),
  enumValues: import_zod.z.array(import_zod.z.string()).optional(),
  refClass: import_zod.z.string().optional().describe("For ref, e.g. contact:mixin:Employee")
});
const SetCustomFieldsSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  object: import_zod.z.string().describe("Issue id, card id or document id"),
  fields: FieldValues
});
const DriveArg = import_zod.z.string().describe("Drive name or id");
const ListDrivesSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const CreateDriveSchema = import_zod.z.object({ workspace: WorkspaceArg, name: import_zod.z.string().min(1), description: import_zod.z.string().optional(), isPrivate: import_zod.z.boolean().default(false) });
const ListDriveFilesSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  drive: DriveArg,
  folderId: import_zod.z.string().optional().describe("Default: top level"),
  recursive: import_zod.z.boolean().default(true)
});
const CreateFolderSchema = import_zod.z.object({ workspace: WorkspaceArg, drive: DriveArg, title: import_zod.z.string().min(1), parentId: import_zod.z.string().optional() });
const UploadFileSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  drive: DriveArg,
  folderId: import_zod.z.string().optional(),
  filename: import_zod.z.string().optional().describe("Default: name of localPath"),
  contentBase64: import_zod.z.string().optional(),
  localPath: import_zod.z.string().optional().describe("File under HULY_FILE_ROOT"),
  mimeType: import_zod.z.string().optional(),
  newVersion: import_zod.z.boolean().default(true).describe("Same name in folder \u2192 new version")
});
const DownloadFileSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  fileId: import_zod.z.string(),
  version: import_zod.z.number().int().min(1).optional().describe("Default: current"),
  savePath: import_zod.z.string().optional().describe("Save under HULY_FILE_ROOT instead of returning it")
});
const UpdateDriveItemSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  itemId: import_zod.z.string().describe("File or folder id"),
  title: import_zod.z.string().min(1).optional(),
  parentId: import_zod.z.string().nullable().optional().describe("Move into this folder; null = top level")
});
const DeleteDriveItemSchema = import_zod.z.object({ workspace: WorkspaceArg, itemId: import_zod.z.string(), recursive: import_zod.z.boolean().default(false) });
const ListFileVersionsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, fileId: import_zod.z.string() });
const RestoreFileVersionSchema = import_zod.z.object({ workspace: WorkspaceArg, fileId: import_zod.z.string(), version: import_zod.z.number().int().min(1) });
const TemplateFields = {
  description: import_zod.z.string().optional().describe("Markdown"),
  priority: PriorityEnum.optional(),
  assignee: import_zod.z.string().nullable().optional().describe("Person name"),
  componentLabel: import_zod.z.string().nullable().optional(),
  milestoneLabel: import_zod.z.string().nullable().optional(),
  estimation: import_zod.z.number().min(0).optional(),
  labels: import_zod.z.array(import_zod.z.string()).optional()
};
const TemplateChild = import_zod.z.strictObject({ title: import_zod.z.string().min(1), ...TemplateFields });
const TemplateRef = import_zod.z.string().describe("Template id or title");
const ListIssueTemplatesSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, projectIdentifier: import_zod.z.string().optional() });
const GetIssueTemplateSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, template: TemplateRef, projectIdentifier: import_zod.z.string().optional() });
const CreateIssueTemplateSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  projectIdentifier: import_zod.z.string().describe("Project key"),
  title: import_zod.z.string().min(1),
  ...TemplateFields,
  children: import_zod.z.array(TemplateChild).max(50).optional().describe("Sub-issues")
});
const UpdateIssueTemplateSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  template: TemplateRef,
  projectIdentifier: import_zod.z.string().optional(),
  title: import_zod.z.string().min(1).optional(),
  ...TemplateFields,
  children: import_zod.z.array(TemplateChild).max(50).optional().describe("Replaces all sub-issues")
});
const DeleteIssueTemplateSchema = import_zod.z.object({ workspace: WorkspaceArg, template: TemplateRef, projectIdentifier: import_zod.z.string().optional() });
const CreateIssueFromTemplateSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  template: TemplateRef,
  projectIdentifier: import_zod.z.string().optional(),
  title: import_zod.z.string().min(1).optional().describe("Default: template title")
});
const TestProjectArg = import_zod.z.string().describe("Test project name or id");
const CaseType = import_zod.z.enum(["Functional", "Performance", "Regression", "Security", "Smoke", "Usability"]);
const CasePriority = import_zod.z.enum(["Low", "Medium", "High", "Urgent"]);
const CaseStatus = import_zod.z.enum(["Draft", "ReadyForReview", "FixReviewComments", "Approved", "Rejected"]);
const ListTestProjectsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const CreateTestProjectSchema = import_zod.z.object({ workspace: WorkspaceArg, name: import_zod.z.string().min(1), description: import_zod.z.string().optional(), isPrivate: import_zod.z.boolean().default(false) });
const ListTestCasesSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  project: TestProjectArg,
  suite: import_zod.z.string().optional().describe("Suite name or id; default: all"),
  status: CaseStatus.optional()
});
const CreateTestSuiteSchema = import_zod.z.object({ workspace: WorkspaceArg, project: TestProjectArg, name: import_zod.z.string().min(1), description: import_zod.z.string().optional(), parent: import_zod.z.string().optional().describe("Parent suite") });
const GetTestCaseSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, caseId: import_zod.z.string() });
const CreateTestCaseSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  project: TestProjectArg,
  suite: import_zod.z.string().describe("Suite name or id"),
  name: import_zod.z.string().min(1),
  description: import_zod.z.string().optional().describe("Steps/expected result, Markdown"),
  type: CaseType.default("Functional"),
  priority: CasePriority.default("Medium"),
  status: CaseStatus.default("Draft"),
  assignee: import_zod.z.string().optional()
});
const UpdateTestCaseSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  caseId: import_zod.z.string(),
  name: import_zod.z.string().min(1).optional(),
  description: import_zod.z.string().optional(),
  type: CaseType.optional(),
  priority: CasePriority.optional(),
  status: CaseStatus.optional(),
  assignee: import_zod.z.string().nullable().optional()
});
const DeleteTestCaseSchema = import_zod.z.object({ workspace: WorkspaceArg, caseId: import_zod.z.string() });
const ListTestPlansSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, project: TestProjectArg });
const CreateTestPlanSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  project: TestProjectArg,
  name: import_zod.z.string().min(1),
  suites: import_zod.z.array(import_zod.z.string()).optional().describe("All cases of these suites (incl. nested)"),
  caseIds: import_zod.z.array(import_zod.z.string()).optional()
});
const CreateTestRunSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  project: TestProjectArg,
  name: import_zod.z.string().min(1),
  plan: import_zod.z.string().optional().describe("Plan name or id"),
  suites: import_zod.z.array(import_zod.z.string()).optional(),
  caseIds: import_zod.z.array(import_zod.z.string()).optional(),
  dueDate: import_zod.z.string().optional()
});
const ListTestRunsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, project: TestProjectArg, limit: import_zod.z.number().int().min(1).max(100).default(20) });
const GetTestRunSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, runId: import_zod.z.string() });
const SetTestResultSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  result: import_zod.z.string().describe("Result id, or case id/name with runId"),
  runId: import_zod.z.string().optional(),
  status: import_zod.z.enum(["Untested", "Blocked", "Passed", "Failed"]),
  comment: import_zod.z.string().optional().describe("Markdown"),
  assignee: import_zod.z.string().nullable().optional().describe("Person; null clears")
});
const UpdateTestSuiteSchema = import_zod.z.object({ workspace: WorkspaceArg, project: TestProjectArg, suite: import_zod.z.string(), name: import_zod.z.string().min(1).optional(), description: import_zod.z.string().optional(), parent: import_zod.z.string().nullable().optional().describe("New parent suite; null = top level") });
const DeleteTestSuiteSchema = import_zod.z.object({ workspace: WorkspaceArg, project: TestProjectArg, suite: import_zod.z.string(), recursive: import_zod.z.boolean().optional().describe("Also delete sub-suites and cases") });
const UpdateTestRunSchema = import_zod.z.object({ workspace: WorkspaceArg, runId: import_zod.z.string(), name: import_zod.z.string().min(1).optional(), dueDate: import_zod.z.string().nullable().optional(), description: import_zod.z.string().optional().describe("Markdown") });
const DeleteTestRunSchema = import_zod.z.object({ workspace: WorkspaceArg, runId: import_zod.z.string() });
const DeleteTestPlanSchema = import_zod.z.object({ workspace: WorkspaceArg, project: TestProjectArg, plan: import_zod.z.string().describe("Plan name or id") });
const ImportTestResultsSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  project: TestProjectArg,
  xml: import_zod.z.string().optional().describe("JUnit XML report"),
  file: import_zod.z.string().optional().describe("Or: path to the report on the server machine"),
  runName: import_zod.z.string().optional().describe('Default: "CI <date time>"'),
  parentSuite: import_zod.z.string().optional().describe("Put the report's suites under this suite"),
  createMissing: import_zod.z.boolean().optional().describe("Create unknown suites/cases (default true)"),
  dryRun: import_zod.z.boolean().optional()
});
const GetTestReportSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, project: TestProjectArg, runs: import_zod.z.number().int().min(1).max(50).optional().describe("Latest runs to look at (default 10)"), limit: import_zod.z.number().int().min(1).max(200).optional().describe("Max cases per section (default 25)") });
const CreateIssueFromTestResultSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  result: import_zod.z.string().describe("Test result id (get_test_run)"),
  projectIdentifier: import_zod.z.string().describe("Tracker project key"),
  title: import_zod.z.string().optional().describe('Default: "Test failed: <case>"'),
  priority: PriorityEnum.optional().describe("Default High"),
  notes: import_zod.z.string().optional().describe("Extra Markdown"),
  componentLabel: import_zod.z.string().optional(),
  milestoneLabel: import_zod.z.string().optional(),
  assignee: import_zod.z.string().optional()
});
const CreateTestCasesSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  project: TestProjectArg,
  suite: import_zod.z.string().describe("Suite name or id"),
  createSuite: import_zod.z.boolean().optional().describe("Create the suite if missing"),
  parentSuite: import_zod.z.string().optional().describe("Parent for a new suite"),
  cases: import_zod.z.array(import_zod.z.strictObject({ name: import_zod.z.string().min(1), description: import_zod.z.string().optional().describe("Steps/expected, Markdown"), type: CaseType.optional(), priority: CasePriority.optional(), assignee: import_zod.z.string().optional() })).min(1).max(100)
});
const ListProductsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const GetProductSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, product: import_zod.z.string().describe("Product name or id") });
const ListLabelCategoriesSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const CreateLabelCategorySchema = import_zod.z.object({ workspace: WorkspaceArg, name: import_zod.z.string().min(1) });
const SetLabelCategorySchema = import_zod.z.object({ workspace: WorkspaceArg, labelName: import_zod.z.string().min(1), category: import_zod.z.string().describe("Category name or id") });
const RoleArg = import_zod.z.enum(["guest", "user", "maintainer", "owner"]);
const CreateInviteLinkSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  email: import_zod.z.string().optional().describe("Personal one-use link for this address (nothing is sent)"),
  role: RoleArg.optional().describe("Default user"),
  expiresHours: import_zod.z.number().int().min(1).max(8760).optional().describe("Default 48"),
  limit: import_zod.z.number().int().min(1).max(1e3).optional().describe("Uses, without email; default 1"),
  emailMask: import_zod.z.string().optional().describe("Only addresses matching, e.g. *@acme.com")
});
const SendInviteSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  email: import_zod.z.string(),
  role: RoleArg.optional().describe("Default user")
});
const SetMemberRoleSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  member: import_zod.z.string().describe("Name or account id"),
  role: RoleArg
});
const GetWorkspaceSettingsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const ListProjectTypesSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const ListVacanciesSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, includeArchived: import_zod.z.boolean().optional() });
const CreateVacancySchema = import_zod.z.object({
  workspace: WorkspaceArg,
  name: import_zod.z.string(),
  description: import_zod.z.string().optional().describe("Short plain-text description"),
  company: import_zod.z.string().optional().describe("Organization name"),
  location: import_zod.z.string().optional(),
  dueDate: import_zod.z.string().optional()
});
const UpdateVacancySchema = import_zod.z.object({
  workspace: WorkspaceArg,
  vacancy: import_zod.z.string().describe("Name or id"),
  name: import_zod.z.string().optional(),
  description: import_zod.z.string().nullable().optional(),
  location: import_zod.z.string().nullable().optional(),
  dueDate: import_zod.z.string().nullable().optional(),
  archived: import_zod.z.boolean().optional()
});
const ListCandidatesSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, query: import_zod.z.string().optional().describe("Name or title contains"), limit: import_zod.z.number().int().min(1).max(500).optional() });
const CreateCandidateSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  firstName: import_zod.z.string(),
  lastName: import_zod.z.string(),
  title: import_zod.z.string().optional().describe("e.g. Senior iOS developer"),
  city: import_zod.z.string().optional(),
  email: import_zod.z.string().optional(),
  onsite: import_zod.z.boolean().optional(),
  remote: import_zod.z.boolean().optional()
});
const ListApplicationsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, vacancy: import_zod.z.string().optional(), status: import_zod.z.string().optional(), limit: import_zod.z.number().int().min(1).max(500).optional() });
const CreateApplicationSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  vacancy: import_zod.z.string().describe("Name or id"),
  candidate: import_zod.z.string().describe("Person name or id (create_candidate first for new people)"),
  status: import_zod.z.string().optional().describe("Default: first status"),
  assignee: import_zod.z.string().optional().describe("Recruiter")
});
const UpdateApplicationSchema = import_zod.z.object({ workspace: WorkspaceArg, identifier: import_zod.z.string().describe("APP-12"), status: import_zod.z.string().optional(), assignee: import_zod.z.string().nullable().optional() });
const DeleteApplicationSchema = import_zod.z.object({ workspace: WorkspaceArg, identifier: import_zod.z.string().describe("APP-12") });
const ListLeadsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, funnel: import_zod.z.string().optional(), status: import_zod.z.string().optional(), limit: import_zod.z.number().int().min(1).max(500).optional() });
const ListCustomersSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const CreateLeadSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  title: import_zod.z.string(),
  customer: import_zod.z.string().describe("Existing person/organization (name or id), or the new one's name with newCustomer"),
  newCustomer: import_zod.z.enum(["organization", "person"]).optional().describe("Create the customer first"),
  funnel: import_zod.z.string().optional().describe("Default: the default funnel"),
  status: import_zod.z.string().optional(),
  assignee: import_zod.z.string().optional()
});
const UpdateLeadSchema = import_zod.z.object({ workspace: WorkspaceArg, identifier: import_zod.z.string().describe("LEAD-12"), title: import_zod.z.string().optional(), status: import_zod.z.string().optional(), assignee: import_zod.z.string().nullable().optional() });
const DeleteLeadSchema = import_zod.z.object({ workspace: WorkspaceArg, identifier: import_zod.z.string().describe("LEAD-12") });
const ListDepartmentsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const CreateDepartmentSchema = import_zod.z.object({ workspace: WorkspaceArg, name: import_zod.z.string(), parent: import_zod.z.string().optional().describe("Default: Organization (root)"), teamLead: import_zod.z.string().optional() });
const DeleteDepartmentSchema = import_zod.z.object({ workspace: WorkspaceArg, department: import_zod.z.string() });
const SetDepartmentSchema = import_zod.z.object({ workspace: WorkspaceArg, member: import_zod.z.string(), department: import_zod.z.string() });
const ListTimeOffSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  from: import_zod.z.string().optional().describe("YYYY-MM-DD"),
  to: import_zod.z.string().optional().describe("YYYY-MM-DD"),
  member: import_zod.z.string().optional(),
  department: import_zod.z.string().optional()
});
const CreateTimeOffSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  type: import_zod.z.enum(["vacation", "sick", "pto", "pto-half-day", "overtime", "overtime-half-day", "remote"]),
  from: import_zod.z.string().describe("YYYY-MM-DD"),
  to: import_zod.z.string().optional().describe("Last day, inclusive; default from"),
  member: import_zod.z.string().optional().describe("Default: me"),
  description: import_zod.z.string().optional()
});
const DeleteTimeOffSchema = import_zod.z.object({ workspace: WorkspaceArg, id: import_zod.z.string() });
const ListInventorySchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const CreateInventoryCategorySchema = import_zod.z.object({ workspace: WorkspaceArg, name: import_zod.z.string(), parent: import_zod.z.string().optional().describe("Parent category") });
const CreateInventoryProductSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  name: import_zod.z.string(),
  category: import_zod.z.string(),
  variants: import_zod.z.array(import_zod.z.strictObject({ name: import_zod.z.string(), sku: import_zod.z.string() })).optional()
});
const UpdateInventoryItemSchema = import_zod.z.object({ workspace: WorkspaceArg, id: import_zod.z.string(), name: import_zod.z.string().optional(), sku: import_zod.z.string().optional().describe("Variants"), category: import_zod.z.string().optional().describe("Move a product") });
const DeleteInventoryItemSchema = import_zod.z.object({ workspace: WorkspaceArg, id: import_zod.z.string(), recursive: import_zod.z.boolean().optional() });
const ListMessageTemplatesSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const GetMessageTemplateSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, template: import_zod.z.string().describe("Title or id") });
const CreateMessageTemplateSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  title: import_zod.z.string(),
  message: import_zod.z.string().describe("Markdown; ${field} placeholders allowed"),
  category: import_zod.z.string().optional().describe("Default: public templates"),
  newCategory: import_zod.z.boolean().optional().describe("Create category first")
});
const UpdateMessageTemplateSchema = import_zod.z.object({ workspace: WorkspaceArg, template: import_zod.z.string(), title: import_zod.z.string().optional(), message: import_zod.z.string().optional() });
const DeleteMessageTemplateSchema = import_zod.z.object({ workspace: WorkspaceArg, template: import_zod.z.string() });
const ListMeetingsSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  room: import_zod.z.string().optional(),
  since: import_zod.z.string().optional(),
  limit: import_zod.z.number().int().min(1).max(200).optional(),
  includeOffices: import_zod.z.boolean().optional().describe("List personal offices too")
});
const GetMeetingSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, id: import_zod.z.string(), transcript: import_zod.z.boolean().optional().describe("Default true"), limit: import_zod.z.number().int().min(1).max(5e3).optional() });
const ListControlledDocumentsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, space: import_zod.z.string().optional(), includeTemplates: import_zod.z.boolean().optional() });
const GetControlledDocumentSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, document: import_zod.z.string().describe("Code (SOP-12), title or id"), content: import_zod.z.boolean().optional().describe("Default true") });
const ListTrainingsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, includeArchived: import_zod.z.boolean().optional() });
const GetTrainingSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, training: import_zod.z.string().describe("Code, title or id"), showAnswers: import_zod.z.boolean().optional() });
const TrainingQuestionSchema = import_zod.z.strictObject({
  type: import_zod.z.enum(["single", "multiple", "ordering"]),
  title: import_zod.z.string().min(1),
  options: import_zod.z.array(import_zod.z.string().min(1)).min(2),
  correct: import_zod.z.union([import_zod.z.string(), import_zod.z.number().int(), import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.number().int()]))]).optional().describe("Option text or number (1 = first); several for multiple; all, in order, for ordering. Omit: not scored")
});
const CreateTrainingSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  title: import_zod.z.string().min(1),
  description: import_zod.z.string().optional().describe("Markdown"),
  passingScore: import_zod.z.number().int().min(0).max(100).default(80).describe("Percent of scored questions"),
  questions: import_zod.z.array(TrainingQuestionSchema).optional()
});
const AddTrainingQuestionsSchema = import_zod.z.object({ workspace: WorkspaceArg, training: import_zod.z.string().describe("Code or title of a draft"), questions: import_zod.z.array(TrainingQuestionSchema).min(1) });
const ReleaseTrainingSchema = import_zod.z.object({ workspace: WorkspaceArg, training: import_zod.z.string().describe("Code or title of a draft") });
const AssignTrainingSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  training: import_zod.z.string().describe("Code or title of a released training"),
  trainees: import_zod.z.array(import_zod.z.string()).min(1).describe("Person names"),
  dueDate: import_zod.z.string().optional().describe("ISO date"),
  maxAttempts: import_zod.z.number().int().min(1).optional()
});
const CancelTrainingRequestSchema = import_zod.z.object({ workspace: WorkspaceArg, requestId: import_zod.z.string().describe("Assignment id from get_training") });
const ListProcessesSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const ListExecutionsSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, process: import_zod.z.string().optional(), status: import_zod.z.enum(["active", "done", "cancelled"]).optional(), limit: import_zod.z.number().int().min(1).max(200).optional() });
const StartProcessSchema = import_zod.z.object({ workspace: WorkspaceArg, process: import_zod.z.string().describe("Name or id"), card: import_zod.z.string().describe("Card id"), dryRun: import_zod.z.boolean().optional() });
const CancelExecutionSchema = import_zod.z.object({ workspace: WorkspaceArg, execution: import_zod.z.string().describe("Execution id"), dryRun: import_zod.z.boolean().optional() });
const ListSurveysSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const GetSurveySchema = import_zod.z.object({ workspace: ReadWorkspaceArg, survey: import_zod.z.string(), maxTextAnswers: import_zod.z.number().int().min(0).max(100).optional() });
const ListModulesSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const SetModuleSchema = import_zod.z.object({ workspace: WorkspaceArg, module: import_zod.z.string().min(1).describe("Module id from list_modules, e.g. hr, lead, drive"), enabled: import_zod.z.boolean() });
const UpdateWorkspaceSettingsSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  name: import_zod.z.string().min(1).optional().describe("Display name (the slug stays)"),
  readOnlyGuests: import_zod.z.boolean().optional().describe("Allow read-only guest links"),
  guestSignUp: import_zod.z.boolean().optional().describe("Let guests sign up"),
  passwordAgingDays: import_zod.z.number().int().min(0).optional().describe("Passwords expire after n days; 0 = never")
});
const GetMyProfileSchema = import_zod.z.object({ workspace: ReadWorkspaceArg });
const UpdateMyProfileSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  firstName: import_zod.z.string().min(1).optional(),
  lastName: import_zod.z.string().optional(),
  bio: import_zod.z.string().optional(),
  city: import_zod.z.string().optional(),
  country: import_zod.z.string().optional(),
  website: import_zod.z.string().optional(),
  socialLinks: import_zod.z.record(import_zod.z.string(), import_zod.z.string()).optional().describe('e.g. {"github": "https://github.com/me"}'),
  isPublic: import_zod.z.boolean().optional().describe("Profile visible to people outside your workspaces")
});
const CreateWorkspaceSchema = import_zod.z.object({ workspace: WorkspaceArg.describe("Any workspace of the account (for the login)"), name: import_zod.z.string().min(1), region: import_zod.z.string().optional() });
const HulyApiSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  method: import_zod.z.string().min(1).describe("Account-service method, e.g. getWorkspaceMembers, updateWorkspaceName"),
  params: import_zod.z.array(import_zod.z.unknown()).optional().describe("Positional arguments"),
  dryRun: import_zod.z.boolean().optional().describe("Write methods: default true")
});
const SetupWorkspaceSchema = import_zod.z.object({
  workspace: WorkspaceArg,
  modules: import_zod.z.strictObject({ enable: import_zod.z.array(import_zod.z.string()).optional(), disable: import_zod.z.array(import_zod.z.string()).optional() }).optional(),
  statuses: import_zod.z.array(import_zod.z.strictObject({ name: import_zod.z.string().min(1), category: StatusCategoryEnum, projectIdentifier: import_zod.z.string().optional() })).optional(),
  projects: import_zod.z.array(import_zod.z.strictObject({
    identifier: import_zod.z.string().min(1).max(5).regex(/^[A-Z]+$/),
    name: import_zod.z.string().min(1),
    description: import_zod.z.string().optional(),
    components: import_zod.z.array(import_zod.z.strictObject({ label: import_zod.z.string().min(1), description: import_zod.z.string().optional() })).optional(),
    milestones: import_zod.z.array(import_zod.z.strictObject({ label: import_zod.z.string().min(1), targetDate: import_zod.z.string() })).optional()
  })).optional(),
  teamspaces: import_zod.z.array(import_zod.z.strictObject({ name: import_zod.z.string().min(1), description: import_zod.z.string().optional() })).optional(),
  dryRun: import_zod.z.boolean().optional().describe("Default true: show the plan")
});
const TestCoverageSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, projectIdentifier: import_zod.z.string().describe("Project key"), milestoneLabel: import_zod.z.string().optional(), onlyOpen: import_zod.z.boolean().optional().describe("Only open issues") });
const LinkTestCaseSchema = import_zod.z.object({ workspace: WorkspaceArg, identifier: import_zod.z.string().describe("Issue id"), testCase: import_zod.z.string().describe("Test case id or exact name") });
const ReleaseCheckSchema = import_zod.z.object({ workspace: ReadWorkspaceArg, projectIdentifier: import_zod.z.string().describe("Project key"), milestoneLabel: import_zod.z.string().describe("Milestone name") });
const TimesheetSchema = import_zod.z.object({
  workspace: ReadWorkspaceArg,
  week: import_zod.z.string().optional().describe("A date in it; default now"),
  member: import_zod.z.string().optional(),
  everyone: import_zod.z.boolean().optional().describe("Row per person"),
  hoursPerDay: import_zod.z.number().min(0).max(24).optional()
});
