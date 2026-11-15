"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var client_exports = {};
__export(client_exports, {
  getClient: () => getClient
});
module.exports = __toCommonJS(client_exports);
var import_core = require("../../core/lib/index.js");
var import_platform = __toESM(require("../../platform/lib/index.js"));
var import_utils = require("./utils.js");
function getClient(accountsUrl, token, retryTimeoutMs) {
  if (accountsUrl === void 0) {
    throw new Error("Accounts url not specified");
  }
  return new AccountClientImpl(accountsUrl, token, retryTimeoutMs);
}
__name(getClient, "getClient");
class AccountClientImpl {
  constructor(url, token, retryTimeoutMs) {
    this.url = url;
    this.token = token;
    if (url === "") {
      throw new Error("Accounts url not specified");
    }
    const isBrowser = typeof window !== "undefined";
    this.request = {
      keepalive: true,
      headers: {
        ...this.token === void 0 ? {} : {
          Authorization: "Bearer " + this.token
        }
      },
      ...isBrowser ? { credentials: "include" } : {}
    };
    this.rpc = withRetryUntilTimeout(this._rpc.bind(this), retryTimeoutMs ?? 5e3);
  }
  static {
    __name(this, "AccountClientImpl");
  }
  request;
  rpc;
  async getProviders() {
    return await withRetryUntilMaxAttempts(async () => {
      const response = await fetch((0, import_core.concatLink)(this.url, "/providers"));
      return await response.json();
    })();
  }
  async _rpc(request) {
    const timezone = (0, import_utils.getClientTimezone)();
    const meta = timezone !== void 0 ? { "x-timezone": timezone } : {};
    const response = await fetch(this.url, {
      ...this.request,
      headers: {
        ...this.request.headers,
        "Content-Type": "application/json",
        Connection: "keep-alive",
        ...meta
      },
      method: "POST",
      body: JSON.stringify(request)
    });
    const result = await response.json();
    if (result.error != null) {
      throw new import_platform.PlatformError(result.error);
    }
    return result.result;
  }
  flattenStatus(ws) {
    if (ws === void 0) {
      throw new import_platform.PlatformError(new import_platform.Status(import_platform.Severity.ERROR, import_platform.default.status.WorkspaceNotFound, {}));
    }
    const status = ws.status;
    if (status === void 0) {
      return ws;
    }
    const result = { ...ws, ...status, processingAttemps: status.processingAttempts ?? 0 };
    delete result.status;
    return result;
  }
  async getUserWorkspaces() {
    const request = {
      method: "getUserWorkspaces",
      params: {}
    };
    return (await this.rpc(request)).map((ws) => this.flattenStatus(ws));
  }
  async selectWorkspace(workspaceUrl, kind = "external", externalRegions = []) {
    const request = {
      method: "selectWorkspace",
      params: { workspaceUrl, kind, externalRegions }
    };
    return await this.rpc(request);
  }
  async validateOtp(email, code, password, action) {
    const request = {
      method: "validateOtp",
      params: { email, code, password, action }
    };
    return await this.rpc(request);
  }
  async loginOtp(email) {
    const request = {
      method: "loginOtp",
      params: { email }
    };
    return await this.rpc(request);
  }
  async getLoginInfoByToken(data) {
    const request = {
      method: "getLoginInfoByToken",
      params: data ?? {}
    };
    return await this.rpc(request);
  }
  async getLoginWithWorkspaceInfo() {
    const request = {
      method: "getLoginWithWorkspaceInfo",
      params: {}
    };
    return await this.rpc(request);
  }
  async restorePassword(password) {
    const request = {
      method: "restorePassword",
      params: { password }
    };
    return await this.rpc(request);
  }
  async confirm() {
    const request = {
      method: "confirm",
      params: {}
    };
    return await this.rpc(request);
  }
  async requestPasswordReset(email) {
    const request = {
      method: "requestPasswordReset",
      params: { email }
    };
    await this.rpc(request);
  }
  async sendInvite(email, role) {
    const request = {
      method: "sendInvite",
      params: { email, role }
    };
    await this.rpc(request);
  }
  async resendInvite(email, role) {
    const request = {
      method: "resendInvite",
      params: { email, role }
    };
    await this.rpc(request);
  }
  async createInviteLink(email, role, autoJoin, firstName, lastName, navigateUrl, expHours) {
    const request = {
      method: "createInviteLink",
      params: { email, role, autoJoin, firstName, lastName, navigateUrl, expHours }
    };
    return await this.rpc(request);
  }
  async createAccessLink(role, options) {
    const params = { ...options ?? {}, role };
    if (params.extra != null) {
      params.extra = JSON.stringify(params.extra);
    }
    const request = {
      method: "createAccessLink",
      params
    };
    return await this.rpc(request);
  }
  async leaveWorkspace(account) {
    const request = {
      method: "leaveWorkspace",
      params: { account }
    };
    return await this.rpc(request);
  }
  async changeUsername(first, last) {
    const request = {
      method: "changeUsername",
      params: { first, last }
    };
    await this.rpc(request);
  }
  async changePassword(oldPassword, newPassword) {
    const request = {
      method: "changePassword",
      params: { oldPassword, newPassword }
    };
    await this.rpc(request);
  }
  async updatePasswordAgingRule(days) {
    const request = {
      method: "updatePasswordAgingRule",
      params: { days }
    };
    await this.rpc(request);
  }
  async checkPasswordAging() {
    const request = {
      method: "checkPasswordAging",
      params: {}
    };
    return await this.rpc(request);
  }
  async signUpJoin(email, password, first, last, inviteId, workspaceUrl) {
    const request = {
      method: "signUpJoin",
      params: { email, password, first, last, inviteId, workspaceUrl }
    };
    return await this.rpc(request);
  }
  async join(email, password, inviteId, workspaceUrl) {
    const request = {
      method: "join",
      params: { email, password, inviteId, workspaceUrl }
    };
    return await this.rpc(request);
  }
  async createInvite(exp, emailMask, limit, role) {
    const request = {
      method: "createInvite",
      params: { exp, emailMask, limit, role }
    };
    return await this.rpc(request);
  }
  async checkJoin(inviteId) {
    const request = {
      method: "checkJoin",
      params: { inviteId }
    };
    return await this.rpc(request);
  }
  async joinByToken(inviteId) {
    const request = {
      method: "joinByToken",
      params: { inviteId }
    };
    return await this.rpc(request);
  }
  async checkAutoJoin(inviteId, firstName, lastName) {
    const request = {
      method: "checkAutoJoin",
      params: { inviteId, firstName, lastName }
    };
    return await this.rpc(request);
  }
  async getInviteInfo(inviteId) {
    const request = {
      method: "getInviteInfo",
      params: { inviteId }
    };
    return await this.rpc(request);
  }
  async getWorkspacesInfo(ids) {
    const request = {
      method: "getWorkspacesInfo",
      params: { ids }
    };
    const infos = await this.rpc(request);
    return Array.from(infos).map((it) => this.flattenStatus(it));
  }
  async updateLastVisit(ids) {
    const request = {
      method: "updateLastVisit",
      params: { ids }
    };
    await this.rpc(request);
  }
  async getWorkspaceInfo(updateLastVisit = false) {
    const request = {
      method: "getWorkspaceInfo",
      params: updateLastVisit ? { updateLastVisit: true } : {}
    };
    return this.flattenStatus(await this.rpc(request));
  }
  async getRegionInfo() {
    const request = {
      method: "getRegionInfo",
      params: {}
    };
    return await this.rpc(request);
  }
  async createWorkspace(workspaceName, region) {
    const request = {
      method: "createWorkspace",
      params: { workspaceName, region }
    };
    return await this.rpc(request);
  }
  async signUpOtp(email, firstName, lastName) {
    const request = {
      method: "signUpOtp",
      params: { email, firstName, lastName }
    };
    return await this.rpc(request);
  }
  async signUp(email, password, firstName, lastName) {
    const request = {
      method: "signUp",
      params: { email, password, firstName, lastName }
    };
    return await this.rpc(request);
  }
  async login(email, password) {
    const request = {
      method: "login",
      params: { email, password }
    };
    return await this.rpc(request);
  }
  async loginAsGuest() {
    const request = {
      method: "loginAsGuest",
      params: {}
    };
    return await this.rpc(request);
  }
  async isReadOnlyGuest() {
    const request = {
      method: "isReadOnlyGuest",
      params: {}
    };
    return await this.rpc(request);
  }
  async getPerson() {
    const request = {
      method: "getPerson",
      params: {}
    };
    return await this.rpc(request);
  }
  async getPersonInfo(account) {
    const request = {
      method: "getPersonInfo",
      params: { account }
    };
    return await this.rpc(request);
  }
  async getSocialIds(includeDeleted) {
    const request = {
      method: "getSocialIds",
      params: { includeDeleted }
    };
    return await this.rpc(request);
  }
  async workerHandshake(region, version, operation) {
    const request = {
      method: "workerHandshake",
      params: { region, version, operation }
    };
    await this.rpc(request);
  }
  async getPendingWorkspace(region, version, operation) {
    const request = {
      method: "getPendingWorkspace",
      params: { region, version, operation }
    };
    const result = await this.rpc(request);
    if (result == null) {
      return null;
    }
    return this.flattenStatus(result);
  }
  async updateWorkspaceInfo(workspaceUuid, event, version, progress, message) {
    const request = {
      method: "updateWorkspaceInfo",
      params: { workspaceUuid, event, version, progress, message }
    };
    await this.rpc(request);
  }
  async updateAllowReadOnlyGuests(readOnlyGuestsAllowed) {
    const request = {
      method: "updateAllowReadOnlyGuests",
      params: { readOnlyGuestsAllowed }
    };
    return await this.rpc(request);
  }
  async updateAllowGuestSignUp(guestSignUpAllowed) {
    const request = {
      method: "updateAllowGuestSignUp",
      params: { guestSignUpAllowed }
    };
    await this.rpc(request);
  }
  async getWorkspaceMembers() {
    const request = {
      method: "getWorkspaceMembers",
      params: {}
    };
    return await this.rpc(request);
  }
  async updateWorkspaceRole(targetAccount, targetRole) {
    const request = {
      method: "updateWorkspaceRole",
      params: { targetAccount, targetRole }
    };
    await this.rpc(request);
  }
  async updateWorkspaceName(name) {
    const request = {
      method: "updateWorkspaceName",
      params: { name }
    };
    await this.rpc(request);
  }
  async deleteWorkspace() {
    const request = {
      method: "deleteWorkspace",
      params: {}
    };
    await this.rpc(request);
  }
  async findPersonBySocialKey(socialString, requireAccount) {
    const request = {
      method: "findPersonBySocialKey",
      params: { socialString, requireAccount }
    };
    return await this.rpc(request);
  }
  async findPersonBySocialId(socialId, requireAccount) {
    const request = {
      method: "findPersonBySocialId",
      params: { socialId, requireAccount }
    };
    return await this.rpc(request);
  }
  async findSocialIdBySocialKey(socialKey) {
    const request = {
      method: "findSocialIdBySocialKey",
      params: { socialKey }
    };
    return await this.rpc(request);
  }
  async findFullSocialIdBySocialKey(socialKey) {
    const request = {
      method: "findFullSocialIdBySocialKey",
      params: { socialKey }
    };
    return await this.rpc(request);
  }
  async findFullSocialIds(socialIds) {
    const request = {
      method: "findFullSocialIds",
      params: { socialIds }
    };
    return await this.rpc(request);
  }
  async listWorkspaces(region, mode = null) {
    const request = {
      method: "listWorkspaces",
      params: { region, mode }
    };
    return (await this.rpc(request) ?? []).map((ws) => this.flattenStatus(ws));
  }
  async performWorkspaceOperation(workspaceId, event, ...params) {
    const request = {
      method: "performWorkspaceOperation",
      params: { workspaceId, event, params }
    };
    return await this.rpc(request);
  }
  async updateBackupInfo(backupInfo) {
    const request = {
      method: "updateBackupInfo",
      params: { backupInfo }
    };
    await this.rpc(request);
  }
  async updateUsageInfo(usageInfo) {
    const request = {
      method: "updateUsageInfo",
      params: { usageInfo }
    };
    await this.rpc(request);
  }
  async assignWorkspace(email, workspaceUuid, role) {
    const request = {
      method: "assignWorkspace",
      params: { email, workspaceUuid, role }
    };
    await this.rpc(request);
  }
  async updateWorkspaceRoleBySocialKey(socialKey, targetRole) {
    const request = {
      method: "updateWorkspaceRoleBySocialKey",
      params: { socialKey, targetRole }
    };
    await this.rpc(request);
  }
  async ensurePerson(socialType, socialValue, firstName, lastName) {
    const request = {
      method: "ensurePerson",
      params: { socialType, socialValue, firstName, lastName }
    };
    return await this.rpc(request);
  }
  async exchangeGuestToken(token) {
    const request = {
      method: "exchangeGuestToken",
      params: { token }
    };
    return await this.rpc(request);
  }
  async addSocialIdToPerson(person, type, value, confirmed, displayValue) {
    const request = {
      method: "addSocialIdToPerson",
      params: { person, type, value, confirmed, displayValue }
    };
    return await this.rpc(request);
  }
  async updateSocialId(personId, displayValue) {
    const request = {
      method: "updateSocialId",
      params: { personId, displayValue }
    };
    return await this.rpc(request);
  }
  async getMailboxOptions() {
    const request = {
      method: "getMailboxOptions",
      params: {}
    };
    return await this.rpc(request);
  }
  async getMailboxSecret(mailbox) {
    const request = {
      method: "getMailboxSecret",
      params: { mailbox }
    };
    return await this.rpc(request);
  }
  async createMailbox(name, domain) {
    const request = {
      method: "createMailbox",
      params: { name, domain }
    };
    return await this.rpc(request);
  }
  async getMailboxes() {
    const request = {
      method: "getMailboxes",
      params: {}
    };
    return await this.rpc(request);
  }
  async deleteMailbox(mailbox) {
    const request = {
      method: "deleteMailbox",
      params: { mailbox }
    };
    await this.rpc(request);
  }
  async listAccounts(search, skip, limit) {
    const request = {
      method: "listAccounts",
      params: { search, skip, limit }
    };
    return await this.rpc(request);
  }
  async deleteAccount(uuid) {
    const request = {
      method: "deleteAccount",
      params: { uuid }
    };
    await this.rpc(request);
  }
  async releaseSocialId(personUuid, type, value, deleteIntegrations = false) {
    const request = {
      method: "releaseSocialId",
      params: { personUuid, type, value, deleteIntegrations }
    };
    return await this.rpc(request);
  }
  async createIntegration(integration) {
    const request = {
      method: "createIntegration",
      params: integration
    };
    await this.rpc(request);
  }
  async updateIntegration(integration) {
    const request = {
      method: "updateIntegration",
      params: integration
    };
    await this.rpc(request);
  }
  async deleteIntegration(integrationKey) {
    const request = {
      method: "deleteIntegration",
      params: integrationKey
    };
    await this.rpc(request);
  }
  async getIntegration(integrationKey) {
    const request = {
      method: "getIntegration",
      params: integrationKey
    };
    return await this.rpc(request);
  }
  async listIntegrations(filter) {
    const request = {
      method: "listIntegrations",
      params: filter
    };
    return await this.rpc(request);
  }
  async addIntegrationSecret(integrationSecret) {
    const request = {
      method: "addIntegrationSecret",
      params: integrationSecret
    };
    await this.rpc(request);
  }
  async updateIntegrationSecret(integrationSecret) {
    const request = {
      method: "updateIntegrationSecret",
      params: integrationSecret
    };
    await this.rpc(request);
  }
  async deleteIntegrationSecret(integrationSecretKey) {
    const request = {
      method: "deleteIntegrationSecret",
      params: integrationSecretKey
    };
    await this.rpc(request);
  }
  async getIntegrationSecret(integrationSecretKey) {
    const request = {
      method: "getIntegrationSecret",
      params: integrationSecretKey
    };
    return await this.rpc(request);
  }
  async listIntegrationsSecrets(filter) {
    const request = {
      method: "listIntegrationsSecrets",
      params: filter
    };
    return await this.rpc(request);
  }
  async getAccountInfo(uuid) {
    const request = {
      method: "getAccountInfo",
      params: { accountId: uuid }
    };
    return await this.rpc(request);
  }
  async canMergeSpecifiedPersons(primaryPerson, secondaryPerson) {
    const request = {
      method: "canMergeSpecifiedPersons",
      params: { primaryPerson, secondaryPerson }
    };
    return await this.rpc(request);
  }
  async mergeSpecifiedPersons(primaryPerson, secondaryPerson) {
    const request = {
      method: "mergeSpecifiedPersons",
      params: { primaryPerson, secondaryPerson }
    };
    await this.rpc(request);
  }
  async mergeSpecifiedAccounts(primaryAccount, secondaryAccount) {
    const request = {
      method: "mergeSpecifiedAccounts",
      params: { primaryAccount, secondaryAccount }
    };
    await this.rpc(request);
  }
  async addEmailSocialId(email) {
    const request = {
      method: "addEmailSocialId",
      params: { email }
    };
    return await this.rpc(request);
  }
  async addHulyAssistantSocialId() {
    const request = {
      method: "addHulyAssistantSocialId",
      params: {}
    };
    return await this.rpc(request);
  }
  async refreshHulyAssistantToken() {
    const request = {
      method: "refreshHulyAssistantToken",
      params: {}
    };
    await this.rpc(request);
  }
  async setCookie() {
    const url = (0, import_core.concatLink)(this.url, "/cookie");
    const response = await fetch(url, { ...this.request, method: "PUT" });
    if (!response.ok) {
      const result = await response.json();
      if (result.error != null) {
        throw new import_platform.PlatformError(result.error);
      }
    }
  }
  async deleteCookie() {
    const url = (0, import_core.concatLink)(this.url, "/cookie");
    const response = await fetch(url, { ...this.request, method: "DELETE" });
    if (!response.ok) {
      const result = await response.json();
      if (result.error != null) {
        throw new import_platform.PlatformError(result.error);
      }
    }
  }
  async setMyProfile(profile) {
    const request = {
      method: "setMyProfile",
      params: {
        profile
      }
    };
    await this._rpc(request);
  }
  async getUserProfile(personUuid) {
    return await this._rpc({
      method: "getUserProfile",
      params: {
        personUuid
      }
    });
  }
  async getSubscriptions(workspaceUuid = void 0, activeOnly = true) {
    return await this._rpc({
      method: "getSubscriptions",
      params: {
        workspaceUuid,
        activeOnly
      }
    });
  }
  async getSubscriptionByProviderId(provider, providerSubscriptionId) {
    return await this._rpc({
      method: "getSubscriptionByProviderId",
      params: {
        provider,
        providerSubscriptionId
      }
    });
  }
  async getSubscriptionById(subscriptionId) {
    return await this._rpc({
      method: "getSubscriptionById",
      params: {
        subscriptionId
      }
    });
  }
  async upsertSubscription(subscription) {
    await this._rpc({
      method: "upsertSubscription",
      params: subscription
    });
  }
  async batchAssignWorkspacePermission(params) {
    await this._rpc({
      method: "batchAssignWorkspacePermission",
      params
    });
  }
  async batchRevokeWorkspacePermission(params) {
    await this._rpc({
      method: "batchRevokeWorkspacePermission",
      params
    });
  }
  async hasWorkspacePermission(params) {
    return await this._rpc({
      method: "hasWorkspacePermission",
      params
    });
  }
  async getWorkspacePermissions(params) {
    return await this._rpc({
      method: "getWorkspacePermissions",
      params
    });
  }
  async getWorkspaceUsersWithPermission(params) {
    return await this._rpc({
      method: "getWorkspaceUsersWithPermission",
      params
    });
  }
}
function withRetry(f, shouldFail, intervalMs = 25) {
  return async function(...params) {
    let attempt = 0;
    while (true) {
      try {
        return await f(...params);
      } catch (err) {
        if (shouldFail(err, attempt)) {
          throw err;
        }
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        if (intervalMs < 1e3) {
          intervalMs += 100;
        }
      }
    }
  };
}
__name(withRetry, "withRetry");
function withRetryUntilTimeout(f, timeoutMs = 5e3) {
  const timeout = Date.now() + timeoutMs;
  const shouldFail = /* @__PURE__ */ __name((err) => !(0, import_utils.isNetworkError)(err) || timeout < Date.now(), "shouldFail");
  return withRetry(f, shouldFail);
}
__name(withRetryUntilTimeout, "withRetryUntilTimeout");
function withRetryUntilMaxAttempts(f, maxAttempts = 5) {
  const shouldFail = /* @__PURE__ */ __name((err, attempt) => !(0, import_utils.isNetworkError)(err) || attempt === maxAttempts, "shouldFail");
  return withRetry(f, shouldFail);
}
__name(withRetryUntilMaxAttempts, "withRetryUntilMaxAttempts");
//# sourceMappingURL=client.js.map
