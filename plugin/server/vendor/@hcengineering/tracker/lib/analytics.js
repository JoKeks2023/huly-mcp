"use strict";
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
var analytics_exports = {};
__export(analytics_exports, {
  TrackerEvents: () => TrackerEvents
});
module.exports = __toCommonJS(analytics_exports);
var TrackerEvents = /* @__PURE__ */ ((TrackerEvents2) => {
  TrackerEvents2["IssuePlusButtonClicked"] = "tracker.issue.PlusButtonClicked";
  TrackerEvents2["NewIssueButtonClicked"] = "tracker.issue.NewIssueButtonClicked";
  TrackerEvents2["IssueCreateFromGlobalActionCalled"] = "tracker.issue.CreateFromGlobalActionCalled";
  TrackerEvents2["NewIssueBindingCalled"] = "tracker.issue.NewIssueBindingCalled";
  TrackerEvents2["IssueCreated"] = "tracker.issue.Created";
  TrackerEvents2["IssueDeleted"] = "tracker.issue.Deleted";
  TrackerEvents2["IssueSetStatus"] = "tracker.issue.SetStatus";
  TrackerEvents2["IssueSetPriority"] = "tracker.issue.SetPriority";
  TrackerEvents2["IssueSetAssignee"] = "tracker.issue.SetAssignee";
  TrackerEvents2["IssueSetDueDate"] = "tracker.issue.SetDueDate";
  TrackerEvents2["IssueSetEstimate"] = "tracker.issue.SetEstimate";
  TrackerEvents2["IssueTimeSpentAdded"] = "tracker.issue.TimeSpentAdded";
  TrackerEvents2["IssueTimeSpentUpdated"] = "tracker.issue.TimeSpentUpdated";
  TrackerEvents2["IssueTitleUpdated"] = "tracker.issue.TitleUpdated";
  TrackerEvents2["IssueDescriptionUpdated"] = "tracker.issue.DescriptionUpdated";
  TrackerEvents2["IssueComponentAdded"] = "tracker.issue.ComponentAdded";
  TrackerEvents2["IssueMilestoneAdded"] = "tracker.issue.MilestoneAdded";
  TrackerEvents2["ProjectCreated"] = "tracker.project.Created";
  TrackerEvents2["ProjectDeleted"] = "tracker.project.Deleted";
  TrackerEvents2["ProjectArchived"] = "tracker.project.Archived";
  TrackerEvents2["IssueParentUnset"] = "tracker.issue.ParentUnset";
  return TrackerEvents2;
})(TrackerEvents || {});
//# sourceMappingURL=analytics.js.map
