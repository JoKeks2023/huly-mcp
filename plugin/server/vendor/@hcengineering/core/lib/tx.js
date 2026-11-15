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
var tx_exports = {};
__export(tx_exports, {
  DOMAIN_TX: () => DOMAIN_TX,
  TxFactory: () => TxFactory,
  TxProcessor: () => TxProcessor,
  WorkspaceEvent: () => WorkspaceEvent
});
module.exports = __toCommonJS(tx_exports);
var import_clone = require("./clone.js");
var import_component = __toESM(require("./component.js"));
var import_objvalue = require("./objvalue.js");
var import_operator = require("./operator.js");
var import_proxy = require("./proxy.js");
var import_utils = require("./utils.js");
var WorkspaceEvent = /* @__PURE__ */ ((WorkspaceEvent2) => {
  WorkspaceEvent2[WorkspaceEvent2["UpgradeScheduled"] = 0] = "UpgradeScheduled";
  WorkspaceEvent2[WorkspaceEvent2["IndexingUpdate"] = 1] = "IndexingUpdate";
  WorkspaceEvent2[WorkspaceEvent2["SecurityChange"] = 2] = "SecurityChange";
  WorkspaceEvent2[WorkspaceEvent2["MaintenanceNotification"] = 3] = "MaintenanceNotification";
  WorkspaceEvent2[WorkspaceEvent2["BulkUpdate"] = 4] = "BulkUpdate";
  WorkspaceEvent2[WorkspaceEvent2["LastTx"] = 5] = "LastTx";
  return WorkspaceEvent2;
})(WorkspaceEvent || {});
const DOMAIN_TX = "tx";
class TxProcessor {
  static {
    __name(this, "TxProcessor");
  }
  async tx(...txes) {
    const result = [];
    for (const tx of txes) {
      switch (tx._class) {
        case import_component.default.class.TxCreateDoc:
          result.push(await this.txCreateDoc(tx));
          break;
        case import_component.default.class.TxUpdateDoc:
          result.push(await this.txUpdateDoc(tx));
          break;
        case import_component.default.class.TxRemoveDoc:
          result.push(await this.txRemoveDoc(tx));
          break;
        case import_component.default.class.TxMixin:
          result.push(await this.txMixin(tx));
          break;
        case import_component.default.class.TxApplyIf:
          return await Promise.resolve([]);
      }
    }
    return result;
  }
  static createDoc2Doc(tx, doClone = true) {
    const attached = tx.attachedTo !== void 0 ? {
      attachedTo: tx.attachedTo,
      attachedToClass: tx.attachedToClass,
      collection: tx.collection
    } : {};
    return {
      ...doClone ? (0, import_clone.clone)(tx.attributes) : tx.attributes,
      ...attached,
      _id: tx.objectId,
      _class: tx.objectClass,
      space: tx.objectSpace,
      modifiedBy: tx.modifiedBy,
      modifiedOn: tx.modifiedOn,
      createdBy: tx.createdBy ?? tx.modifiedBy,
      createdOn: tx.createdOn ?? tx.modifiedOn
    };
  }
  static updateDoc2Doc(rawDoc, tx) {
    const doc = (0, import_proxy._toDoc)(rawDoc);
    TxProcessor.applyUpdate(doc, tx.operations);
    doc.modifiedBy = tx.modifiedBy;
    doc.modifiedOn = tx.modifiedOn;
    return rawDoc;
  }
  static applyUpdate(doc, ops) {
    for (const key in ops) {
      if (key.startsWith("$")) {
        const operator = (0, import_operator._getOperator)(key);
        operator(doc, ops[key]);
      } else {
        (0, import_objvalue.setObjectValue)(key, doc, ops[key]);
      }
    }
  }
  static updateMixin4Doc(rawDoc, tx) {
    const ops = tx.attributes;
    const doc = (0, import_proxy._toDoc)(rawDoc);
    const mixin = doc[tx.mixin] ?? {};
    for (const key in ops) {
      if (key.startsWith("$")) {
        const operator = (0, import_operator._getOperator)(key);
        operator(mixin, ops[key]);
      } else {
        (0, import_objvalue.setObjectValue)(key, mixin, ops[key]);
      }
    }
    rawDoc.modifiedBy = tx.modifiedBy;
    rawDoc.modifiedOn = tx.modifiedOn;
    doc[tx.mixin] = mixin;
    return rawDoc;
  }
  static buildDoc2Doc(txes) {
    let doc;
    const deleteTx = txes.find((tx) => tx._class === import_component.default.class.TxRemoveDoc);
    if (deleteTx !== void 0) {
      return null;
    }
    const createTx = txes.find((tx) => tx._class === import_component.default.class.TxCreateDoc);
    if (createTx === void 0) {
      return;
    }
    doc = TxProcessor.createDoc2Doc(createTx);
    for (const tx of txes) {
      if (tx._class === import_component.default.class.TxUpdateDoc) {
        doc = TxProcessor.updateDoc2Doc(doc, tx);
      } else if (tx._class === import_component.default.class.TxMixin) {
        const mixinTx = tx;
        doc = TxProcessor.updateMixin4Doc(doc, mixinTx);
      }
    }
    return doc;
  }
  static isExtendsCUD(_class) {
    return _class === import_component.default.class.TxCreateDoc || _class === import_component.default.class.TxUpdateDoc || _class === import_component.default.class.TxRemoveDoc || _class === import_component.default.class.TxMixin;
  }
  static txHasUpdate(tx, attribute) {
    const ops = tx.operations;
    if (ops[attribute] !== void 0) return true;
    for (const op in ops) {
      if (op.startsWith("$")) {
        const opValue = ops[op];
        for (const key in opValue) {
          if (key === attribute || key.startsWith(attribute + ".")) {
            return true;
          }
        }
      }
    }
    return false;
  }
}
class TxFactory {
  constructor(account, isDerived = false) {
    this.account = account;
    this.isDerived = isDerived;
    this.txSpace = isDerived ? import_component.default.space.DerivedTx : import_component.default.space.Tx;
  }
  static {
    __name(this, "TxFactory");
  }
  txSpace;
  createTxCreateDoc(_class, space, attributes, objectId, modifiedOn, modifiedBy) {
    return {
      _id: (0, import_utils.generateId)(),
      _class: import_component.default.class.TxCreateDoc,
      space: this.txSpace,
      objectId: objectId ?? (0, import_utils.generateId)(),
      objectClass: _class,
      objectSpace: space,
      modifiedOn: modifiedOn ?? Date.now(),
      modifiedBy: modifiedBy ?? this.account,
      createdBy: modifiedBy ?? this.account,
      attributes
    };
  }
  createTxCollectionCUD(_class, objectId, space, collection, tx, modifiedOn, modifiedBy) {
    return {
      ...tx,
      collection,
      attachedTo: objectId,
      attachedToClass: _class,
      modifiedOn: modifiedOn ?? Date.now(),
      modifiedBy: modifiedBy ?? this.account
    };
  }
  createTxUpdateDoc(_class, space, objectId, operations, retrieve, modifiedOn, modifiedBy) {
    return {
      _id: (0, import_utils.generateId)(),
      _class: import_component.default.class.TxUpdateDoc,
      space: this.txSpace,
      modifiedBy: modifiedBy ?? this.account,
      modifiedOn: modifiedOn ?? Date.now(),
      objectId,
      objectClass: _class,
      objectSpace: space,
      operations,
      retrieve
    };
  }
  createTxRemoveDoc(_class, space, objectId, modifiedOn, modifiedBy) {
    return {
      _id: (0, import_utils.generateId)(),
      _class: import_component.default.class.TxRemoveDoc,
      space: this.txSpace,
      modifiedBy: modifiedBy ?? this.account,
      modifiedOn: modifiedOn ?? Date.now(),
      objectId,
      objectClass: _class,
      objectSpace: space
    };
  }
  createTxMixin(objectId, objectClass, objectSpace, mixin, attributes, modifiedOn, modifiedBy) {
    return {
      _id: (0, import_utils.generateId)(),
      _class: import_component.default.class.TxMixin,
      space: this.txSpace,
      modifiedBy: modifiedBy ?? this.account,
      modifiedOn: modifiedOn ?? Date.now(),
      objectId,
      objectClass,
      objectSpace,
      mixin,
      attributes
    };
  }
  createTxApplyIf(space, scope, match, notMatch, txes, measureName, notify = true, extraNotify = [], modifiedOn, modifiedBy) {
    return {
      _id: (0, import_utils.generateId)(),
      _class: import_component.default.class.TxApplyIf,
      space: this.txSpace,
      modifiedBy: modifiedBy ?? this.account,
      modifiedOn: modifiedOn ?? Date.now(),
      objectSpace: space,
      scope,
      match,
      notMatch,
      txes,
      measureName,
      notify,
      extraNotify
    };
  }
}
//# sourceMappingURL=tx.js.map
