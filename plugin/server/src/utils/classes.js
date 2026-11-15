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
var classes_exports = {};
__export(classes_exports, {
  C: () => C,
  CHANNEL_PROVIDERS: () => CHANNEL_PROVIDERS,
  IDS: () => IDS,
  TODO_PRIORITY: () => TODO_PRIORITY,
  TODO_PRIORITY_LABEL: () => TODO_PRIORITY_LABEL,
  generateEventId: () => generateEventId
});
module.exports = __toCommonJS(classes_exports);
const C = {
  InboxNotification: "notification:class:InboxNotification",
  DocNotifyContext: "notification:class:DocNotifyContext",
  ActivityMessage: "activity:class:ActivityMessage",
  DocUpdateMessage: "activity:class:DocUpdateMessage",
  Reaction: "activity:class:Reaction",
  ThreadMessage: "chunter:class:ThreadMessage",
  ToDo: "time:class:ToDo",
  ProjectToDo: "time:class:ProjectToDo",
  WorkSlot: "time:class:WorkSlot",
  Calendar: "calendar:class:Calendar",
  Event: "calendar:class:Event",
  PullRequest: "github:class:GithubPullRequest",
  PullRequestReview: "github:class:GithubReview",
  ReviewComment: "github:class:GithubReviewComment",
  Channel: "contact:class:Channel",
  Collaborator: "core:class:Collaborator",
  PublicLink: "guest:class:PublicLink",
  Card: "card:class:Card",
  MasterTag: "card:class:MasterTag",
  CardTag: "card:class:Tag",
  CardSpace: "card:class:CardSpace",
  Drive: "drive:class:Drive",
  DriveResource: "drive:class:Resource",
  Folder: "drive:class:Folder",
  File: "drive:class:File",
  FileVersion: "drive:class:FileVersion",
  DocumentSnapshot: "document:class:DocumentSnapshot",
  TagCategory: "tags:class:TagCategory",
  Attribute: "core:class:Attribute",
  Enum: "core:class:Enum"
};
const IDS = {
  ToDosSpace: "time:space:ToDos",
  ToDoNotAttached: "time:ids:NotAttached",
  CalendarSpace: "calendar:space:Calendar",
  EventNotAttached: "calendar:ids:NoAttached",
  GithubIssueMixin: "github:mixin:GithubIssue",
  GithubProject: "github:mixin:GithubProject",
  CardDefaultSpace: "card:space:Default",
  DriveRoot: "drive:ids:Root",
  DocumentNoParent: "document:ids:NoParent",
  NoTagCategory: "tags:category:NoCategory"
};
const TODO_PRIORITY = { High: 0, Medium: 1, Low: 2, NoPriority: 3, Urgent: 4 };
const TODO_PRIORITY_LABEL = Object.fromEntries(Object.entries(TODO_PRIORITY).map(([k, v]) => [v, k]));
const CHANNEL_PROVIDERS = ["Email", "Phone", "LinkedIn", "Twitter", "GitHub", "Facebook", "Homepage", "Whatsapp", "Skype", "Telegram", "Viber", "Profile"];
function generateEventId(id) {
  const bytes = new TextEncoder().encode(id);
  const digits = "0123456789abcdefghijklmnopqrstuv";
  let out = "";
  for (let i = 0; i < bytes.length; i += 5) {
    const b = [0, 1, 2, 3, 4].map((k) => bytes[i + k] ?? 0);
    const octets = [
      b[0] >> 3,
      (b[0] & 7) << 2 | b[1] >> 6,
      b[1] >> 1 & 31,
      (b[1] & 1) << 4 | b[2] >> 4,
      (b[2] & 15) << 1 | b[3] >> 7,
      b[3] >> 2 & 31,
      (b[3] & 3) << 3 | b[4] >> 5,
      b[4] & 31
    ];
    for (const o of octets) out += digits.charAt(o);
  }
  return out;
}
