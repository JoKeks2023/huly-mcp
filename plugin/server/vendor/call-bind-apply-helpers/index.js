'use strict';

var bind = require('../function-bind/index.js');
var $TypeError = require('../es-errors/type.js');

var $call = require('./functionCall.js');
var $actualApply = require('./actualApply.js');

/** @type {(args: [Function, thisArg?: unknown, ...args: unknown[]]) => Function} TODO FIXME, find a way to use import('./index.js') */
module.exports = function callBindBasic(args) {
	if (args.length < 1 || typeof args[0] !== 'function') {
		throw new $TypeError('a function is required');
	}
	return $actualApply(bind, $call, args);
};
