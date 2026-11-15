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
var cache_exports = {};
__export(cache_exports, {
  cachingClient: () => cachingClient
});
module.exports = __toCommonJS(cache_exports);
var import_txhub = require("./txhub.js");
const CACHED = [
  "core:class:Status",
  "tracker:class:IssueStatus",
  "contact:class:Person",
  "contact:mixin:Employee",
  "contact:class:SocialIdentity",
  "tracker:class:Project",
  "tracker:class:Milestone",
  "tracker:class:Component",
  "tags:class:TagElement"
];
const LINKED = {
  "contact:class:Person": ["contact:mixin:Employee"],
  "contact:mixin:Employee": ["contact:class:Person"],
  "tracker:class:IssueStatus": ["core:class:Status"],
  "core:class:Status": ["tracker:class:IssueStatus"]
};
const MAX_AGE_MS = 10 * 6e4;
const MAX_ENTRIES = 500;
function copy(value) {
  if (!Array.isArray(value)) return value;
  let docs;
  try {
    docs = structuredClone([...value]);
  } catch {
    docs = value.map((d) => ({ ...d }));
  }
  return Object.assign(docs, { total: value.total, lookupMap: value.lookupMap });
}
function cachingClient(raw, env = process.env) {
  const stats = { hits: 0, misses: 0, invalidations: 0 };
  if (["0", "false", "no", "off"].includes(String(env.HULY_CACHE ?? "").toLowerCase())) return Object.assign(raw, { cacheStats: stats });
  const r = raw;
  const entries = /* @__PURE__ */ new Map();
  const derived = (cls, base) => {
    if (cls === base) return true;
    try {
      return r.getHierarchy?.().isDerived(cls, base) === true;
    } catch {
      return false;
    }
  };
  const generation = /* @__PURE__ */ new Map();
  const drop = (cls) => {
    generation.set(cls, (generation.get(cls) ?? 0) + 1);
    if (entries.delete(cls)) stats.invalidations++;
  };
  const invalidate = (tx) => {
    if (tx == null) return;
    for (const inner of tx.txes ?? []) invalidate(inner);
    if (tx.tx != null) invalidate(tx.tx);
    const touched = [tx.objectClass, tx.mixin].filter((c) => typeof c === "string");
    if (touched.length === 0) return;
    for (const c of CACHED) {
      if (touched.some((t) => derived(t, c))) {
        drop(c);
        for (const l of LINKED[c] ?? []) drop(l);
      }
    }
  };
  (0, import_txhub.txHub)(r).listeners.add(invalidate);
  return new Proxy(r, {
    get(target, prop, receiver) {
      if (prop === "cacheStats") return stats;
      if (prop === "__hulyRaw") return target;
      const orig = Reflect.get(target, prop, receiver);
      if (prop === "tx" && typeof orig === "function") {
        return async (tx, ...rest) => {
          try {
            return await orig.call(target, tx, ...rest);
          } finally {
            invalidate(tx);
          }
        };
      }
      if (prop !== "findAll" || typeof orig !== "function") return orig;
      return async (_class, query, options, ...rest) => {
        if (!CACHED.includes(_class) || options?.lookup != null || rest.length > 0) {
          return await orig.call(receiver, _class, query, options, ...rest);
        }
        const key = JSON.stringify([query, options ?? null]);
        const now = Date.now();
        const hit = entries.get(_class)?.get(key);
        if (hit != null && now - hit.at < MAX_AGE_MS) {
          stats.hits++;
          return copy(hit.value);
        }
        stats.misses++;
        const gen = generation.get(_class) ?? 0;
        const value = await orig.call(receiver, _class, query, options);
        if ((generation.get(_class) ?? 0) === gen) {
          if ([...entries.values()].reduce((n, m) => n + m.size, 0) >= MAX_ENTRIES) entries.clear();
          let byQuery = entries.get(_class);
          if (byQuery == null) {
            byQuery = /* @__PURE__ */ new Map();
            entries.set(_class, byQuery);
          }
          byQuery.set(key, { at: now, value });
        }
        return copy(value);
      };
    }
  });
}
