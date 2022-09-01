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
    let isOnCiTag;

    beforeAll(async () => {
      // If this test run is on CI for a tag, then the branch refs may not be available.
      // NOTE: This may also affect non-master/main branches, but these are currently not used.
      isOnCiTag = Boolean(process.env.CI) &&
        /^v\d+\.\d+\.\d+$/.test(await testingUtils.testCmd('git describe --tags || true')) &&
        /^$/.test(await testingUtils.testCmd('git show-ref --heads || true'));
    });

    it('should detect and print the default branch', async () => {
      const result = await testScript();

      expect(result).toBe(isOnCiTag ? 'unknown-branch' : 'master');
    });
  });
});
