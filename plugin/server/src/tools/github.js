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
var github_exports = {};
__export(github_exports, {
  getPullRequest: () => getPullRequest,
  listPullRequests: () => listPullRequests
});
module.exports = __toCommonJS(github_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_classes = require("../utils/classes.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
const STATE = ["open", "closed", "merged"];
const DECISION = ["changes requested", "approved", "review required"];
const REVIEW = ["pending", "commented", "approved", "changes requested", "dismissed"];
const listPullRequests = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const query = {};
  if (args.projectIdentifier != null) {
    const project = await client.findOne(import_tracker.default.class.Project, { identifier: args.projectIdentifier });
    if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`);
    query.space = project._id;
  }
  if (args.issue != null) {
    const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.issue });
    if (issue == null) throw new Error(`Issue '${args.issue}' not found.`);
    query.attachedTo = issue._id;
  }
  if (args.state !== "all") query.state = STATE.indexOf(args.state);
  const prs = await client.findAll(import_classes.C.PullRequest, query, { limit: args.limit, sort: { modifiedOn: import_core.SortingOrder.Descending } });
  if (prs.length === 0) return `No ${args.state === "all" ? "" : args.state + " "}pull requests found.`;
  const names = await (0, import_people.peopleNames)(client);
  const lines = prs.map((pr) => {
    const gh = pr[import_classes.IDS.GithubIssueMixin] ?? {};
    const decision = pr.reviewDecision != null ? ` \xB7 ${DECISION[pr.reviewDecision] ?? pr.reviewDecision}` : "";
    const draft = pr.draft === true ? " \xB7 draft" : "";
    const who = pr.assignee != null ? ` \xB7 ${names.get(pr.assignee) ?? pr.assignee}` : "";
    return `- **${pr.identifier}** [${STATE[pr.state] ?? pr.state}${draft}${decision}] ${pr.title}${who}
  #${gh.githubNumber ?? "?"} ${gh.url ?? ""} \xB7 updated ${(0, import_format.formatDate)(pr.modifiedOn)}`;
  });
  return `## Pull requests (${prs.length})

${lines.join("\n")}`;
});
const getPullRequest = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const pr = await client.findOne(import_classes.C.PullRequest, { identifier: args.identifier });
  if (pr == null) throw new Error(`Pull request '${args.identifier}' not found.`);
  const gh = pr[import_classes.IDS.GithubIssueMixin] ?? {};
  const issue = pr.attachedTo !== import_tracker.default.ids.NoParent ? await client.findOne(import_tracker.default.class.Issue, { _id: pr.attachedTo }) : void 0;
  const reviews = await client.findAll(import_classes.C.PullRequestReview, { attachedTo: pr._id }, { sort: { createdOn: import_core.SortingOrder.Ascending } });
  const comments = await client.findAll(import_classes.C.ReviewComment, { attachedTo: pr._id }, { sort: { createdOn: import_core.SortingOrder.Ascending }, limit: 30 });
  const who = await (0, import_people.socialIdNames)(client, [...new Set([...reviews, ...comments].map((r) => r.createdBy))]);
  const lines = [
    `## ${pr.identifier}: ${pr.title}`,
    `**State:** ${STATE[pr.state] ?? pr.state}${pr.draft === true ? " (draft)" : ""}${pr.mergedAt != null ? `, merged ${(0, import_format.formatDate)(pr.mergedAt)}` : ""}${pr.closedAt != null && pr.mergedAt == null ? `, closed ${(0, import_format.formatDate)(pr.closedAt)}` : ""}`,
    `**Review decision:** ${pr.reviewDecision != null ? DECISION[pr.reviewDecision] : "none"}`,
    `**GitHub:** #${gh.githubNumber ?? "?"} ${gh.url ?? ""}`,
    `**Branch:** ${pr.head?.name ?? "(deleted)"} \u2192 ${pr.base?.name ?? "?"} \xB7 ${pr.files ?? "?"} file(s) changed`,
    `**Issue:** ${issue != null ? `${issue.identifier}: ${issue.title}` : "none"}`
  ];
  if (reviews.length > 0) {
    lines.push("", "**Reviews:**");
    for (const r of reviews) {
      const body = (0, import_format.markupToText)(r.body);
      lines.push(`- ${(0, import_format.formatDate)(r.createdOn)} ${who.get(r.createdBy) ?? "GitHub user"}: ${REVIEW[r.state] ?? r.state}${body !== "" ? ` \u2014 ${body.slice(0, 300)}` : ""}`);
    }
  }
  if (comments.length > 0) {
    lines.push("", `**Review comments (${comments.length}${comments.length === 30 ? "+" : ""}):**`);
    for (const c of comments) lines.push(`- \`${c.path}:${c.line ?? c.originalLine ?? "?"}\` ${who.get(c.createdBy) ?? ""}: ${(0, import_format.markupToText)(c.body).slice(0, 300)}`);
  }
  return lines.join("\n");
});
