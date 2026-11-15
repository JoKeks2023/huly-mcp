'use strict';

var call = Function.prototype.call;
var $hasOwn = Object.prototype.hasOwnProperty;
var bind = require('../function-bind/index.js');

/** @type {import('./index.js')} */
module.exports = bind.call(call, $hasOwn);
