var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var http_exports = {};
__export(http_exports, {
  allowedHosts: () => allowedHosts,
  headerCredentials: () => headerCredentials,
  oauthFromEnv: () => oauthFromEnv,
  runHttp: () => runHttp,
  startHttpServer: () => startHttpServer
});
module.exports = __toCommonJS(http_exports);
var import_node_http = __toESM(require("node:http"));
var import_node_crypto = require("node:crypto");
var import_streamableHttp = require("../vendor/@modelcontextprotocol/sdk/dist/cjs/server/streamableHttp.js");
var import_types = require("../vendor/@modelcontextprotocol/sdk/dist/cjs/types.js");
var import_server = require("./server.js");
var import_connection = require("./connection.js");
var import_express_rate_limit = __toESM(require("../vendor/express-rate-limit/dist/index.cjs"));
var import_express = __toESM(require("../vendor/express/index.js"));
var import_router = require("../vendor/@modelcontextprotocol/sdk/dist/cjs/server/auth/router.js");
var import_bearerAuth = require("../vendor/@modelcontextprotocol/sdk/dist/cjs/server/auth/middleware/bearerAuth.js");
var import_oauth = require("./oauth.js");
var import_profiles = require("./profiles.js");
const MAX_BODY = 4 * 1024 * 1024;
const header = (req, name) => {
  const v = req.headers[name];
  const s = Array.isArray(v) ? v[0] : v;
  return s != null && s.trim() !== "" ? s.trim() : void 0;
};
function headerCredentials(req) {
  const token = header(req, "x-huly-token");
  const email = header(req, "x-huly-email");
  const password = header(req, "x-huly-password");
  const workspace = header(req, "x-huly-workspace");
  if (token != null) return { token, workspace };
  if (email != null || password != null) {
    if (email == null || password == null) throw new HttpError(400, "Send both X-Huly-Email and X-Huly-Password (or X-Huly-Token).");
    return { email, password, workspace };
  }
  return void 0;
}
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
  status;
}
function bearerOk(req, expected) {
  const got = /^Bearer\s+(.+)$/i.exec(header(req, "authorization") ?? "")?.[1] ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && (0, import_node_crypto.timingSafeEqual)(a, b);
}
async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, "Request body too large.");
    chunks.push(chunk);
  }
  if (size === 0) return void 0;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Body is not valid JSON.");
  }
}
function sendError(res, status, message) {
  if (res.headersSent) return;
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32e3, message }, id: null }));
}
function allowedHosts(value, port) {
  const hosts = (value ?? "").split(",").map((h) => h.trim()).filter((h) => h !== "");
  if (hosts.length === 0) return void 0;
  const all = [...hosts, "localhost", "127.0.0.1"];
  return [...new Set(all.flatMap((h) => h.includes(":") ? [h] : [h, `${h}:${port}`]))];
}
function startHttpServer(opts) {
  const env = opts.env;
  const log = opts.log ?? ((line) => {
    console.error(`huly-mcp http: ${line}`);
  });
  const authToken = (env.MCP_AUTH_TOKEN ?? "").trim();
  const serverCreds = (env.HULY_TOKEN ?? "") !== "" || (env.HULY_EMAIL ?? "") !== "" && (env.HULY_PASSWORD ?? "") !== "";
  const sharedAllowed = serverCreds && authToken !== "";
  const make = opts.createManager ?? ((c) => (0, import_connection.createConnectionManager)(c, env));
  const hosts = allowedHosts(env.MCP_ALLOWED_HOSTS, opts.port);
  const sessions = /* @__PURE__ */ new Map();
  if (serverCreds && authToken === "") log("the server has its own Huly credentials but MCP_AUTH_TOKEN is not set \u2014 they are not used; clients must send their own (X-Huly-Token or X-Huly-Email/X-Huly-Password).");
  const closeSession = async (id) => {
    const s = sessions.get(id);
    if (s == null) return;
    sessions.delete(id);
    await s.transport.close().catch(() => {
    });
    if (s.own) await s.manager.closeAll().catch(() => {
    });
  };
  const idleMs = opts.idleMs ?? 30 * 6e4;
  const sweeper = setInterval(() => {
    const cutoff = Date.now() - idleMs;
    for (const [id, s] of sessions) if (s.lastSeen < cutoff) void closeSession(id);
  }, Math.min(idleMs, 6e4));
  sweeper.unref();
  const handleMcp = async (req, res, oauth2, fixed) => {
    const sessionId = header(req, "mcp-session-id");
    const body = req.method === "POST" ? await readJson(req) : void 0;
    const existing = sessionId != null ? sessions.get(sessionId) : void 0;
    if (existing != null) {
      if (oauth2 != null && existing.account !== oauth2.hulyToken) {
        sendError(res, 403, "This session belongs to another login.");
        return;
      }
      if ((fixed?.key ?? void 0) !== (existing.account?.startsWith("profile:") === true ? existing.account : void 0)) {
        sendError(res, 403, "This session belongs to another path.");
        return;
      }
      existing.lastSeen = Date.now();
      await (0, import_connection.withConnectionManager)(existing.manager, async () => {
        await existing.transport.handleRequest(req, res, body);
      });
      return;
    }
    if (sessionId != null) {
      sendError(res, 404, "Unknown or expired session \u2014 start a new one.");
      return;
    }
    if (req.method !== "POST" || !(0, import_types.isInitializeRequest)(body)) {
      sendError(res, 400, "No session: send an initialize request first.");
      return;
    }
    if (fixed != null) {
      const transport2 = new import_streamableHttp.StreamableHTTPServerTransport({
        sessionIdGenerator: () => (0, import_node_crypto.randomUUID)(),
        allowedHosts: hosts,
        enableDnsRebindingProtection: hosts != null,
        onsessioninitialized: (id) => {
          sessions.set(id, { transport: transport2, manager: fixed.manager, own: false, lastSeen: Date.now(), account: fixed.key });
        }
      });
      transport2.onclose = () => {
        if (transport2.sessionId != null) void closeSession(transport2.sessionId);
      };
      const mcp2 = (0, import_connection.withConnectionManager)(fixed.manager, () => (0, import_server.createServer)({ workspace: fixed.workspace, toolsets: fixed.toolsets }));
      await mcp2.connect(transport2);
      await (0, import_connection.withConnectionManager)(fixed.manager, async () => {
        await transport2.handleRequest(req, res, body);
      });
      return;
    }
    const creds = oauth2 != null ? { token: oauth2.hulyToken, workspace: header(req, "x-huly-workspace") } : headerCredentials(req);
    if (creds == null && !sharedAllowed) {
      sendError(res, 401, serverCreds ? "Send your Huly login: X-Huly-Token, or X-Huly-Email and X-Huly-Password. (The server credentials need MCP_AUTH_TOKEN.)" : "Send your Huly login: X-Huly-Token, or X-Huly-Email and X-Huly-Password.");
      return;
    }
    const own = creds != null;
    const manager = own ? make(creds) : (0, import_connection.getConnectionManager)();
    const pinned = creds?.workspace ?? (own ? void 0 : env.HULY_WORKSPACE);
    const transport = new import_streamableHttp.StreamableHTTPServerTransport({
      sessionIdGenerator: () => (0, import_node_crypto.randomUUID)(),
      allowedHosts: hosts,
      enableDnsRebindingProtection: hosts != null,
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, manager, own, lastSeen: Date.now(), account: oauth2?.hulyToken });
        if (own) void (0, import_connection.withConnectionManager)(manager, async () => await (0, import_connection.prewarm)({ HULY_EMAIL: creds.email, HULY_PASSWORD: creds.password, HULY_TOKEN: creds.token }));
      }
    });
    transport.onclose = () => {
      if (transport.sessionId != null) void closeSession(transport.sessionId);
    };
    const mcp = (0, import_connection.withConnectionManager)(manager, () => (0, import_server.createServer)({ workspace: pinned }));
    await mcp.connect(transport);
    await (0, import_connection.withConnectionManager)(manager, async () => {
      await transport.handleRequest(req, res, body);
    });
  };
  const fail = (res, e) => {
    if (e instanceof HttpError) sendError(res, e.status, e.message);
    else {
      log(`request failed: ${e.message}`);
      sendError(res, 500, "Internal error.");
    }
  };
  const profiles = opts.profiles ?? (0, import_profiles.loadProfiles)(env);
  const fixedOf = /* @__PURE__ */ new Map();
  for (const [name, p] of profiles) {
    const manager = make({ email: p.email, password: p.password, token: p.token, workspace: p.workspace });
    fixedOf.set(name, { key: `profile:${name}`, manager, workspace: p.workspace, toolsets: p.toolsets });
    void (0, import_connection.withConnectionManager)(manager, async () => await (0, import_connection.prewarm)({ HULY_EMAIL: p.email, HULY_PASSWORD: p.password, HULY_TOKEN: p.token, HULY_WORKSPACE: p.workspace }));
  }
  const profileLimit = (0, import_express_rate_limit.default)({
    windowMs: 6e4,
    limit: 600,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: false,
    keyGenerator: (req) => `${String(req.url)}|${header(req, "cf-connecting-ip") ?? String(req.socket?.remoteAddress ?? "")}`
  });
  const PROFILE_PATH = /^\/([a-z0-9][a-z0-9_-]{0,39})\/mcp\/?$/;
  const handleProfile = (req, res, name) => {
    const p = profiles.get(name);
    profileLimit(req, res, () => {
      void (async () => {
        if (p.public !== true && !bearerOk(req, p.authToken ?? "")) {
          res.setHeader("www-authenticate", "Bearer");
          sendError(res, 401, `Missing or wrong bearer token for /${name}/mcp.`);
          return;
        }
        await handleMcp(req, res, void 0, fixedOf.get(name));
      })().catch((e) => {
        fail(res, e);
      });
    });
  };
  const oauth = opts.oauth ?? oauthFromEnv(env, opts.port);
  const base = oauth != null ? oauthApp(oauth, handleMcp, fail) : (req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://local");
      if (url.pathname === "/healthz") {
        res.writeHead(204).end();
        return;
      }
      if (url.pathname !== "/mcp") {
        sendError(res, 404, "Not found. The MCP endpoint is /mcp.");
        return;
      }
      if (authToken !== "" && !bearerOk(req, authToken)) {
        res.setHeader("www-authenticate", "Bearer");
        sendError(res, 401, "Missing or wrong bearer token (MCP_AUTH_TOKEN).");
        return;
      }
      await handleMcp(req, res);
    })().catch((e) => {
      fail(res, e);
    });
  };
  const server = import_node_http.default.createServer((req, res) => {
    const m = PROFILE_PATH.exec(new URL(req.url ?? "/", "http://local").pathname);
    if (m != null && profiles.has(m[1])) {
      handleProfile(req, res, m[1]);
      return;
    }
    base(req, res);
  });
  if (profiles.size > 0) log(`profiles: ${[...profiles].map(([n, p]) => `/${n}/mcp${p.public === true ? " (no token)" : ""}`).join(", ")}`);
  if (oauth != null) log(`"Log in with Huly" (OAuth) at ${oauth.publicUrl.href} \u2014 clients connect to ${new URL("/mcp", oauth.publicUrl).href}`);
  server.on("close", () => {
    clearInterval(sweeper);
    for (const id of [...sessions.keys()]) void closeSession(id);
    for (const f of fixedOf.values()) void f.manager.closeAll().catch(() => {
    });
  });
  return server;
}
async function runHttp(argv) {
  const arg = (name) => {
    const i = argv.indexOf(`--${name}`);
    if (i >= 0) return argv[i + 1];
    return argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  };
  if (argv.includes("--help")) {
    console.log(`huly-mcp-selfhost http [--port 8000] [--host 127.0.0.1]

MCP over Streamable HTTP at /mcp (health check: /healthz).
  MCP_AUTH_TOKEN     bearer token clients must send (needed to use the server's own HULY_* login)
  MCP_ALLOWED_HOSTS  host names clients use (DNS-rebinding protection), e.g. huly-mcp.example.com
Clients can send their own Huly login: X-Huly-Token, or X-Huly-Email + X-Huly-Password; X-Huly-Workspace pins one.

Log in with Huly (OAuth) instead \u2014 people add the URL in their AI app and log in in the browser:
  MCP_OAUTH_SECRET   at least 32 characters (openssl rand -hex 32); seals all logins and tokens
  MCP_PUBLIC_URL     the https address clients reach, e.g. https://huly-mcp.example.com`);
    return;
  }
  const port = Number(arg("port") ?? process.env.MCP_PORT ?? 8e3);
  const host = arg("host") ?? process.env.MCP_HOST ?? "127.0.0.1";
  const server = startHttpServer({ port, host, env: process.env });
  await new Promise((resolve) => server.listen(port, host, resolve));
  console.error(`huly-mcp http: listening on http://${host}:${port}/mcp`);
  const stop = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3e3).unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
