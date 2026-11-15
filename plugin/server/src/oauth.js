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
var oauth_exports = {};
__export(oauth_exports, {
  ACCESS_TTL_S: () => ACCESS_TTL_S,
  HulyOAuthProvider: () => HulyOAuthProvider,
  REFRESH_TTL_S: () => REFRESH_TTL_S,
  Sealer: () => Sealer,
  accountServiceLogin: () => accountServiceLogin,
  loginPage: () => loginPage
});
module.exports = __toCommonJS(oauth_exports);
var import_node_crypto = require("node:crypto");
var import_errors = require("../vendor/@modelcontextprotocol/sdk/dist/cjs/server/auth/errors.js");
var import_account_client = require("../vendor/@hcengineering/account-client/lib/index.js");
const ACCESS_TTL_S = 60 * 60;
const REFRESH_TTL_S = 30 * 24 * 60 * 60;
const CODE_TTL_S = 5 * 60;
const PENDING_TTL_S = 15 * 60;
class Sealer {
  key;
  // scrypt, not a plain hash: MCP_OAUTH_SECRET should be random, but if someone uses a passphrase,
  // a stolen token must not make guessing it cheap. Runs once at start-up (~50 ms).
  constructor(secret) {
    this.key = (0, import_node_crypto.scryptSync)(secret, "huly-mcp-oauth/v2", 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  }
  seal(kind, data, ttlS) {
    const iv = (0, import_node_crypto.randomBytes)(12);
    const c = (0, import_node_crypto.createCipheriv)("aes-256-gcm", this.key, iv);
    const body = JSON.stringify({ k: kind, d: data, e: ttlS != null ? Math.floor(Date.now() / 1e3) + ttlS : void 0 });
    const ct = Buffer.concat([c.update(body, "utf8"), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
  }
  open(kind, token) {
    try {
      const raw = Buffer.from(token, "base64url");
      if (raw.length < 29) return void 0;
      const d = (0, import_node_crypto.createDecipheriv)("aes-256-gcm", this.key, raw.subarray(0, 12));
      d.setAuthTag(raw.subarray(12, 28));
      const body = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8"));
      if (body.k !== kind) return void 0;
      if (body.e != null && body.e < Math.floor(Date.now() / 1e3)) return void 0;
      return { ...body.d, exp: body.e };
    } catch {
      return void 0;
    }
  }
}
function accountServiceLogin(accountsUrl) {
  const client = async () => (0, import_account_client.getClient)(accountsUrl);
  return {
    password: async (email, password) => {
      const info = await (await client()).login(email, password);
      if (info?.token == null) throw new Error("Login failed.");
      return info.token;
    },
    sendCode: async (email) => {
      await (await client()).loginOtp(email);
    },
    verifyCode: async (email, code) => {
      const info = await (await client()).validateOtp(email, code);
      if (info?.token == null) throw new Error("Invalid or expired code.");
      return info.token;
    }
  };
}
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
function loginPage(opts) {
  const e = esc(opts.email ?? "");
  const form = opts.step === "code" ? `<p class="hint">We sent a one-time code to <b>${e}</b>.</p>
      <label>Code<input name="code" inputmode="numeric" autocomplete="one-time-code" required autofocus></label>
      <input type="hidden" name="email" value="${e}">
      <button name="action" value="verify-code">Log in</button>
      <button class="link" name="action" value="send-code" formnovalidate>Send a new code</button>` : `<label>E-mail<input name="email" type="email" autocomplete="username" value="${e}" required autofocus></label>
      <label>Password<input name="password" type="password" autocomplete="current-password"></label>
      <button name="action" value="password">Log in</button>
      <div class="or"><span>Google or GitHub account?</span></div>
      <button class="secondary" name="action" value="send-code" formnovalidate>E-mail me a one-time code</button>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Log in with Huly</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f6f4; --card:#fff; --ink:#111; --muted:#5b5a56; --line:#dddcd7; --accent:#2a78d6; --err:#c0392b }
  @media (prefers-color-scheme: dark) { :root { --bg:#111; --card:#1b1b1a; --ink:#f0efec; --muted:#b3b2aa; --line:#383835; --accent:#3987e5; --err:#ec6a5e } }
  * { box-sizing: border-box } body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--bg); color:var(--ink); font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif }
  main { width:min(380px,92vw); background:var(--card); border:1px solid var(--line); border-radius:14px; padding:28px }
  h1 { font-size:20px; margin:0 0 4px } .sub { color:var(--muted); margin:0 0 20px; font-size:14px }
  label { display:block; font-size:14px; margin:0 0 14px } input { display:block; width:100%; margin-top:6px; padding:10px 12px; font:inherit; color:inherit; background:transparent; border:1px solid var(--line); border-radius:8px }
  input:focus { outline:2px solid var(--accent); outline-offset:1px }
  button { width:100%; padding:11px; font:inherit; font-weight:600; border:0; border-radius:8px; background:var(--accent); color:#fff; cursor:pointer }
  button.secondary { background:transparent; color:var(--ink); border:1px solid var(--line); font-weight:500 } button.link { background:none; color:var(--accent); font-weight:500; margin-top:8px }
  .or { display:flex; align-items:center; gap:10px; color:var(--muted); font-size:13px; margin:18px 0 10px } .or::before,.or::after { content:""; flex:1; border-top:1px solid var(--line) }
  .err { color:var(--err); font-size:14px; margin:0 0 14px } .hint { color:var(--muted); font-size:14px; margin:0 0 14px } .foot { color:var(--muted); font-size:12px; margin:18px 0 0 }
</style></head>
<body><main>
  <h1>Log in with Huly</h1>
  <p class="sub"><b>${esc(opts.client)}</b> wants to work in your Huly workspaces as you.</p>
  ${opts.error != null ? `<p class="err" role="alert">${esc(opts.error)}</p>` : ""}${opts.notice != null ? `<p class="hint">${esc(opts.notice)}</p>` : ""}
  <form method="post" action="/oauth/login">
    <input type="hidden" name="pending" value="${esc(opts.pending)}">
    ${form}
  </form>
  <p class="foot">Your password goes only to your Huly server and is not stored. You can disconnect any time in your AI app.</p>
</main></body></html>`;
}
class Throttle {
  constructor(max, windowMs) {
    this.max = max;
    this.windowMs = windowMs;
  }
  max;
  windowMs;
  hits = /* @__PURE__ */ new Map();
  blocked(key) {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    this.hits.set(key, list);
    return list.length >= this.max;
  }
  fail(key) {
    this.hits.set(key, [...this.hits.get(key) ?? [], Date.now()]);
  }
}
class HulyOAuthProvider {
  constructor(sealer, login) {
    this.sealer = sealer;
    this.login = login;
  }
  sealer;
  login;
  skipLocalPkceValidation = false;
  revoked = /* @__PURE__ */ new Set();
  throttle = new Throttle(10, 10 * 6e4);
  get clientsStore() {
    return {
      getClient: (clientId) => this.sealer.open("client", clientId),
      // The client id is the sealed registration itself — nothing to store.
      registerClient: (client) => {
        const issuedAt = Math.floor(Date.now() / 1e3);
        const id = this.sealer.seal("client", { ...client, client_id_issued_at: issuedAt, nonce: (0, import_node_crypto.randomUUID)() });
        return { ...client, client_id: id, client_id_issued_at: issuedAt };
      }
    };
  }
  async authorize(client, params, res) {
    const pending = this.sealer.seal("pending", {
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      state: params.state,
      codeChallenge: params.codeChallenge,
      scopes: params.scopes ?? [],
      resource: params.resource?.href
    }, PENDING_TTL_S);
    sendPage(res, 200, loginPage({ pending, client: client.client_name ?? "An AI app", step: "start" }));
  }
  /** POST /oauth/login — the login form. */
  async handleLogin(req, res) {
    const body = req.body ?? {};
    const p = this.sealer.open("pending", String(body.pending ?? ""));
    if (p == null) {
      sendPage(res, 400, simplePage("This login link expired", "Start again from your AI app."));
      return;
    }
    const client = this.clientsStore.getClient(String(p.clientId));
    const name = client?.client_name ?? "An AI app";
    const email = String(body.email ?? "").trim();
    const ip = req.ip ?? "unknown";
    const page = (step, error, notice) => {
      sendPage(res, error != null ? 401 : 200, loginPage({ pending: body.pending, client: name, step, email, error, notice }));
    };
    if (this.throttle.blocked(ip)) {
      page("start", "Too many attempts. Wait a few minutes and try again.");
      return;
    }
    try {
      let hulyToken;
      switch (body.action) {
        case "send-code":
          if (email === "") {
            page("start", "Enter your e-mail first.");
            return;
          }
          await this.login.sendCode(email);
          page("code");
          return;
        case "verify-code":
          hulyToken = await this.login.verifyCode(email, String(body.code ?? "").trim());
          break;
        default:
          if (email === "" || String(body.password ?? "") === "") {
            page("start", "Enter your e-mail and password \u2014 or use a one-time code.");
            return;
          }
          hulyToken = await this.login.password(email, String(body.password));
      }
      const code = this.sealer.seal("code", { clientId: p.clientId, redirectUri: p.redirectUri, codeChallenge: p.codeChallenge, scopes: p.scopes, resource: p.resource, hulyToken, email, nonce: (0, import_node_crypto.randomUUID)() }, CODE_TTL_S);
      const target = new URL(String(p.redirectUri));
      target.searchParams.set("code", code);
      if (p.state != null) target.searchParams.set("state", String(p.state));
      res.redirect(302, target.href);
    } catch (e) {
      this.throttle.fail(ip);
      const message = e.message;
      page(body.action === "verify-code" ? "code" : "start", /invalid|password|credential|not found|unauthorized|forbidden/i.test(message) ? body.action === "verify-code" ? "That code is wrong or expired." : "E-mail or password is wrong." : `Huly did not answer: ${message}`);
    }
  }
  async challengeForAuthorizationCode(client, authorizationCode) {
    const c = this.sealer.open("code", authorizationCode);
    if (c == null || c.clientId !== client.client_id) throw new import_errors.InvalidGrantError("Invalid or expired authorization code.");
    return String(c.codeChallenge);
  }
  async exchangeAuthorizationCode(client, authorizationCode, _verifier, redirectUri) {
    const c = this.sealer.open("code", authorizationCode);
    if (c == null || c.clientId !== client.client_id) throw new import_errors.InvalidGrantError("Invalid or expired authorization code.");
    if (redirectUri != null && redirectUri !== c.redirectUri) throw new import_errors.InvalidGrantError("redirect_uri does not match.");
    if (this.revoked.has(hash(authorizationCode))) throw new import_errors.InvalidGrantError("Authorization code already used.");
    this.revoked.add(hash(authorizationCode));
    return this.issue(client.client_id, String(c.hulyToken), String(c.email ?? ""), c.scopes ?? [], c.resource);
  }
  async exchangeRefreshToken(client, refreshToken) {
    const r = this.sealer.open("refresh", refreshToken);
    if (r == null || r.clientId !== client.client_id || this.revoked.has(hash(refreshToken))) throw new import_errors.InvalidGrantError("Invalid or expired refresh token.");
    this.revoked.add(hash(refreshToken));
    return this.issue(client.client_id, String(r.hulyToken), String(r.email ?? ""), r.scopes ?? [], r.resource);
  }
  async verifyAccessToken(token) {
    const a = this.sealer.open("access", token);
    if (a == null || this.revoked.has(hash(token))) throw new import_errors.InvalidTokenError("Invalid or expired access token.");
    return { token, clientId: String(a.clientId), scopes: a.scopes ?? [], expiresAt: a.exp, resource: a.resource != null ? new URL(String(a.resource)) : void 0, extra: { hulyToken: a.hulyToken, email: a.email } };
  }
  async revokeToken(_client, request) {
    this.revoked.add(hash(request.token));
  }
  issue(clientId, hulyToken, email, scopes, resource) {
    const data = { clientId, hulyToken, email, scopes, resource };
    return {
      access_token: this.sealer.seal("access", data, ACCESS_TTL_S),
      token_type: "bearer",
      expires_in: ACCESS_TTL_S,
      refresh_token: this.sealer.seal("refresh", { ...data, nonce: (0, import_node_crypto.randomUUID)() }, REFRESH_TTL_S),
      scope: scopes.join(" ")
    };
  }
}
const hash = (s) => (0, import_node_crypto.createHash)("sha256").update(s).digest("base64url");
function sendPage(res, status, html) {
  res.status(status).set("content-type", "text/html; charset=utf-8").set("cache-control", "no-store").set("x-frame-options", "DENY").set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'").set("referrer-policy", "no-referrer").send(html);
}
function simplePage(title, text) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="font:16px -apple-system,sans-serif;padding:40px"><h1 style="font-size:20px">${esc(title)}</h1><p>${esc(text)}</p></body></html>`;
}
