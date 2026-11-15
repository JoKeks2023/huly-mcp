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
var index_exports = {};
__export(index_exports, {
  connect: () => import_connection.connect,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_client = __toESM(require("../../client/lib/index.js"));
var import_core = __toESM(require("../../core/lib/index.js"));
var import_platform = __toESM(require("../../platform/lib/index.js"));
var import_connection = require("./connection.js");
let dbRequest;
let dbPromise = Promise.resolve(void 0);
if (typeof localStorage !== "undefined") {
  const st = (0, import_core.platformNow)();
  dbPromise = new Promise((resolve) => {
    dbRequest = indexedDB.open("model.db.persistence", 2);
    dbRequest.onupgradeneeded = function() {
      const db = dbRequest.result;
      if (!db.objectStoreNames.contains("model")) {
        db.createObjectStore("model", { keyPath: "id" });
      }
    };
    dbRequest.onsuccess = function() {
      const db = dbRequest.result;
      console.log("init DB complete", (0, import_core.platformNow)() - st);
      resolve(db);
    };
  });
  void dbPromise.then((res) => {
    if (res !== void 0) {
      res.onclose = () => {
        dbRequest = void 0;
        dbPromise = Promise.resolve(void 0);
      };
    }
  });
}
function decodeTokenPayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (err) {
    console.error(err);
    return {};
  }
}
__name(decodeTokenPayload, "decodeTokenPayload");
var index_default = /* @__PURE__ */ __name(async () => {
  return {
    function: {
      GetClient: /* @__PURE__ */ __name(async (token, endpoint, opt) => {
        const filterModel = (0, import_platform.getMetadata)(import_client.default.metadata.FilterModel) ?? "none";
        const extraFilter = (0, import_platform.getMetadata)(import_client.default.metadata.ExtraFilter) ?? [];
        const handler = /* @__PURE__ */ __name(async (handler2) => {
          const url = (0, import_core.concatLink)(endpoint, `/${token}`);
          const upgradeHandler = /* @__PURE__ */ __name((...txes) => {
            for (const tx of txes) {
              if (tx?._class === import_core.default.class.TxModelUpgrade) {
                opt?.onUpgrade?.();
                return;
              }
              if (tx?._class === import_core.default.class.TxWorkspaceEvent) {
                const event = tx;
                if (event.event === import_core.WorkspaceEvent.MaintenanceNotification) {
                  void (0, import_platform.setPlatformStatus)(
                    new import_platform.Status(import_platform.Severity.WARNING, import_platform.default.status.MaintenanceWarning, {
                      time: event.params.timeMinutes,
                      message: event.params.message ?? ""
                    })
                  );
                }
              }
            }
            handler2(...txes);
          }, "upgradeHandler");
          const tokenPayload = decodeTokenPayload(token);
          if (tokenPayload.workspace === void 0 || tokenPayload.account === void 0) {
            throw new Error("Workspace or account not found in token");
          }
          const newOpt = { ...opt };
          const connectTimeout = opt?.connectionTimeout ?? (0, import_platform.getMetadata)(import_client.default.metadata.ConnectionTimeout);
          let connectPromise;
          if ((connectTimeout ?? 0) > 0) {
            connectPromise = new Promise((resolve, reject) => {
              const connectTO = setTimeout(() => {
                if (!clientConnection.isConnected()) {
                  newOpt.onConnect = void 0;
                  void clientConnection?.close();
                  void opt?.onDialTimeout?.();
                  reject(new Error(`Connection timeout, and no connection established to ${endpoint}`));
                }
              }, connectTimeout);
              newOpt.onConnect = async (event, lastTx, data) => {
                try {
                  await opt?.onConnect?.(event, lastTx, data);
                } catch (error) {
                  void clientConnection?.close();
                  void opt?.onDialTimeout?.();
                  reject(error);
                  return;
                }
                if (event !== import_core.ClientConnectEvent.Maintenance) {
                  clearTimeout(connectTO);
                  resolve();
                }
              };
            });
          }
          const clientConnection = (0, import_connection.connect)(url, upgradeHandler, tokenPayload.workspace, tokenPayload.account, newOpt);
          if (connectPromise !== void 0) {
            await connectPromise;
          }
          return await Promise.resolve(clientConnection);
        }, "handler");
        const modelFilter = /* @__PURE__ */ __name((txes) => {
          if (filterModel === "client") {
            return returnClientTxes(txes);
          }
          if (filterModel === "ui") {
            return returnUITxes(txes, extraFilter);
          }
          return txes;
        }, "modelFilter");
        const client = (0, import_core.createClient)(handler, modelFilter, createModelPersistence(getWSFromToken(token)), opt?.ctx);
        return await client;
      }, "GetClient")
    }
  };
}, "default");
function returnUITxes(txes, extraFilter) {
  const configs = /* @__PURE__ */ new Map();
  (0, import_core.fillConfiguration)(txes, configs);
  const allowedPlugins = [...(0, import_platform.getPlugins)(), ...(0, import_platform.getMetadata)(import_client.default.metadata.ExtraPlugins) ?? []];
  const excludedPlugins = Array.from(configs.values()).filter(
    (it) => !it.enabled || !allowedPlugins.includes(it.pluginId) || extraFilter.includes(it.pluginId)
  );
  return (0, import_core.pluginFilterTx)(excludedPlugins, configs, txes);
}
__name(returnUITxes, "returnUITxes");
function returnClientTxes(txes) {
  const configs = /* @__PURE__ */ new Map();
  (0, import_core.fillConfiguration)(txes, configs);
  const excludedPlugins = Array.from(configs.values()).filter((it) => !it.enabled || it.pluginId.startsWith("server-"));
  const toExclude = /* @__PURE__ */ new Set([
    "workbench:class:Application",
    "presentation:class:ComponentPointExtension",
    "presentation:class:ObjectSearchCategory",
    "notification:class:NotificationGroup",
    "notification:class:NotificationType",
    "view:class:Action",
    "view:class:Viewlet",
    "text-editor:class:TextEditorAction",
    "templates:class:TemplateField",
    "activity:class:DocUpdateMessageViewlet",
    "core:class:DomainIndexConfiguration",
    "view:class:ViewletDescriptor",
    "presentation:class:ComponentPointExtension",
    "activity:class:ActivityMessagesFilter",
    "view:class:ActionCategory",
    "activity:class:ActivityExtension",
    "chunter:class:ChatMessageViewlet",
    "activity:class:ActivityMessageControl",
    "notification:class:ActivityNotificationViewlet",
    "setting:class:SettingsCategory",
    "setting:class:WorkspaceSettingCategory",
    "notification:class:NotificationProvider"
  ]);
  const result = (0, import_core.pluginFilterTx)(excludedPlugins, configs, txes).filter((tx) => {
    if (tx?._class === import_core.default.class.TxCreateDoc || tx?._class === import_core.default.class.TxUpdateDoc || tx?._class === import_core.default.class.TxRemoveDoc) {
      const cud = tx;
      if (toExclude.has(cud.objectClass)) {
        return false;
      }
    }
    return true;
  });
  return result;
}
__name(returnClientTxes, "returnClientTxes");
function createModelPersistence(workspace) {
  const overrideStore = (0, import_platform.getMetadata)(import_client.default.metadata.OverridePersistenceStore);
  if (overrideStore !== void 0) {
    return overrideStore;
  }
  return {
    load: /* @__PURE__ */ __name(async () => {
      const db = await dbPromise;
      if (db !== void 0) {
        try {
          const transaction = db.transaction("model", "readwrite");
          const models = transaction.objectStore("model");
          const model = await new Promise((resolve) => {
            const storedValue = models.get(workspace);
            storedValue.onsuccess = function() {
              resolve(storedValue.result);
            };
            storedValue.onerror = function() {
              resolve(void 0);
            };
          });
          if (model == null) {
            return {
              full: false,
              transactions: [],
              hash: ""
            };
          }
          return model.model;
        } catch (err) {
        }
      }
      return {
        full: true,
        transactions: [],
        hash: ""
      };
    }, "load"),
    store: /* @__PURE__ */ __name(async (model) => {
      const db = await dbPromise;
      if (db !== void 0) {
        const transaction = db.transaction("model", "readwrite");
        const models = transaction.objectStore("model");
        models.put({ id: workspace, model });
      }
    }, "store")
  };
}
__name(createModelPersistence, "createModelPersistence");
function getWSFromToken(token) {
  const parts = token.split(".");
  const payload = parts[1];
  const decodedPayload = atob(payload);
  const parsedPayload = JSON.parse(decodedPayload);
  return parsedPayload.workspace;
}
__name(getWSFromToken, "getWSFromToken");
//# sourceMappingURL=index.js.map
