'use strict';

// Exports
module.exports = {
  async: _async,
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
