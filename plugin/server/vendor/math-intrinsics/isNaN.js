'use strict';

/** @type {import('./isNaN.js')} */
module.exports = Number.isNaN || function isNaN(a) {
	return a !== a;
};
