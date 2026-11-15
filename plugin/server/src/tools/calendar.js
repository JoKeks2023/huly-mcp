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
var calendar_exports = {};
__export(calendar_exports, {
  createEvent: () => createEvent,
  deleteEvent: () => deleteEvent,
  listEvents: () => listEvents,
  updateEvent: () => updateEvent
});
module.exports = __toCommonJS(calendar_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_classes = require("../utils/classes.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
var import_planner = require("./planner.js");
var import_resolve = require("../utils/resolve.js");
const DAY = 864e5;
const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
function parse(value, label) {
  const t = new Date(value).getTime();
  if (isNaN(t)) throw new Error(`Invalid ${label}: '${value}'`);
  return t;
}
const fmt = (ts, allDay) => allDay ? new Date(ts).toISOString().slice(0, 10) : new Date(ts).toISOString().slice(0, 16).replace("T", " ");
async function findEvent(client, id) {
  const ev = await client.findOne(import_classes.C.Event, { _id: id });
  if (ev == null) throw new Error(`Event '${id}' not found.`);
  return ev;
}
const listEvents = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const from = args.from != null ? parse(args.from, "from") : new Date((/* @__PURE__ */ new Date()).toISOString().slice(0, 10)).getTime();
  const to = args.to != null ? parse(args.to, "to") + (BARE_DATE.test(args.to) ? DAY - 1 : 0) : from + 7 * DAY - 1;
  const events = await client.findAll(import_classes.C.Event, { date: { $lte: to }, dueDate: { $gte: from } }, { sort: { date: import_core.SortingOrder.Ascending }, limit: args.limit });
  if (events.length === 0) return `No events between ${fmt(from, true)} and ${fmt(to, true)}.`;
  const names = await (0, import_people.peopleNames)(client);
  const lines = [];
  for (const e of events) {
    const span = e.allDay === true ? `${fmt(e.date, true)} (all day)` : `${fmt(e.date, false)}\u2013${new Date(e.dueDate).toISOString().slice(11, 16)}`;
    const kind = e._class === import_classes.C.WorkSlot ? ` \xB7 work slot for ${await (0, import_resolve.loadLabel)(client, e.attachedToClass, e.attachedTo)}` : "";
    const where = e.location != null && e.location !== "" ? ` \xB7 \u{1F4CD} ${e.location}` : "";
    const who = (e.participants ?? []).length > 1 ? ` \xB7 ${e.participants.map((p) => names.get(p) ?? p).join(", ")}` : "";
    lines.push(`- ${span} **${e.title}**${where}${kind}${who} \u2014 \`${e._id}\``);
  }
  return `## Events ${fmt(from, true)} \u2013 ${fmt(to, true)} (${events.length}, times UTC)

${lines.join("\n")}`;
});
const createEvent = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const me = await (0, import_people.currentPerson)(client);
  let date = parse(args.start, "start");
  let dueDate = args.end != null ? parse(args.end, "end") : date + 36e5;
  if (args.allDay) {
    date = new Date(new Date(date).toISOString().slice(0, 10)).getTime();
    dueDate = (args.end != null ? new Date(new Date(dueDate).toISOString().slice(0, 10)).getTime() : date) + DAY - 1;
  }
  if (dueDate < date) throw new Error("end must be after start.");
  const participants = [me._id];
  for (const name of args.participants ?? []) {
    const p = await (0, import_people.findPerson)(client, name);
    if (!participants.includes(p._id)) participants.push(p._id);
  }
  const id = (0, import_core.generateId)();
  await client.addCollection(import_classes.C.Event, import_classes.IDS.CalendarSpace, import_classes.IDS.EventNotAttached, import_classes.C.Event, "events", {
    calendar: await (0, import_planner.primaryCalendar)(client),
    eventId: (0, import_classes.generateEventId)(id),
    date,
    dueDate,
    externalParticipants: [],
    description: (0, import_format.textToMarkup)(args.description ?? null),
    visibility: "public",
    participants,
    reminders: [],
    title: args.title,
    location: args.location ?? "",
    blockTime: !args.allDay,
    allDay: args.allDay,
    timeZone: "UTC",
    access: "owner",
    user: client.user
  }, id);
  return `\u2705 Event **${args.title}** on ${fmt(date, args.allDay)}${args.allDay ? "" : " UTC"} created (id: \`${id}\`).`;
});
const updateEvent = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const ev = await findEvent(client, args.eventId);
  const updates = {};
  if (args.title !== void 0) updates.title = args.title;
  if (args.location !== void 0) updates.location = args.location;
  if (args.description !== void 0) updates.description = (0, import_format.textToMarkup)(args.description);
  if (args.start !== void 0) {
    const start = parse(args.start, "start");
    updates.date = start;
    if (args.end === void 0) updates.dueDate = start + (ev.dueDate - ev.date);
  }
  if (args.end !== void 0) updates.dueDate = parse(args.end, "end");
  if ((updates.dueDate ?? ev.dueDate) < (updates.date ?? ev.date)) throw new Error("end must be after start.");
  if (Object.keys(updates).length === 0) return `Nothing to update for **${ev.title}**.`;
  await client.update(ev, updates);
  return `\u2705 Event **${updates.title ?? ev.title}** updated (${Object.keys(updates).join(", ")}).`;
});
const deleteEvent = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const ev = await findEvent(client, args.eventId);
  await client.removeCollection(ev._class, ev.space, ev._id, ev.attachedTo, ev.attachedToClass, ev.collection);
  return `\u{1F5D1}\uFE0F Event **${ev.title}** deleted.`;
});
