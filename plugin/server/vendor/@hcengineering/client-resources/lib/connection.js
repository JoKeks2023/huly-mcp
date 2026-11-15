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
var connection_exports = {};
__export(connection_exports, {
  connect: () => connect
});
module.exports = __toCommonJS(connection_exports);
var import_analytics = require("../../analytics/lib/index.js");
var import_client = __toESM(require("../../client/lib/index.js"));
var import_core = __toESM(require("../../core/lib/index.js"));
var import_platform = __toESM(require("../../platform/lib/index.js"));
var import_rpc = require("../../rpc/lib/index.js");
var import_snappyjs = require("../../../snappyjs/index.js");
const SECOND = 1e3;
const pingTimeout = 10 * SECOND;
const hangTimeout = 5 * 60 * SECOND;
const dialTimeout = 30 * SECOND;
class RequestPromise {
  constructor(method, params, handleResult) {
    this.method = method;
    this.params = params;
    this.handleResult = handleResult;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
  static {
    __name(this, "RequestPromise");
  }
  startTime = Date.now();
  handleTime;
  promise;
  resolve;
  reject;
  reconnect;
  // Required to properly handle rate limits
  sendData = /* @__PURE__ */ __name(() => {
  }, "sendData");
  chunks;
}
const globalRPCHandler = new import_rpc.RPCHandler();
class Connection {
  constructor(ctx, url, handler, workspace, user, opt) {
    this.ctx = ctx;
    this.url = url;
    this.workspace = workspace;
    this.user = user;
    this.opt = opt;
    if (typeof sessionStorage !== "undefined") {
      const sKey = "session.id." + this.url;
      let sessionId = sessionStorage.getItem(sKey) ?? void 0;
      if (sessionId === void 0) {
        sessionId = (0, import_core.generateId)();
        console.log("Generate new SessionId", sessionId);
        this.sessionId = sessionId;
      } else {
        this.sessionId = sessionId;
        sessionStorage.removeItem(sKey);
      }
      window.addEventListener("beforeunload", () => {
        sessionStorage.setItem(sKey, sessionId);
      });
    } else {
      this.sessionId = (0, import_core.generateId)();
    }
    this.rpcHandler = opt?.useGlobalRPCHandler === true ? globalRPCHandler : new import_rpc.RPCHandler();
    this.pushHandler(handler);
    this.onConnect = opt?.onConnect;
    this.scheduleOpen(this.ctx, false);
  }
  static {
    __name(this, "Connection");
  }
  websocket = null;
  binaryMode = false;
  compressionMode = false;
  requests = /* @__PURE__ */ new Map();
  lastId = 0;
  interval;
  dialTimer;
  sockets = 0;
  openAction;
  sessionId;
  closed = false;
  upgrading = false;
  pingResponse = Date.now();
  helloReceived = false;
  account;
  onConnect;
  rpcHandler;
  lastHash;
  handlers = [];
  pushHandler(handler) {
    this.handlers.push(handler);
  }
  async getLastHash(ctx) {
    await this.waitOpenConnection(ctx);
    return this.lastHash;
  }
  schedulePing(socketId) {
    this.pingResponse = Date.now();
    const wsocket = this.websocket;
    clearInterval(this.interval);
    this.interval = setInterval(() => {
      if (wsocket !== this.websocket) {
        clearInterval(this.interval);
        return;
      }
      if (!this.upgrading && this.pingResponse !== 0 && Date.now() - this.pingResponse > hangTimeout) {
        if (this.websocket !== null) {
          console.log("no ping response from server. Closing socket.", socketId, this.workspace, this.user);
          clearInterval(this.interval);
          this.websocket.close(1e3);
          return;
        }
      }
      if (!this.closed) {
        void this.sendRequest({
          method: import_client.pingConst,
          params: [],
          once: true,
          handleResult: /* @__PURE__ */ __name(async (result) => {
            if (this.websocket === wsocket) {
              this.pingResponse = Date.now();
            }
          }, "handleResult")
        }).catch((err) => {
          this.ctx.error("failed to send msg", { err });
        });
      } else {
        clearInterval(this.interval);
      }
    }, pingTimeout);
  }
  async close() {
    this.closed = true;
    clearTimeout(this.openAction);
    clearTimeout(this.dialTimer);
    clearInterval(this.interval);
    for (const handler of this.onConnectHandlers) {
      handler.reject(new Error("Connection closed"));
    }
    for (const req of this.requests.values()) {
      req.reject(new Error("Connection closed"));
    }
    if (this.websocket !== null) {
      this.websocket.close(1e3);
      this.websocket = null;
    }
  }
  isConnected() {
    return this.websocket != null && this.websocket.readyState === import_client.ClientSocketReadyState.OPEN && this.helloReceived;
  }
  delay = 0;
  onConnectHandlers = [];
  waitOpenConnection(ctx) {
    if (this.isConnected()) {
      return void 0;
    }
    return ctx.with(
      "wait-connection",
      {},
      (ctx2) => new Promise((resolve, reject) => {
        this.onConnectHandlers.push({
          resolve,
          reject
        });
        this.scheduleOpen(ctx2, false);
      })
    );
  }
  scheduleOpen(ctx, force) {
    if (force) {
      ctx.withSync("close-ws", {}, () => {
        if (this.websocket !== null) {
          this.websocket.close();
          this.websocket = null;
        }
      });
      clearTimeout(this.openAction);
      this.openAction = void 0;
    }
    clearInterval(this.interval);
    if (!this.closed && this.openAction === void 0) {
      if (this.websocket === null) {
        const socketId = ++this.sockets;
        if (this.delay === 0) {
          this.openConnection(ctx, socketId);
        } else {
          this.openAction = setTimeout(() => {
            this.openAction = void 0;
            this.openConnection(ctx, socketId);
          }, this.delay * 1e3);
        }
      }
    }
  }
  currentRateLimit;
  slowDownTimer = 0;
  handleMsg(socketId, resp) {
    if (this.closed) {
      return;
    }
    if (resp.rateLimit !== void 0 && resp.rateLimit.remaining < 50) {
      this.currentRateLimit = resp.rateLimit;
      if (this.currentRateLimit.remaining < this.currentRateLimit.limit / 3) {
        if (this.slowDownTimer < 50) {
          this.slowDownTimer += 50;
        }
        this.slowDownTimer++;
      } else if (this.slowDownTimer > 0) {
        this.slowDownTimer--;
      }
    }
    if (resp.error !== void 0) {
      if (resp.terminate === true) {
        if (resp.error.code !== import_platform.default.status.WorkspaceArchived && resp.error.code !== import_platform.default.status.WorkspaceNotFound) {
          import_analytics.Analytics.handleError(new import_platform.PlatformError(resp.error));
        }
        this.closed = true;
        this.websocket?.close();
        this.opt?.onError?.(resp.error.code);
      }
      if (resp.id !== void 0) {
        const promise = this.requests.get(resp.id);
        if (resp.rateLimit !== void 0) {
          const { remaining, retryAfter } = resp.rateLimit;
          if (remaining === 0) {
            void new Promise((resolve) => setTimeout(resolve, retryAfter ?? 1)).then(() => {
              promise?.sendData();
            });
            return;
          }
        }
        if (promise !== void 0) {
          promise.reject(new import_platform.PlatformError(resp.error));
        }
      }
      return;
    }
    if (resp.id === -1) {
      this.delay = 0;
      if (resp.result?.state === "upgrading") {
        void this.onConnect?.(import_core.ClientConnectEvent.Maintenance, void 0, resp.result.stats);
        this.upgrading = true;
        this.delay = 3;
        return;
      }
      if (resp.result === "hello") {
        const helloResp = resp;
        this.binaryMode = helloResp.binary;
        this.compressionMode = helloResp.useCompression ?? false;
        clearTimeout(this.dialTimer);
        this.dialTimer = void 0;
        this.lastHash = resp.lastHash;
        const serverVersion = helloResp.serverVersion;
        if (typeof window !== "undefined") {
          console.log("Connected to server:", serverVersion);
        }
        if (this.opt?.onHello !== void 0 && !this.opt.onHello(serverVersion)) {
          this.closed = true;
          this.websocket?.close();
          return;
        }
        this.account = helloResp.account;
        this.helloReceived = true;
        if (this.upgrading) {
          this.opt?.onUpgrade?.();
        }
        this.upgrading = false;
        const handlers = this.onConnectHandlers.splice(0, this.onConnectHandlers.length);
        for (const h of handlers) {
          h.resolve();
        }
        for (const [, v] of this.requests.entries()) {
          v.reconnect?.();
        }
        void this.onConnect?.(
          helloResp.reconnect === true ? import_core.ClientConnectEvent.Reconnected : import_core.ClientConnectEvent.Connected,
          helloResp.lastTx,
          this.sessionId
        )?.catch((err) => {
          this.ctx.error("failed to call onConnect", { err });
        });
        this.schedulePing(socketId);
        return;
      } else {
        import_analytics.Analytics.handleError(new Error(`unexpected response: ${JSON.stringify(resp)}`));
      }
      return;
    }
    if (resp.result === import_client.pingConst) {
      void this.sendRequest({ method: import_client.pingConst, params: [] }).catch((err) => {
        this.ctx.error("failed to send ping", { err });
      });
      return;
    }
    if (resp.id !== void 0) {
      const promise = this.requests.get(resp.id);
      if (promise === void 0) {
        console.error(
          new Error(`unknown response id: ${resp.id} ${this.workspace} ${this.user}`),
          JSON.stringify(this.requests)
        );
        return;
      }
      if (resp.chunk !== void 0) {
        promise.chunks = [
          ...promise.chunks ?? [],
          {
            index: resp.chunk.index,
            data: resp.result
          }
        ];
        if (resp.chunk.final) {
          promise.chunks.sort((a, b) => a.index - b.index);
          let result = [];
          let total = -1;
          let lookupMap;
          for (const c of promise.chunks) {
            if (c.data.total !== 0) {
              total = c.data.total;
            }
            if (c.data.lookupMap !== void 0) {
              lookupMap = c.data.lookupMap;
            }
            result = result.concat(c.data);
          }
          resp.result = (0, import_core.toFindResult)(result, total, lookupMap);
          resp.chunk = void 0;
        } else {
          return;
        }
      }
      const request = this.requests.get(resp.id);
      promise.handleTime?.(
        Date.now() - promise.startTime,
        resp.result,
        resp.time ?? 0,
        resp.queue ?? 0,
        Date.now() - (resp.bfst ?? 0)
      );
      this.requests.delete(resp.id);
      if (resp.error !== void 0) {
        console.log(
          "ERROR",
          "request:",
          request?.method,
          "response-id:",
          resp.id,
          "error: ",
          resp.error,
          "result: ",
          resp.result,
          this.workspace,
          this.user
        );
        promise.reject(new import_platform.PlatformError(resp.error));
      } else {
        if (request?.handleResult !== void 0) {
          void request.handleResult(resp.result).then(() => {
            promise.resolve(resp.result);
          }).catch((err) => {
            this.ctx.error("failed to handleResult", { err });
          });
        } else {
          promise.resolve(resp.result);
        }
      }
    } else {
      const txArr = Array.isArray(resp.result) ? resp.result : [resp.result];
      for (const tx of txArr) {
        if (tx?._class === import_core.default.class.TxModelUpgrade) {
          console.log("Processing upgrade", this.workspace, this.user);
          this.opt?.onUpgrade?.();
          return;
        }
      }
      this.handlers.forEach((handler) => {
        handler(...txArr);
      });
    }
  }
  checkArrayBufferPing(data) {
    if (data.byteLength === import_client.pingConst.length || data.byteLength === import_client.pongConst.length) {
      const text = new TextDecoder().decode(data);
      if (text === import_client.pingConst) {
        void this.sendRequest({ method: import_client.pingConst, params: [] }).catch((err) => {
          this.ctx.error("failed to send ping", { err });
        });
        return true;
      }
      if (text === import_client.pongConst) {
        this.pingResponse = Date.now();
        return true;
      }
    }
    return false;
  }
  openConnection(ctx, socketId) {
    this.binaryMode = false;
    this.helloReceived = false;
    const clientSocketFactory = this.opt?.socketFactory ?? (0, import_platform.getMetadata)(import_client.default.metadata.ClientSocketFactory) ?? ((url) => {
      const s = new WebSocket(url);
      return s;
    });
    if (socketId !== this.sockets) {
      return;
    }
    const wsocket = ctx.withSync(
      "create-socket",
      {},
      () => clientSocketFactory(this.url + `?sessionId=${this.sessionId}`)
    );
    if (socketId !== this.sockets) {
      wsocket.close();
      return;
    }
    this.websocket = wsocket;
    if (this.dialTimer === void 0) {
      this.dialTimer = setTimeout(() => {
        this.dialTimer = void 0;
        if (!this.closed) {
          void this.opt?.onDialTimeout?.()?.catch((err) => {
            this.ctx.error("failed to handle dial timeout", { err });
          });
          this.scheduleOpen(this.ctx, true);
        }
      }, dialTimeout);
    }
    wsocket.onmessage = (event) => {
      if (this.closed) {
        return;
      }
      if (this.websocket !== wsocket) {
        return;
      }
      if (event.data === import_client.pongConst) {
        this.pingResponse = Date.now();
        return;
      }
      if (event.data === import_client.pingConst) {
        void this.sendRequest({ method: import_client.pingConst, params: [] }).catch((err) => {
          this.ctx.error("failed to send ping", { err });
        });
        return;
      }
      if (event.data instanceof ArrayBuffer && this.checkArrayBufferPing(event.data)) {
        return;
      }
      if (event.data instanceof Blob) {
        void event.data.arrayBuffer().then((data) => {
          if (this.checkArrayBufferPing(data)) {
            return;
          }
          if (this.compressionMode && this.helloReceived) {
            try {
              data = (0, import_snappyjs.uncompress)(data);
            } catch (err) {
              console.error(err);
            }
          }
          try {
            const resp = this.rpcHandler.readResponse(data, this.binaryMode);
            this.handleMsg(socketId, resp);
          } catch (err) {
            if (!this.helloReceived) {
              console.error(err);
            } else {
              throw err;
            }
          }
        }).catch((err) => {
          this.ctx.error("failed to decode array buffer", { err });
        });
      } else {
        let data = event.data;
        if (this.compressionMode && this.helloReceived) {
          try {
            data = (0, import_snappyjs.uncompress)(data);
          } catch (err) {
            console.error(err);
          }
        }
        try {
          const resp = this.rpcHandler.readResponse(data, this.binaryMode);
          this.handleMsg(socketId, resp);
        } catch (err) {
          if (!this.helloReceived) {
            console.error(err);
          } else {
            throw err;
          }
        }
      }
    };
    wsocket.onclose = (ev) => {
      if (this.websocket !== wsocket) {
        wsocket.close();
        return;
      }
      this.scheduleOpen(this.ctx, true);
    };
    wsocket.onopen = () => {
      if (this.websocket !== wsocket) {
        return;
      }
      const useBinary = this.opt?.useBinaryProtocol ?? (0, import_platform.getMetadata)(import_client.default.metadata.UseBinaryProtocol) ?? true;
      this.compressionMode = this.opt?.useProtocolCompression ?? (0, import_platform.getMetadata)(import_client.default.metadata.UseProtocolCompression) ?? false;
      const helloRequest = {
        method: "hello",
        params: [],
        id: -1,
        binary: useBinary,
        compression: this.compressionMode
      };
      ctx.withSync("send-hello", {}, () => this.websocket?.send(this.rpcHandler.serialize(helloRequest, false)));
    };
    wsocket.onerror = () => {
      if (this.websocket !== wsocket) {
        return;
      }
      if (this.delay < 3) {
        this.delay += 1;
      }
      console.error("client websocket error:", socketId, this.url, this.workspace, this.user);
    };
  }
  sendRequest(data) {
    return this.ctx.with(
      "send-request",
      {},
      async (ctx) => {
        if (this.closed) {
          throw new import_platform.PlatformError(new import_platform.Status(import_platform.Severity.ERROR, import_platform.default.status.ConnectionClosed, {}));
        }
        if (this.slowDownTimer > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.slowDownTimer));
        }
        if (data.once === true) {
          const dparams = JSON.stringify(data.params);
          for (const [, v] of this.requests) {
            if (v.method === data.method && JSON.stringify(v.params) === dparams) {
              return;
            }
          }
        }
        const id = data.overrideId ?? this.lastId++;
        const promise = new RequestPromise(data.method, data.params, data.handleResult);
        promise.handleTime = data.measure;
        const w = this.waitOpenConnection(ctx);
        if (w instanceof Promise) {
          await w;
        }
        if (data.method !== import_client.pingConst) {
          this.requests.set(id, promise);
        }
        promise.sendData = () => {
          if (this.websocket?.readyState === import_client.ClientSocketReadyState.OPEN) {
            promise.startTime = Date.now();
            if (data.method !== import_client.pingConst) {
              const dta = this.rpcHandler.serialize(
                {
                  method: data.method,
                  params: data.params,
                  meta: ctx.extractMeta(),
                  id,
                  time: Date.now()
                },
                this.binaryMode
              );
              this.websocket?.send(dta);
            } else {
              this.websocket?.send(import_client.pingConst);
            }
          }
        };
        if (data.allowReconnect ?? true) {
          promise.reconnect = () => {
            setTimeout(async () => {
              if (this.requests.has(id) && (await data.retry?.() ?? true)) {
                promise.sendData();
              }
            }, 50);
          };
        }
        promise.sendData();
        if (data.method !== import_client.pingConst) {
          return await promise.promise;
        }
      },
      { method: data.method },
      {
        span: "skip"
      }
    );
  }
  loadModel(last, hash) {
    return this.sendRequest({ method: "loadModel", params: [last, hash] });
  }
  getAccount() {
    if (this.account !== void 0) {
      return Promise.resolve((0, import_core.clone)(this.account));
    }
    return this.sendRequest({ method: "getAccount", params: [] });
  }
  async findAll(_class, query, options) {
    const result = await this.sendRequest({
      method: "findAll",
      params: [_class, query, options],
      measure: /* @__PURE__ */ __name((time, result2, serverTime, queue, toReceive) => {
        if (typeof window !== "undefined" && (time > 1e3 || serverTime > 500)) {
          console.error(
            "measure slow findAll",
            time,
            serverTime,
            toReceive,
            queue,
            _class,
            query,
            options,
            result2,
            JSON.stringify(result2).length
          );
        }
      }, "measure")
    });
    if (result.lookupMap !== void 0) {
      for (const d of result) {
        if (d.$lookup !== void 0) {
          for (const [k, v] of Object.entries(d.$lookup)) {
            if (!Array.isArray(v)) {
              d.$lookup[k] = result.lookupMap[v];
            } else {
              d.$lookup[k] = v.map((it) => result.lookupMap?.[it]);
            }
          }
        }
      }
      delete result.lookupMap;
    }
    for (const doc of result) {
      for (const [k, v] of Object.entries(query)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          if (doc[k] == null) {
            doc[k] = v;
          }
        }
      }
      if (doc._class == null) {
        doc._class = _class;
      }
    }
    return result;
  }
  tx(tx) {
    return this.sendRequest({
      method: "tx",
      params: [tx],
      retry: /* @__PURE__ */ __name(async () => {
        if (tx._class === import_core.default.class.TxApplyIf) {
          return (await this.findAll(import_core.default.class.Tx, { _id: tx.txes[0]._id }, { limit: 1 })).length === 0;
        }
        return (await this.findAll(import_core.default.class.Tx, { _id: tx._id }, { limit: 1 })).length === 0;
      }, "retry")
    });
  }
  loadChunk(domain, idx) {
    return this.sendRequest({ method: "loadChunk", params: [domain, idx] });
  }
  async getDomainHash(domain) {
    return await this.sendRequest({ method: "getDomainHash", params: [domain] });
  }
  closeChunk(idx) {
    return this.sendRequest({ method: "closeChunk", params: [idx] });
  }
  loadDocs(domain, docs) {
    return this.sendRequest({ method: "loadDocs", params: [domain, docs] });
  }
  upload(domain, docs) {
    return this.sendRequest({ method: "upload", params: [domain, docs] });
  }
  clean(domain, docs) {
    return this.sendRequest({ method: "clean", params: [domain, docs] });
  }
  searchFulltext(query, options) {
    return this.sendRequest({ method: "searchFulltext", params: [query, options] });
  }
  domainRequest(domain, params, options) {
    return this.sendRequest({
      method: "domainRequest",
      params: [domain, params],
      retry: /* @__PURE__ */ __name(async () => {
        return options?.retry ?? false;
      }, "retry")
    });
  }
  sendForceClose() {
    return this.sendRequest({ method: "forceClose", params: [], allowReconnect: false, overrideId: -2, once: true });
  }
}
function connect(url, handler, workspace, user, opt) {
  return new Connection(
    opt?.ctx?.newChild?.("connection", {}) ?? new import_core.MeasureMetricsContext("connection", {}),
    url,
    handler,
    workspace,
    user,
    opt
  );
}
__name(connect, "connect");
//# sourceMappingURL=connection.js.map
