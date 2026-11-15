"use strict";
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
var analytics_exports = {};
__export(analytics_exports, {
  DocumentEvents: () => DocumentEvents
});
module.exports = __toCommonJS(analytics_exports);
var DocumentEvents = /* @__PURE__ */ ((DocumentEvents2) => {
  DocumentEvents2["CreateDocumentButtonClicked"] = "document.CreateButtonClicked";
  DocumentEvents2["PlusDocumentButtonClicked"] = "document.PlusButtonClicked";
  DocumentEvents2["DocumentCreated"] = "document.Created";
  DocumentEvents2["TeamspaceCreated"] = "document.CreatedTeamspace";
  DocumentEvents2["DocumentEdited"] = "document.Edited";
  DocumentEvents2["DocumentOpened"] = "document.Opened";
  return DocumentEvents2;
})(DocumentEvents || {});
//# sourceMappingURL=analytics.js.map
