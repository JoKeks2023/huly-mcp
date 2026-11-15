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
var utils_exports = {};
__export(utils_exports, {
  genRanks: () => genRanks,
  makeRank: () => makeRank
});
module.exports = __toCommonJS(utils_exports);
var import_lexoRankBucket = __toESM(require("../../../lexorank/lib/lexoRank/lexoRankBucket.js"));
var import_lexorank = require("../../../lexorank/lib/index.js");
function genRanks(count) {
  const sys = new import_lexorank.LexoNumeralSystem36();
  const base = 36;
  const max = base ** 6;
  const gap = import_lexorank.LexoDecimal.parse(Math.trunc(max / (count + 2)).toString(base), sys);
  let cur = import_lexorank.LexoDecimal.parse("0", sys);
  const res = [];
  for (let i = 0; i < count; i++) {
    cur = cur.add(gap);
    res.push(new import_lexorank.LexoRank(import_lexoRankBucket.default.BUCKET_0, cur).toString());
  }
  return res;
}
__name(genRanks, "genRanks");
function makeRank(prev, next) {
  try {
    if (prev != null && prev.trim() === "") {
      prev = void 0;
    }
    if (next != null && next.trim() === "") {
      next = void 0;
    }
    if (prev !== void 0 && next !== void 0) {
      const prevLexoRank = import_lexorank.LexoRank.parse(prev);
      const nextLexoRank = import_lexorank.LexoRank.parse(next);
      return prevLexoRank.equals(nextLexoRank) ? prevLexoRank.genNext().toString() : prevLexoRank.between(nextLexoRank).toString();
    } else if (prev !== void 0) {
      const prevLexoRank = import_lexorank.LexoRank.parse(prev);
      return prevLexoRank.genNext().toString();
    } else if (next !== void 0) {
      const nextLexoRank = import_lexorank.LexoRank.parse(next);
      return nextLexoRank.genPrev().toString();
    } else {
      return import_lexorank.LexoRank.middle().toString();
    }
  } catch (err) {
    throw new Error(`Failed to make rank: ${prev} ${next} ${err.message}`);
  }
}
__name(makeRank, "makeRank");
//# sourceMappingURL=utils.js.map
