"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LexoRank = void 0;
const lexoDecimal_1 = require("./lexoDecimal.js");
const lexoRankBucket_1 = require("./lexoRankBucket.js");
const stringBuilder_1 = require("../utils/stringBuilder.js");
const numeralSystems_1 = require("../numeralSystems/index.js");
class LexoRank {
    constructor(bucket, decimal) {
        this.value = bucket.format() + '|' + LexoRank.formatDecimal(decimal);
        this.bucket = bucket;
        this.decimal = decimal;
    }
    static get NUMERAL_SYSTEM() {
        if (!this._NUMERAL_SYSTEM) {
            this._NUMERAL_SYSTEM = new numeralSystems_1.LexoNumeralSystem36();
        }
        return this._NUMERAL_SYSTEM;
    }
    static get ZERO_DECIMAL() {
        if (!this._ZERO_DECIMAL) {
            this._ZERO_DECIMAL = lexoDecimal_1.LexoDecimal.parse('0', LexoRank.NUMERAL_SYSTEM);
        }
        return this._ZERO_DECIMAL;
    }
    static get ONE_DECIMAL() {
        if (!this._ONE_DECIMAL) {
            this._ONE_DECIMAL = lexoDecimal_1.LexoDecimal.parse('1', LexoRank.NUMERAL_SYSTEM);
        }
        return this._ONE_DECIMAL;
    }
    static get EIGHT_DECIMAL() {
        if (!this._EIGHT_DECIMAL) {
            this._EIGHT_DECIMAL = lexoDecimal_1.LexoDecimal.parse('8', LexoRank.NUMERAL_SYSTEM);
        }
        return this._EIGHT_DECIMAL;
    }
    static get MIN_DECIMAL() {
        if (!this._MIN_DECIMAL) {
            this._MIN_DECIMAL = LexoRank.ZERO_DECIMAL;
        }
        return this._MIN_DECIMAL;
    }
    static get MAX_DECIMAL() {
        if (!this._MAX_DECIMAL) {
            this._MAX_DECIMAL = lexoDecimal_1.LexoDecimal.parse('1000000', LexoRank.NUMERAL_SYSTEM).subtract(LexoRank.ONE_DECIMAL);
        }
        return this._MAX_DECIMAL;
    }
    static get MID_DECIMAL() {
        if (!this._MID_DECIMAL) {
            this._MID_DECIMAL = LexoRank.between(LexoRank.MIN_DECIMAL, LexoRank.MAX_DECIMAL);
        }
        return this._MID_DECIMAL;
    }
    static get INITIAL_MIN_DECIMAL() {
        if (!this._INITIAL_MIN_DECIMAL) {
            this._INITIAL_MIN_DECIMAL = lexoDecimal_1.LexoDecimal.parse('100000', LexoRank.NUMERAL_SYSTEM);
        }
        return this._INITIAL_MIN_DECIMAL;
    }
    static get INITIAL_MAX_DECIMAL() {
        if (!this._INITIAL_MAX_DECIMAL) {
            this._INITIAL_MAX_DECIMAL = lexoDecimal_1.LexoDecimal.parse(LexoRank.NUMERAL_SYSTEM.toChar(LexoRank.NUMERAL_SYSTEM.getBase() - 2) + '00000', LexoRank.NUMERAL_SYSTEM);
        }
        return this._INITIAL_MAX_DECIMAL;
    }
    static min() {
        return LexoRank.from(lexoRankBucket_1.default.BUCKET_0, LexoRank.MIN_DECIMAL);
    }
    static middle() {
        const minLexoRank = LexoRank.min();
        return minLexoRank.between(LexoRank.max(minLexoRank.bucket));
    }
    static max(bucket = lexoRankBucket_1.default.BUCKET_0) {
        return LexoRank.from(bucket, LexoRank.MAX_DECIMAL);
    }
    static initial(bucket) {
        return bucket === lexoRankBucket_1.default.BUCKET_0
            ? LexoRank.from(bucket, LexoRank.INITIAL_MIN_DECIMAL)
            : LexoRank.from(bucket, LexoRank.INITIAL_MAX_DECIMAL);
    }
    static between(oLeft, oRight) {
        if (oLeft.getSystem().getBase() !== oRight.getSystem().getBase()) {
            throw new Error('Expected same system');
        }
        let left = oLeft;
        let right = oRight;
        let nLeft;
        if (oLeft.getScale() < oRight.getScale()) {
            nLeft = oRight.setScale(oLeft.getScale(), false);
            if (oLeft.compareTo(nLeft) >= 0) {
                return LexoRank.mid(oLeft, oRight);
            }
            right = nLeft;
        }
        if (oLeft.getScale() > right.getScale()) {
            nLeft = oLeft.setScale(right.getScale(), true);
            if (nLeft.compareTo(right) >= 0) {
                return LexoRank.mid(oLeft, oRight);
            }
            left = nLeft;
        }
        let nRight;
        for (let scale = left.getScale(); scale > 0; right = nRight) {
            const nScale1 = scale - 1;
            const nLeft1 = left.setScale(nScale1, true);
            nRight = right.setScale(nScale1, false);
            const cmp = nLeft1.compareTo(nRight);
            if (cmp === 0) {
                return LexoRank.checkMid(oLeft, oRight, nLeft1);
            }
            if (nLeft1.compareTo(nRight) > 0) {
                break;
            }
            scale = nScale1;
            left = nLeft1;
        }
        let mid = LexoRank.middleInternal(oLeft, oRight, left, right);
        let nScale;
        for (let mScale = mid.getScale(); mScale > 0; mScale = nScale) {
            nScale = mScale - 1;
            const nMid = mid.setScale(nScale);
            if (oLeft.compareTo(nMid) >= 0 || nMid.compareTo(oRight) >= 0) {
                break;
            }
            mid = nMid;
        }
        return mid;
    }
    static parse(str) {
        const parts = str.split('|');
        const bucket = lexoRankBucket_1.default.from(parts[0]);
        const decimal = lexoDecimal_1.LexoDecimal.parse(parts[1], LexoRank.NUMERAL_SYSTEM);
        return new LexoRank(bucket, decimal);
    }
    static from(bucket, decimal) {
        if (decimal.getSystem().getBase() !== LexoRank.NUMERAL_SYSTEM.getBase()) {
            throw new Error('Expected different system');
        }
        return new LexoRank(bucket, decimal);
    }
    static middleInternal(lbound, rbound, left, right) {
        const mid = LexoRank.mid(left, right);
        return LexoRank.checkMid(lbound, rbound, mid);
    }
    static checkMid(lbound, rbound, mid) {
        if (lbound.compareTo(mid) >= 0) {
            return LexoRank.mid(lbound, rbound);
        }
        return mid.compareTo(rbound) >= 0 ? LexoRank.mid(lbound, rbound) : mid;
    }
    static mid(left, right) {
        const sum = left.add(right);
        const mid = sum.multiply(lexoDecimal_1.LexoDecimal.half(left.getSystem()));
        const scale = left.getScale() > right.getScale() ? left.getScale() : right.getScale();
        if (mid.getScale() > scale) {
            const roundDown = mid.setScale(scale, false);
            if (roundDown.compareTo(left) > 0) {
                return roundDown;
            }
            const roundUp = mid.setScale(scale, true);
            if (roundUp.compareTo(right) < 0) {
                return roundUp;
            }
        }
        return mid;
    }
    static formatDecimal(decimal) {
        const formatVal = decimal.format();
        const val = new stringBuilder_1.default(formatVal);
        let partialIndex = formatVal.indexOf(LexoRank.NUMERAL_SYSTEM.getRadixPointChar());
        const zero = LexoRank.NUMERAL_SYSTEM.toChar(0);
        if (partialIndex < 0) {
            partialIndex = formatVal.length;
            val.append(LexoRank.NUMERAL_SYSTEM.getRadixPointChar());
        }
        while (partialIndex < 6) {
            val.insert(0, zero);
            ++partialIndex;
        }
        while (val[val.length - 1] === zero) {
            val.length = val.length - 1;
        }
        return val.toString();
    }
    genPrev() {
        if (this.isMax()) {
            return new LexoRank(this.bucket, LexoRank.INITIAL_MAX_DECIMAL);
        }
        const floorInteger = this.decimal.floor();
        const floorDecimal = lexoDecimal_1.LexoDecimal.from(floorInteger);
        let nextDecimal = floorDecimal.subtract(LexoRank.EIGHT_DECIMAL);
        if (nextDecimal.compareTo(LexoRank.MIN_DECIMAL) <= 0) {
            nextDecimal = LexoRank.between(LexoRank.MIN_DECIMAL, this.decimal);
        }
        return new LexoRank(this.bucket, nextDecimal);
    }
    genNext() {
        if (this.isMin()) {
            return new LexoRank(this.bucket, LexoRank.INITIAL_MIN_DECIMAL);
        }
        const ceilInteger = this.decimal.ceil();
        const ceilDecimal = lexoDecimal_1.LexoDecimal.from(ceilInteger);
        let nextDecimal = ceilDecimal.add(LexoRank.EIGHT_DECIMAL);
        if (nextDecimal.compareTo(LexoRank.MAX_DECIMAL) >= 0) {
            nextDecimal = LexoRank.between(this.decimal, LexoRank.MAX_DECIMAL);
        }
        return new LexoRank(this.bucket, nextDecimal);
    }
    between(other) {
        if (!this.bucket.equals(other.bucket)) {
            throw new Error('Between works only within the same bucket');
        }
        const cmp = this.decimal.compareTo(other.decimal);
        if (cmp > 0) {
            return new LexoRank(this.bucket, LexoRank.between(other.decimal, this.decimal));
        }
        if (cmp === 0) {
            throw new Error('Try to rank between issues with same rank this=' +
                this +
                ' other=' +
                other +
                ' this.decimal=' +
                this.decimal +
                ' other.decimal=' +
                other.decimal);
        }
        return new LexoRank(this.bucket, LexoRank.between(this.decimal, other.decimal));
    }
    getBucket() {
        return this.bucket;
    }
    getDecimal() {
        return this.decimal;
    }
    inNextBucket() {
        return LexoRank.from(this.bucket.next(), this.decimal);
    }
    inPrevBucket() {
        return LexoRank.from(this.bucket.prev(), this.decimal);
    }
    isMin() {
        return this.decimal.equals(LexoRank.MIN_DECIMAL);
    }
    isMax() {
        return this.decimal.equals(LexoRank.MAX_DECIMAL);
    }
    format() {
        return this.value;
    }
    equals(other) {
        if (this === other) {
            return true;
        }
        if (!other) {
            return false;
        }
        return this.value === other.value;
    }
    toString() {
        return this.value;
    }
    compareTo(other) {
        if (this === other) {
            return 0;
        }
        if (!other) {
            return 1;
        }
        return this.value.localeCompare(other.value);
    }
}
exports.LexoRank = LexoRank;
