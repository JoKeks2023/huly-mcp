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
var token_exports = {};
__export(token_exports, {
  TokenError: () => TokenError,
  decodeToken: () => decodeToken,
  decodeTokenVerbose: () => decodeTokenVerbose,
  generateToken: () => generateToken
});
module.exports = __toCommonJS(token_exports);
var import_platform = require("../../platform/lib/index.js");
var import_jwt_simple = require("../../../jwt-simple/index.js");
var import_uuid = require("../../../uuid/dist/cjs/index.js");
var import_plugin = __toESM(require("./plugin.js"));
class TokenError extends Error {
  static {
    __name(this, "TokenError");
  }
  constructor(message) {
    super(message);
    this.name = "TokenError";
  }
}
const getSecret = /* @__PURE__ */ __name(() => {
  return (0, import_platform.getMetadata)(import_plugin.default.metadata.Secret) ?? "secret";
}, "getSecret");
function generateToken(accountUuid, workspaceUuid, extra, secret, options) {
  if (!(0, import_uuid.validate)(accountUuid)) {
    throw new TokenError(`Invalid account uuid: "${accountUuid}"`);
  }
  if (workspaceUuid !== void 0 && !(0, import_uuid.validate)(workspaceUuid)) {
    throw new TokenError(`Invalid workspace uuid: "${workspaceUuid}"`);
  }
  const { grant, nbf, exp, sub } = options ?? {};
  if (grant?.workspace !== void 0 && !(0, import_uuid.validate)(grant?.workspace)) {
    throw new TokenError(`Invalid grant workspace uuid: "${grant?.workspace}"`);
  }
  if (grant != null && sub == null && (nbf == null || exp == null)) {
    throw new TokenError("nbf and exp are required when sub is not provided");
  }
  const service = (0, import_platform.getMetadata)(import_plugin.default.metadata.Service);
  if (service !== void 0) {
    extra = { service, ...extra };
  }
  const sanitizedGrant = grant !== void 0 ? {
    workspace: grant.workspace,
    role: grant.role,
    grantedBy: grant.grantedBy,
    firstName: grant.firstName,
    lastName: grant.lastName,
    spaces: grant.spaces,
    extra: grant.extra
  } : void 0;
  return (0, import_jwt_simple.encode)(
    {
      ...extra !== void 0 ? { extra } : {},
      account: accountUuid,
      workspace: workspaceUuid,
      grant: sanitizedGrant,
      sub,
      exp,
      nbf
    },
    secret ?? getSecret()
  );
}
__name(generateToken, "generateToken");
function decodeToken(token, verify = true, secret) {
  try {
    return (0, import_jwt_simple.decode)(token, secret ?? getSecret(), !verify);
  } catch (err) {
    throw new TokenError(err.message);
  }
}
__name(decodeToken, "decodeToken");
function decodeTokenVerbose(ctx, token) {
  try {
    return decodeToken(token);
  } catch (err) {
    try {
      const decode2 = decodeToken(token, false);
      ctx.warn("Failed to verify token", { ...decode2 });
    } catch (err2) {
    }
    throw new TokenError(err.message);
  }
}
__name(decodeTokenVerbose, "decodeTokenVerbose");
//# sourceMappingURL=token.js.map
