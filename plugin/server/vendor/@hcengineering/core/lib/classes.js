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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var classes_exports = {};
__export(classes_exports, {
  AccountRole: () => AccountRole,
  ClassifierKind: () => ClassifierKind,
  DOMAIN_BLOB: () => DOMAIN_BLOB,
  DOMAIN_COLLABORATOR: () => DOMAIN_COLLABORATOR,
  DOMAIN_CONFIGURATION: () => DOMAIN_CONFIGURATION,
  DOMAIN_MIGRATION: () => DOMAIN_MIGRATION,
  DOMAIN_MODEL: () => DOMAIN_MODEL,
  DOMAIN_MODEL_TX: () => DOMAIN_MODEL_TX,
  DOMAIN_RELATION: () => DOMAIN_RELATION,
  DOMAIN_SEQUENCE: () => DOMAIN_SEQUENCE,
  DOMAIN_SPACE: () => DOMAIN_SPACE,
  DOMAIN_TRANSIENT: () => DOMAIN_TRANSIENT,
  DateRangeMode: () => DateRangeMode,
  IndexKind: () => IndexKind,
  IndexOrder: () => IndexOrder,
  SocialIdType: () => SocialIdType,
  WorkspaceAccountPermission: () => WorkspaceAccountPermission,
  isActiveMode: () => isActiveMode,
  isArchivingMode: () => isArchivingMode,
  isDeletingMode: () => isDeletingMode,
  isMigrationMode: () => isMigrationMode,
  isRestoringMode: () => isRestoringMode,
  isUpgradingMode: () => isUpgradingMode,
  roleOrder: () => roleOrder,
  versionToString: () => versionToString
});
module.exports = __toCommonJS(classes_exports);
var IndexKind = /* @__PURE__ */ ((IndexKind2) => {
  IndexKind2[IndexKind2["FullText"] = 0] = "FullText";
  IndexKind2[IndexKind2["Indexed"] = 1] = "Indexed";
  IndexKind2[IndexKind2["IndexedDsc"] = 2] = "IndexedDsc";
  return IndexKind2;
})(IndexKind || {});
var ClassifierKind = /* @__PURE__ */ ((ClassifierKind2) => {
  ClassifierKind2[ClassifierKind2["CLASS"] = 0] = "CLASS";
  ClassifierKind2[ClassifierKind2["INTERFACE"] = 1] = "INTERFACE";
  ClassifierKind2[ClassifierKind2["MIXIN"] = 2] = "MIXIN";
  return ClassifierKind2;
})(ClassifierKind || {});
var DateRangeMode = /* @__PURE__ */ ((DateRangeMode2) => {
  DateRangeMode2["DATE"] = "date";
  DateRangeMode2["TIME"] = "time";
  DateRangeMode2["DATETIME"] = "datetime";
  DateRangeMode2["TIMEONLY"] = "timeonly";
  return DateRangeMode2;
})(DateRangeMode || {});
const DOMAIN_MODEL = "model";
const DOMAIN_MODEL_TX = "model_tx";
const DOMAIN_SPACE = "space";
const DOMAIN_CONFIGURATION = "_configuration";
const DOMAIN_MIGRATION = "_migrations";
const DOMAIN_TRANSIENT = "transient";
const DOMAIN_RELATION = "relation";
const DOMAIN_COLLABORATOR = "collaborator";
const DOMAIN_BLOB = "blob";
const DOMAIN_SEQUENCE = "sequence";
var AccountRole = /* @__PURE__ */ ((AccountRole2) => {
  AccountRole2["ReadOnlyGuest"] = "READONLYGUEST";
  AccountRole2["DocGuest"] = "DocGuest";
  AccountRole2["Guest"] = "GUEST";
  AccountRole2["User"] = "USER";
  AccountRole2["Maintainer"] = "MAINTAINER";
  AccountRole2["Owner"] = "OWNER";
  AccountRole2["Admin"] = "ADMIN";
  return AccountRole2;
})(AccountRole || {});
const roleOrder = {
  ["READONLYGUEST" /* ReadOnlyGuest */]: 5,
  ["DocGuest" /* DocGuest */]: 10,
  ["GUEST" /* Guest */]: 20,
  ["USER" /* User */]: 30,
  ["MAINTAINER" /* Maintainer */]: 40,
  ["OWNER" /* Owner */]: 50,
  ["ADMIN" /* Admin */]: 100
};
function versionToString(version) {
  return `${version?.major}.${version?.minor}.${version?.patch}`;
}
__name(versionToString, "versionToString");
var IndexOrder = /* @__PURE__ */ ((IndexOrder2) => {
  IndexOrder2[IndexOrder2["Ascending"] = 1] = "Ascending";
  IndexOrder2[IndexOrder2["Descending"] = -1] = "Descending";
  return IndexOrder2;
})(IndexOrder || {});
function isActiveMode(mode) {
  return mode === "active";
}
__name(isActiveMode, "isActiveMode");
function isDeletingMode(mode) {
  return mode === "pending-deletion" || mode === "deleting" || mode === "deleted";
}
__name(isDeletingMode, "isDeletingMode");
function isArchivingMode(mode) {
  return mode === "archiving-pending-backup" || mode === "archiving-backup" || mode === "archiving-pending-clean" || mode === "archiving-clean" || mode === "archived";
}
__name(isArchivingMode, "isArchivingMode");
function isMigrationMode(mode) {
  return mode === "migration-pending-backup" || mode === "migration-backup" || mode === "migration-pending-clean" || mode === "migration-clean";
}
__name(isMigrationMode, "isMigrationMode");
function isRestoringMode(mode) {
  return mode === "restoring" || mode === "pending-restore";
}
__name(isRestoringMode, "isRestoringMode");
function isUpgradingMode(mode) {
  return mode === "upgrading";
}
__name(isUpgradingMode, "isUpgradingMode");
var SocialIdType = /* @__PURE__ */ ((SocialIdType2) => {
  SocialIdType2["EMAIL"] = "email";
  SocialIdType2["GITHUB"] = "github";
  SocialIdType2["GOOGLE"] = "google";
  SocialIdType2["PHONE"] = "phone";
  SocialIdType2["OIDC"] = "oidc";
  SocialIdType2["HULY"] = "huly";
  SocialIdType2["TELEGRAM"] = "telegram";
  SocialIdType2["HULY_ASSISTANT"] = "huly-assistant";
  return SocialIdType2;
})(SocialIdType || {});
var WorkspaceAccountPermission = /* @__PURE__ */ ((WorkspaceAccountPermission2) => {
  WorkspaceAccountPermission2["ImportDocument"] = "ImportDocument";
  return WorkspaceAccountPermission2;
})(WorkspaceAccountPermission || {});
//# sourceMappingURL=classes.js.map
