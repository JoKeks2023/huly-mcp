"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LexoInteger = void 0;
const lexoHelper_1 = require("./lexoHelper.js");
const stringBuilder_1 = require("../utils/stringBuilder.js");
class LexoInteger {
    constructor(system, sign, mag) {
        this.sys = system;
        this.sign = sign;
        this.mag = mag;
    }
    static parse(strFull, system) {
        let str = strFull;
        let sign = 1;
        if (strFull.indexOf(system.getPositiveChar()) === 0) {
            str = strFull.substring(1);
        }
        else if (strFull.indexOf(system.getNegativeChar()) === 0) {
            str = strFull.substring(1);
            sign = -1;
        }
        const mag = new Array(str.length);
        let strIndex = mag.length - 1;
        for (let magIndex = 0; strIndex >= 0; ++magIndex) {
            mag[magIndex] = system.toDigit(str.charAt(strIndex));
            --strIndex;
        }
        return LexoInteger.make(system, sign, mag);
    }
    static zero(sys) {
        return new LexoInteger(sys, 0, LexoInteger.ZERO_MAG);
    }
    static one(sys) {
        return LexoInteger.make(sys, 1, LexoInteger.ONE_MAG);
    }
    static make(sys, sign, mag) {
        let actualLength;
        for (actualLength = mag.length; actualLength > 0 && mag[actualLength - 1] === 0; --actualLength) {
            // ignore
        }
        if (actualLength === 0) {
            return LexoInteger.zero(sys);
        }
        if (actualLength === mag.length) {
            return new LexoInteger(sys, sign, mag);
        }
        const nmag = new Array(actualLength).fill(0);
        lexoHelper_1.lexoHelper.arrayCopy(mag, 0, nmag, 0, actualLength);
        return new LexoInteger(sys, sign, nmag);
    }
    static add(sys, l, r) {
        const estimatedSize = Math.max(l.length, r.length);
        const result = new Array(estimatedSize).fill(0);
        let carry = 0;
        for (let i = 0; i < estimatedSize; ++i) {
            const lnum = i < l.length ? l[i] : 0;
            const rnum = i < r.length ? r[i] : 0;
            let sum = lnum + rnum + carry;
            for (carry = 0; sum >= sys.getBase(); sum -= sys.getBase()) {
                ++carry;
            }
            result[i] = sum;
        }
        return LexoInteger.extendWithCarry(result, carry);
    }
    static extendWithCarry(mag, carry) {
        if (carry > 0) {
            const extendedMag = new Array(mag.length + 1).fill(0);
            lexoHelper_1.lexoHelper.arrayCopy(mag, 0, extendedMag, 0, mag.length);
            extendedMag[extendedMag.length - 1] = carry;
            return extendedMag;
        }
        return mag;
    }
    static subtract(sys, l, r) {
        const rComplement = LexoInteger.complement(sys, r, l.length);
        const rSum = LexoInteger.add(sys, l, rComplement);
        rSum[rSum.length - 1] = 0;
        return LexoInteger.add(sys, rSum, LexoInteger.ONE_MAG);
    }
    static multiply(sys, l, r) {
        const result = new Array(l.length + r.length).fill(0);
        for (let li = 0; li < l.length; ++li) {
            for (let ri = 0; ri < r.length; ++ri) {
                const resultIndex = li + ri;
                for (result[resultIndex] += l[li] * r[ri]; result[resultIndex] >= sys.getBase(); result[resultIndex] -= sys.getBase()) {
                    ++result[resultIndex + 1];
                }
            }
        }
        return result;
    }
    static complement(sys, mag, digits) {
        if (digits <= 0) {
            throw new Error('Expected at least 1 digit');
        }
        const nmag = new Array(digits).fill(sys.getBase() - 1);
        for (let i = 0; i < mag.length; ++i) {
            nmag[i] = sys.getBase() - 1 - mag[i];
        }
        return nmag;
    }
    static compare(l, r) {
        if (l.length < r.length) {
            return -1;
        }
        if (l.length > r.length) {
            return 1;
        }
        for (let i = l.length - 1; i >= 0; --i) {
            if (l[i] < r[i]) {
                return -1;
            }
            if (l[i] > r[i]) {
                return 1;
            }
        }
        return 0;
    }
    add(other) {
        this.checkSystem(other);
        if (this.isZero()) {
            return other;
        }
        if (other.isZero()) {
            return this;
        }
        if (this.sign !== other.sign) {
            let pos;
            if (this.sign === -1) {
                pos = this.negate();
                const val = pos.subtract(other);
                return val.negate();
            }
            pos = other.negate();
            return this.subtract(pos);
        }
        const result = LexoInteger.add(this.sys, this.mag, other.mag);
        return LexoInteger.make(this.sys, this.sign, result);
    }
    subtract(other) {
        this.checkSystem(other);
        if (this.isZero()) {
            return other.negate();
        }
        if (other.isZero()) {
            return this;
        }
        if (this.sign !== other.sign) {
            let negate;
            if (this.sign === -1) {
                negate = this.negate();
                const sum = negate.add(other);
                return sum.negate();
            }
            negate = other.negate();
            return this.add(negate);
        }
        const cmp = LexoInteger.compare(this.mag, other.mag);
        if (cmp === 0) {
            return LexoInteger.zero(this.sys);
        }
        return cmp < 0
            ? LexoInteger.make(this.sys, this.sign === -1 ? 1 : -1, LexoInteger.subtract(this.sys, other.mag, this.mag))
            : LexoInteger.make(this.sys, this.sign === -1 ? -1 : 1, LexoInteger.subtract(this.sys, this.mag, other.mag));
    }
    multiply(other) {
        this.checkSystem(other);
        if (this.isZero()) {
            return this;
        }
        if (other.isZero()) {
            return other;
        }
        if (this.isOneish()) {
            return this.sign === other.sign
                ? LexoInteger.make(this.sys, 1, other.mag)
                : LexoInteger.make(this.sys, -1, other.mag);
        }
        if (other.isOneish()) {
            return this.sign === other.sign
                ? LexoInteger.make(this.sys, 1, this.mag)
                : LexoInteger.make(this.sys, -1, this.mag);
        }
        const newMag = LexoInteger.multiply(this.sys, this.mag, other.mag);
        return this.sign === other.sign ? LexoInteger.make(this.sys, 1, newMag) : LexoInteger.make(this.sys, -1, newMag);
    }
    negate() {
        return this.isZero() ? this : LexoInteger.make(this.sys, this.sign === 1 ? -1 : 1, this.mag);
    }
    shiftLeft(times = 1) {
        if (times === 0) {
            return this;
        }
        if (times < 0) {
            return this.shiftRight(Math.abs(times));
        }
        const nmag = new Array(this.mag.length + times).fill(0);
        lexoHelper_1.lexoHelper.arrayCopy(this.mag, 0, nmag, times, this.mag.length);
        return LexoInteger.make(this.sys, this.sign, nmag);
    }
    shiftRight(times = 1) {
        if (this.mag.length - times <= 0) {
            return LexoInteger.zero(this.sys);
        }
        const nmag = new Array(this.mag.length - times).fill(0);
        lexoHelper_1.lexoHelper.arrayCopy(this.mag, times, nmag, 0, nmag.length);
        return LexoInteger.make(this.sys, this.sign, nmag);
    }
    complement() {
        return this.complementDigits(this.mag.length);
    }
    complementDigits(digits) {
        return LexoInteger.make(this.sys, this.sign, LexoInteger.complement(this.sys, this.mag, digits));
    }
    isZero() {
        return this.sign === 0 && this.mag.length === 1 && this.mag[0] === 0;
    }
    isOne() {
        return this.sign === 1 && this.mag.length === 1 && this.mag[0] === 1;
    }
    getMag(index) {
        return this.mag[index];
    }
    compareTo(other) {
        if (this === other) {
            return 0;
        }
        if (!other) {
            return 1;
        }
        if (this.sign === -1) {
            if (other.sign === -1) {
                const cmp = LexoInteger.compare(this.mag, other.mag);
                if (cmp === -1) {
                    return 1;
                }
                return cmp === 1 ? -1 : 0;
            }
            return -1;
        }
        if (this.sign === 1) {
            return other.sign === 1 ? LexoInteger.compare(this.mag, other.mag) : 1;
        }
        if (other.sign === -1) {
            return 1;
        }
        return other.sign === 1 ? -1 : 0;
    }
    getSystem() {
        return this.sys;
    }
    format() {
        if (this.isZero()) {
            return '' + this.sys.toChar(0);
        }
        const sb = new stringBuilder_1.default();
        const var2 = this.mag;
        const var3 = var2.length;
        for (let var4 = 0; var4 < var3; ++var4) {
            const digit = var2[var4];
            sb.insert(0, this.sys.toChar(digit));
        }
        if (this.sign === -1) {
            sb.insert(0, this.sys.getNegativeChar());
        }
        return sb.toString();
    }
    equals(other) {
        if (this === other) {
            return true;
        }
        if (!other) {
            return false;
        }
        return this.sys.getBase() === other.sys.getBase() && this.compareTo(other) === 0;
    }
    toString() {
        return this.format();
    }
    isOneish() {
        return this.mag.length === 1 && this.mag[0] === 1;
    }
    checkSystem(other) {
        if (this.sys.getBase() !== other.sys.getBase()) {
            throw new Error('Expected numbers of same numeral sys');
        }
    }
}
exports.LexoInteger = LexoInteger;
LexoInteger.ZERO_MAG = [0];
LexoInteger.ONE_MAG = [1];
LexoInteger.NEGATIVE_SIGN = -1;
LexoInteger.ZERO_SIGN = 0;
LexoInteger.POSITIVE_SIGN = 1;
