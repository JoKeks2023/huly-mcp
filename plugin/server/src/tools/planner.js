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
var planner_exports = {};
__export(planner_exports, {
  createTodo: () => createTodo,
  deleteTodo: () => deleteTodo,
  listTodos: () => listTodos,
  primaryCalendar: () => primaryCalendar,
  scheduleTodo: () => scheduleTodo,
  updateTodo: () => updateTodo
});
module.exports = __toCommonJS(planner_exports);
var import_tracker = __toESM(require("../../vendor/@hcengineering/tracker/lib/index.js"));
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_rank = require("../../vendor/@hcengineering/rank/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_classes = require("../utils/classes.js");
var import_format = require("../utils/format.js");
var import_people = require("../utils/people.js");
var import_resolve = require("../utils/resolve.js");
function parseDate(value, label = "date") {
  const t = new Date(value).getTime();
  if (isNaN(t)) throw new Error(`Invalid ${label}: '${value}'`);
  return t;
}
async function findTodo(client, todoId) {
  const todo = await client.findOne(import_classes.C.ToDo, { _id: todoId });
  if (todo == null) throw new Error(`To-do '${todoId}' not found.`);
  return todo;
}
async function primaryCalendar(client) {
  const uuid = await (0, import_people.currentAccountUuid)(client);
  const own = `${uuid}_calendar`;
  if (await client.findOne(import_classes.C.Calendar, { _id: own }) != null) return own;
  const any = await client.findOne(import_classes.C.Calendar, { hidden: false });
  if (any == null) throw new Error("No calendar found for the current user.");
  return any._id;
}
const listTodos = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const me = await (0, import_people.currentPerson)(client);
  const query = { user: me._id };
  if (args.status === "open") query.doneOn = null;
  let todos = await client.findAll(import_classes.C.ToDo, query, { sort: { rank: import_core.SortingOrder.Ascending } });
  if (args.status === "done") todos = todos.filter((t) => t.doneOn != null).sort((a, b) => b.doneOn - a.doneOn);
  if (args.dueBefore != null) {
    const limit = parseDate(args.dueBefore, "dueBefore") + 864e5 - 1;
    todos = todos.filter((t) => t.dueDate != null && t.dueDate <= limit);
  }
  const total = todos.length;
  todos = todos.slice(0, args.limit);
  if (todos.length === 0) return `No ${args.status === "all" ? "" : args.status + " "}to-dos.`;
  const lines = [];
  for (const t of todos) {
    const done = t.doneOn != null ? `[x] (done ${(0, import_format.formatDate)(t.doneOn)})` : "[ ]";
    const due = t.dueDate != null ? ` \xB7 due ${(0, import_format.formatDate)(t.dueDate)}` : "";
    const prio = t.priority !== import_classes.TODO_PRIORITY.NoPriority ? ` \xB7 ${import_classes.TODO_PRIORITY_LABEL[t.priority] ?? t.priority}` : "";
    const link = t.attachedTo !== import_classes.IDS.ToDoNotAttached ? ` \xB7 ${await (0, import_resolve.loadLabel)(client, t.attachedToClass, t.attachedTo)}` : "";
    const slots = (t.workslots ?? 0) > 0 ? ` \xB7 ${t.workslots} slot(s)` : "";
    lines.push(`- ${done} **${t.title}**${prio}${due}${link}${slots} \u2014 \`${t._id}\``);
  }
  return `## To-dos (${args.status}, ${total})

${lines.join("\n")}${total > todos.length ? `

_${total - todos.length} more (raise limit)._` : ""}`;
});
const createTodo = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const me = await (0, import_people.currentPerson)(client);
  const latest = await client.findOne(import_classes.C.ToDo, { user: me._id, doneOn: null }, { sort: { rank: import_core.SortingOrder.Ascending } });
  const data = {
    title: args.title,
    description: (0, import_format.textToMarkup)(args.description ?? null),
    user: me._id,
    workslots: 0,
    doneOn: null,
    priority: import_classes.TODO_PRIORITY[args.priority],
    rank: (0, import_rank.makeRank)(void 0, latest?.rank)
  };
  if (args.dueDate != null) data.dueDate = parseDate(args.dueDate, "dueDate");
  const id = (0, import_core.generateId)();
  if (args.issue != null) {
    const issue = await client.findOne(import_tracker.default.class.Issue, { identifier: args.issue });
    if (issue == null) throw new Error(`Issue '${args.issue}' not found.`);
    await client.addCollection(import_classes.C.ProjectToDo, import_classes.IDS.ToDosSpace, issue._id, import_tracker.default.class.Issue, "todos", { ...data, attachedSpace: issue.space, visibility: "public" }, id);
    return `\u2705 To-do **${args.title}** created on ${args.issue} (id: \`${id}\`).`;
  }
  await client.addCollection(import_classes.C.ToDo, import_classes.IDS.ToDosSpace, import_classes.IDS.ToDoNotAttached, import_classes.C.ToDo, "todos", { ...data, visibility: "private" }, id);
  return `\u2705 To-do **${args.title}** created (id: \`${id}\`).`;
});
const updateTodo = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const todo = await findTodo(client, args.todoId);
  const updates = {};
  if (args.title !== void 0) updates.title = args.title;
  if (args.description !== void 0) updates.description = (0, import_format.textToMarkup)(args.description);
  if (args.dueDate !== void 0) updates.dueDate = args.dueDate === null ? null : parseDate(args.dueDate, "dueDate");
  if (args.priority !== void 0) updates.priority = import_classes.TODO_PRIORITY[args.priority];
  if (args.done !== void 0 && args.done !== (todo.doneOn != null)) updates.doneOn = args.done ? Date.now() : null;
  if (Object.keys(updates).length === 0) return `Nothing to update for **${todo.title}**.`;
  await client.update(todo, updates);
  return `\u2705 To-do **${updates.title ?? todo.title}** updated (${Object.keys(updates).map((k) => k === "doneOn" ? args.done === true ? "done" : "reopened" : k).join(", ")}).`;
});
const deleteTodo = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const todo = await findTodo(client, args.todoId);
  await client.removeCollection(todo._class, todo.space, todo._id, todo.attachedTo, todo.attachedToClass, todo.collection);
  return `\u{1F5D1}\uFE0F To-do **${todo.title}** deleted.`;
});
const scheduleTodo = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const todo = await findTodo(client, args.todoId);
  const me = await (0, import_people.currentPerson)(client);
  const date = parseDate(args.start, "start");
  const dueDate = date + args.durationMinutes * 6e4;
  const id = (0, import_core.generateId)();
  await client.addCollection(import_classes.C.WorkSlot, import_classes.IDS.CalendarSpace, todo._id, todo._class, "workslots", {
    eventId: (0, import_classes.generateEventId)(id),
    date,
    dueDate,
    calendar: await primaryCalendar(client),
    description: todo.description ?? "",
    participants: [me._id],
    title: todo.title,
    blockTime: true,
    allDay: false,
    access: "owner",
    user: client.user,
    visibility: todo.visibility === "public" ? "public" : "freeBusy",
    reminders: []
  }, id);
  return `\u2705 **${todo.title}** scheduled ${new Date(date).toISOString().slice(0, 16).replace("T", " ")} UTC for ${args.durationMinutes} min (slot \`${id}\`).`;
});
