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
var products_exports = {};
__export(products_exports, {
  getProduct: () => getProduct,
  listProducts: () => listProducts
});
module.exports = __toCommonJS(products_exports);
var import_connection = require("../connection.js");
var import_errors = require("../utils/errors.js");
var import_format = require("../utils/format.js");
const P = { Product: "products:class:Product", Version: "products:class:ProductVersion", NoParent: "products:ids:NoParentVersion" };
const STATE = ["Active", "Released"];
const versionName = (v) => `${String(v.major)}.${String(v.minor)}.${String(v.patch)}${v.codename != null && v.codename !== "" ? ` "${String(v.codename)}"` : ""}`;
const listProducts = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const products = await client.findAll(P.Product, { archived: false });
  if (products.length === 0) return "No products.";
  const lines = [];
  for (const p of products) {
    const versions = await client.findAll(P.Version, { space: p._id });
    const active = versions.filter((v) => v.state === 0).map(versionName);
    lines.push(`- **${String(p.name)}** \u2014 ${versions.length} version(s)${active.length > 0 ? `, active: ${active.join(", ")}` : ""} \u2014 \`${String(p._id)}\``);
  }
  return `## Products (${products.length})

${lines.join("\n")}`;
});
const getProduct = (0, import_errors.wrapToolHandler)(async (args) => {
  const client = await (0, import_connection.getConnection)(args.workspace);
  const all = await client.findAll(P.Product, {});
  const hits = all.filter((p2) => p2._id === args.product || String(p2.name).toLowerCase() === args.product.toLowerCase());
  if (hits.length !== 1) throw new Error(hits.length === 0 ? `Product '${args.product}' not found.` : `Product '${args.product}' is ambiguous.`);
  const p = hits[0];
  const versions = await client.findAll(P.Version, { space: p._id });
  versions.sort((a, b) => b.major - a.major || b.minor - a.minor || b.patch - a.patch);
  const lines = [`## ${String(p.name)}`, "", `**Id:** \`${String(p._id)}\``];
  const desc = [p.description, (0, import_format.markupToText)(p.fullDescription)].filter((x) => x != null && x !== "").join("\n\n");
  if (desc !== "") lines.push("", desc);
  lines.push("", `### Versions (${versions.length})`);
  for (const v of versions) {
    const d = (0, import_format.markupToText)(v.description);
    lines.push(`- **${versionName(v)}** \u2014 ${STATE[v.state] ?? String(v.state)}${v.readonly === true ? ", read-only" : ""} \xB7 ${(0, import_format.formatDate)(v.createdOn)}${d !== "" ? `
  ${d.replace(/\n/g, " ").slice(0, 200)}` : ""}`);
  }
  return lines.join("\n");
});
