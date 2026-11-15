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
var plugin_exports = {};
__export(plugin_exports, {
  default: () => plugin_default,
  documentId: () => documentId,
  documentPlugin: () => documentPlugin
});
module.exports = __toCommonJS(plugin_exports);
var import_platform = require("../../platform/lib/index.js");
const documentId = "document";
const documentPlugin = (0, import_platform.plugin)(documentId, {
  class: {
    Document: "",
    DocumentSnapshot: "",
    SavedDocument: "",
    Teamspace: ""
  },
  mixin: {
    DefaultTeamspaceTypeData: ""
  },
  component: {
    CreateDocument: "",
    DocumentSearchIcon: ""
  },
  action: {
    CreateChildDocument: "",
    CreateDocument: "",
    EditTeamspace: ""
  },
  icon: {
    Document: "",
    DocumentApplication: "",
    Add: "",
    Teamspace: "",
    References: "",
    History: "",
    Star: "",
    Starred: "",
    Lock: "",
    Unlock: ""
  },
  app: {
    Documents: ""
  },
  resolver: {
    Location: ""
  },
  string: {
    ConfigLabel: "",
    CreateDocument: "",
    Documents: "",
    ForbidCreateTeamspacePermission: "",
    ForbidCreateTeamspacePermissionDescription: ""
  },
  ids: {
    NoParent: "",
    DocumentNotificationGroup: "",
    ContentNotification: ""
  },
  descriptor: {
    TeamspaceType: ""
  },
  spaceType: {
    DefaultTeamspaceType: ""
  },
  permission: {
    ForbidCreateTeamspace: ""
  }
});
var plugin_default = documentPlugin;
//# sourceMappingURL=plugin.js.map
