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
var rpc_exports = {};
__export(rpc_exports, {
  RPCHandler: () => RPCHandler,
  fromStatus: () => fromStatus,
  rpcJSONReceiver: () => rpcJSONReceiver,
  rpcJSONReplacer: () => rpcJSONReplacer
});
module.exports = __toCommonJS(rpc_exports);
var import_platform = __toESM(require("../../platform/lib/index.js"));
var import_msgpackr = require("../../../msgpackr/dist/node.cjs");
function isTotalArray(value) {
  return Array.isArray(value) && (value.total !== void 0 || value.lookupMap !== void 0);
}
__name(isTotalArray, "isTotalArray");
function rpcJSONReplacer(key, value) {
  if (isTotalArray(value)) {
    return {
      dataType: "TotalArray",
      total: value.total,
      lookupMap: value.lookupMap,
      value: [...value]
    };
  } else if (typeof value === "object" && value !== null && "domain" in value && typeof value.domain === "string" && "value" in value && isTotalArray(value.value)) {
    return {
      ...value,
      value: {
        dataType: "TotalArray",
        total: value.value.total,
        lookupMap: value.value.lookupMap,
        value: [...value.value]
      }
    };
  } else {
    return value ?? null;
  }
}
__name(rpcJSONReplacer, "rpcJSONReplacer");
function rpcJSONReceiver(key, value) {
  if (typeof value === "object" && value !== null) {
    if (value.dataType === "TotalArray") {
      return Object.assign(value.value, { total: value.total, lookupMap: value.lookupMap });
    } else if ("domain" in value && typeof value.domain === "string" && "value" in value && value.value != null && value.value.dataType === "TotalArray") {
      return {
        ...value,
        value: Object.assign(value.value.value, { total: value.value.total, lookupMap: value.value.lookupMap })
      };
    }
  }
  return value;
}
__name(rpcJSONReceiver, "rpcJSONReceiver");
class RPCHandler {
  static {
    __name(this, "RPCHandler");
  }
  packr = new import_msgpackr.Packr({ structuredClone: true, bundleStrings: true, copyBuffers: false });
  protoSerialize(object, binary) {
    if (!binary) {
      return JSON.stringify(object, rpcJSONReplacer);
    }
    return new Uint8Array(this.packr.pack(object));
  }
  protoDeserialize(data, binary) {
    if (!binary) {
      let _data = data;
      if (_data instanceof ArrayBuffer) {
        const decoder = new TextDecoder();
        _data = decoder.decode(_data);
      }
      try {
        return JSON.parse(_data.toString(), rpcJSONReceiver);
      } catch (err) {
        if ((err.message ?? "").includes("Unexpected token")) {
          return this.packr.unpack(new Uint8Array(data));
        }
      }
    }
    return this.packr.unpack(new Uint8Array(data));
  }
  /**
   * @public
   * @param object -
   * @returns
   */
  serialize(object, binary) {
    if (object.result !== void 0) {
      ;
      object.result = rpcJSONReplacer("result", object.result);
    }
    return this.protoSerialize(object, binary);
  }
  /**
   * @public
   * @param response -
   * @returns
   */
  readResponse(response, binary) {
    const data = this.protoDeserialize(response, binary);
    if (data.result !== void 0) {
      data.result = rpcJSONReceiver("result", data.result);
    }
    return data;
  }
  /**
   * @public
   * @param request -
   * @returns
   */
  readRequest(request, binary) {
    const result = this.protoDeserialize(request, binary);
    if (typeof result.method !== "string") {
      throw new import_platform.PlatformError(new import_platform.Status(import_platform.Severity.ERROR, import_platform.default.status.BadRequest, {}));
    }
    return result;
  }
}
function fromStatus(status, id) {
  return { id, error: status };
}
__name(fromStatus, "fromStatus");
//# sourceMappingURL=rpc.js.map
