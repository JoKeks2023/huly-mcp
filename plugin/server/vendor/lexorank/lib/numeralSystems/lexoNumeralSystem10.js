"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LexoNumeralSystem10 = void 0;
class LexoNumeralSystem10 {
    getBase() {
        return 10;
    }
    getPositiveChar() {
        return '+';
    }
    getNegativeChar() {
        return '-';
    }
    getRadixPointChar() {
        return '.';
    }
    toDigit(ch) {
        if (ch >= '0' && ch <= '9') {
            return ch.charCodeAt(0) - 48;
        }
        throw new Error('Not valid digit: ' + ch);
    }
    toChar(digit) {
        return String.fromCharCode(digit + 48);
    }
}
exports.LexoNumeralSystem10 = LexoNumeralSystem10;
