'use strict';

// Exports
module.exports = {
  async: _async,
  reversePromise: _reversePromise,
  tickAsPromised: _tickAsPromised,
};

// Functions - Definitions
function _async(fn) {
  return done => {
    const promise = fn();

    if (!(promise instanceof Promise)) {
      done.fail('The spec function (wrapped in `async()`) did not return a promise.');
      return;
    }

    promise.then(done, done.fail);
  };
}

function _reversePromise(p) {
  return p.then(val => Promise.reject(val), err => err);
}

function _tickAsPromised() {
  return new Promise(resolve => setTimeout(resolve));
}
