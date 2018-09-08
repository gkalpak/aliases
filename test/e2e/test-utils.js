'use strict';

// Imports
const {spawnAsPromised} = require('@gkalpak/cli-utils').commandUtils;
const {join, resolve} = require('path');

// Constants
const ROOT_DIR = resolve(__dirname, '../../');
const BIN_DIR = join(ROOT_DIR, 'bin');

// Exports
module.exports = {
  ROOT_DIR,
  testBinScriptFactory: _testBinScriptFactory,
  testCmd: _testCmd,
  withJasmineTimeout: _withJasmineTimeout,
};

// Functions - Definitions
function _testBinScriptFactory(scriptNamespace, scriptName) {
  const scriptPath = resolve(BIN_DIR, scriptNamespace, scriptName);
  const baseCmd = `node ${scriptPath}`;

  return (argsStr = '') => _testCmd(`${baseCmd} ${argsStr}`);
}

async function _testCmd(cmd) {
  const result = await spawnAsPromised(cmd, {returnOutput: true});
  return normalizeNewlines(stripCleanUpCharacters(result)).trim();
}

function _withJasmineTimeout(newTimeout, testSuite) {
  return () => {
    let originalDefaultTimeoutInterval;

    beforeAll(() => {
      originalDefaultTimeoutInterval = jasmine.DEFAULT_TIMEOUT_INTERVAL;
      jasmine.DEFAULT_TIMEOUT_INTERVAL = newTimeout;
    });

    afterAll(() => jasmine.DEFAULT_TIMEOUT_INTERVAL = originalDefaultTimeoutInterval);

    testSuite();
  };
}

function normalizeNewlines(str) {
  return str.replace(/\r\n/g, '\n');
}

function stripCleanUpCharacters(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[(?:0m|\?25h)/gi, '');
}
