"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class StringBuilder {
    constructor(str = '') {
        this.str = str;
    }
    get length() {
        return this.str.length;
    }
    set length(value) {
        this.str = this.str.substring(0, value);
    }
    append(str) {
        this.str = this.str + str;
        return this;
    }
    remove(startIndex, length) {
        this.str = this.str.substr(0, startIndex) + this.str.substr(startIndex + length);
        return this;
    }
    insert(index, value) {
        this.str = this.str.substr(0, index) + value + this.str.substr(index);
        return this;
    }
    toString() {
        return this.str;
    }
}
exports.default = StringBuilder;
