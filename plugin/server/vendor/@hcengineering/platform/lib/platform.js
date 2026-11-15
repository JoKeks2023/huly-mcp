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
var platform_exports = {};
__export(platform_exports, {
  _EmbeddedId: () => _EmbeddedId,
  _ID_SEPARATOR: () => _ID_SEPARATOR,
  default: () => platform_default,
  getEmbeddedLabel: () => getEmbeddedLabel,
  mergeIds: () => mergeIds,
  platformId: () => platformId,
  plugin: () => plugin
});
module.exports = __toCommonJS(platform_exports);
/*!
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
*/
const _ID_SEPARATOR = ":";
const _EmbeddedId = "embedded";
function identify(result, prefix, namespace) {
  for (const key in namespace) {
    const value = namespace[key];
    if (typeof result[key] === "string") {
      throw new Error(`'identify' overwrites '${key}' for ${prefix}`);
    }
    const ident = prefix + _ID_SEPARATOR + key;
    result[key] = typeof value === "string" ? ident : identify(result[key] ?? {}, ident, value);
  }
  return result;
}
__name(identify, "identify");
function getEmbeddedLabel(str) {
  return _EmbeddedId + _ID_SEPARATOR + _EmbeddedId + _ID_SEPARATOR + str;
}
__name(getEmbeddedLabel, "getEmbeddedLabel");
function plugin(plugin2, namespace) {
  return identify({}, plugin2, namespace);
}
__name(plugin, "plugin");
function mergeIds(plugin2, ns, merge) {
  return identify({ ...ns }, plugin2, merge);
}
__name(mergeIds, "mergeIds");
const platformId = "platform";
var platform_default = plugin(platformId, {
  status: {
    OK: "",
    BadError: "",
    UnknownError: "",
    InvalidId: "",
    ConnectionClosed: "",
    LoadingPlugin: "",
    NoLocationForPlugin: "",
    ResourceNotFound: "",
    NoLoaderForStrings: "",
    BadRequest: "",
    Forbidden: "",
    // 403
    Unauthorized: "",
    // 401
    TokenExpired: "",
    // 401
    TokenNotActive: "",
    // 401
    PasswordExpired: "",
    // 401
    Conflict: "",
    // 409
    ExpiredLink: "",
    UnknownMethod: "",
    InternalServerError: "",
    MaintenanceWarning: "",
    MaintenanceWarningTime: "",
    AccountNotFound: "",
    AccountMismatch: "",
    AccountNotConfirmed: "",
    WorkspaceNotFound: "",
    WorkspaceArchived: "",
    WorkspaceMigration: "",
    SocialIdNotFound: "",
    SocialIdNotConfirmed: "",
    SocialIdAlreadyConfirmed: "",
    IntegrationExists: "",
    IntegrationAlreadyExists: "",
    IntegrationNotFound: "",
    IntegrationSecretAlreadyExists: "",
    IntegrationSecretNotFound: "",
    PersonNotFound: "",
    InvalidPassword: "",
    PasswordLoginLocked: "",
    AccountAlreadyExists: "",
    WorkspaceAlreadyExists: "",
    WorkspaceRateLimit: "",
    WorkspaceLimitReached: "",
    InvalidOtp: "",
    InviteNotFound: "",
    MailboxError: "",
    SocialIdAlreadyExists: "",
    ReadOnlyAccount: "",
    RegularAccount: "",
    SystemAccount: ""
  },
  metadata: {
    locale: "",
    LoadHelper: ""
  }
});
//# sourceMappingURL=platform.js.map
