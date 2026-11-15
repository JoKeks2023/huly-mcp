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
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var index_exports = {};
__export(index_exports, {
  TaskOrdering: () => TaskOrdering,
  default: () => index_default,
  taskId: () => taskId
});
module.exports = __toCommonJS(index_exports);
var import_platform = require("../../platform/lib/index.js");
__reExport(index_exports, require("./utils.js"), module.exports);
var TaskOrdering = /* @__PURE__ */ ((TaskOrdering2) => {
  TaskOrdering2["State"] = "state";
  TaskOrdering2["LastUpdated"] = "modifiedOn";
  TaskOrdering2["DueDate"] = "dueDate";
  TaskOrdering2["Manual"] = "rank";
  return TaskOrdering2;
})(TaskOrdering || {});
const taskId = "task";
const task = (0, import_platform.plugin)(taskId, {
  app: {
    Tasks: ""
  },
  action: {
    Move: ""
  },
  mixin: {
    KanbanCard: "",
    TaskTypeClass: "",
    ProjectTypeClass: ""
  },
  attribute: {
    State: ""
  },
  string: {
    StartDate: "",
    DueDate: "",
    TaskState: "",
    TaskStateTitle: "",
    TaskStateDone: "",
    TaskNumber: "",
    Todo: "",
    TaskDone: "",
    TaskDueTo: "",
    TaskParent: "",
    IssueName: "",
    TaskComments: "",
    TaskLabels: "",
    Rank: "",
    EditStates: "",
    MarkAsDone: "",
    MarkAsUndone: "",
    Kanban: "",
    ApplicationLabelTask: "",
    AssignedToMe: "",
    Dashboard: "",
    ProjectTypes: "",
    TaskType: "",
    ProjectType: "",
    Identifier: ""
  },
  class: {
    ProjectTypeDescriptor: "",
    ProjectType: "",
    Project: "",
    TaskTypeDescriptor: "",
    TaskType: "",
    Task: ""
  },
  viewlet: {
    Kanban: "",
    Dashboard: "",
    StatusTable: ""
  },
  icon: {
    Task: "",
    Kanban: "",
    TodoCheck: "",
    TodoUnCheck: "",
    ManageTemplates: "",
    TaskState: "",
    Dashboard: ""
  },
  global: {
    // Global task root, if not attached to some other object.
    Task: ""
  },
  space: {
    Sequence: "",
    Statuses: ""
  },
  statusCategory: {
    UnStarted: "",
    // For classic project type
    ToDo: "",
    Active: "",
    Won: "",
    Lost: ""
  },
  component: {
    ProjectTypeSelector: "",
    CreateStatePopup: ""
  },
  ids: {
    AssigneedNotification: "",
    ManageProjects: ""
  },
  extensions: {
    ProjectEditorExtension: ""
  }
});
var index_default = task;
//# sourceMappingURL=index.js.map
