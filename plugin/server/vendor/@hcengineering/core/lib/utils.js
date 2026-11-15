"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
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
var utils_exports = {};
__export(utils_exports, {
  AggregateValue: () => AggregateValue,
  AggregateValueData: () => AggregateValueData,
  DocManager: () => DocManager,
  RateLimiter: () => RateLimiter,
  TimeRateLimiter: () => TimeRateLimiter,
  buildSocialIdString: () => buildSocialIdString,
  checkForbiddenPermission: () => checkForbiddenPermission,
  checkPermission: () => checkPermission,
  combineAttributes: () => combineAttributes,
  concatLink: () => concatLink,
  cutObjectArray: () => cutObjectArray,
  docKey: () => docKey,
  escapeLikeForRegexp: () => escapeLikeForRegexp,
  fillConfiguration: () => fillConfiguration,
  fillDefaults: () => fillDefaults,
  generateId: () => generateId,
  generateUuid: () => generateUuid,
  getBranding: () => getBranding,
  getCurrentAccount: () => getCurrentAccount,
  getFullTextContext: () => getFullTextContext,
  getFullTextIndexableAttributes: () => getFullTextIndexableAttributes,
  getRoleAttributeLabel: () => getRoleAttributeLabel,
  hasAccountRole: () => hasAccountRole,
  includesAny: () => includesAny,
  isClassIndexable: () => isClassIndexable,
  isEnum: () => isEnum,
  isFullTextAttribute: () => isFullTextAttribute,
  isId: () => isId,
  isIndexedAttribute: () => isIndexedAttribute,
  isOwnerOrMaintainer: () => isOwnerOrMaintainer,
  isWorkspaceCreating: () => isWorkspaceCreating,
  loginSocialTypes: () => loginSocialTypes,
  mergeQueries: () => mergeQueries,
  notEmpty: () => notEmpty,
  parseSocialIdString: () => parseSocialIdString,
  pickPrimarySocialId: () => pickPrimarySocialId,
  platformNow: () => import_measurements.platformNow,
  platformNowDiff: () => import_measurements.platformNowDiff,
  pluginFilterTx: () => pluginFilterTx,
  reduceCalls: () => reduceCalls,
  setCurrentAccount: () => setCurrentAccount,
  toFindResult: () => toFindResult,
  toIdMap: () => toIdMap,
  toRank: () => toRank,
  unique: () => unique,
  uniqueNotEmpty: () => uniqueNotEmpty
});
module.exports = __toCommonJS(utils_exports);
var import_platform = require("../../platform/lib/index.js");
var import_fast_equals = require("../../../fast-equals/dist/cjs/index.cjs");
var import_benchmark = require("./benchmark.js");
var import_classes = require("./classes.js");
var import_component = __toESM(require("./component.js"));
var import_predicate = require("./predicate.js");
var import_tx = require("./tx.js");
var import_measurements = require("../../measurements/lib/index.js");
function toHex(value, chars) {
  const result = value.toString(16);
  if (result.length < chars) {
    return "0".repeat(chars - result.length) + result;
  }
  return result;
}
__name(toHex, "toHex");
let counter = Math.random() * (1 << 24) | 0;
const random = toHex(Math.random() * (1 << 24) | 0, 6) + toHex(Math.random() * (1 << 16) | 0, 4);
function timestamp() {
  const time = Date.now() / 1e3 | 0;
  return toHex(time, 8);
}
__name(timestamp, "timestamp");
function count() {
  const val = counter++ & 16777215;
  return toHex(val, 6);
}
__name(count, "count");
function generateId(join = "") {
  return timestamp() + join + random + join + count();
}
__name(generateId, "generateId");
function generateUuid() {
  return crypto.randomUUID();
}
__name(generateUuid, "generateUuid");
function isId(value) {
  return typeof value === "string" && /^[0-9a-f]{24,24}$/.test(value);
}
__name(isId, "isId");
let currentAccount;
function getCurrentAccount() {
  return currentAccount;
}
__name(getCurrentAccount, "getCurrentAccount");
function setCurrentAccount(account) {
  currentAccount = account;
}
__name(setCurrentAccount, "setCurrentAccount");
function escapeLikeForRegexp(value) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}
__name(escapeLikeForRegexp, "escapeLikeForRegexp");
function toFindResult(docs, total, lookupMap) {
  const length = total ?? docs.length;
  if (Object.keys(lookupMap ?? {}).length === 0) {
    lookupMap = void 0;
  }
  return Object.assign(docs, { total: length, lookupMap });
}
__name(toFindResult, "toFindResult");
function isWorkspaceCreating(mode) {
  if (mode === void 0) {
    return false;
  }
  return ["pending-creation", "creating"].includes(mode);
}
__name(isWorkspaceCreating, "isWorkspaceCreating");
function docKey(name, _class) {
  return _class === void 0 || _class !== import_component.default.class.Doc ? name : `${_class}%${name}`;
}
__name(docKey, "docKey");
function isFullTextAttribute(attr) {
  return attr.index === import_classes.IndexKind.FullText || attr.type._class === import_component.default.class.TypeBlob || attr.type._class === import_component.default.class.EnumOf || attr.type._class === import_component.default.class.TypeCollaborativeDoc;
}
__name(isFullTextAttribute, "isFullTextAttribute");
function isIndexedAttribute(attr) {
  return attr.index === import_classes.IndexKind.Indexed || attr.index === import_classes.IndexKind.IndexedDsc;
}
__name(isIndexedAttribute, "isIndexedAttribute");
function toIdMap(arr) {
  return new Map(arr.map((p) => [p._id, p]));
}
__name(toIdMap, "toIdMap");
function concatLink(host, path) {
  if (!host.endsWith("/") && !path.startsWith("/")) {
    return `${host}/${path}`;
  } else if (host.endsWith("/") && path.startsWith("/")) {
    const newPath = path.slice(1);
    return `${host}${newPath}`;
  } else {
    return `${host}${path}`;
  }
}
__name(concatLink, "concatLink");
function fillDefaults(hierarchy, object, _class) {
  const baseClass = hierarchy.isDerived(_class, import_component.default.class.AttachedDoc) ? import_component.default.class.AttachedDoc : import_component.default.class.Doc;
  const attributes = hierarchy.getAllAttributes(_class, baseClass);
  for (const attribute of attributes) {
    if (attribute[1].defaultValue != null) {
      if (object[attribute[0]] === void 0) {
        ;
        object[attribute[0]] = structuredClone(attribute[1].defaultValue);
      }
    }
  }
  return object;
}
__name(fillDefaults, "fillDefaults");
class AggregateValueData {
  constructor(name, _id, space, rank, category) {
    this.name = name;
    this._id = _id;
    this.space = space;
    this.rank = rank;
    this.category = category;
  }
  static {
    __name(this, "AggregateValueData");
  }
  getRank() {
    return this.rank ?? "";
  }
}
class AggregateValue {
  constructor(name, values) {
    this.name = name;
    this.values = values;
  }
  static {
    __name(this, "AggregateValue");
  }
}
class DocManager {
  constructor(docs) {
    this.docs = docs;
    this.byId = toIdMap(docs);
  }
  static {
    __name(this, "DocManager");
  }
  byId;
  get(ref) {
    return this.byId.get(ref);
  }
  getDocs() {
    return this.docs;
  }
  getIdMap() {
    return this.byId;
  }
  filter(predicate) {
    return this.docs.filter(predicate);
  }
}
class RateLimiter {
  static {
    __name(this, "RateLimiter");
  }
  idCounter = 0;
  processingQueue = /* @__PURE__ */ new Map();
  last = 0;
  rate;
  queue = [];
  constructor(rate) {
    this.rate = rate;
  }
  notify = [];
  async exec(op, args) {
    const processingId = this.idCounter++;
    while (this.processingQueue.size >= this.rate) {
      await new Promise((resolve) => {
        this.notify.push(resolve);
      });
    }
    try {
      const p = op(args);
      this.processingQueue.set(processingId, p);
      return await p;
    } finally {
      this.processingQueue.delete(processingId);
      const n = this.notify.shift();
      if (n !== void 0) {
        n();
      }
    }
  }
  async add(op, args, errHandler) {
    while (this.processingQueue.size >= this.rate) {
      await new Promise((resolve) => {
        this.notify.push(resolve);
      });
    }
    void this.exec(op, args).catch((err) => {
      if (errHandler !== void 0) {
        errHandler(err);
      }
      console.error("Failed to execute in rate limitter", err);
    });
  }
  async waitProcessing() {
    while (this.processingQueue.size > 0) {
      await new Promise((resolve) => {
        this.notify.push(resolve);
      });
    }
  }
}
function mergeQueries(query1, query2) {
  const keys1 = Object.keys(query1);
  const keys2 = Object.keys(query2);
  const query = {};
  for (const key of keys1) {
    if (!keys2.includes(key)) {
      Object.assign(query, { [key]: query1[key] });
    }
  }
  for (const key of keys2) {
    if (!keys1.includes(key)) {
      Object.assign(query, { [key]: query2[key] });
    } else {
      const value = mergeField(query1[key], query2[key]);
      if (value !== void 0) {
        Object.assign(query, { [key]: value });
      }
    }
  }
  return query;
}
__name(mergeQueries, "mergeQueries");
function mergeField(field1, field2) {
  const never = { $in: [] };
  const ignored = ["$in", "$nin", "$ne"];
  const isPredicate1 = (0, import_predicate.isPredicate)(field1);
  const isPredicate2 = (0, import_predicate.isPredicate)(field2);
  if (isPredicate1 && isPredicate2) {
    const result = getInNiN(field1, field2);
    const keys1 = Object.keys(field1);
    const keys2 = Object.keys(field2);
    for (const key of keys1) {
      if (ignored.includes(key)) continue;
      if (!keys2.includes(key)) {
        Object.assign(result, { [key]: field1[key] });
      } else {
        const value = mergePredicateWithPredicate(key, field1[key], field2[key]);
        if (value !== void 0) {
          Object.assign(result, { [key]: value });
        }
      }
    }
    for (const key of keys2) {
      if (ignored.includes(key)) continue;
      if (!keys1.includes(key)) {
        Object.assign(result, { [key]: field2[key] });
      }
    }
    return Object.keys(result).length > 0 ? result : void 0;
  } else if (isPredicate1 || isPredicate2) {
    const predicate = isPredicate1 ? field1 : field2;
    const value = isPredicate1 ? field2 : field1;
    for (const x in predicate) {
      const result = mergePredicateWithValue(x, predicate[x], value);
      if (Array.isArray(result?.$in) && result.$in.length > 0 && Array.isArray(result?.$nin) && result.$nin.length === 0) {
        delete result.$nin;
      }
      if (result !== void 0) {
        return result;
      }
    }
    return never;
  } else {
    return (0, import_fast_equals.deepEqual)(field1, field2) ? field1 : never;
  }
}
__name(mergeField, "mergeField");
function mergePredicateWithPredicate(predicate, val1, val2) {
  if (val1 === void 0) return val2;
  if (val2 === void 0) return val1;
  switch (predicate) {
    case "$lt":
      return val1 < val2 ? val1 : val2;
    case "$lte":
      return val1 <= val2 ? val1 : val2;
    case "$gt":
      return val1 > val2 ? val1 : val2;
    case "$gte":
      return val1 >= val2 ? val1 : val2;
  }
  return val1;
}
__name(mergePredicateWithPredicate, "mergePredicateWithPredicate");
function mergePredicateWithValue(predicate, val1, val2) {
  switch (predicate) {
    case "$in":
      return Array.isArray(val1) && val1.includes(val2) ? val2 : void 0;
    case "$nin":
      return Array.isArray(val1) && !val1.includes(val2) ? val2 : void 0;
    case "$lt":
      return val2 < val1 ? val2 : void 0;
    case "$lte":
      return val2 <= val1 ? val2 : void 0;
    case "$gt":
      return val2 > val1 ? val2 : void 0;
    case "$gte":
      return val2 >= val1 ? val2 : void 0;
    case "$ne":
      return val1 !== val2 ? val2 : void 0;
  }
  return val2;
}
__name(mergePredicateWithValue, "mergePredicateWithValue");
function getInNiN(query1, query2) {
  const aIn = typeof query1 === "object" && "$in" in query1 ? query1.$in : void 0;
  const bIn = typeof query2 === "object" && "$in" in query2 ? query2.$in : void 0;
  const aNIn = (typeof query1 === "object" && "$nin" in query1 ? query1.$nin : void 0) ?? (typeof query1 === "object" && query1.$ne !== void 0 ? [query1.$ne] : []);
  const bNIn = (typeof query2 === "object" && "$nin" in query2 ? query2.$nin : void 0) ?? (typeof query1 === "object" && query2.$ne !== void 0 ? [query2.$ne] : []);
  const finalNin = Array.from(/* @__PURE__ */ new Set([...aNIn, ...bNIn]));
  if (aIn !== void 0 || bIn !== void 0) {
    const finalIn = aIn !== void 0 && bIn !== void 0 ? aIn.length - bIn.length < 0 ? bIn.filter((c) => aIn.includes(c)) : aIn.filter((c) => bIn.includes(c)) : aIn ?? bIn;
    return { $in: finalIn.filter((p) => !finalNin.includes(p)) };
  }
  if (typeof query1 === "object" && "$ne" in query1 || typeof query2 === "object" && "$ne" in query2) {
    if (finalNin.length === 1) {
      return { $ne: finalNin[0] };
    }
  }
  if (finalNin.length > 0) {
    return { $nin: finalNin };
  }
  return {};
}
__name(getInNiN, "getInNiN");
function cutObjectArray(obj) {
  if (obj == null) {
    return obj;
  }
  const r = {};
  for (const key of Object.keys(obj)) {
    if (Array.isArray(obj[key])) {
      if (obj[key].length > 3) {
        Object.assign(r, { [key]: [...obj[key].slice(0, 3), `... and ${obj[key].length - 3} more`] });
      } else Object.assign(r, { [key]: obj[key] });
      continue;
    }
    if (typeof obj[key] === "object" && obj[key] !== null) {
      Object.assign(r, { [key]: cutObjectArray(obj[key]) });
      continue;
    }
    Object.assign(r, { [key]: obj[key] });
  }
  return r;
}
__name(cutObjectArray, "cutObjectArray");
function includesAny(arr1, arr2) {
  if (arr1 == null || arr1.length === 0 || arr2 == null || arr2.length === 0) {
    return false;
  }
  return arr1.some((m) => arr2.includes(m));
}
__name(includesAny, "includesAny");
const isEnum = /* @__PURE__ */ __name((e) => (token) => {
  return typeof token === "string" && Object.values(e).includes(token);
}, "isEnum");
async function checkPermission(client, _id, _space, space) {
  const arePermissionsDisabled = (0, import_platform.getMetadata)(import_component.default.metadata.DisablePermissions) ?? false;
  if (arePermissionsDisabled) return true;
  return await hasPermission(client, _id, _space, space);
}
__name(checkPermission, "checkPermission");
async function checkForbiddenPermission(client, _id, _space, space) {
  const arePermissionsDisabled = (0, import_platform.getMetadata)(import_component.default.metadata.DisablePermissions) ?? false;
  if (arePermissionsDisabled) return false;
  return await hasPermission(client, _id, _space, space);
}
__name(checkForbiddenPermission, "checkForbiddenPermission");
async function hasPermission(client, _id, _space, space) {
  space = space ?? await client.findOne(import_component.default.class.TypedSpace, { _id: _space });
  const type = await client.getModel().findOne(import_component.default.class.SpaceType, { _id: space?.type }, { lookup: { _id: { roles: import_component.default.class.Role } } });
  const mixin = type?.targetClass;
  if (space === void 0 || type === void 0 || mixin === void 0) {
    return false;
  }
  const me = getCurrentAccount();
  const asMixin = client.getHierarchy().as(space, mixin);
  const myRoles = type.$lookup?.roles?.filter((role) => (asMixin[role._id] ?? []).includes(me.uuid));
  if (myRoles === void 0) {
    return false;
  }
  const myPermissions = new Set(myRoles.flatMap((role) => role.permissions));
  return myPermissions.has(_id);
}
__name(hasPermission, "hasPermission");
function getRoleAttributeLabel(roleName) {
  return (0, import_platform.getEmbeddedLabel)(`Role: ${roleName.trim()}`);
}
__name(getRoleAttributeLabel, "getRoleAttributeLabel");
function getFullTextIndexableAttributes(hierarchy, clazz, skipDocs = false) {
  const allAttributes = hierarchy.getAllAttributes(clazz);
  const result = [];
  for (const [, attr] of allAttributes) {
    if (skipDocs && (attr.attributeOf === import_component.default.class.Doc || attr.attributeOf === import_component.default.class.AttachedDoc)) {
      continue;
    }
    if (isFullTextAttribute(attr) || isIndexedAttribute(attr)) {
      result.push(attr);
    }
  }
  hierarchy.getDescendants(clazz).filter((m) => hierarchy.getClass(m).kind === import_classes.ClassifierKind.MIXIN).forEach((m) => {
    for (const [, v] of hierarchy.getAllAttributes(m, clazz)) {
      if (skipDocs && (v.attributeOf === import_component.default.class.Doc || v.attributeOf === import_component.default.class.AttachedDoc)) {
        continue;
      }
      if (isFullTextAttribute(v) || isIndexedAttribute(v)) {
        result.push(v);
      }
    }
  });
  return result;
}
__name(getFullTextIndexableAttributes, "getFullTextIndexableAttributes");
const ctxKey = "indexer_ftc";
function getFullTextContext(hierarchy, objectClass, contexts) {
  let ctx = hierarchy.getClassifierProp(objectClass, ctxKey);
  if (ctx !== void 0) {
    return ctx;
  }
  if (typeof ctx !== "string") {
    const anc = hierarchy.getAncestors(objectClass);
    for (const oc of anc) {
      const ctx2 = contexts.get(oc);
      if (ctx2 !== void 0) {
        hierarchy.setClassifierProp(objectClass, ctxKey, ctx2);
        return ctx2;
      }
    }
  }
  ctx = {
    toClass: objectClass,
    fullTextSummary: false,
    forceIndex: false
  };
  hierarchy.setClassifierProp(objectClass, ctxKey, ctx);
  return ctx;
}
__name(getFullTextContext, "getFullTextContext");
function isClassIndexable(hierarchy, c, contexts) {
  const indexed = hierarchy.getClassifierProp(c, "class_indexed");
  if (indexed !== void 0) {
    return indexed;
  }
  const domain = hierarchy.findDomain(c);
  if (domain === void 0) {
    hierarchy.setClassifierProp(c, "class_indexed", false);
    return false;
  }
  if (domain === import_tx.DOMAIN_TX || domain === import_classes.DOMAIN_MODEL || domain === import_classes.DOMAIN_BLOB || domain === "preference" || domain === import_classes.DOMAIN_TRANSIENT || domain === "settings" || domain === import_benchmark.DOMAIN_BENCHMARK) {
    hierarchy.setClassifierProp(c, "class_indexed", false);
    return false;
  }
  const indexMixin = hierarchy.classHierarchyMixin(c, import_component.default.mixin.IndexConfiguration);
  if (indexMixin?.searchDisabled !== void 0 && indexMixin?.searchDisabled) {
    hierarchy.setClassifierProp(c, "class_indexed", false);
    return false;
  }
  const attrs = getFullTextIndexableAttributes(hierarchy, c, true);
  for (const d of hierarchy.getDescendants(c)) {
    if (hierarchy.isMixin(d)) {
      attrs.push(...getFullTextIndexableAttributes(hierarchy, d, true));
    }
  }
  let result = true;
  if (attrs.length === 0 && !(getFullTextContext(hierarchy, c, contexts)?.forceIndex ?? false)) {
    result = false;
    const attrs2 = hierarchy.getAllAttributes(c).values();
    for (const attr of attrs2) {
      if (attr.type._class === import_component.default.class.Collection) {
        if (isClassIndexable(hierarchy, attr.type.of, contexts)) {
          result = true;
          break;
        }
      }
    }
  }
  hierarchy.setClassifierProp(c, "class_indexed", result);
  return result;
}
__name(isClassIndexable, "isClassIndexable");
function reduceCalls(operation) {
  let nextCall;
  let currentCall;
  const next = /* @__PURE__ */ __name(() => {
    currentCall = nextCall;
    nextCall = void 0;
    if (currentCall !== void 0) {
      void currentCall.op().catch();
    }
  }, "next");
  return async function(...args) {
    const myOp = /* @__PURE__ */ __name(async () => {
      try {
        await operation(...args);
      } catch (err) {
        console.error("Error occurred in reduceCalls:", err);
      }
      next();
    }, "myOp");
    nextCall = { op: myOp };
    await Promise.resolve();
    if (currentCall === void 0) {
      next();
    }
  };
}
__name(reduceCalls, "reduceCalls");
function isOwnerOrMaintainer() {
  const account = getCurrentAccount();
  return hasAccountRole(account, import_classes.AccountRole.Maintainer);
}
__name(isOwnerOrMaintainer, "isOwnerOrMaintainer");
function hasAccountRole(acc, targerRole) {
  return import_classes.roleOrder[acc.role] >= import_classes.roleOrder[targerRole];
}
__name(hasAccountRole, "hasAccountRole");
function getBranding(brandings, key) {
  if (key === void 0) return null;
  return Object.values(brandings).find((branding) => branding.key === key) ?? null;
}
__name(getBranding, "getBranding");
function fillConfiguration(systemTx, configs) {
  for (const t of systemTx) {
    if (t._class === import_component.default.class.TxCreateDoc) {
      const ct = t;
      if (ct.objectClass === import_component.default.class.PluginConfiguration) {
        configs.set(ct.objectId, import_tx.TxProcessor.createDoc2Doc(ct));
      }
    } else if (t._class === import_component.default.class.TxUpdateDoc) {
      const ut = t;
      if (ut.objectClass === import_component.default.class.PluginConfiguration) {
        const c = configs.get(ut.objectId);
        if (c !== void 0) {
          if (c.system !== true || ut.modifiedBy === import_component.default.account.ConfigUser) {
            import_tx.TxProcessor.updateDoc2Doc(c, ut);
          }
        }
      }
    }
  }
}
__name(fillConfiguration, "fillConfiguration");
function pluginFilterTx(excludedPlugins, configs, systemTx) {
  const stx = toIdMap(systemTx);
  const totalExcluded = /* @__PURE__ */ new Set();
  let msg = "";
  for (const a of excludedPlugins) {
    for (const c of configs.values()) {
      if (a.pluginId === c.pluginId) {
        for (const id of c.transactions) {
          if (c.classFilter !== void 0) {
            const filter = new Set(c.classFilter);
            const tx = stx.get(id);
            if (tx?._class === import_component.default.class.TxCreateDoc || tx?._class === import_component.default.class.TxUpdateDoc || tx?._class === import_component.default.class.TxRemoveDoc) {
              const cud = tx;
              if (filter.has(cud.objectClass)) {
                totalExcluded.add(id);
              }
            }
          } else {
            totalExcluded.add(id);
          }
        }
        msg += ` ${c.pluginId}:${c.transactions.length}`;
      }
    }
  }
  if (typeof window !== "undefined") {
    console.log("exclude plugin", msg);
  }
  systemTx = systemTx.filter((t) => !totalExcluded.has(t._id));
  return systemTx;
}
__name(pluginFilterTx, "pluginFilterTx");
class TimeRateLimiter {
  static {
    __name(this, "TimeRateLimiter");
  }
  idCounter = 0;
  active = 0;
  last = 0;
  rate;
  period;
  executions = [];
  queue = [];
  notify = [];
  constructor(rate, period = 1e3) {
    this.rate = rate;
    this.period = period;
  }
  cleanupExecutions() {
    const now = Date.now();
    this.executions = this.executions.filter((time) => time.running || now - time.time < this.period);
  }
  async exec(op, args) {
    while (this.active >= this.rate || this.executions.length >= this.rate) {
      this.cleanupExecutions();
      if (this.executions.length < this.rate) {
        break;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, this.period / this.rate);
      });
    }
    const v = { time: Date.now(), running: true };
    this.active++;
    try {
      this.executions.push(v);
      const p = op(args);
      return await p;
    } finally {
      v.running = false;
      this.active--;
      this.cleanupExecutions();
      const n = this.notify.shift();
      if (n !== void 0) {
        n();
      }
    }
  }
  async waitProcessing() {
    while (this.active > 0) {
      await new Promise((resolve) => {
        this.notify.push(resolve);
      });
    }
  }
}
function combineAttributes(attributes, key, operator, arrayKey) {
  return Array.from(
    new Set(
      attributes.flatMap((attr) => {
        if (arrayKey === void 0) {
          return attr[operator]?.[key];
        }
        return Array.isArray(attr[operator]?.[key]?.[arrayKey]) ? attr[operator]?.[key]?.[arrayKey] : attr[operator]?.[key];
      })
    )
  ).filter((v) => v != null);
}
__name(combineAttributes, "combineAttributes");
function buildSocialIdString(key) {
  return `${key.type}:${key.value}`;
}
__name(buildSocialIdString, "buildSocialIdString");
function parseSocialIdString(id) {
  const [type, value] = id.split(":");
  if (type === void 0 || value === void 0) {
    throw new Error(`Social id is not valid: ${id}`);
  }
  if (!Object.values(import_classes.SocialIdType).includes(type)) {
    throw new Error(`Social id type is not valid: ${id}`);
  }
  return { type, value };
}
__name(parseSocialIdString, "parseSocialIdString");
function pickPrimarySocialId(socialIds) {
  const activeSocialIds = socialIds.filter((si) => si.isDeleted !== true);
  if (activeSocialIds.length === 0) {
    throw new Error("No active social ids provided");
  }
  const hulySocialIds = activeSocialIds.filter((si) => si.type === import_classes.SocialIdType.HULY);
  return hulySocialIds[0] ?? activeSocialIds[0];
}
__name(pickPrimarySocialId, "pickPrimarySocialId");
const loginSocialTypes = [import_classes.SocialIdType.EMAIL, import_classes.SocialIdType.GOOGLE, import_classes.SocialIdType.GITHUB, import_classes.SocialIdType.OIDC];
function notEmpty(id) {
  return id !== void 0 && id !== null && id !== "";
}
__name(notEmpty, "notEmpty");
function unique(arr) {
  return Array.from(new Set(arr));
}
__name(unique, "unique");
function uniqueNotEmpty(arr) {
  return unique(arr).filter(notEmpty);
}
__name(uniqueNotEmpty, "uniqueNotEmpty");
function toRank(str) {
  if (str === void 0) return;
  if (str.startsWith("0|")) {
    return str;
  }
  return "0|" + str.replaceAll(/[-:_]/g, "").toLowerCase();
}
__name(toRank, "toRank");
//# sourceMappingURL=utils.js.map
