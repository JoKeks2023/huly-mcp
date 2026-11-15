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
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var index_exports = {};
__export(index_exports, {
  default: () => index_default,
  findTagCategory: () => findTagCategory,
  tagsId: () => tagsId
});
module.exports = __toCommonJS(index_exports);
var import_platform = require("../../platform/lib/index.js");
__reExport(index_exports, require("./analytics.js"), module.exports);
const tagsId = "tags";
const tagsPlugin = (0, import_platform.plugin)(tagsId, {
  class: {
    TagElement: "",
    TagReference: "",
    TagCategory: ""
  },
  icon: {
    Tags: "",
    Level1: "",
    Level2: "",
    Level3: ""
  },
  component: {
    DraftTagsEditor: "",
    DocTagsEditor: "",
    TagsView: "",
    TagsEditor: "",
    TagsDropdownEditor: "",
    TagsCategoryBar: "",
    TagsAttributeEditor: "",
    TagsPresenter: "",
    LabelsPresenter: "",
    TagElementPresenter: "",
    TagsEditorPopup: "",
    ObjectsTagsEditorPopup: ""
  },
  string: {
    Tags: "",
    AddLabel: "",
    TagLabel: ""
  },
  category: {
    NoCategory: ""
  },
  filter: {
    FilterTagsIn: "",
    FilterTagsNin: ""
  }
});
var index_default = tagsPlugin;
function findTagCategory(title, categories) {
  let defaultCategory;
  for (const c of categories) {
    if (c.default) {
      defaultCategory = c;
    }
    if (c.tags.findIndex((it) => it.toLowerCase() === title.toLowerCase()) !== -1) {
      return c._id;
    }
  }
  if (defaultCategory === void 0) {
    throw new Error("Tag category not found");
  }
  return defaultCategory._id;
}
__name(findTagCategory, "findTagCategory");
//# sourceMappingURL=index.js.map
