'use strict';

var $isNaN = require('./isNaN.js');

/** @type {import('./sign.js')} */
module.exports = function sign(number) {
	if ($isNaN(number) || number === 0) {
		return number;
	}
	return number < 0 ? -1 : +1;
};
