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
var cards_exports = {};
__export(cards_exports, {
  createCard: () => createCard,
  createCardType: () => createCardType,
  deleteCard: () => deleteCard,
  deleteCardType: () => deleteCardType,
  getCard: () => getCard,
  listCardTypes: () => listCardTypes,
  listCards: () => listCards,
  updateCard: () => updateCard
});
module.exports = __toCommonJS(cards_exports);
var import_core = require("../../vendor/@hcengineering/core/lib/index.js");
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_classes = require("../utils/classes.js");
var import_content = require("../utils/content.js");
var import_attributes = require("../utils/attributes.js");
const CLASS = 0;
const MIXIN = 2;
function cardTypes(client) {
  const h = client.getHierarchy();
  return h.getDescendants(import_classes.C.Card).filter((id) => id !== import_classes.C.Card).map((id) => h.getClass(id)).map((c) => ({ _id: c._id, label: (0, import_attributes.labelText)(c.label), kind: c.kind, extends: c.extends, removed: c.removed })).filter((t) => t.removed !== true);
}
function resolveType(client, ref, kind) {
  const types = cardTypes(client).filter((t) => t.kind === kind);
  const k = ref.trim().toLowerCase();
  const hits = types.filter((t) => t._id.toLowerCase() === k || t.label.toLowerCase() === k);
  const what = kind === MIXIN ? "Card tag" : "Card type";
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw new Error(`${what} '${ref}' is ambiguous: ${hits.map((t) => t._id).join(", ")}.`);
  throw new Error(`${what} '${ref}' not found. Available: ${types.map((t) => t.label).join(", ")}.`);
}
async function findCard(client, id) {
  const card = await client.findOne(import_classes.C.Card, { _id: id });
  if (card == null) throw new Error(`Card '${id}' not found.`);
  return card;
}
const parentChain = (parent) => [...parent.parentInfo ?? [], { _id: parent._id, _class: parent._class, title: parent.title }];
const listCardTypes = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const types = cardTypes(client);
  const masters = types.filter((t) => t.kind === CLASS);
  const lines = masters.map((t) => {
    const tags = types.filter((x) => x.kind === MIXIN && x.extends === t._id).map((x) => x.label);
    const sub = t.extends != null && t.extends !== import_classes.C.Card ? ` (subtype of ${(0, import_attributes.labelText)(client.getHierarchy().getClass(t.extends).label)})` : "";
    return `- **${t.label}**${sub} \u2014 \`${t._id}\`${tags.length > 0 ? `
  tags: ${tags.join(", ")}` : ""}`;
  });
  return `## Card types (${masters.length})

${lines.join("\n")}`;
});
const listCards = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const _class = args.type != null ? resolveType(client, args.type, CLASS)._id : import_classes.C.Card;
  const query = {};
  if (args.parentId !== void 0) query.parent = args.parentId;
  let cards = await client.findAll(_class, query, { sort: { modifiedOn: import_core.SortingOrder.Descending }, limit: args.query != null ? 1e3 : args.limit });
  cards = cards.filter((c) => c.isLatest !== false);
  if (args.query != null) cards = cards.filter((c) => String(c.title ?? "").toLowerCase().includes(args.query.toLowerCase())).slice(0, args.limit);
  if (cards.length === 0) return "No cards found.";
  const h = client.getHierarchy();
  const lines = cards.map((c) => {
    let type = c._class;
    try {
      type = (0, import_attributes.labelText)(h.getClass(c._class).label);
    } catch {
    }
    const parent = (c.parentInfo ?? []).length > 0 ? ` \xB7 in ${c.parentInfo.map((p) => p.title).join(" \u203A ")}` : "";
    return `- **${String(c.title ?? "(untitled)").trim()}** [${type}]${parent} \u2014 \`${c._id}\``;
  });
  return `## Cards (${cards.length})

${lines.join("\n")}`;
});
const getCard = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const card = await findCard(client, args.cardId);
  const h = client.getHierarchy();
  const typeLabel = (0, import_attributes.labelText)(h.getClass(card._class).label);
  const tags = cardTypes(client).filter((t) => t.kind === MIXIN && card[t._id] != null).map((t) => t.label);
  const fields = await (0, import_attributes.fieldsOf)(client, card);
  const children = await client.findAll(import_classes.C.Card, { parent: card._id }, { limit: 50 });
  const lines = [
    `## ${String(card.title).trim()}`,
    "",
    `**Type:** ${typeLabel} (\`${card._class}\`)`,
    `**Id:** \`${card._id}\``
  ];
  if ((card.parentInfo ?? []).length > 0) lines.push(`**Parent:** ${card.parentInfo.map((p) => `${String(p.title)} (\`${String(p._id)}\`)`).join(" \u203A ")}`);
  if (tags.length > 0) lines.push(`**Tags:** ${tags.join(", ")}`);
  for (const f of fields) lines.push(`**${f.label}:** ${(0, import_attributes.showValue)(f, (0, import_attributes.valueOf)(card, f))}`);
  if (children.length > 0) lines.push("", `### Child cards (${children.length})`, ...children.map((c) => `- ${String(c.title).trim()} \u2014 \`${c._id}\``));
  const body = await (0, import_content.readMarkup)(args.workspace, card.content);
  lines.push("", "### Content", body !== "" ? body : "_(empty)_");
  return lines.join("\n");
});
async function fieldValues(client, card, values) {
  if (values == null) return [];
  const fields = await (0, import_attributes.fieldsOf)(client, card);
  const out = [];
  for (const [key, raw] of Object.entries(values)) {
    const field = (0, import_attributes.findField)(fields, key);
    out.push({ field, value: await (0, import_attributes.coerceValue)(client, field, raw) });
  }
  return out;
}
const createCard = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const type = resolveType(client, args.type, CLASS);
  const h = client.getHierarchy();
  if (h.getClass(type._id).baseType === true && cardTypes(client).some((t) => t.kind === CLASS && t.extends === type._id)) {
    throw new Error(`'${type.label}' is a base type with subtypes \u2014 pick one of its subtypes.`);
  }
  const parent = args.parentId != null ? await findCard(client, args.parentId) : void 0;
  const tags = (args.tags ?? []).map((t) => resolveType(client, t, MIXIN));
  const space = parent?.space ?? args.space ?? import_classes.IDS.CardDefaultSpace;
  const _id = (0, import_core.generateId)();
  const draft = { _id, _class: type._id, space, ...Object.fromEntries(tags.map((t) => [t._id, {}])) };
  const values = await fieldValues(client, draft, args.fields);
  const content = args.content != null && args.content !== "" ? await (0, import_content.writeMarkup)(args.workspace, `card-${_id}`, args.content) : "";
  const data = { title: args.title, rank: "", content, blobs: {}, parentInfo: parent != null ? parentChain(parent) : [] };
  if (parent != null) data.parent = parent._id;
  for (const { field, value } of values) if (!field.ownerIsMixin) data[field.name] = value;
  await client.createDoc(type._id, space, data, _id);
  for (const tag of tags) {
    const tagValues = Object.fromEntries(values.filter((v) => v.field.owner === tag._id).map((v) => [v.field.name, v.value]));
    await client.createMixin(_id, type._id, space, tag._id, tagValues);
  }
  return `\u2705 Card **${args.title}** [${type.label}] created \u2014 \`${_id}\`${parent != null ? ` under "${String(parent.title)}"` : ""}.`;
});
const updateCard = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const card = await findCard(client, args.cardId);
  const tags = (args.addTags ?? []).map((t) => resolveType(client, t, MIXIN));
  const withTags = { ...card, ...Object.fromEntries(tags.filter((t) => card[t._id] == null).map((t) => [t._id, {}])) };
  const values = await fieldValues(client, withTags, args.fields);
  let parent;
  if (args.parentId != null) {
    parent = await findCard(client, args.parentId);
    if (parent._id === card._id || (parent.parentInfo ?? []).some((p) => p._id === card._id)) throw new Error("A card cannot be moved under itself or one of its children.");
  }
  const done = [];
  const update = {};
  if (args.title != null) {
    update.title = args.title;
    done.push("title");
  }
  if (args.content != null) {
    update.content = await (0, import_content.writeMarkup)(args.workspace, `card-${String(card._id)}`, args.content);
    done.push("content");
  }
  if (args.parentId !== void 0) {
    update.parent = parent?._id ?? null;
    update.parentInfo = parent != null ? parentChain(parent) : [];
    done.push(parent != null ? `moved under "${String(parent.title)}"` : "moved to top level");
  }
  if (Object.keys(update).length > 0) await client.updateDoc(card._class, card.space, card._id, update);
  for (const tag of tags) if (card[tag._id] == null) {
    await client.createMixin(card._id, card._class, card.space, tag._id, {});
    done.push(`tag ${tag.label}`);
  }
  if (values.length > 0) {
    await (0, import_attributes.writeFields)(client, withTags, values);
    done.push(...values.map((v) => v.field.label));
  }
  if (args.parentId !== void 0) {
    const self = { ...card, ...update };
    let level = [self];
    for (let depth = 0; depth < 20 && level.length > 0; depth++) {
      const next = [];
      for (const p of level) {
        const kids = await client.findAll(import_classes.C.Card, { parent: p._id });
        for (const k of kids) {
          const parentInfo = parentChain(p);
          await client.updateDoc(k._class, k.space, k._id, { parentInfo });
          next.push({ ...k, parentInfo });
        }
      }
      level = next;
    }
  }
  if (done.length === 0) return "Nothing to change.";
  return `\u2705 Card **${String(args.title ?? card.title).trim()}** updated: ${done.join(", ")}.`;
});
const deleteCard = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const card = await findCard(client, args.cardId);
  const children = await client.findAll(import_classes.C.Card, { parent: card._id }, { limit: 1 });
  if (children.length > 0) throw new Error(`Card "${String(card.title)}" has child cards \u2014 move or delete them first.`);
  await client.removeDoc(card._class, card.space, card._id);
  return `\u2705 Card **${String(card.title).trim()}** deleted.`;
});
const createCardType = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const isTag = args.kind === "tag";
  if (isTag && args.parentType == null) throw new Error("A tag belongs to a card type: pass parentType.");
  const parent = args.parentType != null ? resolveType(client, args.parentType, CLASS) : void 0;
  const existing = cardTypes(client).find((t) => t.label.toLowerCase() === args.name.toLowerCase() && t.kind === (isTag ? MIXIN : CLASS));
  if (existing != null) return `\u2139\uFE0F ${isTag ? "Tag" : "Card type"} **${existing.label}** already exists \u2014 \`${existing._id}\`.`;
  const id = await client.createDoc(isTag ? import_classes.C.CardTag : import_classes.C.MasterTag, "core:space:Model", {
    extends: parent?._id ?? import_classes.C.Card,
    label: (0, import_attributes.embeddedLabel)(args.name),
    kind: isTag ? MIXIN : CLASS,
    icon: isTag ? "card:icon:Tag" : "card:icon:MasterTag"
  });
  return `\u2705 ${isTag ? `Tag **${args.name}** for ${parent.label}` : `Card type **${args.name}**`} created \u2014 \`${String(id)}\`. Add fields with create_custom_field.`;
});
const deleteCardType = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const all = cardTypes(client);
  const k = args.type.trim().toLowerCase();
  const hits = all.filter((t) => t._id.toLowerCase() === k || t.label.toLowerCase() === k);
  if (hits.length !== 1) throw new Error(hits.length === 0 ? `Card type or tag '${args.type}' not found.` : `'${args.type}' is ambiguous: ${hits.map((t) => t._id).join(", ")}.`);
  const type = hits[0];
  const cards = await client.findAll(type._id, {}, { limit: 1 });
  if (cards.length > 0) throw new Error(`'${type.label}' still has cards \u2014 delete or retype them first.`);
  if (type.kind === CLASS) await client.updateDoc(import_classes.C.MasterTag, "core:space:Model", type._id, { removed: true });
  else await client.removeDoc(import_classes.C.CardTag, "core:space:Model", type._id);
  return `\u2705 ${type.kind === CLASS ? "Card type" : "Tag"} **${type.label}** deleted.`;
});
