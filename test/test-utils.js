'use strict';

// Imports
const {resolve} = require('path');

// Constants
const ROOT_DIR = resolve(__dirname, '..');

// Exports
module.exports = {
  ROOT_DIR,
  reversePromise: _reversePromise,
  tickAsPromised: _tickAsPromised,
};

// Functions - Definitions
function _reversePromise(p) {
  return p.then(val => Promise.reject(val), err => err);
}

function _tickAsPromised() {
  return new Promise(resolve => setTimeout(resolve));
}
