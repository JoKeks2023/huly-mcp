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
var resource_exports = {};
__export(resource_exports, {
  addLocation: () => addLocation,
  getPlugins: () => getPlugins,
  getResource: () => getResource,
  getResourceC: () => getResourceC,
  getResourceP: () => getResourceP,
  getResourcePlugin: () => getResourcePlugin
});
module.exports = __toCommonJS(resource_exports);
var import_event = require("./event.js");
var import_ident = require("./ident.js");
var import_status = require("./status.js");
var import_metadata = require("./metadata.js");
var import_platform = __toESM(require("./platform.js"));
const locations = /* @__PURE__ */ new Map();
function addLocation(plugin, module2) {
  locations.set(plugin, module2);
}
__name(addLocation, "addLocation");
function getPlugins() {
  return Array.from(locations.keys());
}
__name(getPlugins, "getPlugins");
function getLocation(plugin) {
  const location = locations.get(plugin);
  if (location === void 0) {
    throw new import_status.PlatformError(
      new import_status.Status(import_status.Severity.ERROR, import_platform.default.status.NoLocationForPlugin, {
        plugin
      })
    );
  }
  return location;
}
__name(getLocation, "getLocation");
const loading = /* @__PURE__ */ new Map();
function loadPlugin(id) {
  let pluginLoader = loading.get(id);
  if (pluginLoader === void 0) {
    const status = new import_status.Status(import_status.Severity.INFO, import_platform.default.status.LoadingPlugin, {
      plugin: id
    });
    const loadHelper = (0, import_metadata.getMetadata)(import_platform.default.metadata.LoadHelper);
    const locationLoader = getLocation(id);
    pluginLoader = (0, import_event.monitor)(status, loadHelper !== void 0 ? loadHelper(locationLoader) : locationLoader()).then(
      async (plugin) => {
        try {
          if (typeof plugin.default === "object") {
            return await plugin.default.default();
          }
          return await plugin.default();
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
    );
    loading.set(id, pluginLoader);
  }
  return pluginLoader;
}
__name(loadPlugin, "loadPlugin");
const cachedResource = /* @__PURE__ */ new Map();
async function getResource(resource) {
  const cached = cachedResource.get(resource);
  if (cached !== void 0) {
    return cached;
  }
  const info = (0, import_ident._parseId)(resource);
  let resources = loading.get(info.component) ?? loadPlugin(info.component);
  if (resources instanceof Promise) {
    resources = await resources;
    loading.set(info.component, resources);
  }
  const value = resources[info.kind]?.[info.name];
  if (value === void 0) {
    throw new import_status.PlatformError(new import_status.Status(import_status.Severity.ERROR, import_platform.default.status.ResourceNotFound, { resource }));
  }
  cachedResource.set(resource, value);
  return value;
}
__name(getResource, "getResource");
function getResourceP(resource) {
  return cachedResource.get(resource) ?? getResource(resource);
}
__name(getResourceP, "getResourceP");
function getResourceC(resource, callback) {
  if (resource === void 0) {
    callback(void 0);
    return;
  }
  const cached = cachedResource.get(resource);
  if (cached !== void 0) {
    callback(cached);
  } else {
    void getResource(resource).then((r) => {
      callback(r);
    }).catch(() => {
      callback(void 0);
    });
  }
}
__name(getResourceC, "getResourceC");
function getResourcePlugin(resource) {
  const info = (0, import_ident._parseId)(resource);
  return info.component;
}
__name(getResourcePlugin, "getResourcePlugin");
//# sourceMappingURL=resource.js.map
