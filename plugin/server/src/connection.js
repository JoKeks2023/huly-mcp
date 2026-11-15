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
var connection_exports = {};
__export(connection_exports, {
  WorkspaceConnectionManager: () => WorkspaceConnectionManager,
  closeConnection: () => closeConnection,
  createConnectionManager: () => createConnectionManager,
  getAccountClient: () => getAccountClient,
  getConnection: () => getConnection,
  getConnectionManager: () => getConnectionManager,
  getWorkspace: () => getWorkspace,
  getWorkspaceInfo: () => getWorkspaceInfo,
  listWorkspaces: () => listWorkspaces,
  prewarm: () => prewarm,
  setConnectionManager: () => setConnectionManager,
  tokenClaims: () => tokenClaims,
  transactorEndpoint: () => transactorEndpoint,
  withConnectionManager: () => withConnectionManager
});
module.exports = __toCommonJS(connection_exports);
var import_node_async_hooks = require("node:async_hooks");
var import_undo = require("./utils/undo.js");
var import_cache = require("./utils/cache.js");
var import_account_client = require("../vendor/@hcengineering/account-client/lib/index.js");
var import_core = require("../vendor/@hcengineering/core/lib/index.js");
var import_server_client = require("../vendor/@hcengineering/server-client/lib/index.js");
function tokenClaims(token) {
  const part = token?.split(".")[1];
  if (part == null) return void 0;
  try {
    const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return { workspace: claims.workspace, exp: typeof claims.exp === "number" ? claims.exp : void 0, apiTokenId: claims.extra?.apiTokenId };
  } catch {
    return void 0;
  }
}
const TOKEN_HELP = "API token: create a new one in Huly \u2192 Settings \u2192 API tokens. Account token: npx huly-mcp-selfhost setup.";
async function defaultOpenConnection(endpoint, token, socialId) {
  const raw = await (0, import_server_client.createClient)(endpoint, token);
  return { client: new import_core.TxOperations((0, import_cache.cachingClient)(raw), socialId), close: async () => await raw.close() };
}
function toRef(ws) {
  return {
    uuid: String(ws.uuid),
    url: ws.url,
    name: ws.name ?? ws.url,
    mode: ws.mode != null ? String(ws.mode) : void 0,
    isDisabled: ws.isDisabled
  };
}
function describe(ws) {
  return ws.name !== ws.url ? `${ws.url} (${ws.name})` : ws.url;
}
class WorkspaceConnectionManager {
  constructor(opts) {
    this.opts = opts;
    this.createAccountClient = opts.createAccountClient ?? ((url, token) => (0, import_account_client.getClient)(url, token));
    this.openConnection = opts.openConnection ?? defaultOpenConnection;
  }
  opts;
  createAccountClient;
  openConnection;
  session = null;
  workspaces = null;
  // Bumped by closeAll() so calls that were in flight don't hand out or register connections afterwards.
  generation = 0;
  // Keyed by workspace UUID — never by user input, so "acme" and its UUID share one connection.
  connections = /* @__PURE__ */ new Map();
  /** How this manager logs in (never the secrets themselves, except the token for reading its claims). */
  describeAuth() {
    const set = (v) => (v ?? "").trim() !== "";
    const kind = set(this.opts.token) ? "token" : set(this.opts.email) && set(this.opts.password) ? "e-mail + password" : void 0;
    return { kind, token: set(this.opts.token) ? this.opts.token : void 0, accountsUrl: this.opts.accountsUrl, pinned: this.opts.restrictTo || void 0 };
  }
  /** All workspaces this account can use (after the optional legacy HULY_WORKSPACE restriction). */
  async listWorkspaces() {
    if (this.workspaces === null) {
      const pending = this.discover();
      this.workspaces = pending;
      pending.catch(() => {
        if (this.workspaces === pending) this.workspaces = null;
      });
    }
    return await this.workspaces;
  }
  /**
   * Resolve user input (slug, name or UUID; case-insensitive) to a workspace.
   * Without input, succeeds only if exactly one workspace is available.
   */
  async resolveWorkspace(input) {
    let available = await this.listWorkspaces();
    if (input != null && input.trim() === "") {
      throw new Error("Workspace must not be empty (see list_workspaces).");
    }
    if (input == null) {
      if (available.length === 1) return available[0];
      if (available.length === 0) throw new Error("No Huly workspaces are accessible with these credentials.");
      throw new Error(
        `Multiple workspaces available \u2014 pass 'workspace' explicitly (see list_workspaces). Available: ${available.map(describe).join(", ")}`
      );
    }
    let match = this.match(available, input);
    if (match === void 0) {
      this.workspaces = null;
      available = await this.listWorkspaces();
      match = this.match(available, input);
    }
    if (match === void 0) {
      throw new Error(`Unknown workspace '${input}'. Available: ${available.map(describe).join(", ") || "(none)"}`);
    }
    return match;
  }
  /** Cached connection for the given workspace (see resolveWorkspace for the input rules). */
  async getWorkspace(input) {
    const generation = this.generation;
    const ws = await this.resolveWorkspace(input);
    if (generation !== this.generation) throw new Error("Huly connections were closed.");
    let pending = this.connections.get(ws.uuid);
    if (pending === void 0) {
      pending = this.connect(ws);
      this.connections.set(ws.uuid, pending);
      const current = pending;
      current.catch(() => {
        if (this.connections.get(ws.uuid) === current) this.connections.delete(ws.uuid);
      });
    }
    const { close, ...conn } = await pending;
    if (generation !== this.generation) throw new Error("Huly connections were closed.");
    return conn;
  }
  async closeAll() {
    this.generation++;
    const pending = [...this.connections.values()];
    this.connections.clear();
    this.workspaces = null;
    this.session = null;
    const results = await Promise.allSettled(pending);
    await Promise.allSettled(results.map(async (r) => {
      if (r.status === "fulfilled") await r.value.close();
    }));
  }
  match(available, input) {
    const needle = input.trim().toLowerCase();
    const byId = available.find((w) => w.uuid.toLowerCase() === needle || w.url.toLowerCase() === needle);
    if (byId !== void 0) return byId;
    const byName = available.filter((w) => w.name.toLowerCase() === needle);
    if (byName.length > 1) {
      throw new Error(`Workspace name '${input}' is ambiguous \u2014 use the slug or ID instead: ${byName.map((w) => `${w.url} / ${w.uuid}`).join(", ")}`);
    }
    return byName[0];
  }
  async getSession() {
    if (this.session === null) {
      const pending = this.login();
      this.session = pending;
      pending.catch(() => {
        if (this.session === pending) this.session = null;
      });
    }
    return await this.session;
  }
  async login() {
    const { accountsUrl, email, password, token } = this.opts;
    if (token != null && token !== "") {
      const claims = tokenClaims(token);
      if (claims?.exp != null && claims.exp * 1e3 <= Date.now()) {
        throw new Error(`HULY_TOKEN expired on ${new Date(claims.exp * 1e3).toISOString().slice(0, 10)}. ${TOKEN_HELP}`);
      }
      const accountClient = this.createAccountClient(accountsUrl, token);
      const info = await accountClient.getLoginInfoByToken().catch((e) => {
        throw new Error(`HULY_TOKEN was refused (${e.message}) \u2014 invalid, expired or revoked. ${TOKEN_HELP}`);
      });
      if (info == null) {
        throw new Error(`HULY_TOKEN is invalid, expired or revoked. ${TOKEN_HELP}`);
      }
      if (!("socialId" in info) || info.socialId == null) {
        throw new Error("Token auth: no socialId returned for HULY_TOKEN.");
      }
      const session = { accountClient, socialId: info.socialId, apiToken: claims?.apiTokenId != null };
      if ("endpoint" in info && info.endpoint != null && info.token != null) {
        session.preselected = {
          workspace: { uuid: String(info.workspace), url: info.workspaceUrl, name: info.workspaceUrl },
          endpoint: info.endpoint,
          token: info.token
        };
      }
      return session;
    }
    if (email == null || email === "" || password == null || password === "") {
      throw new Error("Missing credentials. Provide HULY_TOKEN (for SSO accounts) or both HULY_EMAIL and HULY_PASSWORD.");
    }
    const loginInfo = await this.createAccountClient(accountsUrl).login(email, password);
    if (loginInfo.token == null) throw new Error("Login failed: no token returned. Check credentials.");
    if (loginInfo.socialId == null) throw new Error("Login failed: no socialId returned.");
    return { accountClient: this.createAccountClient(accountsUrl, loginInfo.token), socialId: loginInfo.socialId };
  }
  async discover() {
    const session = await this.getSession();
    let all;
    try {
      if (session.apiToken === true && session.preselected !== void 0) all = [session.preselected.workspace];
      else all = (await session.accountClient.getUserWorkspaces()).map(toRef);
    } catch (err) {
      if (session.preselected === void 0) throw err;
      all = [session.preselected.workspace];
    }
    const restrictTo = this.opts.restrictTo;
    if (restrictTo == null || restrictTo === "") return all;
    const pinned = this.match(all, restrictTo);
    if (pinned === void 0) {
      throw new Error(`HULY_WORKSPACE='${restrictTo}' is not accessible. Available: ${all.map(describe).join(", ") || "(none)"}`);
    }
    return [pinned];
  }
  async connect(ws) {
    const session = await this.getSession();
    let endpoint;
    let wsToken;
    let workspaceUuid;
    if (session.preselected !== void 0 && session.preselected.workspace.uuid === ws.uuid) {
      ({ endpoint, token: wsToken } = session.preselected);
      workspaceUuid = ws.uuid;
    } else {
      const wsInfo = await session.accountClient.selectWorkspace(ws.url, "external");
      if (wsInfo?.endpoint == null || wsInfo.token == null) {
        throw new Error(`Workspace '${ws.url}' not found or not accessible.`);
      }
      if (wsInfo.workspace != null && String(wsInfo.workspace) !== ws.uuid) {
        throw new Error(`selectWorkspace('${ws.url}') returned workspace ${String(wsInfo.workspace)}, expected ${ws.uuid}.`);
      }
      endpoint = wsInfo.endpoint;
      wsToken = wsInfo.token;
      workspaceUuid = String(wsInfo.workspace ?? ws.uuid);
    }
    endpoint = transactorEndpoint(endpoint, this.opts.transactorUrl);
    const { client, close } = await this.openConnection(endpoint, wsToken, session.socialId);
    return {
      workspace: ws,
      client,
      accountClient: this.createAccountClient(this.opts.accountsUrl, wsToken),
      wsToken,
      workspaceUuid,
      close
    };
  }
}
function transactorEndpoint(endpoint, override) {
  const o = override?.trim();
  return o != null && o !== "" ? o.replace(/\/+$/, "") : endpoint;
}
let manager = null;
const scoped = new import_node_async_hooks.AsyncLocalStorage();
function withConnectionManager(m, fn) {
  return scoped.run(m, fn);
}
function createConnectionManager(creds, env = process.env) {
  return new WorkspaceConnectionManager({
    accountsUrl: env.HULY_ACCOUNTS_URL ?? "https://account.huly.app",
    email: creds.email,
    password: creds.password,
    token: creds.token,
    restrictTo: creds.workspace,
    transactorUrl: env.HULY_TRANSACTOR_URL
  });
}
function getConnectionManager() {
  const own = scoped.getStore();
  if (own != null) return own;
  if (manager === null) {
    manager = new WorkspaceConnectionManager({
      accountsUrl: process.env.HULY_ACCOUNTS_URL ?? "https://account.huly.app",
      email: process.env.HULY_EMAIL,
      password: process.env.HULY_PASSWORD,
      token: process.env.HULY_TOKEN,
      restrictTo: process.env.HULY_WORKSPACE,
      transactorUrl: process.env.HULY_TRANSACTOR_URL
    });
  }
  return manager;
}
function setConnectionManager(next) {
  manager = next;
}
async function listWorkspaces() {
  return await getConnectionManager().listWorkspaces();
}
async function getWorkspace(workspace) {
  return await getConnectionManager().getWorkspace(workspace);
}
async function getConnection(workspace) {
  return (0, import_undo.recordingClient)((await getWorkspace(workspace)).client);
}
async function getAccountClient(workspace) {
  return (await getWorkspace(workspace)).accountClient;
}
async function getWorkspaceInfo(workspace) {
  const { wsToken, workspaceUuid } = await getWorkspace(workspace);
  return { wsToken, workspaceUuid };
}
async function prewarm(env = process.env) {
  if (["0", "false", "no", "off"].includes(String(env.HULY_PREWARM ?? "").trim().toLowerCase())) return "off";
  const set = (v) => (v ?? "").trim() !== "";
  if (!set(env.HULY_TOKEN) && !(set(env.HULY_EMAIL) && set(env.HULY_PASSWORD))) return "no-credentials";
  try {
    const workspaces = await listWorkspaces();
    if (workspaces.length !== 1) return "account";
    await getWorkspace();
    return "workspace";
  } catch {
    return "failed";
  }
}
async function closeConnection() {
  if (manager !== null) await manager.closeAll();
}
