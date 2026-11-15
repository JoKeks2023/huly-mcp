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
var meetings_exports = {};
__export(meetings_exports, {
  LOVE: () => LOVE,
  getMeeting: () => getMeeting,
  listMeetings: () => listMeetings
});
module.exports = __toCommonJS(meetings_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
var import_content = require("../utils/content.js");
var import_people = require("../utils/people.js");
const LOVE = { Room: "love:class:Room", Office: "love:class:Office", Minutes: "love:class:MeetingMinutes", Message: "chunter:class:ChatMessage", Collaborator: "core:class:Collaborator" };
const ROOM_TYPE = ["video", "audio", "reception"];
const ACCESS = ["open", "knock", "do not disturb"];
const when = (ts) => ts == null ? "?" : new Date(ts).toISOString().slice(0, 16).replace("T", " ");
const listMeetings = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const rooms = await client.findAll(LOVE.Room, {});
  const query = {};
  if (args.room != null) {
    const q = args.room.trim().toLowerCase();
    const hits = rooms.filter((r) => r._id === args.room || String(r.name).toLowerCase() === q);
    if (hits.length !== 1) throw new Error(hits.length === 0 ? `Room '${args.room}' not found. Rooms: ${rooms.map((r) => r.name).join(", ")}.` : `Room '${args.room}' is ambiguous.`);
    query.attachedTo = hits[0]._id;
  }
  if (args.since != null) {
    const t = Date.parse(args.since);
    if (Number.isNaN(t)) throw new Error(`since must be a date, got '${args.since}'.`);
    query.createdOn = { $gte: t };
  }
  const minutes = await client.findAll(LOVE.Minutes, query, { sort: { createdOn: import_core.SortingOrder.Descending }, limit: args.limit ?? 20 });
  const roomLines = rooms.filter((r) => r._class !== LOVE.Office || args.includeOffices === true).map((r) => `- ${String(r.name)} (${ROOM_TYPE[r.type] ?? r.type}, ${ACCESS[r.access] ?? r.access}${r.startWithTranscription === true ? ", transcribed" : ""}) \xB7 ${Number(r.meetings ?? 0)} meeting(s)`);
  const out = [`## Rooms (${roomLines.length})`, ...roomLines, "", `## Meetings (${minutes.length})`];
  if (minutes.length === 0) out.push("No meeting minutes yet.");
  for (const m of minutes) {
    const room = rooms.find((r) => r._id === m.attachedTo);
    const dur = m.meetingEnd != null ? ` \u2013 ${when(m.meetingEnd).slice(11)}` : m.status === 0 ? " (running)" : "";
    out.push(`- **${String(m.title)}** \xB7 ${String(room?.name ?? "?")} \xB7 ${when(m.createdOn)}${dur} \xB7 ${Number(m.transcription ?? 0)} transcript line(s), ${Number(m.todos ?? 0)} action item(s) \u2014 \`${String(m._id)}\``);
  }
  return out.join("\n");
});
const getMeeting = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const m = await client.findOne(LOVE.Minutes, { _id: args.id });
  if (m == null) throw new Error(`Meeting '${args.id}' not found (ids come from list_meetings).`);
  const room = await client.findOne(LOVE.Room, { _id: m.attachedTo });
  const [collabs, todos, lines] = await Promise.all([
    client.findAll(LOVE.Collaborator, { attachedTo: m._id }),
    client.findAll("time:class:ToDo", { attachedTo: m._id }),
    args.transcript === false ? Promise.resolve([]) : client.findAll(LOVE.Message, { attachedTo: m._id, collection: "transcription" }, { sort: { createdOn: import_core.SortingOrder.Ascending }, limit: args.limit ?? 500 })
  ]);
  const persons = collabs.length > 0 ? await client.findAll("contact:class:Person", { personUuid: { $in: collabs.map((c) => c.collaborator) } }) : [];
  const speakers = await (0, import_people.socialIdNames)(client, [...new Set(lines.map((l) => l.createdBy).filter((x) => x != null))]);
  const notes = await (0, import_content.readMarkup)(args.workspace, m.description);
  const out = [
    `## ${String(m.title)}`,
    `**Room:** ${String(room?.name ?? "?")} \xB7 **Start:** ${when(m.createdOn)} \xB7 **End:** ${m.meetingEnd != null ? when(m.meetingEnd) : m.status === 0 ? "running" : "?"}`,
    `**Participants:** ${persons.length > 0 ? persons.map((p) => String(p.name).split(",").reverse().join(" ").trim()).join(", ") : `${collabs.length}`}`
  ];
  if (notes.trim() !== "") out.push("", "### Notes", notes.trim());
  if (todos.length > 0) out.push("", "### Action items", ...todos.map((t) => `- [${t.doneOn != null ? "x" : " "}] ${String(t.title)}`));
  if (args.transcript !== false) {
    out.push("", `### Transcript (${lines.length}${lines.length === (args.limit ?? 500) ? "+" : ""})`);
    if (lines.length === 0) out.push("_(none)_");
    for (const l of lines) out.push(`[${when(l.createdOn).slice(11)}] **${speakers.get(l.createdBy) ?? "?"}:** ${(0, import_format.markupToText)(l.message).trim()}`);
  }
  return out.join("\n");
});
