'use strict';

// Imports
const {testingUtils} = require('@gkalpak/cli-utils');
const {join} = require('path');
const {ROOT_DIR} = require('../test-utils');

// Constants
const SCRIPT_DIR = 'bin/git/';

// Tests
describe(SCRIPT_DIR, () => {
  describe('gdefb', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'gdefb'));

    it('should detect and print the default branch', async () => {
      const result = await testScript();

      expect(result).toBe('master');
    });
  });
});
