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
  createClient: () => createClient
});
module.exports = __toCommonJS(client_exports);
var import_client = __toESM(require("../../client/lib/index.js"));
var import_platform = require("../../platform/lib/index.js");
var import_node_crypto = __toESM(require("node:crypto"));
var import_plugin = __toESM(require("./plugin.js"));
async function createClient(transactorUrl, token, model, connectTimeout = 0) {
  const WebSocket = require("../../../ws/index.js");
  (0, import_platform.setMetadata)(import_client.default.metadata.UseBinaryProtocol, true);
  (0, import_platform.setMetadata)(import_client.default.metadata.UseProtocolCompression, true);
  (0, import_platform.setMetadata)(import_client.default.metadata.ConnectionTimeout, connectTimeout);
  (0, import_platform.setMetadata)(import_client.default.metadata.ClientSocketFactory, (url) => {
    const socket = new WebSocket(url, {
      headers: {
        "User-Agent": (0, import_platform.getMetadata)(import_plugin.default.metadata.UserAgent) ?? "Anticrm Client"
      }
    });
    return socket;
  });
  (0, import_platform.addLocation)(import_client.clientId, () => import("../../client-resources/lib/index.js"));
  if (model !== void 0) {
    let prev = "";
    const hashes = model.map((it) => {
      const h = import_node_crypto.default.createHash("sha1");
      h.update(prev);
      h.update(JSON.stringify(it));
      prev = h.digest("hex");
      return prev;
    });
    (0, import_platform.setMetadata)(import_client.default.metadata.OverridePersistenceStore, {
      load: /* @__PURE__ */ __name(async () => ({
        hash: hashes[hashes.length - 1],
        transactions: model,
        full: true
      }), "load"),
      store: /* @__PURE__ */ __name(async (model2) => {
      }, "store")
    });
  }
  const clientFactory = await (0, import_platform.getResource)(import_client.default.function.GetClient);
  return await clientFactory(token, transactorUrl);
}
__name(createClient, "createClient");
//# sourceMappingURL=client.js.map
