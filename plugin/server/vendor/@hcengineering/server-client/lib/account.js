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
var account_exports = {};
__export(account_exports, {
  getAccountClient: () => getAccountClient,
  getTransactorEndpoint: () => getTransactorEndpoint,
  withRetry: () => withRetry,
  withRetryConnUntilSuccess: () => withRetryConnUntilSuccess,
  withRetryConnUntilTimeout: () => withRetryConnUntilTimeout
});
module.exports = __toCommonJS(account_exports);
var import_account_client = require("../../account-client/lib/index.js");
var import_platform = require("../../platform/lib/index.js");
var import_plugin = __toESM(require("./plugin.js"));
const connectionErrorCodes = ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND"];
function getAccountClient(token, retryTimeoutMs) {
  const accountsUrl = (0, import_platform.getMetadata)(import_plugin.default.metadata.Endpoint);
  return (0, import_account_client.getClient)(accountsUrl, token, retryTimeoutMs);
}
__name(getAccountClient, "getAccountClient");
const externalRegions = process.env.EXTERNAL_REGIONS?.split(";") ?? [];
async function getTransactorEndpoint(token, kind = "byregion", timeout = -1) {
  const accountClient = getAccountClient(token, 3e4);
  const st = Date.now();
  while (true) {
    try {
      const workspaceInfo = await accountClient.selectWorkspace("", kind, externalRegions);
      if (workspaceInfo === void 0) {
        throw new Error("Workspace not found");
      }
      return workspaceInfo.endpoint;
    } catch (err) {
      if (timeout > 0 && st + timeout < Date.now()) {
        throw err;
      }
      if (connectionErrorCodes.includes(err?.cause?.code)) {
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      } else {
        throw err;
      }
    }
  }
}
__name(getTransactorEndpoint, "getTransactorEndpoint");
function withRetry(f, shouldFail, intervalMs = 1e3) {
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
      }
    }
  };
}
__name(withRetry, "withRetry");
function withRetryConnUntilTimeout(f, timeoutMs = 5e3) {
  const timeout = Date.now() + timeoutMs;
  const shouldFail = /* @__PURE__ */ __name((err) => !connectionErrorCodes.includes(err?.cause?.code) || timeout < Date.now(), "shouldFail");
  return withRetry(f, shouldFail);
}
__name(withRetryConnUntilTimeout, "withRetryConnUntilTimeout");
function withRetryConnUntilSuccess(f) {
  const shouldFail = /* @__PURE__ */ __name((err) => {
    const res = !connectionErrorCodes.includes(err?.cause?.code);
    if (res) {
      console.error("Failing withRetryConnUntilSuccess with error cause:", err?.cause);
    }
    return res;
  }, "shouldFail");
  return withRetry(f, shouldFail);
}
__name(withRetryConnUntilSuccess, "withRetryConnUntilSuccess");
//# sourceMappingURL=account.js.map
