"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LexoDecimal = void 0;
const lexoInteger_1 = require("./lexoInteger.js");
const stringBuilder_1 = require("../utils/stringBuilder.js");
class LexoDecimal {
    constructor(mag, sig) {
        this.mag = mag;
        this.sig = sig;
    }
    static half(sys) {
        const mid = (sys.getBase() / 2) | 0;
        return LexoDecimal.make(lexoInteger_1.LexoInteger.make(sys, 1, [mid]), 1);
    }
    static parse(str, system) {
        const partialIndex = str.indexOf(system.getRadixPointChar());
        if (str.lastIndexOf(system.getRadixPointChar()) !== partialIndex) {
            throw new Error('More than one ' + system.getRadixPointChar());
        }
        if (partialIndex < 0) {
            return LexoDecimal.make(lexoInteger_1.LexoInteger.parse(str, system), 0);
        }
        const intStr = str.substring(0, partialIndex) + str.substring(partialIndex + 1);
        return LexoDecimal.make(lexoInteger_1.LexoInteger.parse(intStr, system), str.length - 1 - partialIndex);
    }
    static from(integer) {
        return LexoDecimal.make(integer, 0);
    }
    static make(integer, sig) {
        if (integer.isZero()) {
            return new LexoDecimal(integer, 0);
        }
        let zeroCount = 0;
        for (let i = 0; i < sig && integer.getMag(i) === 0; ++i) {
            ++zeroCount;
        }
        const newInteger = integer.shiftRight(zeroCount);
        const newSig = sig - zeroCount;
        return new LexoDecimal(newInteger, newSig);
    }
    getSystem() {
        return this.mag.getSystem();
    }
    add(other) {
        let tmag = this.mag;
        let tsig = this.sig;
        let omag = other.mag;
        let osig;
        for (osig = other.sig; tsig < osig; ++tsig) {
            tmag = tmag.shiftLeft();
        }
        while (tsig > osig) {
            omag = omag.shiftLeft();
            ++osig;
        }
        return LexoDecimal.make(tmag.add(omag), tsig);
    }
    subtract(other) {
        let thisMag = this.mag;
        let thisSig = this.sig;
        let otherMag = other.mag;
        let otherSig;
        for (otherSig = other.sig; thisSig < otherSig; ++thisSig) {
            thisMag = thisMag.shiftLeft();
        }
        while (thisSig > otherSig) {
            otherMag = otherMag.shiftLeft();
            ++otherSig;
        }
        return LexoDecimal.make(thisMag.subtract(otherMag), thisSig);
    }
    multiply(other) {
        return LexoDecimal.make(this.mag.multiply(other.mag), this.sig + other.sig);
    }
    floor() {
        return this.mag.shiftRight(this.sig);
    }
    ceil() {
        if (this.isExact()) {
            return this.mag;
        }
        const floor = this.floor();
        return floor.add(lexoInteger_1.LexoInteger.one(floor.getSystem()));
    }
    isExact() {
        if (this.sig === 0) {
            return true;
        }
        for (let i = 0; i < this.sig; ++i) {
            if (this.mag.getMag(i) !== 0) {
                return false;
            }
        }
        return true;
    }
    getScale() {
        return this.sig;
    }
    setScale(nsig, ceiling = false) {
        if (nsig >= this.sig) {
            return this;
        }
        if (nsig < 0) {
            nsig = 0;
        }
        const diff = this.sig - nsig;
        let nmag = this.mag.shiftRight(diff);
        if (ceiling) {
            nmag = nmag.add(lexoInteger_1.LexoInteger.one(nmag.getSystem()));
        }
        return LexoDecimal.make(nmag, nsig);
    }
    compareTo(other) {
        if (this === other) {
            return 0;
        }
        if (!other) {
            return 1;
        }
        let tMag = this.mag;
        let oMag = other.mag;
        if (this.sig > other.sig) {
            oMag = oMag.shiftLeft(this.sig - other.sig);
        }
        else if (this.sig < other.sig) {
            tMag = tMag.shiftLeft(other.sig - this.sig);
        }
        return tMag.compareTo(oMag);
    }
    format() {
        const intStr = this.mag.format();
        if (this.sig === 0) {
            return intStr;
        }
        const sb = new stringBuilder_1.default(intStr);
        const head = sb[0];
        const specialHead = head === this.mag.getSystem().getPositiveChar() || head === this.mag.getSystem().getNegativeChar();
        if (specialHead) {
            sb.remove(0, 1);
        }
        while (sb.length < this.sig + 1) {
            sb.insert(0, this.mag.getSystem().toChar(0));
        }
        sb.insert(sb.length - this.sig, this.mag.getSystem().getRadixPointChar());
        if (sb.length - this.sig === 0) {
            sb.insert(0, this.mag.getSystem().toChar(0));
        }
        if (specialHead) {
            sb.insert(0, head);
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
        return this.mag.equals(other.mag) && this.sig === other.sig;
    }
    toString() {
        return this.format();
    }
}
exports.LexoDecimal = LexoDecimal;
