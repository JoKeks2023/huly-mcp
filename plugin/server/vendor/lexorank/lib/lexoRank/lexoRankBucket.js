"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lexoInteger_1 = require("./lexoInteger.js");
const lexoRank_1 = require("./lexoRank.js");
class LexoRankBucket {
    constructor(val) {
        this.value = lexoInteger_1.LexoInteger.parse(val, lexoRank_1.LexoRank.NUMERAL_SYSTEM);
    }
    static get BUCKET_0() {
        if (!this._BUCKET_0) {
            this._BUCKET_0 = new LexoRankBucket('0');
        }
        return this._BUCKET_0;
    }
    static get BUCKET_1() {
        if (!this._BUCKET_1) {
            this._BUCKET_1 = new LexoRankBucket('1');
        }
        return this._BUCKET_1;
    }
    static get BUCKET_2() {
        if (!this._BUCKET_2) {
            this._BUCKET_2 = new LexoRankBucket('2');
        }
        return this._BUCKET_2;
    }
    static get VALUES() {
        if (!this._VALUES) {
            this._VALUES = [LexoRankBucket.BUCKET_0, LexoRankBucket.BUCKET_1, LexoRankBucket.BUCKET_2];
        }
        return this._VALUES;
    }
    static max() {
        return LexoRankBucket.VALUES[LexoRankBucket.VALUES.length - 1];
    }
    static from(str) {
        const val = lexoInteger_1.LexoInteger.parse(str, lexoRank_1.LexoRank.NUMERAL_SYSTEM);
        const var2 = LexoRankBucket.VALUES;
        const var3 = var2.length;
        for (let var4 = 0; var4 < var3; ++var4) {
            const bucket = var2[var4];
            if (bucket.value.equals(val)) {
                return bucket;
            }
        }
        throw new Error('Unknown bucket: ' + str);
    }
    static resolve(bucketId) {
        const var1 = LexoRankBucket.VALUES;
        const var2 = var1.length;
        for (let var3 = 0; var3 < var2; ++var3) {
            const bucket = var1[var3];
            if (bucket.equals(LexoRankBucket.from(bucketId.toString()))) {
                return bucket;
            }
        }
        throw new Error('No bucket found with id ' + bucketId);
    }
    format() {
        return this.value.format();
    }
    next() {
        if (this.equals(LexoRankBucket.BUCKET_0)) {
            return LexoRankBucket.BUCKET_1;
        }
        if (this.equals(LexoRankBucket.BUCKET_1)) {
            return LexoRankBucket.BUCKET_2;
        }
        return this.equals(LexoRankBucket.BUCKET_2) ? LexoRankBucket.BUCKET_0 : LexoRankBucket.BUCKET_2;
    }
    prev() {
        if (this.equals(LexoRankBucket.BUCKET_0)) {
            return LexoRankBucket.BUCKET_2;
        }
        if (this.equals(LexoRankBucket.BUCKET_1)) {
            return LexoRankBucket.BUCKET_0;
        }
        return this.equals(LexoRankBucket.BUCKET_2) ? LexoRankBucket.BUCKET_1 : LexoRankBucket.BUCKET_0;
    }
    equals(other) {
        if (this === other) {
            return true;
        }
        if (!other) {
            return false;
        }
        return this.value.equals(other.value);
    }
}
exports.default = LexoRankBucket;
