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
var operations_exports = {};
__export(operations_exports, {
  ApplyOperations: () => ApplyOperations,
  TxBuilder: () => TxBuilder,
  TxOperations: () => TxOperations,
  getDiffUpdate: () => getDiffUpdate,
  splitMixinUpdate: () => splitMixinUpdate,
  updateAttribute: () => updateAttribute
});
module.exports = __toCommonJS(operations_exports);
var import_analytics = require("../../analytics/lib/index.js");
var import_fast_equals = require("../../../fast-equals/dist/cjs/index.cjs");
var import__ = require("./index.js");
var import_component = __toESM(require("./component.js"));
var import_tx = require("./tx.js");
class TxOperations {
  constructor(client, user, isDerived = false) {
    this.client = client;
    this.user = user;
    this.isDerived = isDerived;
    this.txFactory = new import_tx.TxFactory(user, isDerived);
  }
  static {
    __name(this, "TxOperations");
  }
  txFactory;
  getHierarchy() {
    return this.client.getHierarchy();
  }
  getModel() {
    return this.client.getModel();
  }
  async close() {
    await this.client.close();
  }
  findAll(_class, query, options) {
    return this.client.findAll(_class, query, options);
  }
  findOne(_class, query, options) {
    return this.client.findOne(_class, query, options);
  }
  domainRequest(domain, params) {
    return this.client.domainRequest(domain, params);
  }
  searchFulltext(query, options) {
    return this.client.searchFulltext(query, options);
  }
  tx(tx) {
    return this.client.tx(tx);
  }
  async createDoc(_class, space, attributes, id, modifiedOn, modifiedBy) {
    const hierarchy = this.client.getHierarchy();
    if (hierarchy.isDerived(_class, import_component.default.class.AttachedDoc)) {
      throw new Error("createDoc cannot be used for objects inherited from AttachedDoc");
    }
    if (hierarchy.findDomain(_class) === import__.DOMAIN_MODEL && space !== import_component.default.space.Model) {
      throw new Error("createDoc cannot be called for DOMAIN_MODEL classes with non-model space");
    }
    const tx = this.txFactory.createTxCreateDoc(_class, space, attributes, id, modifiedOn, modifiedBy);
    await this.tx(tx);
    return tx.objectId;
  }
  async addCollection(_class, space, attachedTo, attachedToClass, collection, attributes, id, modifiedOn, modifiedBy) {
    const tx = this.txFactory.createTxCollectionCUD(
      attachedToClass,
      attachedTo,
      space,
      collection,
      this.txFactory.createTxCreateDoc(_class, space, attributes, id, modifiedOn, modifiedBy),
      modifiedOn,
      modifiedBy
    );
    await this.tx(tx);
    return tx.objectId;
  }
  async updateCollection(_class, space, objectId, attachedTo, attachedToClass, collection, operations, retrieve, modifiedOn, modifiedBy) {
    const tx = this.txFactory.createTxCollectionCUD(
      attachedToClass,
      attachedTo,
      space,
      collection,
      this.txFactory.createTxUpdateDoc(_class, space, objectId, operations, retrieve, modifiedOn, modifiedBy),
      modifiedOn,
      modifiedBy
    );
    await this.tx(tx);
    return attachedTo;
  }
  async removeCollection(_class, space, objectId, attachedTo, attachedToClass, collection, modifiedOn, modifiedBy) {
    const tx = this.txFactory.createTxCollectionCUD(
      attachedToClass,
      attachedTo,
      space,
      collection,
      this.txFactory.createTxRemoveDoc(_class, space, objectId, modifiedOn, modifiedBy),
      modifiedOn,
      modifiedBy
    );
    await this.tx(tx);
    return attachedTo;
  }
  updateDoc(_class, space, objectId, operations, retrieve, modifiedOn, modifiedBy) {
    const tx = this.txFactory.createTxUpdateDoc(_class, space, objectId, operations, retrieve, modifiedOn, modifiedBy);
    return this.tx(tx);
  }
  removeDoc(_class, space, objectId, modifiedOn, modifiedBy) {
    const tx = this.txFactory.createTxRemoveDoc(_class, space, objectId, modifiedOn, modifiedBy);
    return this.tx(tx);
  }
  createMixin(objectId, objectClass, objectSpace, mixin, attributes, modifiedOn, modifiedBy) {
    const tx = this.txFactory.createTxMixin(
      objectId,
      objectClass,
      objectSpace,
      mixin,
      attributes,
      modifiedOn,
      modifiedBy
    );
    return this.tx(tx);
  }
  updateMixin(objectId, objectClass, objectSpace, mixin, attributes, modifiedOn, modifiedBy) {
    const tx = this.txFactory.createTxMixin(
      objectId,
      objectClass,
      objectSpace,
      mixin,
      attributes,
      modifiedOn,
      modifiedBy
    );
    return this.tx(tx);
  }
  async update(doc, update, retrieve, modifiedOn, modifiedBy) {
    const hierarchy = this.client.getHierarchy();
    const mixClass = import__.Hierarchy.mixinOrClass(doc);
    if (hierarchy.isMixin(mixClass)) {
      const baseClass = hierarchy.getBaseClass(doc._class);
      const byClass = splitMixinUpdate(hierarchy, update, mixClass, baseClass);
      const ops = this.apply(doc._id);
      for (const it of byClass) {
        if (hierarchy.isMixin(it[0])) {
          await ops.updateMixin(doc._id, baseClass, doc.space, it[0], it[1], modifiedOn, modifiedBy);
        } else {
          if (hierarchy.isDerived(it[0], import_component.default.class.AttachedDoc)) {
            const adoc = doc;
            return await this.updateCollection(
              it[0],
              doc.space,
              adoc._id,
              adoc.attachedTo,
              adoc.attachedToClass,
              adoc.collection,
              it[1],
              retrieve,
              modifiedOn,
              modifiedBy
            );
          }
          await ops.updateDoc(it[0], doc.space, doc._id, it[1], retrieve, modifiedOn, modifiedBy);
        }
      }
      return await ops.commit();
    }
    if (hierarchy.isDerived(doc._class, import_component.default.class.AttachedDoc)) {
      const adoc = doc;
      return await this.updateCollection(
        doc._class,
        doc.space,
        adoc._id,
        adoc.attachedTo,
        adoc.attachedToClass,
        adoc.collection,
        update,
        retrieve,
        modifiedOn,
        modifiedBy
      );
    }
    return await this.updateDoc(doc._class, doc.space, doc._id, update, retrieve, modifiedOn, modifiedBy);
  }
  remove(doc, modifiedOn, modifiedBy) {
    if (this.client.getHierarchy().isDerived(doc._class, import_component.default.class.AttachedDoc)) {
      const adoc = doc;
      return this.removeCollection(
        doc._class,
        doc.space,
        adoc._id,
        adoc.attachedTo,
        adoc.attachedToClass,
        adoc.collection,
        modifiedOn,
        modifiedBy
      );
    }
    return this.removeDoc(doc._class, doc.space, doc._id);
  }
  apply(scope, measure, derived) {
    return new ApplyOperations(this, scope, measure, derived ?? this.isDerived);
  }
  async diffUpdate(doc, update, date, account) {
    const documentUpdate = getDiffUpdate(doc, update);
    if (Object.keys(documentUpdate).length > 0) {
      await this.update(doc, documentUpdate, false, date ?? Date.now(), account);
      import_tx.TxProcessor.applyUpdate(doc, documentUpdate);
    }
    return doc;
  }
  async mixinDiffUpdate(doc, raw, mixin, modifiedBy, modifiedOn) {
    if (!this.getHierarchy().hasMixin(doc, mixin)) {
      await this.createMixin(doc._id, doc._class, doc.space, mixin, raw, modifiedOn, modifiedBy);
      import_tx.TxProcessor.applyUpdate(this.getHierarchy().as(doc, mixin), raw);
      return doc;
    }
    const documentUpdate = {};
    for (const [k, v] of Object.entries(raw)) {
      if (["_class", "_id", "modifiedBy", "modifiedOn", "space", "attachedTo", "attachedToClass"].includes(k)) {
        continue;
      }
      const dv = doc[k];
      if (!(0, import_fast_equals.deepEqual)(dv, v) && v != null) {
        ;
        documentUpdate[k] = v;
      }
    }
    if (Object.keys(documentUpdate).length > 0) {
      await this.updateMixin(doc._id, doc._class, doc.space, mixin, documentUpdate, modifiedOn, modifiedBy);
      import_tx.TxProcessor.applyUpdate(this.getHierarchy().as(doc, mixin), documentUpdate);
    }
    return doc;
  }
}
function getDiffUpdate(doc, update) {
  const documentUpdate = {};
  for (const [k, v] of Object.entries(update)) {
    if (["_class", "_id", "modifiedBy", "modifiedOn", "space", "attachedTo", "attachedToClass"].includes(k)) {
      continue;
    }
    const dv = doc[k];
    if (!(0, import_fast_equals.deepEqual)(dv, v) && v !== void 0) {
      ;
      documentUpdate[k] = v;
    }
  }
  return documentUpdate;
}
__name(getDiffUpdate, "getDiffUpdate");
function splitMixinUpdate(hierarchy, update, mixClass, baseClass) {
  const attributes = hierarchy.getAllAttributes(mixClass);
  const updateAttrs = Object.fromEntries(
    Object.entries(update).filter((it) => !it[0].startsWith("$"))
  );
  const updateOps = Object.fromEntries(
    Object.entries(update).filter((it) => it[0].startsWith("$"))
  );
  const result = splitObjectAttributes(
    hierarchy,
    updateAttrs,
    baseClass,
    attributes
  );
  for (const [key, value] of Object.entries(updateOps)) {
    const updates = splitObjectAttributes(hierarchy, value, baseClass, attributes);
    for (const [opsClass, opsUpdate] of updates) {
      const upd = result.get(opsClass) ?? {};
      result.set(opsClass, { ...upd, [key]: opsUpdate });
    }
  }
  return result;
}
__name(splitMixinUpdate, "splitMixinUpdate");
function splitObjectAttributes(hierarchy, obj, objClass, attributes) {
  const result = /* @__PURE__ */ new Map();
  for (const [key, value] of Object.entries(obj)) {
    const attributeOf = attributes.get(key)?.attributeOf;
    const clazz = attributeOf !== void 0 && hierarchy.isMixin(attributeOf) ? attributeOf : objClass;
    result.set(clazz, { ...result.get(clazz) ?? {}, [key]: value });
  }
  return result;
}
__name(splitObjectAttributes, "splitObjectAttributes");
class ApplyOperations extends TxOperations {
  constructor(ops, scope, measureName, isDerived) {
    const txClient = {
      getHierarchy: /* @__PURE__ */ __name(() => ops.client.getHierarchy(), "getHierarchy"),
      getModel: /* @__PURE__ */ __name(() => ops.client.getModel(), "getModel"),
      close: /* @__PURE__ */ __name(() => ops.client.close(), "close"),
      findOne: /* @__PURE__ */ __name((_class, query, options) => ops.client.findOne(_class, query, options), "findOne"),
      findAll: /* @__PURE__ */ __name((_class, query, options) => ops.client.findAll(_class, query, options), "findAll"),
      searchFulltext: /* @__PURE__ */ __name((query, options) => ops.client.searchFulltext(query, options), "searchFulltext"),
      domainRequest: /* @__PURE__ */ __name((domain, params) => ops.client.domainRequest(domain, params), "domainRequest"),
      tx: /* @__PURE__ */ __name(async (tx) => {
        if (import_tx.TxProcessor.isExtendsCUD(tx._class)) {
          this.txes.push(tx);
        }
        return {};
      }, "tx")
    };
    super(txClient, ops.user, isDerived ?? false);
    this.ops = ops;
    this.scope = scope;
    this.measureName = measureName;
  }
  static {
    __name(this, "ApplyOperations");
  }
  txes = [];
  matches = [];
  notMatches = [];
  match(_class, query) {
    this.matches.push({ _class, query });
    return this;
  }
  notMatch(_class, query) {
    this.notMatches.push({ _class, query });
    return this;
  }
  async commit(notify = true, extraNotify = []) {
    if (this.txes.length === 1 && this.matches.length === 0 && this.notMatches.length === 0 && this.measureName == null) {
      const st = (0, import__.platformNow)();
      await this.ops.tx(this.txes[0]);
      const time = (0, import__.platformNow)() - st;
      this.txes = [];
      return {
        result: true,
        time,
        serverTime: time
      };
    }
    if (this.txes.length > 0) {
      const st = (0, import__.platformNow)();
      const aop = this.ops.txFactory.createTxApplyIf(
        import_component.default.space.Tx,
        this.scope,
        this.matches,
        this.notMatches,
        this.txes,
        this.measureName,
        notify,
        extraNotify
      );
      const result = await this.ops.tx(aop);
      const dnow = (0, import__.platformNow)();
      if (typeof window === "object" && window !== null && this.measureName != null) {
        console.log(`measure ${this.measureName}`, dnow - st, "server time", result.serverTime);
      }
      if (!result.success) {
        console.warn("ops.commit() failed", {
          scope: this.scope,
          measureName: this.measureName,
          matchCount: this.matches.length,
          notMatchCount: this.notMatches.length,
          txCount: this.txes.length,
          matches: this.matches.map((m) => ({ _class: m._class, query: m.query })),
          notMatches: this.notMatches.map((m) => ({ _class: m._class, query: m.query }))
        });
      }
      this.txes = [];
      return {
        result: result.success,
        time: dnow - st,
        serverTime: result.serverTime
      };
    }
    return { result: true, time: 0, serverTime: 0 };
  }
  // Apply for this will reuse, same apply context.
  apply(scope, measure) {
    return this;
  }
}
class TxBuilder extends TxOperations {
  constructor(hierarchy, modelDb, user) {
    const txClient = {
      getHierarchy: /* @__PURE__ */ __name(() => this.hierarchy, "getHierarchy"),
      getModel: /* @__PURE__ */ __name(() => this.modelDb, "getModel"),
      close: /* @__PURE__ */ __name(async () => {
      }, "close"),
      findOne: /* @__PURE__ */ __name(async (_class, query, options) => void 0, "findOne"),
      findAll: /* @__PURE__ */ __name(async (_class, query, options) => (0, import__.toFindResult)([]), "findAll"),
      searchFulltext: /* @__PURE__ */ __name(async (query, options) => ({ docs: [] }), "searchFulltext"),
      domainRequest: /* @__PURE__ */ __name(async (domain, params) => ({ domain, value: null }), "domainRequest"),
      tx: /* @__PURE__ */ __name(async (tx) => {
        if (import_tx.TxProcessor.isExtendsCUD(tx._class)) {
          this.txes.push(tx);
        }
        return {};
      }, "tx")
    };
    super(txClient, user);
    this.hierarchy = hierarchy;
    this.modelDb = modelDb;
  }
  static {
    __name(this, "TxBuilder");
  }
  txes = [];
  matches = [];
}
async function updateAttribute(client, object, _class, attribute, value, saveModified = false, analyticsProps = {}) {
  const doc = object;
  const attributeKey = attribute.key;
  if (doc[attributeKey] === value) return;
  const modifiedOn = saveModified ? doc.modifiedOn : Date.now();
  const modifiedBy = attribute.key === "modifiedBy" ? value : saveModified ? doc.modifiedBy : void 0;
  const attr = attribute.attr;
  const baseAnalyticsProps = {
    objectClass: _class,
    objectId: object._id,
    attribute: attributeKey,
    ...analyticsProps
  };
  if (client.getHierarchy().isMixin(attr.attributeOf)) {
    await client.updateMixin(
      doc._id,
      _class,
      doc.space,
      attr.attributeOf,
      { [attributeKey]: value },
      modifiedOn,
      modifiedBy
    );
    import_analytics.Analytics.handleEvent("ChangeAttribute", { ...baseAnalyticsProps, value });
  } else {
    if (client.getHierarchy().isDerived(attribute.attr.type._class, import_component.default.class.ArrOf)) {
      const oldValue = object[attributeKey] ?? [];
      const val = Array.isArray(value) ? value : [value];
      const toPull = oldValue.filter((it) => !val.includes(it));
      const toPush = val.filter((it) => !oldValue.includes(it));
      if (toPull.length > 0) {
        await client.update(object, { $pull: { [attributeKey]: { $in: toPull } } }, false, modifiedOn, modifiedBy);
        import_analytics.Analytics.handleEvent("RemoveCollectionItems", {
          ...baseAnalyticsProps,
          removed: toPull
        });
      }
      if (toPush.length > 0) {
        await client.update(
          object,
          { $push: { [attributeKey]: { $each: toPush, $position: 0 } } },
          false,
          modifiedOn,
          modifiedBy
        );
        import_analytics.Analytics.handleEvent("AddCollectionItems", {
          ...baseAnalyticsProps,
          added: toPush
        });
      }
    } else {
      await client.update(object, { [attributeKey]: value }, false, modifiedOn, modifiedBy);
      import_analytics.Analytics.handleEvent("SetCollectionItems", {
        ...baseAnalyticsProps,
        value
      });
    }
  }
}
__name(updateAttribute, "updateAttribute");
//# sourceMappingURL=operations.js.map
