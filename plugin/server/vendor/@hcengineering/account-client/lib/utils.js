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
var utils_exports = {};
__export(utils_exports, {
  getClientTimezone: () => getClientTimezone,
  isLoginInfoRequest: () => isLoginInfoRequest,
  isNetworkError: () => isNetworkError,
  isWorkspaceLoginInfo: () => isWorkspaceLoginInfo
});
module.exports = __toCommonJS(utils_exports);
function isWorkspaceLoginInfo(loginInfo) {
  return !isLoginInfoRequest(loginInfo) && loginInfo?.workspace != null;
}
__name(isWorkspaceLoginInfo, "isWorkspaceLoginInfo");
function isLoginInfoRequest(info) {
  return info?.request;
}
__name(isLoginInfoRequest, "isLoginInfoRequest");
function getClientTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (err) {
    console.error("Failed to get client timezone", err);
    return void 0;
  }
}
__name(getClientTimezone, "getClientTimezone");
const connectionErrorCodes = ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND"];
const networkErrorNames = ["NetworkError", "TypeError", "FetchError"];
const browserFetchErrorMessages = ["failed to fetch", "networkerror", "network request failed"];
const networkMessageKeywords = ["fetch", "network", "connection"];
function hasNetworkMessage(message) {
  const lowerMessage = message.toLowerCase();
  return networkMessageKeywords.some((keyword) => lowerMessage.includes(keyword));
}
__name(hasNetworkMessage, "hasNetworkMessage");
function isNetworkError(err) {
  if (err == null) {
    return false;
  }
  if (typeof err === "object" && "cause" in err) {
    const cause = err.cause;
    if (cause != null && typeof cause === "object" && "code" in cause) {
      const code = cause.code;
      if (typeof code === "string" && connectionErrorCodes.includes(code)) {
        return true;
      }
    }
  }
  let errorName;
  let message;
  if (err instanceof TypeError) {
    errorName = "TypeError";
    message = err.message;
  } else if (typeof err === "object" && "name" in err && "message" in err) {
    const name = err.name;
    const msg = err.message;
    if (typeof name === "string") {
      errorName = name;
    }
    if (typeof msg === "string") {
      message = msg;
    }
  }
  if (errorName != null && networkErrorNames.includes(errorName) && message != null) {
    const lowerMessage = message.toLowerCase();
    if (browserFetchErrorMessages.some((pattern) => lowerMessage.includes(pattern))) {
      return true;
    }
    if (hasNetworkMessage(message)) {
      return true;
    }
  }
  return false;
}
__name(isNetworkError, "isNetworkError");
//# sourceMappingURL=utils.js.map
