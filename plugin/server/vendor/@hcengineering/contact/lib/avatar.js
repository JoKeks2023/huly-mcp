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
var avatar_exports = {};
__export(avatar_exports, {
  getAvatarDisplayName: () => getAvatarDisplayName,
  getAvatarProvider: () => getAvatarProvider,
  getAvatarUrlInfo: () => getAvatarUrlInfo
});
module.exports = __toCommonJS(avatar_exports);
var import_platform = require("../../platform/lib/index.js");
var import__ = __toESM(require("./index.js"));
const providers = /* @__PURE__ */ new Map();
async function getAvatarProvider(client, providerId) {
  const provider = providers.get(providerId);
  if (provider !== void 0) {
    return provider ?? void 0;
  }
  const res = await client.findOne(import__.default.class.AvatarProvider, { _id: providerId });
  providers.set(providerId, res ?? null);
  return res;
}
__name(getAvatarProvider, "getAvatarProvider");
async function getAvatarUrlInfo(client, avatar, width, name) {
  let url;
  let srcSet;
  let color;
  const displayName = getAvatarDisplayName(name);
  if (avatar != null) {
    const avatarProviderId = (0, import__.getAvatarProviderId)(avatar.avatarType);
    const avatarProvider = avatarProviderId !== void 0 ? await getAvatarProvider(client, avatarProviderId) : void 0;
    if (avatarProvider !== void 0) {
      const getUrlHandler = await (0, import_platform.getResource)(avatarProvider.getUrl);
      ({ url, srcSet, color } = await getUrlHandler(avatar, displayName, width));
    }
  }
  return {
    url,
    srcSet,
    color
  };
}
__name(getAvatarUrlInfo, "getAvatarUrlInfo");
function getAvatarDisplayName(name) {
  if (name == null) {
    return "";
  }
  const lastFirst = (0, import_platform.getMetadata)(import__.default.metadata.LastNameFirst) === true;
  const fname = (0, import__.getFirstName)(name ?? "").trim()[0] ?? "";
  const lname = (0, import__.getLastName)(name ?? "").trim()[0] ?? "";
  return lastFirst ? lname + fname : fname + lname;
}
__name(getAvatarDisplayName, "getAvatarDisplayName");
//# sourceMappingURL=avatar.js.map
