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
var memdb_exports = {};
__export(memdb_exports, {
  MemDb: () => MemDb,
  ModelDb: () => ModelDb,
  TxDb: () => TxDb
});
module.exports = __toCommonJS(memdb_exports);
var import_platform = require("../../platform/lib/index.js");
var import__ = require("./index.js");
var import_component = __toESM(require("./component.js"));
var import_query = require("./query.js");
var import_tx = require("./tx.js");
var import_utils = require("./utils.js");
class MemDb extends import_tx.TxProcessor {
  constructor(hierarchy) {
    super();
    this.hierarchy = hierarchy;
  }
  static {
    __name(this, "MemDb");
  }
  objectsByClass = /* @__PURE__ */ new Map();
  objectById = /* @__PURE__ */ new Map();
  getObjectsByClass(_class) {
    const result = this.objectsByClass.get(_class);
    if (result === void 0) {
      const result2 = /* @__PURE__ */ new Map();
      this.objectsByClass.set(_class, result2);
      return result2;
    }
    return result;
  }
  cleanObjectByClass(_class, _id) {
    const result = this.objectsByClass.get(_class);
    if (result !== void 0) {
      result.delete(_id);
    }
  }
  getByIdQuery(query, _class) {
    const result = [];
    if (typeof query._id === "string") {
      const obj = this.objectById.get(query._id);
      if (obj !== void 0 && this.hierarchy.isDerived(obj._class, _class)) result.push(obj);
    } else if (query._id?.$in !== void 0) {
      const ids = new Set(query._id.$in);
      for (const id of ids) {
        const obj = this.objectById.get(id);
        if (obj !== void 0 && this.hierarchy.isDerived(obj._class, _class)) result.push(obj);
      }
    }
    return result;
  }
  getObject(_id) {
    const doc = this.objectById.get(_id);
    if (doc === void 0) {
      throw new import_platform.PlatformError(new import_platform.Status(import_platform.Severity.ERROR, import_component.default.status.ObjectNotFound, { _id }));
    }
    return doc;
  }
  findObject(_id) {
    const doc = this.objectById.get(_id);
    return doc;
  }
  async getLookupValue(_class, doc, lookup, result) {
    for (const key in lookup) {
      if (key === "_id") {
        await this.getReverseLookupValue(doc, lookup, result);
        continue;
      }
      const value = lookup[key];
      const tkey = (0, import_query.checkMixinKey)(key, _class, this.hierarchy);
      if (Array.isArray(value)) {
        const [_class2, nested] = value;
        const objects = await this.findAll(_class2, { _id: (0, import__.getObjectValue)(tkey, doc) });
        result[key] = objects[0];
        const nestedResult = {};
        const parent = result[key];
        await this.getLookupValue(_class2, parent, nested, nestedResult);
        Object.assign(parent, {
          $lookup: nestedResult
        });
      } else {
        const objects = await this.findAll(value, { _id: (0, import__.getObjectValue)(tkey, doc) });
        result[key] = objects[0];
      }
    }
  }
  async getReverseLookupValue(doc, lookup, result) {
    for (const key in lookup._id) {
      const value = lookup._id[key];
      if (Array.isArray(value)) {
        const objects = await this.findAll(value[0], { [value[1]]: doc._id });
        result[key] = objects;
      } else {
        const objects = await this.findAll(value, { attachedTo: doc._id });
        result[key] = objects;
      }
    }
  }
  async lookup(_class, docs, lookup) {
    const withLookup = [];
    for (const doc of docs) {
      const result = {};
      await this.getLookupValue(_class, doc, lookup, result);
      withLookup.push(Object.assign({}, doc, { $lookup: result }));
    }
    return withLookup;
  }
  async fillAssociations(docs, associations) {
    const withLookup = [];
    for (const doc of docs) {
      const result = await this.getAssociationValue(doc, associations);
      withLookup.push(Object.assign({}, doc, { $associations: result }));
    }
    return withLookup;
  }
  async getAssociationValue(doc, associations) {
    const result = {};
    for (const association of associations) {
      const _id = association[0];
      const assoc = this.findObject(_id);
      if (assoc === void 0) continue;
      const isReverse = association[1] === -1;
      const key = !isReverse ? "docA" : "docB";
      const key2 = !isReverse ? "docB" : "docA";
      const _class = !isReverse ? assoc.classB : assoc.classA;
      const relations = await this.findAll(import_component.default.class.Relation, { association: _id, [key]: doc._id });
      let objects = await this.findAll(_class, { _id: { $in: relations.map((r) => r[key2]) } });
      if (association[2] !== void 0) {
        objects = (0, import_utils.toFindResult)(await this.fillAssociations(objects, association[2]), objects.length);
      }
      result[`${_id}_${!isReverse ? "b" : "a"}`] = objects;
    }
    return result;
  }
  async findAll(_class, query, options) {
    let result;
    const baseClass = this.hierarchy.getBaseClass(_class);
    if (Object.prototype.hasOwnProperty.call(query, "_id") && (typeof query._id === "string" || query._id?.$in !== void 0 || query._id === void 0 || query._id === null)) {
      result = this.getByIdQuery(query, baseClass);
    } else {
      result = Array.from(this.getObjectsByClass(baseClass).values());
    }
    result = (0, import_query.matchQuery)(result, query, _class, this.hierarchy, true);
    if (baseClass !== _class) {
      result = result.filter((r) => r[_class] !== void 0);
    }
    if (options?.lookup !== void 0) {
      result = await this.lookup(_class, result, options.lookup);
      result = (0, import_query.matchQuery)(result, query, _class, this.hierarchy);
    }
    if (options?.associations !== void 0) {
      result = await this.fillAssociations(result, options.associations);
    }
    if (options?.sort !== void 0) (0, import_query.resultSort)(result, options?.sort, _class, this.hierarchy, this);
    const total = result.length;
    result = result.slice(0, options?.limit);
    const tresult = this.hierarchy.clone(result);
    const res = tresult.map((it) => this.hierarchy.updateLookupMixin(_class, it, options));
    return (0, import_utils.toFindResult)(res, total);
  }
  async findOne(_class, query, options) {
    return (await this.findAll(_class, query, { ...options, limit: 1 }))[0];
  }
  /**
   * Only in model find without lookups and sorting.
   * Do not clone results, so be aware modifications are not allowed.
   */
  findAllSync(_class, query, options) {
    let result;
    const baseClass = this.hierarchy.getBaseClass(_class);
    if (Object.prototype.hasOwnProperty.call(query, "_id") && (typeof query._id === "string" || query._id?.$in !== void 0 || query._id === void 0 || query._id === null)) {
      result = this.getByIdQuery(query, baseClass);
    } else {
      result = Array.from(this.getObjectsByClass(baseClass).values());
    }
    result = (0, import_query.matchQuery)(result, query, _class, this.hierarchy, true);
    if (baseClass !== _class) {
      result = result.filter((r) => r[_class] !== void 0);
    }
    if (options?.sort !== void 0) (0, import_query.resultSort)(result, options?.sort, _class, this.hierarchy, this);
    const total = result.length;
    result = result.slice(0, options?.limit);
    return (0, import_utils.toFindResult)(
      result.map((it) => {
        return baseClass !== _class ? this.hierarchy.as(it, _class) : it;
      }),
      total
    );
  }
  addDoc(doc) {
    this.hierarchy.getAncestors(doc._class).forEach((_class) => {
      const arr = this.getObjectsByClass(_class);
      arr.set(doc._id, doc);
    });
    this.objectById.set(doc._id, doc);
  }
  delDoc(_id) {
    const doc = this.objectById.get(_id);
    if (doc === void 0) {
      throw new import_platform.PlatformError(new import_platform.Status(import_platform.Severity.ERROR, import_component.default.status.ObjectNotFound, { _id }));
    }
    this.objectById.delete(_id);
    this.hierarchy.getAncestors(doc._class).forEach((_class) => {
      this.cleanObjectByClass(_class, _id);
    });
  }
  updateDoc(_id, doc, update) {
  }
}
class TxDb extends MemDb {
  static {
    __name(this, "TxDb");
  }
  txCreateDoc(tx) {
    throw new Error("Method not implemented.");
  }
  txUpdateDoc(tx) {
    throw new Error("Method not implemented.");
  }
  txRemoveDoc(tx) {
    throw new Error("Method not implemented.");
  }
  txMixin(tx) {
    throw new Error("Method not implemented.");
  }
  async tx(tx) {
    this.addDoc(tx);
    return [];
  }
}
class ModelDb extends MemDb {
  static {
    __name(this, "ModelDb");
  }
  async txCreateDoc(tx) {
    this.addDoc(import_tx.TxProcessor.createDoc2Doc(tx));
    return {};
  }
  addTxes(ctx, txes, clone) {
    for (const tx of txes) {
      switch (tx._class) {
        case import_component.default.class.TxCreateDoc:
          this.addDoc(import_tx.TxProcessor.createDoc2Doc(tx, clone));
          break;
        case import_component.default.class.TxUpdateDoc: {
          const cud = tx;
          const doc = this.findObject(cud.objectId);
          if (doc !== void 0) {
            this.updateDoc(cud.objectId, doc, cud);
            import_tx.TxProcessor.updateDoc2Doc(doc, cud);
          } else {
            ctx.warn("no document found, failed to apply model transaction, skipping", {
              _id: tx._id,
              _class: tx._class,
              objectId: cud.objectId
            });
          }
          break;
        }
        case import_component.default.class.TxRemoveDoc:
          try {
            this.delDoc(tx.objectId);
          } catch (err) {
            ctx.warn("no document found, failed to apply model transaction, skipping", {
              _id: tx._id,
              _class: tx._class,
              objectId: tx.objectId
            });
          }
          break;
        case import_component.default.class.TxMixin: {
          const mix = tx;
          const doc = this.findObject(mix.objectId);
          if (doc !== void 0) {
            this.updateDoc(mix.objectId, doc, mix);
            import_tx.TxProcessor.updateMixin4Doc(doc, mix);
          } else {
            ctx.warn("no document found, failed to apply model transaction, skipping", {
              _id: tx._id,
              _class: tx._class,
              objectId: mix.objectId
            });
          }
          break;
        }
      }
    }
  }
  async txUpdateDoc(tx) {
    try {
      const doc = this.getObject(tx.objectId);
      this.updateDoc(tx.objectId, doc, tx);
      import_tx.TxProcessor.updateDoc2Doc(doc, tx);
      return tx.retrieve === true ? { object: doc } : {};
    } catch (err) {
    }
    return {};
  }
  async txRemoveDoc(tx) {
    try {
      this.delDoc(tx.objectId);
    } catch (err) {
    }
    return {};
  }
  // TODO: process ancessor mixins
  async txMixin(tx) {
    const doc = this.getObject(tx.objectId);
    this.updateDoc(tx.objectId, doc, tx);
    import_tx.TxProcessor.updateMixin4Doc(doc, tx);
    return {};
  }
}
//# sourceMappingURL=memdb.js.map
