"use strict";
/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Copyrights licensed under the New BSD License.
See the accompanying LICENSE file for terms.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntlMessageFormat = void 0;
var tslib_1 = require("../tslib/tslib.js");
var core_1 = require("./src/core.js");
Object.defineProperty(exports, "IntlMessageFormat", { enumerable: true, get: function () { return core_1.IntlMessageFormat; } });
tslib_1.__exportStar(require("./src/core.js"), exports);
tslib_1.__exportStar(require("./src/error.js"), exports);
tslib_1.__exportStar(require("./src/formatters.js"), exports);
exports.default = core_1.IntlMessageFormat;
