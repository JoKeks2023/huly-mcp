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
var index_exports = {};
__export(index_exports, {
  Analytics: () => Analytics,
  providers: () => providers
});
module.exports = __toCommonJS(index_exports);
var import_platform = require("../../platform/lib/index.js");
const providers = [];
const Analytics = {
  data: {},
  init(provider, config) {
    const res = provider.init(config);
    if (res) {
      providers.push(provider);
    }
  },
  setUser(email, data) {
    providers.forEach((provider) => {
      provider.setUser(email, data);
    });
  },
  setAlias(distinctId, alias) {
    providers.forEach((provider) => {
      provider.setAlias(distinctId, alias);
    });
  },
  setTag(key, value) {
    providers.forEach((provider) => {
      provider.setTag(key, value);
    });
  },
  setWorkspace(ws, guest) {
    providers.forEach((provider) => {
      provider.setWorkspace(ws, guest);
    });
  },
  handleEvent(event, params = {}) {
    providers.forEach((provider) => {
      provider.handleEvent(event, { ...this.data, ...params });
    });
  },
  handleError(error) {
    providers.forEach((provider) => {
      provider.handleError(error);
    });
  },
  navigate(path) {
    providers.forEach((provider) => {
      provider.navigate(path);
    });
  },
  logout() {
    providers.forEach((provider) => {
      provider.logout();
    });
  }
};
(0, import_platform.addEventListener)(import_platform.PlatformEvent, async (_event, _status) => {
  if (_status.severity === import_platform.Severity.ERROR) {
    const label = await (0, import_platform.translate)(_status.code, _status.params, "en");
    Analytics.handleError(new Error(label));
  }
});
//# sourceMappingURL=index.js.map
