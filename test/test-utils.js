'use strict';

// Exports
module.exports = {
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
