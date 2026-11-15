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
var watch_exports = {};
__export(watch_exports, {
  DEFAULT_COMMAND: () => DEFAULT_COMMAND,
  DEFAULT_PROMPT: () => DEFAULT_PROMPT,
  WATCH_HELP: () => WATCH_HELP,
  fill: () => fill,
  findCandidates: () => findCandidates,
  loadState: () => loadState,
  parseEnvFile: () => parseEnvFile,
  parseWatchArgs: () => parseWatchArgs,
  processIssue: () => processIssue,
  runWatch: () => runWatch,
  saveState: () => saveState,
  splitCommand: () => splitCommand,
  watchOnce: () => watchOnce,
  writeMcpConfig: () => writeMcpConfig
});
module.exports = __toCommonJS(watch_exports);
var import_node_child_process = require("node:child_process");
var import_node_fs = require("node:fs");
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var import_tracker = __toESM(require("../vendor/@hcengineering/tracker/lib/index.js"));
var import_task = __toESM(require("../vendor/@hcengineering/task/lib/index.js"));
var import_connection = require("./connection.js");
var import_env = require("./env.js");
var import_guard = require("./guard.js");
var import_people = require("./utils/people.js");
var import_agent = require("./tools/agent.js");
var import_comments = require("./tools/comments.js");
const DEFAULT_COMMAND = "claude -p {prompt} --mcp-config {mcpConfig} --strict-mcp-config --allowedTools mcp__huly --permission-mode acceptEdits";
const DEFAULT_PROMPT = [
  'Huly issue {issue} ("{title}") in workspace {workspace} was handed to you ({trigger}).',
  'You are the Huly agent "{agent}" and already hold the claim on it.',
  "1. Read everything with get_issue_context {issue}.",
  "2. Do the work in the current directory.",
  "3. Hand back with finish_work: a short summary of what you did and what is left.",
  "If you cannot finish, add a comment that says what is missing, then stop. Never delete anything."
].join("\n");
const WATCH_HELP = `Usage: huly-mcp watch [options]

Hands Huly issues to an agent: open issues with --label, or assigned to this account
(--assigned, the default), are claimed, passed to --command and released afterwards.

  --workspace <ws>      Workspace slug/name (required with more than one)
  --project <KEY>       Only these projects (repeat or comma-separate); default: all,
                        limited to HULY_WRITE_PROJECTS when set
  --label <name>        Trigger label (e.g. "claude")
  --assigned            Trigger: assigned to this account (default if no --label)
  --command <cmd>       Command per issue; placeholders {prompt} {issue} {title}
                        {workspace} {agent} {trigger} {mcpConfig}
                        default: ${DEFAULT_COMMAND}
  --prompt <text>       Prompt template (same placeholders, except {prompt})
  --cwd <dir>           Working directory for the command (default: current)
  --interval <sec>      Poll interval (default 60)
  --timeout <min>       Stop a run after this many minutes (default 60)
  --once                One pass, then exit
  --dry-run             Only list what would run
  --state <file>        State file (default ~/.huly-mcp/watch-<workspace>.json)
  --agent <name>        Agent name for claims (default HULY_AGENT_NAME or claude-watch)
  --env-file <file>     Load HULY_* credentials from this file (the agent's own account)
`;
function splitCommand(line) {
  const out = [];
  let cur = "";
  let quote = null;
  let started = false;
  for (const ch of line) {
    if (quote != null) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started || cur !== "") out.push(cur);
      cur = "";
      started = false;
    } else {
      cur += ch;
    }
  }
  if (quote != null) throw new Error(`Unclosed ${quote} in --command.`);
  if (started || cur !== "") out.push(cur);
  return out;
}
function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
function parseEnvFile(content) {
  const out = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (m == null) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"') || v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    out[m[1]] = v;
  }
  return out;
}
function parseWatchArgs(argv, env = process.env) {
  const opts = {
    projects: [],
    assigned: false,
    command: DEFAULT_COMMAND,
    prompt: DEFAULT_PROMPT,
    cwd: process.cwd(),
    intervalSec: 60,
    once: false,
    dryRun: false,
    timeoutMin: 60,
    agent: env.HULY_AGENT_NAME ?? "claude-watch"
  };
  const value = (i, flag) => {
    const v = argv[i + 1];
    if (v == null || v.startsWith("--")) throw new Error(`${flag} needs a value.`);
    return v;
  };
  const number = (v, flag, min) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min) throw new Error(`${flag} must be a number \u2265 ${min}.`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case "--workspace":
        opts.workspace = value(i, flag);
        i++;
        break;
      case "--project":
        opts.projects.push(...value(i, flag).split(",").map((p) => p.trim().toUpperCase()).filter((p) => p !== ""));
        i++;
        break;
      case "--label":
        opts.label = value(i, flag);
        i++;
        break;
      case "--assigned":
        opts.assigned = true;
        break;
      case "--command":
        opts.command = value(i, flag);
        i++;
        break;
      case "--prompt":
        opts.prompt = value(i, flag);
        i++;
        break;
      case "--cwd":
        opts.cwd = (0, import_node_path.resolve)(value(i, flag));
        i++;
        break;
      case "--interval":
        opts.intervalSec = number(value(i, flag), flag, 5);
        i++;
        break;
      case "--timeout":
        opts.timeoutMin = number(value(i, flag), flag, 1);
        i++;
        break;
      case "--once":
        opts.once = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--state":
        opts.statePath = (0, import_node_path.resolve)(value(i, flag));
        i++;
        break;
      case "--agent":
        opts.agent = value(i, flag).replace(/\s+/g, "-");
        i++;
        break;
      case "--env-file":
        opts.envFile = (0, import_node_path.resolve)(value(i, flag));
        i++;
        break;
      default:
        throw new Error(`Unknown option '${flag}'. See huly-mcp watch --help.`);
    }
  }
  if (opts.label == null) opts.assigned = true;
  if (splitCommand(opts.command).length === 0) throw new Error("--command is empty.");
  return opts;
}
function loadState(path) {
  if (!(0, import_node_fs.existsSync)(path)) return {};
  try {
    return JSON.parse((0, import_node_fs.readFileSync)(path, "utf8"));
  } catch {
    throw new Error(`State file ${path} is not valid JSON \u2014 fix or delete it.`);
  }
}
function saveState(path, state) {
  (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(path), { recursive: true });
  (0, import_node_fs.writeFileSync)(path, JSON.stringify(state, null, 2) + "\n");
}
async function findCandidates(client, opts, state) {
  const projects = await client.findAll(import_tracker.default.class.Project, opts.projects.length > 0 ? { identifier: { $in: opts.projects } } : {});
  const missing = opts.projects.filter((p) => !projects.some((x) => x.identifier === p));
  if (missing.length > 0) throw new Error(`Project(s) not found: ${missing.join(", ")}.`);
  const spaces = new Set(projects.map((p) => p._id));
  const statuses = await client.findAll(import_tracker.default.class.IssueStatus, {});
  const closed = new Set(statuses.filter((s) => s.category === import_task.default.statusCategory.Won || s.category === import_task.default.statusCategory.Lost).map((s) => s._id));
  const open = (i) => spaces.has(i.space) && !closed.has(i.status);
  const found = /* @__PURE__ */ new Map();
  if (opts.label != null) {
    const want = opts.label.toLowerCase();
    const refs = (await client.findAll("tags:class:TagReference", { attachedToClass: import_tracker.default.class.Issue })).filter((r) => String(r.title ?? "").toLowerCase() === want);
    if (refs.length > 0) {
      const issues = await client.findAll(import_tracker.default.class.Issue, { _id: { $in: refs.map((r) => r.attachedTo) } });
      for (const issue of issues.filter(open)) {
        const ref = refs.find((r) => r.attachedTo === issue._id);
        found.set(issue._id, { issue, trigger: "label", since: ref?.createdOn ?? ref?.modifiedOn ?? 0 });
      }
    }
  }
  if (opts.assigned) {
    const me = await (0, import_people.currentPerson)(client);
    const issues = await client.findAll(import_tracker.default.class.Issue, { assignee: me._id });
    for (const issue of issues.filter(open)) if (!found.has(issue._id)) found.set(issue._id, { issue, trigger: "assigned", since: 0 });
  }
  return [...found.values()].filter((c) => {
    const prev = state[c.issue._id];
    return prev == null || c.trigger === "label" && c.since > prev.ranAt;
  }).sort((a, b) => (a.issue.createdOn ?? 0) - (b.issue.createdOn ?? 0));
}
function writeMcpConfig(dir, entry, env) {
  const path = (0, import_node_path.join)(dir, "mcp.json");
  (0, import_node_fs.writeFileSync)(path, JSON.stringify({ mcpServers: { huly: { command: process.execPath, args: [entry], env } } }, null, 2), { mode: 384 });
  return path;
}
async function processIssue(c, opts, deps) {
  const { issue } = c;
  const id = issue.identifier;
  const ws = deps.workspace;
  try {
    await (0, import_agent.claimIssue)({ workspace: ws, identifier: id, agent: opts.agent, minutes: opts.timeoutMin + 5, force: false });
  } catch (e) {
    deps.log(`skip ${id}: ${e.message.replace(/^Huly MCP: /, "")}`);
    return void 0;
  }
  const childEnv = {
    ...deps.env,
    HULY_WORKSPACE: ws,
    HULY_AGENT_NAME: opts.agent,
    HULY_CONFIRM: deps.env.HULY_CONFIRM ?? "strict",
    HULY_ISSUE: id,
    HULY_ISSUE_TITLE: String(issue.title ?? "")
  };
  const vars = { issue: id, title: String(issue.title ?? ""), workspace: ws, agent: opts.agent, trigger: c.trigger === "label" ? `label "${opts.label ?? ""}"` : "assigned to you" };
  vars.prompt = fill(opts.prompt, vars);
  let tmp;
  let code;
  try {
    if (opts.command.includes("{mcpConfig}")) {
      tmp = (0, import_node_fs.mkdtempSync)((0, import_node_path.join)((0, import_node_os.tmpdir)(), "huly-watch-"));
      const pass = {};
      for (const k of ["HULY_WORKSPACE", "HULY_AGENT_NAME", "HULY_CONFIRM", "HULY_TOOLSETS", "HULY_WRITE_PROJECTS", "HULY_AUDIT_LOG"]) if (childEnv[k] != null) pass[k] = childEnv[k];
      vars.mcpConfig = writeMcpConfig(tmp, opts.serverEntry ?? process.argv[1], pass);
    }
    const argv = splitCommand(opts.command).map((w) => fill(w, vars));
    deps.log(`run ${id} (${c.trigger}): ${argv[0]} \u2026`);
    code = await deps.exec(argv, opts.cwd, childEnv, opts.timeoutMin * 6e4);
  } catch (e) {
    deps.log(`run ${id} failed to start: ${e.message}`);
    code = -1;
  } finally {
    if (tmp != null) (0, import_node_fs.rmSync)(tmp, { recursive: true, force: true });
  }
  const result = code === 0 ? "ok" : code == null ? `timeout after ${opts.timeoutMin} min` : `exit ${code}`;
  if (code !== 0) {
    await (0, import_comments.addComment)({ workspace: ws, identifier: id, message: `\u{1F916} Agent run by **${opts.agent}** ended: ${result}. The issue is free again.` });
  }
  const labels = await deps.client.findAll("tags:class:TagReference", { attachedTo: issue._id });
  if (labels.some((l) => l.title === import_agent.CLAIM_LABEL)) await (0, import_agent.releaseIssue)({ workspace: ws, identifier: id, agent: opts.agent });
  deps.log(`done ${id}: ${result}`);
  return { identifier: id, trigger: c.trigger, ranAt: (deps.now ?? Date.now)(), result };
}
async function watchOnce(opts, deps, state, save) {
  const candidates = await findCandidates(deps.client, opts, state);
  if (opts.dryRun) {
    for (const c of candidates) deps.log(`would run ${c.issue.identifier} (${c.trigger}): ${c.issue.title}`);
    if (candidates.length === 0) deps.log("nothing to do");
    return candidates.length;
  }
  for (const c of candidates) {
    const record = await processIssue(c, opts, deps);
    if (record != null) {
      state[c.issue._id] = record;
      save(state);
    }
  }
  return candidates.length;
}
function execChild(argv, cwd, env, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const child = (0, import_node_child_process.spawn)(argv[0], argv.slice(1), { cwd, env, stdio: ["ignore", "inherit", "inherit"] });
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolvePromise(killed ? null : code);
    });
  });
}
async function runWatch(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(WATCH_HELP);
    return;
  }
  const opts = parseWatchArgs(argv);
  if (opts.envFile != null) {
    const vars = parseEnvFile((0, import_node_fs.readFileSync)(opts.envFile, "utf8"));
    for (const [k, v] of Object.entries(vars)) process.env[k] = v;
  }
  (0, import_env.normalizeEnv)();
  const allowed = (0, import_guard.parseWriteProjects)(process.env.HULY_WRITE_PROJECTS);
  if (allowed != null) {
    const outside = opts.projects.filter((p) => !allowed.has(p));
    if (outside.length > 0) throw new Error(`--project ${outside.join(", ")} is outside HULY_WRITE_PROJECTS (${[...allowed].join(", ")}).`);
    if (opts.projects.length === 0) opts.projects = [...allowed];
  }
  const conn = await (0, import_connection.getWorkspace)(opts.workspace);
  const ws = conn.workspace.url;
  const me = await (0, import_people.currentPerson)(conn.client);
  const statePath = opts.statePath ?? (0, import_node_path.join)((0, import_node_os.homedir)(), ".huly-mcp", `watch-${ws}.json`);
  const state = loadState(statePath);
  const log = (line) => {
    process.stderr.write(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${line}
`);
  };
  const triggers = [opts.label != null ? `label "${opts.label}"` : void 0, opts.assigned ? `assigned to ${me.name}` : void 0].filter((t) => t != null).join(" or ");
  log(`watching ${ws}${opts.projects.length > 0 ? ` (${opts.projects.join(", ")})` : ""} as ${me.name}, agent "${opts.agent}": ${triggers}${opts.dryRun ? " \u2014 dry run" : ""}`);
  let stop = false;
  const onSignal = () => {
    stop = true;
    log("stopping after the current run\u2026");
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  const deps = { client: conn.client, workspace: ws, exec: execChild, log, env: process.env };
  try {
    while (!stop) {
      try {
        await watchOnce(opts, deps, state, (s) => saveState(statePath, s));
      } catch (e) {
        log(`poll failed: ${e.message}`);
        if (opts.once || opts.dryRun) process.exitCode = 1;
      }
      if (opts.once || opts.dryRun) break;
      for (let waited = 0; waited < opts.intervalSec * 1e3 && !stop; waited += 500) await new Promise((r) => setTimeout(r, 500));
    }
  } finally {
    await (0, import_connection.closeConnection)();
  }
}
