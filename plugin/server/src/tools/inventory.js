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
var inventory_exports = {};
__export(inventory_exports, {
  INV: () => INV,
  createInventoryCategory: () => createInventoryCategory,
  createInventoryProduct: () => createInventoryProduct,
  deleteInventoryItem: () => deleteInventoryItem,
  listInventory: () => listInventory,
  updateInventoryItem: () => updateInventoryItem
});
module.exports = __toCommonJS(inventory_exports);
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
const INV = {
  Category: "inventory:class:Category",
  Product: "inventory:class:Product",
  Variant: "inventory:class:Variant",
  Root: "inventory:global:Category",
  Space: "core:space:Workspace"
};
async function findOneOf(client, cls, ref, what, query = {}) {
  const all = await client.findAll(cls, query);
  const hits = all.filter((d) => d._id === ref || String(d.name).toLowerCase() === ref.trim().toLowerCase());
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) throw new Error(`${what} '${ref}' not found.`);
  throw new Error(`${what} '${ref}' is ambiguous \u2014 pass its id.`);
}
const listInventory = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const [cats, products, variants] = await Promise.all([client.findAll(INV.Category, {}), client.findAll(INV.Product, {}), client.findAll(INV.Variant, {})]);
  if (cats.length === 0 && products.length === 0) return "Inventory is empty (or the module is not enabled).";
  const lines = [];
  const walk = (parent, depth) => {
    for (const c of cats.filter((x) => x.attachedTo === parent).sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
      lines.push(`${"  ".repeat(depth)}- \u{1F4C1} **${String(c.name)}** \u2014 \`${String(c._id)}\``);
      for (const p of products.filter((x) => x.attachedTo === c._id)) {
        const vs = variants.filter((v) => v.attachedTo === p._id).map((v) => `${String(v.name)} (${String(v.sku)})`);
        lines.push(`${"  ".repeat(depth + 1)}- ${String(p.name)}${vs.length > 0 ? ` \u2014 ${vs.join(", ")}` : ""} \u2014 \`${String(p._id)}\``);
      }
      walk(c._id, depth + 1);
    }
  };
  walk(INV.Root, 0);
  return `## Inventory (${cats.length} categories, ${products.length} products, ${variants.length} variants)

${lines.join("\n")}`;
});
const createInventoryCategory = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const parent = args.parent != null ? (await findOneOf(client, INV.Category, args.parent, "Category"))._id : INV.Root;
  const id = await client.addCollection(INV.Category, INV.Space, parent, INV.Category, "categories", { name: args.name.trim() });
  return `\u2705 Category **${args.name}** created \u2014 \`${String(id)}\``;
});
const createInventoryProduct = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const cat = await findOneOf(client, INV.Category, args.category, "Category");
  const id = await client.addCollection(INV.Product, INV.Space, cat._id, INV.Category, "products", { name: args.name.trim() });
  for (const v of args.variants ?? []) await client.addCollection(INV.Variant, INV.Space, id, INV.Product, "variants", { name: v.name.trim(), sku: v.sku.trim() });
  return `\u2705 Product **${args.name}** in ${String(cat.name)}${(args.variants ?? []).length > 0 ? ` with ${(args.variants ?? []).length} variant(s)` : ""} \u2014 \`${String(id)}\``;
});
const updateInventoryItem = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const doc = await client.findOne(INV.Category, { _id: args.id }) ?? await client.findOne(INV.Product, { _id: args.id }) ?? await client.findOne(INV.Variant, { _id: args.id });
  if (doc == null) throw new Error(`Inventory item '${args.id}' not found (ids come from list_inventory).`);
  const update = {};
  if (args.name != null) update.name = args.name.trim();
  if (args.sku != null) {
    if (doc._class !== INV.Variant) throw new Error("Only variants have a SKU.");
    update.sku = args.sku.trim();
  }
  if (args.category != null) {
    if (doc._class !== INV.Product) throw new Error("Only products can move to another category.");
    update.attachedTo = (await findOneOf(client, INV.Category, args.category, "Category"))._id;
  }
  if (Object.keys(update).length === 0) throw new Error("Nothing to change.");
  await client.updateDoc(doc._class, doc.space, doc._id, update);
  return `\u2705 ${String(update.name ?? doc.name)} updated: ${Object.keys(update).map((k) => k === "attachedTo" ? "category" : k).join(", ")}.`;
});
const deleteInventoryItem = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const doc = await client.findOne(INV.Category, { _id: args.id }) ?? await client.findOne(INV.Product, { _id: args.id }) ?? await client.findOne(INV.Variant, { _id: args.id });
  if (doc == null) throw new Error(`Inventory item '${args.id}' not found (ids come from list_inventory).`);
  const children = doc._class === INV.Category ? [...await client.findAll(INV.Category, { attachedTo: doc._id }), ...await client.findAll(INV.Product, { attachedTo: doc._id })] : doc._class === INV.Product ? await client.findAll(INV.Variant, { attachedTo: doc._id }) : [];
  if (children.length > 0 && args.recursive !== true) throw new Error(`${String(doc.name)} still contains ${children.length} item(s) \u2014 pass recursive=true to delete them too.`);
  const remove = async (d) => {
    let n2 = 0;
    const kids = d._class === INV.Category ? [...await client.findAll(INV.Category, { attachedTo: d._id }), ...await client.findAll(INV.Product, { attachedTo: d._id })] : d._class === INV.Product ? await client.findAll(INV.Variant, { attachedTo: d._id }) : [];
    for (const k of kids) n2 += await remove(k);
    await client.removeCollection(d._class, d.space, d._id, d.attachedTo, d.attachedToClass, d.collection);
    return n2 + 1;
  };
  const n = await remove(doc);
  return `\u{1F5D1}\uFE0F ${String(doc.name)} deleted${n > 1 ? ` (with ${n - 1} item(s) inside)` : ""}.`;
});