function oauthFromEnv(env, port) {
  const secret = (env.MCP_OAUTH_SECRET ?? "").trim();
  if (secret === "") return void 0;
  if (secret.length < 32) throw new Error("MCP_OAUTH_SECRET must be at least 32 characters (e.g. openssl rand -hex 32).");
  const raw = (env.MCP_PUBLIC_URL ?? "").trim() || `http://localhost:${port}`;
  let publicUrl;
  try {
    publicUrl = new URL(raw);
  } catch {
    throw new Error(`MCP_PUBLIC_URL is not a URL: ${raw}`);
  }
  if (publicUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(publicUrl.hostname)) {
    throw new Error("MCP_PUBLIC_URL must use https (logins travel over it); http only for localhost.");
  }
  const accounts = env.HULY_ACCOUNTS_URL ?? "https://account.huly.app";
  return { publicUrl, provider: new import_oauth.HulyOAuthProvider(new import_oauth.Sealer(secret), (0, import_oauth.accountServiceLogin)(accounts)) };
}
function oauthApp(cfg, handleMcp, fail) {
  const app = (0, import_express.default)();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback, linklocal, uniquelocal");
  const mcpUrl = new URL("/mcp", cfg.publicUrl);
  app.get("/healthz", (_req, res) => {
    res.status(204).end();
  });
  app.use((0, import_router.mcpAuthRouter)({
    provider: cfg.provider,
    issuerUrl: cfg.publicUrl,
    resourceServerUrl: mcpUrl,
    resourceName: "Huly",
    scopesSupported: ["huly"],
    clientRegistrationOptions: { clientIdGeneration: false }
  }));
  const loginLimit = (0, import_express_rate_limit.default)({ windowMs: 6e4, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
  const mcpLimit = (0, import_express_rate_limit.default)({ windowMs: 6e4, limit: 600, standardHeaders: "draft-7", legacyHeaders: false });
  app.post("/oauth/login", loginLimit, import_express.default.urlencoded({ extended: false, limit: "16kb" }), (req, res) => {
    void cfg.provider.handleLogin(req, res);
  });
  app.all("/mcp", mcpLimit, (0, import_bearerAuth.requireBearerAuth)({ verifier: cfg.provider, resourceMetadataUrl: (0, import_router.getOAuthProtectedResourceMetadataUrl)(mcpUrl) }), (req, res) => {
    const hulyToken = String(req.auth?.extra?.hulyToken ?? "");
    handleMcp(req, res, { hulyToken }).catch((e) => {
      fail(res, e);
    });
  });
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found. The MCP endpoint is /mcp." });
  });
  return app;
}
