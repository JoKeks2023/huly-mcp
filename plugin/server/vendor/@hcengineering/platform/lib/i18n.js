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
var i18n_exports = {};
__export(i18n_exports, {
  addStringsLoader: () => addStringsLoader,
  loadPluginStrings: () => loadPluginStrings,
  translate: () => translate,
  translateCB: () => translateCB
});
module.exports = __toCommonJS(i18n_exports);
var import_intl_messageformat = require("../../../intl-messageformat/index.js");
var import_event = require("./event.js");
var import_ident = require("./ident.js");
var import_status = require("./status.js");
var import_metadata = require("./metadata.js");
var import_platform = __toESM(require("./platform.js"));
const loaders = /* @__PURE__ */ new Map();
const translations = /* @__PURE__ */ new Map();
const cache = /* @__PURE__ */ new Map();
const englishTranslationsForMissing = /* @__PURE__ */ new Map();
function addStringsLoader(plugin, loader) {
  loaders.set(plugin, loader);
}
__name(addStringsLoader, "addStringsLoader");
async function loadPluginStrings(locale, force = false) {
  if (force) {
    cache.clear();
  }
  for (const [plugin] of loaders) {
    const localtTanslations = translations.get(locale) ?? /* @__PURE__ */ new Map();
    if (!translations.has(locale)) {
      translations.set(locale, localtTanslations);
    }
    let messages = localtTanslations.get(plugin);
    if (messages === void 0 || force) {
      messages = await loadTranslationsForComponent(plugin, locale);
      localtTanslations.set(plugin, messages);
    }
  }
}
__name(loadPluginStrings, "loadPluginStrings");
async function loadTranslationsForComponent(plugin, locale) {
  const loader = loaders.get(plugin);
  if (loader === void 0) {
    const status = new import_status.Status(import_status.Severity.ERROR, import_platform.default.status.NoLoaderForStrings, { plugin });
    await (0, import_event.setPlatformStatus)(status);
    return status;
  }
  try {
    return await loader(locale);
  } catch (err) {
    console.error("No translations found for plugin", plugin, err);
    try {
      return await loader("en");
    } catch (err2) {
      const status = (0, import_status.unknownError)(err2);
      await (0, import_event.setPlatformStatus)(status);
      return status;
    }
  }
}
__name(loadTranslationsForComponent, "loadTranslationsForComponent");
function getCachedTranslation(id, locale) {
  const localtTanslations = translations.get(locale);
  if (localtTanslations === void 0) {
    return void 0;
  }
  const messages = localtTanslations.get(id.component);
  if (messages === void 0) {
    return void 0;
  }
  if (messages instanceof import_status.Status) {
    return messages;
  }
  if (id.kind !== void 0) {
    if (messages[id.kind]?.[id.name] !== void 0) {
      return messages[id.kind]?.[id.name];
    }
  }
}
__name(getCachedTranslation, "getCachedTranslation");
async function getTranslation(id, locale) {
  try {
    const localtTanslations = translations.get(locale) ?? /* @__PURE__ */ new Map();
    if (!translations.has(locale)) {
      translations.set(locale, localtTanslations);
    }
    let messages = localtTanslations.get(id.component);
    if (messages === void 0) {
      messages = await loadTranslationsForComponent(id.component, locale);
      localtTanslations.set(id.component, messages);
    }
    if (messages instanceof import_status.Status) {
      return messages;
    }
    if (id.kind !== void 0) {
      if (messages[id.kind]?.[id.name] !== void 0) {
        return messages[id.kind]?.[id.name];
      } else {
        let eng = englishTranslationsForMissing.get(id.component);
        if (eng === void 0) {
          eng = await loadTranslationsForComponent(id.component, "en");
          englishTranslationsForMissing.set(id.component, eng);
        }
        if (eng instanceof import_status.Status) {
          return eng;
        }
        return eng[id.kind]?.[id.name];
      }
    } else {
      return messages[id.name];
    }
  } catch (err) {
    const status = (0, import_status.unknownError)(err);
    await (0, import_event.setPlatformStatus)(status);
    return status;
  }
}
__name(getTranslation, "getTranslation");
async function translate(message, params, language) {
  const locale = language ?? (0, import_metadata.getMetadata)(import_platform.default.metadata.locale) ?? "en";
  const localCache = cache.get(locale) ?? /* @__PURE__ */ new Map();
  if (!cache.has(locale)) {
    cache.set(locale, localCache);
  }
  const compiled = localCache.get(message);
  if (compiled !== void 0) {
    if (compiled instanceof import_status.Status) {
      return message;
    }
    return compiled.format(params);
  } else {
    try {
      const id = (0, import_ident._parseId)(message);
      if (id.component === import_platform._EmbeddedId) {
        return id.name;
      }
      const translation = getCachedTranslation(id, locale) ?? await getTranslation(id, locale) ?? message;
      if (translation instanceof import_status.Status) {
        localCache.set(message, translation);
        return message;
      }
      const compiled2 = new import_intl_messageformat.IntlMessageFormat(translation, locale, void 0, { ignoreTag: true });
      localCache.set(message, compiled2);
      return compiled2.format(params);
    } catch (err) {
      const status = (0, import_status.unknownError)(err);
      void (0, import_event.setPlatformStatus)(status);
      localCache.set(message, status);
      return message;
    }
  }
}
__name(translate, "translate");
function translateCB(message, params, language, resolve) {
  const locale = language ?? (0, import_metadata.getMetadata)(import_platform.default.metadata.locale) ?? "en";
  const localCache = cache.get(locale) ?? /* @__PURE__ */ new Map();
  if (!cache.has(locale)) {
    cache.set(locale, localCache);
  }
  const compiled = localCache.get(message);
  if (compiled !== void 0) {
    if (compiled instanceof import_status.Status) {
      resolve(message);
      return;
    }
    resolve(compiled.format(params));
  } else {
    let id;
    try {
      id = (0, import_ident._parseId)(message);
      if (id.component === import_platform._EmbeddedId) {
        resolve(id.name);
        return;
      }
    } catch (err) {
      const status = (0, import_status.unknownError)(err);
      void (0, import_event.setPlatformStatus)(status);
      localCache.set(message, status);
      resolve(message);
      return;
    }
    const translation = getCachedTranslation(id, locale);
    if (translation === void 0 || translation instanceof import_status.Status) {
      void translate(message, params, language).then((res) => {
        resolve(res);
      }).catch((err) => {
        const status = (0, import_status.unknownError)(err);
        void (0, import_event.setPlatformStatus)(status);
        localCache.set(message, status);
        resolve(message);
      });
      return;
    }
    const compiled2 = new import_intl_messageformat.IntlMessageFormat(translation, locale, void 0, { ignoreTag: true });
    localCache.set(message, compiled2);
    resolve(compiled2.format(params));
  }
}
__name(translateCB, "translateCB");
//# sourceMappingURL=i18n.js.map
