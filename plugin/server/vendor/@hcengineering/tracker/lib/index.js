"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
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
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var index_exports = {};
__export(index_exports, {
  IssuePriority: () => IssuePriority,
  IssuesDateModificationPeriod: () => IssuesDateModificationPeriod,
  IssuesGrouping: () => IssuesGrouping,
  IssuesOrdering: () => IssuesOrdering,
  MilestoneStatus: () => MilestoneStatus,
  TimeReportDayType: () => TimeReportDayType,
  createStatesData: () => createStatesData,
  default: () => index_default,
  trackerId: () => trackerId
});
module.exports = __toCommonJS(index_exports);
var import_platform = require("../../platform/lib/index.js");
__reExport(index_exports, require("./analytics.js"), module.exports);
__reExport(index_exports, require("./analytics.js"), module.exports);
var TimeReportDayType = /* @__PURE__ */ ((TimeReportDayType2) => {
  TimeReportDayType2["CurrentWorkDay"] = "CurrentWorkDay";
  TimeReportDayType2["PreviousWorkDay"] = "PreviousWorkDay";
  return TimeReportDayType2;
})(TimeReportDayType || {});
var IssuePriority = /* @__PURE__ */ ((IssuePriority2) => {
  IssuePriority2[IssuePriority2["NoPriority"] = 0] = "NoPriority";
  IssuePriority2[IssuePriority2["Urgent"] = 1] = "Urgent";
  IssuePriority2[IssuePriority2["High"] = 2] = "High";
  IssuePriority2[IssuePriority2["Medium"] = 3] = "Medium";
  IssuePriority2[IssuePriority2["Low"] = 4] = "Low";
  return IssuePriority2;
})(IssuePriority || {});
var IssuesGrouping = /* @__PURE__ */ ((IssuesGrouping2) => {
  IssuesGrouping2["Status"] = "status";
  IssuesGrouping2["Assignee"] = "assignee";
  IssuesGrouping2["Priority"] = "priority";
  IssuesGrouping2["Component"] = "component";
  IssuesGrouping2["Milestone"] = "milestone";
  IssuesGrouping2["NoGrouping"] = "#no_category";
  return IssuesGrouping2;
})(IssuesGrouping || {});
var IssuesOrdering = /* @__PURE__ */ ((IssuesOrdering2) => {
  IssuesOrdering2["Status"] = "status";
  IssuesOrdering2["Priority"] = "priority";
  IssuesOrdering2["LastUpdated"] = "modifiedOn";
  IssuesOrdering2["DueDate"] = "dueDate";
  IssuesOrdering2["Manual"] = "rank";
  return IssuesOrdering2;
})(IssuesOrdering || {});
var IssuesDateModificationPeriod = /* @__PURE__ */ ((IssuesDateModificationPeriod2) => {
  IssuesDateModificationPeriod2["All"] = "all";
  IssuesDateModificationPeriod2["PastWeek"] = "pastWeek";
  IssuesDateModificationPeriod2["PastMonth"] = "pastMonth";
  return IssuesDateModificationPeriod2;
})(IssuesDateModificationPeriod || {});
var MilestoneStatus = /* @__PURE__ */ ((MilestoneStatus2) => {
  MilestoneStatus2[MilestoneStatus2["Planned"] = 0] = "Planned";
  MilestoneStatus2[MilestoneStatus2["InProgress"] = 1] = "InProgress";
  MilestoneStatus2[MilestoneStatus2["Completed"] = 2] = "Completed";
  MilestoneStatus2[MilestoneStatus2["Canceled"] = 3] = "Canceled";
  return MilestoneStatus2;
})(MilestoneStatus || {});
const trackerId = "tracker";
const pluginState = (0, import_platform.plugin)(trackerId, {
  class: {
    Project: "",
    Issue: "",
    IssueTemplate: "",
    Component: "",
    IssueStatus: "",
    TypeIssuePriority: "",
    Milestone: "",
    TypeMilestoneStatus: "",
    TimeSpendReport: "",
    TypeReportedTime: "",
    TypeEstimation: "",
    TypeRemainingTime: "",
    RelatedIssueTarget: "",
    ProjectTargetPreference: ""
  },
  mixin: {
    ClassicProjectTypeData: "",
    IssueTypeData: ""
  },
  ids: {
    NoParent: "",
    IssueDraft: "",
    IssueDraftChild: "",
    ClassingProjectType: ""
  },
  status: {
    Backlog: "",
    Todo: "",
    InProgress: "",
    Coding: "",
    UnderReview: "",
    Done: "",
    Canceled: ""
  },
  component: {
    Tracker: "",
    TrackerApp: "",
    RelatedIssues: "",
    RelatedIssuesSection: "",
    RelatedIssueSelector: "",
    RelatedIssueTemplates: "",
    EditIssue: "",
    CreateIssue: "",
    ProjectPresenter: "",
    CreateIssueTemplate: "",
    CreateProject: "",
    IssueStatusPresenter: "",
    LabelsView: ""
  },
  attribute: {
    IssueStatus: ""
  },
  icon: {
    TrackerApplication: "",
    Component: "",
    Issue: "",
    Subissue: "",
    Project: "",
    Relations: "",
    Inbox: "",
    MyIssues: "",
    Views: "",
    Issues: "",
    Components: "",
    NewIssue: "",
    Magnifier: "",
    Labels: "",
    DueDate: "",
    Parent: "",
    UnsetParent: "",
    Milestone: "",
    IssueTemplates: "",
    Start: "",
    Stop: "",
    CategoryBacklog: "",
    CategoryUnstarted: "",
    CategoryStarted: "",
    CategoryCompleted: "",
    CategoryCanceled: "",
    PriorityNoPriority: "",
    PriorityUrgent: "",
    PriorityHigh: "",
    PriorityMedium: "",
    PriorityLow: "",
    ComponentsList: "",
    MilestoneStatusPlanned: "",
    MilestoneStatusInProgress: "",
    MilestoneStatusPaused: "",
    MilestoneStatusCompleted: "",
    MilestoneStatusCanceled: "",
    CopyBranch: "",
    Duplicate: "",
    TimeReport: "",
    Estimation: "",
    // Project icons
    Home: "",
    RedCircle: ""
  },
  category: {
    Other: "",
    Tracker: ""
  },
  descriptors: {
    ProjectType: "",
    Issue: ""
  },
  action: {
    SetDueDate: "",
    SetParent: "",
    SetStatus: "",
    SetPriority: "",
    SetAssignee: "",
    SetComponent: "",
    CopyIssueId: "",
    CopyIssueTitle: "",
    CopyIssueLink: "",
    MoveToProject: "",
    Duplicate: "",
    Relations: "",
    NewIssue: "",
    NewIssueGlobal: "",
    NewSubIssue: "",
    EditWorkflowStatuses: "",
    EditProject: "",
    SetMilestone: "",
    SetLabels: "",
    EditRelatedTargets: "",
    UnsetParent: ""
  },
  project: {
    DefaultProject: ""
  },
  resolver: {
    Location: ""
  },
  string: {
    TrackerApplication: "",
    ConfigLabel: "",
    NewRelatedIssue: "",
    IssueNotificationTitle: "",
    IssueNotificationBody: "",
    IssueNotificationChanged: "",
    IssueNotificationChangedProperty: "",
    IssueNotificationMessage: "",
    IssueAssignedToYou: "",
    Project: "",
    RelatedIssues: "",
    Issue: "",
    NewProject: "",
    UnsetParentIssue: "",
    ForbidCreateProjectPermission: "",
    ForbidCreateProjectPermissionDescription: ""
  },
  extensions: {
    IssueListHeader: "",
    EditIssueHeader: "",
    EditIssueTitle: ""
  },
  taskTypes: {
    Issue: "",
    SubIssue: ""
  },
  permission: {
    ForbidCreateProject: ""
  }
});
var index_default = pluginState;
function createStatesData(data) {
  const states = [];
  for (const category of data) {
    for (const sName of category.statuses) {
      states.push({
        ofAttribute: pluginState.attribute.IssueStatus,
        name: Array.isArray(sName) ? sName[0] : sName,
        color: Array.isArray(sName) ? sName[1] : void 0,
        category: category.category
      });
    }
  }
  return states;
}
__name(createStatesData, "createStatesData");
//# sourceMappingURL=index.js.map
