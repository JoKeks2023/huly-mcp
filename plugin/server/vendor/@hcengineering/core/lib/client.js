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
  ClientConnectEvent: () => ClientConnectEvent,
  buildModel: () => buildModel,
  createClient: () => createClient
});
module.exports = __toCommonJS(client_exports);
var import_analytics = require("../../analytics/lib/index.js");
var import_classes = require("./classes.js");
var import_component = __toESM(require("./component.js"));
var import_hierarchy = require("./hierarchy.js");
var import_measurements = require("../../measurements/lib/index.js");
var import_memdb = require("./memdb.js");
var import_tx = require("./tx.js");
var import_utils = require("./utils.js");
var ClientConnectEvent = /* @__PURE__ */ ((ClientConnectEvent2) => {
  ClientConnectEvent2[ClientConnectEvent2["Connected"] = 0] = "Connected";
  ClientConnectEvent2[ClientConnectEvent2["Reconnected"] = 1] = "Reconnected";
  ClientConnectEvent2[ClientConnectEvent2["Upgraded"] = 2] = "Upgraded";
  ClientConnectEvent2[ClientConnectEvent2["Refresh"] = 3] = "Refresh";
  ClientConnectEvent2[ClientConnectEvent2["Maintenance"] = 4] = "Maintenance";
  return ClientConnectEvent2;
})(ClientConnectEvent || {});
class ClientImpl {
  constructor(conn) {
    this.conn = conn;
  }
  static {
    __name(this, "ClientImpl");
  }
  notify;
  hierarchy;
  model;
  appliedModelTransactions = /* @__PURE__ */ new Set();
  getConnection() {
    return this.conn;
  }
  setModel(hierarchy, model) {
    this.hierarchy = hierarchy;
    this.model = model;
  }
  getHierarchy() {
    return this.hierarchy;
  }
  getModel() {
    return this.model;
  }
  async findAll(_class, query, options) {
    const domain = this.hierarchy.getDomain(_class);
    const data = domain === import_classes.DOMAIN_MODEL ? await this.model.findAll(_class, query, options) : await this.conn.findAll(_class, query, options);
    const result = data.map((v) => {
      return this.hierarchy.updateLookupMixin(_class, v, options);
    });
    return (0, import_utils.toFindResult)(result, data.total);
  }
  async searchFulltext(query, options) {
    return await this.conn.searchFulltext(query, options);
  }
  async domainRequest(ctx, params, options) {
    return await this.conn.domainRequest(ctx, params, options);
  }
  async findOne(_class, query, options) {
    return (await this.findAll(_class, query, { ...options, limit: 1 }))[0];
  }
  async tx(tx) {
    if (tx.objectSpace === import_component.default.space.Model) {
      this.hierarchy.tx(tx);
      await this.model.tx(tx);
      this.appliedModelTransactions.add(tx._id);
    }
    return await this.conn.tx(tx);
  }
  async updateFromRemote(...tx) {
    for (const t of tx) {
      try {
        if (t.objectSpace === import_component.default.space.Model) {
          const hasTx = this.appliedModelTransactions.has(t._id);
          if (!hasTx) {
            this.hierarchy.tx(t);
            await this.model.tx(t);
          } else {
            this.appliedModelTransactions.delete(t._id);
          }
        }
      } catch (err) {
        continue;
      }
    }
    this.notify?.(...tx);
  }
  async close() {
    await this.conn.close();
  }
  async loadChunk(domain, idx) {
    return await this.conn.loadChunk(domain, idx);
  }
  async getDomainHash(domain) {
    return await this.conn.getDomainHash(domain);
  }
  async closeChunk(idx) {
    await this.conn.closeChunk(idx);
  }
  async loadDocs(domain, docs) {
    return await this.conn.loadDocs(domain, docs);
  }
  async upload(domain, docs) {
    await this.conn.upload(domain, docs);
  }
  async clean(domain, docs) {
    await this.conn.clean(domain, docs);
  }
  async sendForceClose() {
    await this.conn.sendForceClose();
  }
}
async function createClient(connect, modelFilter, txPersistence, _ctx) {
  const ctx = _ctx ?? new import_measurements.MeasureMetricsContext("createClient", {});
  let client = null;
  let txBuffer = [];
  let hierarchy = new import_hierarchy.Hierarchy();
  let model = new import_memdb.ModelDb(hierarchy);
  let lastTx;
  function txHandler(...tx) {
    if (tx == null || tx.length === 0) {
      return;
    }
    if (client === null) {
      txBuffer?.push(...tx);
    } else {
      client.updateFromRemote(...tx);
    }
    for (const t of tx) {
      if (t._class === import_component.default.class.TxWorkspaceEvent && t.event === import_tx.WorkspaceEvent.LastTx) {
        lastTx = t.params.lastTx;
      }
    }
  }
  __name(txHandler, "txHandler");
  const conn = await ctx.with("connect", {}, () => connect(txHandler), {}, { suspendErrors: true });
  let { mode, current, addition } = await ctx.with("load-model", {}, (ctx2) => loadModel(ctx2, conn, txPersistence));
  switch (mode) {
    case "same":
    case "upgrade":
      ctx.withSync("build-model", {}, (ctx2) => {
        buildModel(ctx2, current, modelFilter, hierarchy, model);
      });
      break;
    case "addition":
      ctx.withSync("build-model", {}, (ctx2) => {
        buildModel(ctx2, current.concat(addition), modelFilter, hierarchy, model);
      });
  }
  current = [];
  addition = [];
  txBuffer = txBuffer.filter((tx) => tx.space !== import_component.default.space.Model);
  client = new ClientImpl(conn);
  client.setModel(hierarchy, model);
  txHandler(...txBuffer);
  txBuffer = void 0;
  const oldOnConnect = conn.onConnect;
  conn.onConnect = async (event, _lastTx, data) => {
    console.log("Client: onConnect", event);
    if (event === 4 /* Maintenance */) {
      lastTx = _lastTx;
      await oldOnConnect?.(4 /* Maintenance */, _lastTx, data);
      return;
    }
    let { mode: mode2, current: current2, addition: addition2 } = await ctx.with("load-model", {}, (ctx2) => loadModel(ctx2, conn, txPersistence));
    switch (mode2) {
      case "upgrade":
        hierarchy = new import_hierarchy.Hierarchy();
        model = new import_memdb.ModelDb(hierarchy);
        client.setModel(hierarchy, model);
        ctx.withSync("build-model", {}, (ctx2) => {
          buildModel(ctx2, current2, modelFilter, hierarchy, model);
        });
        current2 = [];
        await oldOnConnect?.(2 /* Upgraded */, _lastTx, data);
        break;
      case "addition":
        ctx.withSync("build-model", {}, (ctx2) => {
          buildModel(ctx2, current2.concat(addition2), modelFilter, hierarchy, model);
        });
        break;
    }
    current2 = [];
    addition2 = [];
    if (lastTx === void 0) {
      await oldOnConnect?.(event, _lastTx, data);
      lastTx = _lastTx;
      return;
    }
    if (lastTx === _lastTx) {
      await oldOnConnect?.(1 /* Reconnected */, _lastTx, data);
      return;
    }
    lastTx = _lastTx;
    await oldOnConnect?.(3 /* Refresh */, lastTx, data);
  };
  return client;
}
__name(createClient, "createClient");
async function loadModel(ctx, conn, persistence) {
  const t = (0, import_utils.platformNow)();
  const current = await ctx.with("persistence-load", {}, () => persistence?.load()) ?? {
    full: true,
    transactions: [],
    hash: ""
  };
  if (conn.getLastHash !== void 0 && await conn.getLastHash(ctx) === current.hash) {
    return { mode: "same", current: current.transactions, addition: [] };
  }
  const lastTxTime = getLastTxTime(current.transactions);
  const result = await ctx.with(
    "connection-load-model",
    { hash: current.hash !== "" },
    (ctx2) => conn.loadModel(lastTxTime, current.hash)
  );
  if (Array.isArray(result)) {
    return {
      mode: "same",
      current: result,
      addition: []
    };
  }
  void ctx.with(
    "persistence-store",
    {},
    (ctx2) => persistence?.store({
      ...result,
      // Store concatinated old + new txes
      transactions: result.full ? result.transactions : current.transactions.concat(result.transactions)
    })
  ).catch((err) => {
    import_analytics.Analytics.handleError(err);
  });
  if (typeof window !== "undefined") {
    console.log("find" + (result.full ? "full model" : "model diff"), result.transactions.length, (0, import_utils.platformNowDiff)(t));
  }
  if (result.full) {
    return { mode: "upgrade", current: result.transactions, addition: [] };
  }
  return { mode: "addition", current: current.transactions, addition: result.transactions };
}
__name(loadModel, "loadModel");
function buildModel(ctx, transactions, modelFilter, hierarchy, model) {
  let txes = transactions;
  if (modelFilter !== void 0) {
    txes = modelFilter(txes);
  }
  ctx.withSync("build hierarchy", {}, () => {
    for (const tx of txes) {
      try {
        hierarchy.tx(tx);
      } catch (err) {
        ctx.warn("failed to apply model transaction, skipping", {
          _id: tx._id,
          _class: tx._class,
          message: err?.message
        });
      }
    }
  });
  ctx.withSync("build model", {}, (ctx2) => {
    model.addTxes(ctx2, txes, false);
  });
}
__name(buildModel, "buildModel");
function getLastTxTime(txes) {
  let lastTxTime = 0;
  for (const tx of txes) {
    if (tx.modifiedOn > lastTxTime) {
      lastTxTime = tx.modifiedOn;
    }
  }
  return lastTxTime;
}
__name(getLastTxTime, "getLastTxTime");
//# sourceMappingURL=client.js.map
