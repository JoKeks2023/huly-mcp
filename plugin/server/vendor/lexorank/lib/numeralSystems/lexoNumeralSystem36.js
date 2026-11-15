"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LexoNumeralSystem36 = void 0;
class LexoNumeralSystem36 {
    constructor() {
        this.DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'.split('');
    }
    getBase() {
        return 36;
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
        if (ch >= 'a' && ch <= 'z') {
            return ch.charCodeAt(0) - 97 + 10;
        }
        throw new Error('Not valid digit: ' + ch);
    }
    toChar(digit) {
        return this.DIGITS[digit];
    }
}
exports.LexoNumeralSystem36 = LexoNumeralSystem36;
