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
var cache_exports = {};
__export(cache_exports, {
  default: () => ContactCache
});
module.exports = __toCommonJS(cache_exports);
var import_core = __toESM(require("../../core/lib/index.js"));
var import__ = __toESM(require("./index.js"));
function isCreateTx(tx) {
  return tx._class === import_core.default.class.TxCreateDoc;
}
__name(isCreateTx, "isCreateTx");
function isUpdateTx(tx) {
  return tx._class === import_core.default.class.TxUpdateDoc;
}
__name(isUpdateTx, "isUpdateTx");
function isMixinTx(tx) {
  return tx._class === import_core.default.class.TxMixin;
}
__name(isMixinTx, "isMixinTx");
function isPersonTx(tx) {
  return tx.objectClass === import__.default.class.Person;
}
__name(isPersonTx, "isPersonTx");
function isSocialIdentityTx(tx) {
  return tx.objectClass === import__.default.class.SocialIdentity;
}
__name(isSocialIdentityTx, "isSocialIdentityTx");
class ContactCache {
  static {
    __name(this, "ContactCache");
  }
  static _instance;
  /**
   * [PersonId (socialId _id) => Ref<Person>] cache
   */
  _personIdsByPersonRef = /* @__PURE__ */ new Map();
  /**
   * [PersonId (socialId _id) => Ref<Person>] cache
   */
  _personRefByPersonId = /* @__PURE__ */ new Map();
  /**
   * [PersonId (socialId _id) => Person] cache
   */
  _personByPersonId = /* @__PURE__ */ new Map();
  /**
   * [Ref<Person> => Person] cache
   */
  _personByRef = /* @__PURE__ */ new Map();
  /**
   * [PersonId (socialId _id) => SocialIdentity] cache
   */
  _socialIdByPersonId = /* @__PURE__ */ new Map();
  _changeListeners = [];
  constructor() {
  }
  static get instance() {
    if (this._instance === void 0) {
      this._instance = new ContactCache();
    }
    return this._instance;
  }
  get personRefByPersonId() {
    return this._personRefByPersonId;
  }
  get personByPersonId() {
    return this._personByPersonId;
  }
  get personByRef() {
    return this._personByRef;
  }
  get socialIdByPersonId() {
    return this._socialIdByPersonId;
  }
  addPersonIdToPersonRef(personRef, personId) {
    this._personIdsByPersonRef.set(personRef, (this._personIdsByPersonRef.get(personRef) ?? /* @__PURE__ */ new Set()).add(personId));
  }
  fillCachesForPersonId(personId, socialId) {
    if (socialId == null) {
      this._personRefByPersonId.set(personId, null);
      this._personByPersonId.set(personId, null);
      this._socialIdByPersonId.set(personId, null);
      return;
    }
    const person = socialId.$lookup?.attachedTo;
    this._personRefByPersonId.set(personId, socialId.attachedTo);
    this.addPersonIdToPersonRef(socialId.attachedTo, personId);
    this._personByPersonId.set(personId, person ?? null);
    this._socialIdByPersonId.set(personId, socialId);
    if (person != null) {
      this._personByRef.set(person._id, person);
    }
  }
  fillCachesForPersonRef(personRef, person) {
    this._personByRef.set(personRef, person ?? null);
    for (const sidObj of person?.$lookup?.socialIds ?? []) {
      this._personRefByPersonId.set(sidObj._id, personRef);
      this.addPersonIdToPersonRef(personRef, sidObj._id);
      this._personByPersonId.set(sidObj._id, person ?? null);
    }
  }
  shouldHandleCreateTx(tx) {
    return isCreateTx(tx) && (isPersonTx(tx) || isSocialIdentityTx(tx));
  }
  shouldHandleUpdateOrMixinTx(tx) {
    return (isUpdateTx(tx) || isMixinTx(tx)) && isPersonTx(tx);
  }
  handleTx = /* @__PURE__ */ __name((txes) => {
    for (const tx of txes) {
      if (this.shouldHandleCreateTx(tx)) {
        if (isPersonTx(tx)) {
          this.handleCreatePersonTx(tx);
        } else if (isSocialIdentityTx(tx)) {
          this.handleCreateSocialIdentityTx(tx);
        }
      } else if (this.shouldHandleUpdateOrMixinTx(tx)) {
        this.handleUpdateOrMixinPersonTx(tx);
      }
    }
  }, "handleTx");
  handleCreatePersonTx(tx) {
    const ref = tx.objectId;
    const person = this._personByRef.get(ref);
    if (person === void 0) return;
    const createdPerson = import_core.TxProcessor.createDoc2Doc(tx);
    this._personByRef.set(ref, createdPerson);
    const personIds = Array.from(this._personIdsByPersonRef.get(ref) ?? []);
    for (const personId of personIds) {
      this._personByPersonId.set(personId, createdPerson);
    }
    this.broadcastChange({
      personRef: ref,
      personIds
    });
  }
  handleCreateSocialIdentityTx(tx) {
    const personId = tx.objectId;
    const personRef = this._personRefByPersonId.get(personId);
    if (personRef === void 0) return;
    const newPersonRef = tx.attachedTo;
    this._personRefByPersonId.set(personId, newPersonRef);
    this.addPersonIdToPersonRef(newPersonRef, personId);
    const createdSocialId = import_core.TxProcessor.createDoc2Doc(tx);
    this._socialIdByPersonId.set(personId, createdSocialId);
    this.broadcastChange({
      personRef: newPersonRef,
      personIds: [personId]
    });
  }
  handleUpdateOrMixinPersonTx(tx) {
    const ref = tx.objectId;
    const person = this._personByRef.get(ref);
    if (person == null) return;
    const updatedPerson = isUpdateTx(tx) ? import_core.TxProcessor.updateDoc2Doc(person, tx) : import_core.TxProcessor.updateMixin4Doc(person, tx);
    this._personByRef.set(ref, updatedPerson);
    const personIds = Array.from(this._personIdsByPersonRef.get(ref) ?? []);
    for (const personId of personIds) {
      this._personByPersonId.set(personId, updatedPerson);
    }
    this.broadcastChange({
      personRef: ref,
      personIds
    });
  }
  addChangeListener(listener) {
    this._changeListeners.push(listener);
  }
  removeChangeListener(listener) {
    const pos = this._changeListeners.findIndex((it) => it === listener);
    if (pos !== -1) {
      this._changeListeners.splice(pos, 1);
    }
  }
  broadcastChange(change) {
    for (const listener of this._changeListeners) {
      void listener(change);
    }
  }
}
//# sourceMappingURL=cache.js.map
