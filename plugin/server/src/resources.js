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
var resources_exports = {};
__export(resources_exports, {
  GUIDES: () => GUIDES,
  completeIssue: () => completeIssue,
  completeProject: () => completeProject,
  completeWorkspace: () => completeWorkspace,
  modifiedOn: () => modifiedOn,
  readGuide: () => readGuide,
  registerPrompts: () => registerPrompts,
  registerResources: () => registerResources,
  registerSubscriptions: () => registerSubscriptions
});
module.exports = __toCommonJS(resources_exports);
var import_mcp = require("../vendor/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js");
var import_completable = require("../vendor/@modelcontextprotocol/sdk/dist/cjs/server/completable.js");
var import_types = require("../vendor/@modelcontextprotocol/sdk/dist/cjs/types.js");
var import_zod = require("../vendor/zod/index.cjs");
var import_fs = require("fs");
var import_path = require("path");
var import_tracker = __toESM(require("../vendor/@hcengineering/tracker/lib/index.js"));
var import_task = __toESM(require("../vendor/@hcengineering/task/lib/index.js"));
var import_core = require("../vendor/@hcengineering/core/lib/index.js");
var import_txhub = require("./utils/txhub.js");
var import_connection = require("./connection.js");
var import_people = require("./utils/people.js");
var import_agent = require("./tools/agent.js");
var import_documents = require("./tools/documents.js");
const DONE = /* @__PURE__ */ new Set([import_task.default.statusCategory.Won, import_task.default.statusCategory.Lost]);
async function myOpenIssues(limit = 30) {
  const out = [];
  let workspaces;
  try {
    workspaces = await (0, import_connection.listWorkspaces)();
  } catch {
    return [];
  }
  for (const ws2 of workspaces) {
    try {
      const client = await (0, import_connection.getConnection)(ws2.url);
      const me = await (0, import_people.currentPerson)(client);
      const statuses = await client.findAll(import_tracker.default.class.IssueStatus, {});
      const open = statuses.filter((s) => !DONE.has(s.category)).map((s) => s._id);
      const issues = await client.findAll(import_tracker.default.class.Issue, { assignee: me._id, status: { $in: open } }, { sort: { modifiedOn: import_core.SortingOrder.Descending }, limit });
      for (const i of issues) out.push({ uri: `huly://${ws2.url}/issue/${i.identifier}`, name: `${i.identifier}: ${i.title}`, description: `Open issue in ${ws2.name}` });
    } catch {
    }
  }
  return out.slice(0, limit);
}
const MAX = 100;
const starts = (values, prefix) => values.filter((v) => v.toLowerCase().startsWith(prefix.toLowerCase())).slice(0, MAX);
async function completeWorkspace(prefix) {
  try {
    return starts((await (0, import_connection.listWorkspaces)()).map((w) => w.url), prefix);
  } catch {
    return [];
  }
}
async function completeProject(prefix, workspace) {
  try {
    const client = await (0, import_connection.getConnection)(workspace);
    const projects = (await client.findAll(import_tracker.default.class.Project, {})).filter((p) => p.archived !== true);
    return starts(projects.map((p) => p.identifier).sort(), prefix);
  } catch {
    return [];
  }
}
async function completeIssue(prefix, workspace) {
  try {
    const client = await (0, import_connection.getConnection)(workspace);
    const m = /^([A-Za-z][A-Za-z0-9]*)(?:-(\d*))?$/.exec(prefix.trim());
    if (m == null) {
      const me = await (0, import_people.currentPerson)(client);
      const mine = await client.findAll(import_tracker.default.class.Issue, { assignee: me._id }, { sort: { modifiedOn: import_core.SortingOrder.Descending }, limit: 50 });
      return mine.map((i) => i.identifier);
    }
    if (m[2] == null) {
      const projects = await completeProject(m[1], workspace);
      return projects.length === 1 ? projects.map((p) => `${p}-`) : projects;
    }
    const project = await client.findOne(import_tracker.default.class.Project, { identifier: m[1].toUpperCase() });
    if (project == null) return [];
    const issues = await client.findAll(import_tracker.default.class.Issue, { space: project._id }, { sort: { modifiedOn: import_core.SortingOrder.Descending }, limit: 500 });
    return starts(issues.map((i) => i.identifier), prefix);
  } catch {
    return [];
  }
}
const ws = (ctx) => ctx?.arguments?.workspace;
const wsArg = () => (0, import_completable.completable)(import_zod.z.string(), async (v) => await completeWorkspace(v));
const issueArg = () => (0, import_completable.completable)(import_zod.z.string(), async (v, ctx) => await completeIssue(v, ws(ctx)));
const projectArg = () => (0, import_completable.completable)(import_zod.z.string(), async (v, ctx) => await completeProject(v, ws(ctx)));
const GUIDES = {
  workflow: { file: "SKILL.md", title: "Huly workflow for agents", description: "Repo rules first, pick up/hand back issues, status flow, creating without duplicates" },
  costs: { file: "costs.md", title: "Cheapest Huly call per question", description: "Which call answers which question with the least output (measured sizes)" },
  onboarding: { file: "onboarding.md", title: "Bringing a project into Huly", description: "Status set, components, milestones, TODO scan, architecture document" },
  features: { file: "features.md", title: "All of Huly for a software project", description: "Labels, templates, test management, documents, drive, custom fields, cards \u2014 tools and toolsets" }
};
function readGuide(name) {
  const g = GUIDES[name];
  if (g == null) throw new Error(`Unknown guide: ${name}. Available: ${Object.keys(GUIDES).join(", ")}`);
  let text;
  try {
    text = (0, import_fs.readFileSync)((0, import_path.join)(__dirname, "guides", `${name}.md`), "utf8");
  } catch {
    const skill = [(0, import_path.join)(__dirname, "..", "plugin", "skills", "huly", g.file), (0, import_path.join)(__dirname, "..", "skills", "huly", g.file), (0, import_path.join)(__dirname, "..", "..", "skills", "huly", g.file)].find((f) => (0, import_fs.existsSync)(f)) ?? (0, import_path.join)(__dirname, "..", "plugin", "skills", "huly", g.file);
    text = (0, import_fs.readFileSync)(skill, "utf8").replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n+/, "");
  }
  return text.replace(/\]\((SKILL|costs|onboarding|features)\.md\)/g, (_m, f) => `](huly://guide/${f === "SKILL" ? "workflow" : f})`);
}
function registerResources(server) {
  for (const [name, g] of Object.entries(GUIDES)) {
    server.registerResource(
      `guide-${name}`,
      `huly://guide/${name}`,
      { title: g.title, description: g.description, mimeType: "text/markdown" },
      async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: readGuide(name) }] })
    );
  }
  server.registerResource(
    "issue",
    new import_mcp.ResourceTemplate("huly://{workspace}/issue/{identifier}", {
      list: async () => ({ resources: (await myOpenIssues()).map((r) => ({ ...r, mimeType: "text/markdown" })) }),
      complete: {
        workspace: async (v) => await completeWorkspace(v),
        identifier: async (v, ctx) => await completeIssue(v, ws(ctx))
      }
    }),
    { title: "Huly issue", description: "Issue with description, sub-issues, blockers, PRs and comments", mimeType: "text/markdown" },
    async (uri, vars) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: await (0, import_agent.issueContext)(String(vars.workspace), String(vars.identifier)) }]
    })
  );
  server.registerResource(
    "document",
    new import_mcp.ResourceTemplate("huly://{workspace}/document/{id}", { list: void 0, complete: { workspace: async (v) => await completeWorkspace(v) } }),
    { title: "Huly document", description: "Document with its content", mimeType: "text/markdown" },
    async (uri, vars) => {
      const result = await (0, import_documents.getDocument)({ workspace: String(vars.workspace), documentId: String(vars.id) });
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: result.content[0].text }] };
    }
  );
}
const user = (text) => ({ messages: [{ role: "user", content: { type: "text", text } }] });
function registerPrompts(server) {
  server.registerPrompt("setup", {
    title: "Set up Huly for a project",
    description: "Ask how Huly should be used for a project, write the rules for your project instructions, optionally import it",
    argsSchema: { repository: import_zod.z.string().optional(), workspace: import_zod.z.string().optional() }
  }, ({ repository, workspace }) => user(
    `Set up how you use Huly for ${repository != null ? `the repository ${repository}` : "my current project"}${workspace != null ? ` (workspace ${workspace})` : ""}.

1. Find the project: ` + (repository != null ? "call find_project_for_repo with the repository; " : "") + 'otherwise list_workspaces and list_projects and suggest the one that fits. Never create a Huly project \u2014 if none fits, suggest a short key and ask me to create it.\n2. Ask me in one message, with numbered options and your recommendation first: (a) role of Huly \u2014 leads / overview only / not used; (b) where new issues go \u2014 code bugs on GitHub and product topics in Huly / everything in Huly / only when I ask; (c) initiative \u2014 act and keep status current / propose first / only on request; (d) efficiency \u2014 normal / token-saving / minimal.\n3. Write a short "## Huly" rules section from my answers (workspace, project, where issues go, duplicate check, component + milestone on every issue, status flow, initiative, efficiency) and give it to me to paste into my project instructions (CLAUDE.md, AGENTS.md, Cursor rules or the project instructions of this app).\n4. Ask which imports I want (components, milestones, status set, TODO/FIXME proposals, architecture document) and do them as described in resource huly://guide/onboarding, dry runs first. For efficient calls follow huly://guide/costs. End with what was created and what I still have to do.'
  ));
  server.registerPrompt("start", {
    title: "Start working on an issue",
    description: "Pick up an issue, load its context and propose a plan",
    argsSchema: { workspace: wsArg(), identifier: issueArg() }
  }, ({ workspace, identifier }) => user(
    `Start work on Huly issue ${identifier} in workspace ${workspace}: call start_work, read the context it returns (description, sub-issues, blockers, PRs, comments). If it is blocked by open issues, say so before doing anything. Then propose a short implementation plan and use the suggested branch name.`
  ));
  server.registerPrompt("finish", {
    title: "Finish an issue",
    description: "Post a work summary, link the PR and move the issue to review",
    argsSchema: { workspace: wsArg(), identifier: issueArg(), pullRequest: import_zod.z.string().optional() }
  }, ({ workspace, identifier, pullRequest }) => user(
    `Finish Huly issue ${identifier} in workspace ${workspace}: summarise what was changed and how it was verified (be honest about anything not verified), then call finish_work with that summary${pullRequest != null ? ` and pullRequest "${pullRequest}"` : ""}.`
  ));
  server.registerPrompt("plan", {
    title: "Turn a plan into issues",
    description: "Epic + sub-issues from a goal or plan, with duplicate check",
    argsSchema: { workspace: wsArg(), projectIdentifier: projectArg(), goal: import_zod.z.string() }
  }, ({ workspace, projectIdentifier, goal }) => user(
    `Break this down into a Huly epic with sub-issues in project ${projectIdentifier} (workspace ${workspace}):

${goal}

Look up components and milestones first (list_components, list_milestones) and assign each child the fitting ones. Express ordering with blockedBy. Call create_issue_tree with dryRun=true, show me the plan, and only create it after I confirm.`
  ));
  server.registerPrompt("triage", {
    title: "Triage my inbox",
    description: "Go through unread notifications and suggest actions",
    argsSchema: { workspace: wsArg() }
  }, ({ workspace }) => user(
    `Triage my Huly inbox in workspace ${workspace}: call triage_inbox once (unread items with what changed), group them by urgency, and for each suggest one action (reply, start work, delegate, mark read). Do not change anything until I pick.`
  ));
  server.registerPrompt("standup", {
    title: "Stand-up summary",
    description: "What I did since the last working day, today, blockers",
    argsSchema: { workspace: wsArg(), since: import_zod.z.string().optional() }
  }, ({ workspace, since }) => user(
    `Write my stand-up for Huly workspace ${workspace}: call standup once${since != null ? ` with since="${since}"` : ""} \u2014 it already covers what I did, what is in progress, blockers and today. Format: Done / In progress / Blocked / Next \u2014 short bullet points with issue ids.`
  ));
}
async function resolveUri(uri) {
  const m = /^huly:\/\/([^/]+)\/(issue|document)\/(.+)$/.exec(uri);
  if (m == null) return void 0;
  try {
    const workspace = decodeURIComponent(m[1]);
    const client = await (0, import_connection.getConnection)(workspace);
    const ref = decodeURIComponent(m[3]);
    const doc = m[2] === "issue" ? await client.findOne(import_tracker.default.class.Issue, { identifier: ref }) : await client.findOne("document:class:Document", { _id: ref });
    return doc == null ? void 0 : { workspace, id: String(doc._id), modifiedOn: doc.modifiedOn };
  } catch {
    return void 0;
  }
}
async function modifiedOn(uri) {
  return (await resolveUri(uri))?.modifiedOn;
}
function registerSubscriptions(server, pollMs = Number(process.env.HULY_SUBSCRIBE_POLL_MS ?? 3e5)) {
  const subs = /* @__PURE__ */ new Map();
  const subscriptions = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Map();
  const pending = /* @__PURE__ */ new Map();
  let timer;
  let polling = false;
  const pushed = (uri) => {
    if (pending.has(uri)) return;
    const t = setTimeout(() => {
      pending.delete(uri);
      if (subs.has(uri)) void server.server.sendResourceUpdated({ uri }).catch(() => {
      });
    }, 750);
    t.unref();
    pending.set(uri, t);
  };
  const listen = async (workspace) => {
    if (listeners.has(workspace)) return;
    const client = await (0, import_connection.getConnection)(workspace);
    listeners.set(workspace, (0, import_txhub.onTx)(client, (tx) => {
      const ids = (0, import_txhub.touchedIds)(tx);
      for (const [uri, s] of subs) if (s.workspace === workspace && s.id != null && ids.has(s.id)) pushed(uri);
    }));
  };
  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      for (const [uri, s] of subs) {
        const now = await modifiedOn(uri);
        if (now != null && s.last != null && now > s.last) {
          s.last = now;
          subscriptions.set(uri, now);
          await server.server.sendResourceUpdated({ uri }).catch(() => {
          });
        } else if (s.last == null && now != null) {
          s.last = now;
          subscriptions.set(uri, now);
        }
      }
    } finally {
      polling = false;
    }
  };
  const sync = () => {
    if (subs.size > 0 && timer == null) {
      timer = setInterval(() => {
        void poll();
      }, Math.max(5e3, pollMs));
      timer.unref();
    } else if (subs.size === 0 && timer != null) {
      clearInterval(timer);
      timer = void 0;
    }
    for (const [ws2, stop] of listeners) {
      if (![...subs.values()].some((s) => s.workspace === ws2)) {
        stop();
        listeners.delete(ws2);
      }
    }
  };
  server.server.registerCapabilities({ resources: { subscribe: true, listChanged: true } });
  server.server.setRequestHandler(import_types.SubscribeRequestSchema, async (req) => {
    const r = await resolveUri(req.params.uri);
    subs.set(req.params.uri, { last: r?.modifiedOn, id: r?.id, workspace: r?.workspace });
    subscriptions.set(req.params.uri, r?.modifiedOn);
    if (r != null) await listen(r.workspace).catch(() => {
    });
    sync();
    return {};
  });
  server.server.setRequestHandler(import_types.UnsubscribeRequestSchema, async (req) => {
    subs.delete(req.params.uri);
    subscriptions.delete(req.params.uri);
    sync();
    return {};
  });
  server.server.onclose = () => {
    subs.clear();
    subscriptions.clear();
    sync();
  };
  return { poll, subscriptions, pushed };
}
