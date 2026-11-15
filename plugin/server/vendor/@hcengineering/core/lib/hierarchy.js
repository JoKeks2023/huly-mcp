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
var hierarchy_exports = {};
__export(hierarchy_exports, {
  Hierarchy: () => Hierarchy
});
module.exports = __toCommonJS(hierarchy_exports);
var import_classes = require("./classes.js");
var import_clone = require("./clone.js");
var import_component = __toESM(require("./component.js"));
var import_proxy = require("./proxy.js");
var import_tx = require("./tx.js");
class Hierarchy {
  static {
    __name(this, "Hierarchy");
  }
  classifiers = /* @__PURE__ */ new Map();
  attributes = /* @__PURE__ */ new Map();
  attributesById = /* @__PURE__ */ new Map();
  descendants = /* @__PURE__ */ new Map();
  ancestors = /* @__PURE__ */ new Map();
  proxies = /* @__PURE__ */ new Map();
  classifierProperties = /* @__PURE__ */ new Map();
  createMixinProxyHandler(mixin) {
    const value = this.getClass(mixin);
    const ancestor = this.getClass(value.extends);
    const ancestorProxy = ancestor.kind === import_classes.ClassifierKind.MIXIN ? this.getMixinProxyHandler(ancestor._id) : null;
    return (0, import_proxy._createMixinProxy)(value, ancestorProxy);
  }
  getMixinProxyHandler(mixin) {
    const handler = this.proxies.get(mixin);
    if (handler === void 0) {
      const handler2 = this.createMixinProxyHandler(mixin);
      this.proxies.set(mixin, handler2);
      return handler2;
    }
    return handler;
  }
  as(doc, mixin) {
    if (doc[import_proxy.PROXY_MIXIN_CLASS_KEY] === mixin) return doc;
    return new Proxy(Hierarchy.toDoc(doc), this.getMixinProxyHandler(mixin));
  }
  asIf(doc, mixin) {
    if (doc === void 0) {
      return void 0;
    }
    return this.hasMixin(doc, mixin) ? this.as(doc, mixin) : void 0;
  }
  asIfArray(docs, mixin) {
    return docs.map((it) => this.asIf(it, mixin)).filter((it) => it !== void 0);
  }
  static toDoc(doc) {
    return (0, import_proxy._toDoc)(doc);
  }
  static mixinClass(doc) {
    return (0, import_proxy._mixinClass)(doc);
  }
  static mixinOrClass(doc) {
    const m = (0, import_proxy._mixinClass)(doc);
    return m ?? doc._class;
  }
  static hasMixin(doc, mixin) {
    const d = Hierarchy.toDoc(doc);
    return typeof d[mixin] === "object";
  }
  hasMixin(doc, mixin) {
    return Hierarchy.hasMixin(doc, mixin);
  }
  classHierarchyMixin(_class, mixin, filter) {
    let clazz = this.getClass(_class);
    while (true) {
      if (this.hasMixin(clazz, mixin)) {
        const m = this.as(clazz, mixin);
        if (m !== void 0 && (filter?.(m) ?? true)) {
          return m;
        }
      }
      if (clazz.extends === void 0) return;
      clazz = this.getClass(clazz.extends);
    }
  }
  findClassOrMixinMixin(doc, mixin) {
    const cc = this.classHierarchyMixin(doc._class, mixin);
    if (cc !== void 0) {
      return cc;
    }
    const _doc = (0, import_proxy._toDoc)(doc);
    for (const [k, v] of Object.entries(_doc)) {
      if (typeof v === "object" && this.classifiers.has(k)) {
        const cc2 = this.classHierarchyMixin(k, mixin);
        if (cc2 !== void 0) {
          return cc2;
        }
      }
    }
  }
  findMixinMixins(doc, mixin) {
    const _doc = (0, import_proxy._toDoc)(doc);
    const result = [];
    const resultSet = /* @__PURE__ */ new Set();
    for (const [k, v] of Object.entries(_doc)) {
      if (typeof v === "object" && this.classifiers.has(k)) {
        const clazz = this.getClass(k);
        if (this.hasMixin(clazz, mixin)) {
          const cc = this.as(clazz, mixin);
          if (cc !== void 0 && !resultSet.has(cc._id)) {
            result.push(cc);
            resultSet.add(cc._id);
          }
        }
      }
    }
    return result;
  }
  findAllMixins(doc) {
    const _doc = (0, import_proxy._toDoc)(doc);
    const resultSet = /* @__PURE__ */ new Set();
    for (const [k, v] of Object.entries(_doc)) {
      if (typeof v === "object" && this.classifiers.has(k)) {
        if (this.isMixin(k)) {
          if (!resultSet.has(k)) {
            resultSet.add(k);
          }
        }
      }
    }
    return Array.from(resultSet);
  }
  isMixin(_class) {
    const data = this.classifiers.get(_class);
    return data !== void 0 && this._isMixin(data);
  }
  getAncestors(_class) {
    const result = this.ancestors.get(_class);
    if (result === void 0) {
      throw new Error("ancestors not found: " + _class);
    }
    return result;
  }
  getClass(_class) {
    const data = this.classifiers.get(_class);
    if (data === void 0 || this.isInterface(data)) {
      throw new Error("class not found: " + _class);
    }
    return data;
  }
  findClass(_class) {
    const data = this.classifiers.get(_class);
    if (data === void 0 || this.isInterface(data)) {
      return void 0;
    }
    return data;
  }
  hasClass(_class) {
    const data = this.classifiers.get(_class);
    return !(data === void 0 || this.isInterface(data));
  }
  getClassOrInterface(_class) {
    const data = this.classifiers.get(_class);
    if (data === void 0) {
      throw new Error("class not found: " + _class);
    }
    return data;
  }
  getInterface(_interface) {
    const data = this.classifiers.get(_interface);
    if (data === void 0 || !this.isInterface(data)) {
      throw new Error("interface not found: " + _interface);
    }
    return data;
  }
  getDomain(_class) {
    const domain = this.findDomain(_class);
    if (domain === void 0) {
      throw new Error(`domain not found: ${_class} `);
    }
    return domain;
  }
  findDomain(_class) {
    const klazz = this.findClass(_class);
    if (klazz === void 0) return;
    if (klazz.domain !== void 0) {
      return klazz.domain;
    }
    let _klazz = klazz;
    while (_klazz.extends !== void 0) {
      _klazz = this.findClass(_klazz.extends);
      if (_klazz === void 0) return;
      if (_klazz.domain !== void 0) {
        klazz.domain = _klazz.domain;
        return _klazz.domain;
      }
    }
  }
  tx(tx) {
    switch (tx._class) {
      case import_component.default.class.TxCreateDoc:
        this.txCreateDoc(tx);
        return;
      case import_component.default.class.TxUpdateDoc:
        this.txUpdateDoc(tx);
        return;
      case import_component.default.class.TxRemoveDoc:
        this.txRemoveDoc(tx);
        return;
      case import_component.default.class.TxMixin:
        this.txMixin(tx);
    }
  }
  isClassifierTx(tx) {
    const base = [import_component.default.class.Class, import_component.default.class.Mixin, import_component.default.class.Interface];
    return base.includes(tx.objectClass) || this.isDerived(tx.objectClass, import_component.default.class.Class);
  }
  txCreateDoc(tx) {
    if (this.isClassifierTx(tx)) {
      const _id = tx.objectId;
      this.classifiers.set(_id, import_tx.TxProcessor.createDoc2Doc(tx));
      this.updateAncestors(_id);
      this.updateDescendant(_id);
    } else if (tx.objectClass === import_component.default.class.Attribute) {
      const createTx = tx;
      this.addAttribute(import_tx.TxProcessor.createDoc2Doc(createTx));
    }
  }
  txUpdateDoc(tx) {
    if (tx.objectClass === import_component.default.class.Attribute) {
      const updateTx = tx;
      const doc = this.attributesById.get(updateTx.objectId);
      if (doc === void 0) return;
      this.addAttribute(import_tx.TxProcessor.updateDoc2Doc(doc, updateTx));
      this.classifierProperties.delete(doc.attributeOf);
    } else if (this.isClassifierTx(tx)) {
      const updateTx = tx;
      const doc = this.classifiers.get(updateTx.objectId);
      if (doc === void 0) return;
      import_tx.TxProcessor.updateDoc2Doc(doc, updateTx);
      this.classifierProperties.delete(doc._id);
    }
  }
  txRemoveDoc(tx) {
    if (tx.objectClass === import_component.default.class.Attribute) {
      const removeTx = tx;
      const doc = this.attributesById.get(removeTx.objectId);
      if (doc === void 0) return;
      const map = this.attributes.get(doc.attributeOf);
      map?.delete(doc.name);
      this.attributesById.delete(removeTx.objectId);
    } else if (this.isClassifierTx(tx)) {
      const removeTx = tx;
      this.updateDescendant(removeTx.objectId, false);
      this.updateAncestors(removeTx.objectId, false);
      this.classifiers.delete(removeTx.objectId);
    }
  }
  txMixin(tx) {
    if (this.isClassifierTx(tx)) {
      const obj = this.getClass(tx.objectId);
      import_tx.TxProcessor.updateMixin4Doc(obj, tx);
    }
  }
  /**
   * Check if passed _class is derived from `from` class.
   * It will iterate over parents.
   */
  isDerived(_class, from) {
    return this.ancestors.get(_class)?.includes(from) ?? false;
  }
  /**
   * Return first non interface/mixin parent
   */
  getBaseClass(_class) {
    let cl = _class;
    while (cl !== void 0) {
      const clz = this.getClass(cl);
      if (this.isClass(clz)) return cl;
      cl = clz.extends;
    }
    return import_component.default.class.Doc;
  }
  /**
   * Check if passed _class implements passed interfaces `from`.
   * It will check for class parents and their interfaces.
   */
  isImplements(_class, from) {
    let cl = _class;
    while (cl !== void 0) {
      const klazz = this.getClass(cl);
      if (this.isExtends(klazz.implements ?? [], from)) {
        return true;
      }
      cl = klazz.extends;
    }
    return false;
  }
  /**
   * Check if interface extends passed interface.
   */
  isExtends(extendsOrImplements, from) {
    const result = [];
    const toVisit = [...extendsOrImplements];
    while (toVisit.length > 0) {
      const ref = toVisit.shift();
      if (ref === from) {
        return true;
      }
      addIf(result, ref);
      toVisit.push(...this.ancestorsOf(ref));
    }
    return false;
  }
  getDescendants(_class) {
    const data = this.descendants.get(_class);
    if (data === void 0) {
      throw new Error("descendants not found: " + _class);
    }
    return data;
  }
  updateDescendant(_class, add = true) {
    let hierarchy = [];
    try {
      hierarchy = this.getAncestors(_class);
    } catch (err) {
      if (add) {
        throw err;
      }
    }
    for (const cls of hierarchy) {
      const list = this.descendants.get(cls);
      if (list === void 0) {
        if (add) {
          this.descendants.set(cls, [_class]);
        }
      } else {
        if (add) {
          list.push(_class);
        } else {
          const pos = list.indexOf(_class);
          if (pos !== -1) {
            list.splice(pos, 1);
          }
        }
      }
    }
  }
  updateAncestors(_class, add = true) {
    const cl = [_class];
    const visited = /* @__PURE__ */ new Set();
    const ancestorList = [];
    while (cl.length > 0) {
      const classifier = cl.shift();
      if (addNew(visited, classifier)) {
        ancestorList.push(classifier);
        cl.push(...this.ancestorsOf(classifier));
      }
    }
    if (add) {
      this.ancestors.set(_class, ancestorList);
    } else {
      this.ancestors.delete(_class);
    }
  }
  /**
   * Return extends and implemnets as combined list of references
   */
  ancestorsOf(classifier) {
    const attrs = this.classifiers.get(classifier);
    const result = [];
    if (this.isClass(attrs) || this._isMixin(attrs)) {
      const cls = attrs;
      if (cls.extends !== void 0) {
        result.push(cls.extends);
      }
      result.push(...cls.implements ?? []);
    }
    if (this.isInterface(attrs)) {
      result.push(...attrs.extends ?? []);
    }
    return result;
  }
  isClass(attrs) {
    return attrs?.kind === import_classes.ClassifierKind.CLASS;
  }
  _isMixin(attrs) {
    return attrs?.kind === import_classes.ClassifierKind.MIXIN;
  }
  isInterface(attrs) {
    return attrs?.kind === import_classes.ClassifierKind.INTERFACE;
  }
  addAttribute(attribute) {
    const _class = attribute.attributeOf;
    let attributes = this.attributes.get(_class);
    if (attributes === void 0) {
      attributes = /* @__PURE__ */ new Map();
      this.attributes.set(_class, attributes);
    }
    attributes.set(attribute.name, attribute);
    this.attributesById.set(attribute._id, attribute);
    this.classifierProperties.delete(attribute.attributeOf);
  }
  getAllAttributes(clazz, to, traverse) {
    const result = /* @__PURE__ */ new Map();
    let ancestors = this.getAncestors(clazz);
    if (to !== void 0) {
      const toAncestors = this.getAncestors(to);
      for (const uto of toAncestors) {
        if (ancestors.includes(uto)) {
          to = uto;
          break;
        }
      }
      ancestors = ancestors.filter(
        (c) => c !== to && (this.isInterface(this.classifiers.get(c)) || this.isDerived(c, to))
      );
    }
    for (let index = ancestors.length - 1; index >= 0; index--) {
      const cls = ancestors[index];
      const attributes = this.attributes.get(cls);
      if (attributes !== void 0) {
        for (const [name, attr] of attributes) {
          traverse?.(name, attr);
          result.set(name, attr);
        }
      }
    }
    return result;
  }
  getOwnAttributes(clazz) {
    const result = /* @__PURE__ */ new Map();
    const attributes = this.attributes.get(clazz);
    if (attributes !== void 0) {
      for (const [name, attr] of attributes) {
        result.set(name, attr);
      }
    }
    return result;
  }
  getParentClass(_class) {
    const baseDomain = this.getDomain(_class);
    const ancestors = this.getAncestors(_class);
    let result = _class;
    for (const ancestor of ancestors) {
      try {
        const domain = this.getClass(ancestor).domain;
        if (domain === baseDomain) {
          result = ancestor;
        }
      } catch {
      }
    }
    return result;
  }
  getAttribute(classifier, name) {
    const attr = this.findAttribute(classifier, name);
    if (attr === void 0) {
      throw new Error("attribute not found: " + name);
    }
    return attr;
  }
  findAttribute(classifier, name) {
    const list = [classifier];
    const visited = /* @__PURE__ */ new Set();
    while (list.length > 0) {
      const cl = list.shift();
      if (addNew(visited, cl)) {
        const attribute = this.attributes.get(cl)?.get(name);
        if (attribute !== void 0) {
          return attribute;
        }
        list.push(...this.ancestorsOf(cl));
      }
    }
  }
  updateLookupMixin(_class, result, options) {
    const baseClass = this.getBaseClass(_class);
    const vResult = baseClass !== _class ? this.as(result, _class) : result;
    const lookup = result.$lookup;
    if (lookup !== void 0) {
      const lu = options?.lookup;
      if (lu?._id !== void 0) {
        for (const [k, v] of Object.entries(lu._id)) {
          const _cl = getClass(v);
          if (this.isMixin(_cl)) {
            const mval = lookup[k];
            if (mval !== void 0) {
              if (Array.isArray(mval)) {
                ;
                lookup[k] = mval.map((it) => this.as(it, _cl));
              } else {
                ;
                lookup[k] = this.as(mval, _cl);
              }
            }
          }
        }
      }
      for (const [k, v] of Object.entries(lu ?? {})) {
        if (k === "_id") {
          continue;
        }
        const _cl = getClass(v);
        if (this.isMixin(_cl)) {
          const mval = lookup[k];
          if (mval != null) {
            ;
            lookup[k] = this.as(mval, _cl);
          }
        }
      }
    }
    return vResult;
  }
  clone(obj) {
    return (0, import_clone.clone)(
      obj,
      (doc, m) => this.as(doc, m),
      (value) => Hierarchy.mixinClass(value)
    );
  }
  domains() {
    const classes = Array.from(this.classifiers.values()).filter(
      (it) => this.isClass(it) || this._isMixin(it)
    );
    return classes.map((it) => it.domain).filter((it) => it !== void 0).filter((it, idx, array) => array.findIndex((pt) => pt === it) === idx);
  }
  getClassifierProp(cl, prop) {
    return this.classifierProperties.get(cl)?.get(prop);
  }
  setClassifierProp(cl, prop, value) {
    let cur = this.classifierProperties.get(cl);
    if (cur === void 0) {
      cur = /* @__PURE__ */ new Map();
      this.classifierProperties.set(cl, cur);
    }
    cur.set(prop, value);
  }
}
function addNew(val, value) {
  if (val.has(value)) {
    return false;
  }
  val.add(value);
  return true;
}
__name(addNew, "addNew");
function addIf(array, value) {
  if (!array.includes(value)) {
    array.push(value);
  }
}
__name(addIf, "addIf");
function getClass(vvv) {
  if (Array.isArray(vvv)) {
    return vvv[0];
  }
  return vvv;
}
__name(getClass, "getClass");
//# sourceMappingURL=hierarchy.js.map
