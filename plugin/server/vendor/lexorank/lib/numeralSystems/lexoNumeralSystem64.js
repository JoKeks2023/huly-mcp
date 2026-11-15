"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LexoNumeralSystem64 = void 0;
class LexoNumeralSystem64 {
    constructor() {
        this.DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ^_abcdefghijklmnopqrstuvwxyz'.split('');
    }
    getBase() {
        return 64;
    }
    getPositiveChar() {
        return '+';
    }
    getNegativeChar() {
        return '-';
    }
    getRadixPointChar() {
        return ':';
    }
    toDigit(ch) {
        if (ch >= '0' && ch <= '9') {
            return ch.charCodeAt(0) - 48;
        }
        if (ch >= 'A' && ch <= 'Z') {
            return ch.charCodeAt(0) - 65 + 10;
        }
        if (ch === '^') {
            return 36;
        }
        if (ch === '_') {
            return 37;
        }
        if (ch >= 'a' && ch <= 'z') {
            return ch.charCodeAt(0) - 97 + 38;
        }
        throw new Error('Not valid digit: ' + ch);
    }
    toChar(digit) {
        return this.DIGITS[digit];
    }
}
exports.LexoNumeralSystem64 = LexoNumeralSystem64;
