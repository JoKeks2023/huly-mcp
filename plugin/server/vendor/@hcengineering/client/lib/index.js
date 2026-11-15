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
  ClientSocketReadyState: () => ClientSocketReadyState,
  clientId: () => clientId,
  default: () => index_default,
  pingConst: () => pingConst,
  pongConst: () => pongConst
});
module.exports = __toCommonJS(index_exports);
var import_platform = require("../../platform/lib/index.js");
const clientId = "client";
var ClientSocketReadyState = /* @__PURE__ */ ((ClientSocketReadyState2) => {
  ClientSocketReadyState2[ClientSocketReadyState2["CONNECTING"] = 0] = "CONNECTING";
  ClientSocketReadyState2[ClientSocketReadyState2["OPEN"] = 1] = "OPEN";
  ClientSocketReadyState2[ClientSocketReadyState2["CLOSING"] = 2] = "CLOSING";
  ClientSocketReadyState2[ClientSocketReadyState2["CLOSED"] = 3] = "CLOSED";
  return ClientSocketReadyState2;
})(ClientSocketReadyState || {});
const pingConst = "ping";
const pongConst = "pong!";
var index_default = (0, import_platform.plugin)(clientId, {
  metadata: {
    ClientSocketFactory: "",
    FilterModel: "",
    ExtraFilter: "",
    ExtraPlugins: "",
    UseBinaryProtocol: "",
    UseProtocolCompression: "",
    ConnectionTimeout: "",
    OverridePersistenceStore: ""
  },
  function: {
    GetClient: ""
  }
});
//# sourceMappingURL=index.js.map
