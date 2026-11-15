"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var collaboration_exports = {};
__export(collaboration_exports, {
  makeCollabId: () => makeCollabId,
  makeCollabJsonId: () => makeCollabJsonId,
  makeCollabYdocId: () => makeCollabYdocId,
  makeDocCollabId: () => makeDocCollabId
});
module.exports = __toCommonJS(collaboration_exports);
function makeCollabId(objectClass, objectId, objectAttr) {
  return { objectClass, objectId, objectAttr };
}
__name(makeCollabId, "makeCollabId");
function makeDocCollabId(doc, objectAttr) {
  return makeCollabId(doc._class, doc._id, objectAttr);
}
__name(makeDocCollabId, "makeDocCollabId");
function makeCollabYdocId(doc) {
  const { objectId, objectAttr } = doc;
  return `${objectId}%${objectAttr}`;
}
__name(makeCollabYdocId, "makeCollabYdocId");
function makeCollabJsonId(doc) {
  const timestamp = Date.now();
  const { objectId, objectAttr } = doc;
  return [objectId, objectAttr, timestamp].join("-");
}
__name(makeCollabJsonId, "makeCollabJsonId");
//# sourceMappingURL=collaboration.js.map
