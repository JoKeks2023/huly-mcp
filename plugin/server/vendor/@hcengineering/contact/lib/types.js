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
var types_exports = {};
__export(types_exports, {
  AVATAR_COLORS: () => AVATAR_COLORS
});
module.exports = __toCommonJS(types_exports);
const AVATAR_COLORS = [
  { name: "blue", color: "#4674ca" },
  // blue
  { name: "blue_dark", color: "#315cac" },
  // blue_dark
  { name: "green", color: "#57be8c" },
  // green
  { name: "green_dark", color: "#3fa372" },
  // green_dark
  { name: "yellow_orange", color: "#f9a66d" },
  // yellow_orange
  { name: "red", color: "#ec5e44" },
  // red
  { name: "red_dark", color: "#e63717" },
  // red_dark
  { name: "pink", color: "#f868bc" },
  // pink
  { name: "purple", color: "#6c5fc7" },
  // purple
  { name: "purple_dark", color: "#4e3fb4" },
  // purple_dark
  { name: "teal", color: "#57b1be" },
  // teal
  { name: "gray", color: "#847a8c" }
  // gray
];
//# sourceMappingURL=types.js.map
