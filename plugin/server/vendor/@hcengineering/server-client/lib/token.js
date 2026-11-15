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
var token_exports = {};
__export(token_exports, {
  extractToken: () => extractToken,
  readToken: () => readToken
});
module.exports = __toCommonJS(token_exports);
var import_server_token = require("../../server-token/lib/index.js");
const extractCookieToken = /* @__PURE__ */ __name((cookie) => {
  if (cookie === void 0 || cookie === null) {
    return null;
  }
  const cookies = cookie.split(";");
  const tokenCookie = cookies.find((cookie2) => cookie2.toLocaleLowerCase().includes("token"));
  if (tokenCookie === void 0) {
    return null;
  }
  const encodedToken = tokenCookie.split("=")[1];
  if (encodedToken === void 0) {
    return null;
  }
  return encodedToken;
}, "extractCookieToken");
const extractAuthorizationToken = /* @__PURE__ */ __name((authorization) => {
  if (authorization === void 0 || authorization === null) {
    return null;
  }
  const encodedToken = authorization.split(" ")[1];
  if (encodedToken === void 0) {
    return null;
  }
  return encodedToken;
}, "extractAuthorizationToken");
function readToken(headers) {
  try {
    return extractAuthorizationToken(headers.authorization) ?? extractCookieToken(headers.cookie) ?? void 0;
  } catch {
    return void 0;
  }
}
__name(readToken, "readToken");
function extractToken(headers) {
  try {
    const tokenStr = readToken(headers);
    return tokenStr !== void 0 ? (0, import_server_token.decodeToken)(tokenStr) : void 0;
  } catch {
    return void 0;
  }
}
__name(extractToken, "extractToken");
//# sourceMappingURL=token.js.map
