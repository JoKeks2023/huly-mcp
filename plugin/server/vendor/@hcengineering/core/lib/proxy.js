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
var proxy_exports = {};
__export(proxy_exports, {
  PROXY_MIXIN_CLASS_KEY: () => PROXY_MIXIN_CLASS_KEY,
  _createFreezeProxy: () => _createFreezeProxy,
  _createMixinProxy: () => _createMixinProxy,
  _mixinClass: () => _mixinClass,
  _toDoc: () => _toDoc,
  freeze: () => freeze
});
module.exports = __toCommonJS(proxy_exports);
var import_platform = require("../../platform/lib/index.js");
const PROXY_TARGET_KEY = "$___proxy_target";
const PROXY_MIXIN_CLASS_KEY = "$__mixin";
function _createMixinProxy(mixin, ancestorProxy) {
  return {
    get(target, property, receiver) {
      if (property === PROXY_TARGET_KEY) {
        return target;
      }
      if (property === PROXY_MIXIN_CLASS_KEY) {
        return mixin._id;
      }
      const value = target[mixin._id]?.[property];
      if (value === void 0) {
        return ancestorProxy !== null ? ancestorProxy.get?.(target, property, receiver) : target[property];
      }
      return value;
    }
  };
}
__name(_createMixinProxy, "_createMixinProxy");
function freeze(value) {
  if (value != null && typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map((it) => freeze(it));
    }
    if (value instanceof Map) {
      throw new import_platform.PlatformError((0, import_platform.unknownError)("Map is not allowed in model"));
    }
    if (value instanceof Set) {
      throw new import_platform.PlatformError((0, import_platform.unknownError)("Set is not allowed in model"));
    }
    return new Proxy(value, _createFreezeProxy(value));
  }
  return value;
}
__name(freeze, "freeze");
function _createFreezeProxy(doc) {
  return {
    get(target, property, receiver) {
      const value = target[property];
      return freeze(value);
    },
    set(target, p, newValue, receiver) {
      throw new import_platform.PlatformError((0, import_platform.unknownError)("Modification is not allowed"));
    },
    defineProperty(target, property, attributes) {
      throw new import_platform.PlatformError((0, import_platform.unknownError)("Modification is not allowed"));
    },
    deleteProperty(target, p) {
      throw new import_platform.PlatformError((0, import_platform.unknownError)("Modification is not allowed"));
    },
    setPrototypeOf(target, v) {
      throw new import_platform.PlatformError((0, import_platform.unknownError)("Modification is not allowed"));
    }
  };
}
__name(_createFreezeProxy, "_createFreezeProxy");
function _toDoc(doc) {
  const targetDoc = doc[PROXY_TARGET_KEY];
  if (targetDoc !== void 0) {
    return targetDoc;
  }
  return doc;
}
__name(_toDoc, "_toDoc");
function _mixinClass(doc) {
  return doc[PROXY_MIXIN_CLASS_KEY];
}
__name(_mixinClass, "_mixinClass");
//# sourceMappingURL=proxy.js.map
