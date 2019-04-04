'use strict';

// Imports
const {testingUtils} = require('@gkalpak/cli-utils');
const {readFileSync} = require('fs');
const {join} = require('path');
const {ROOT_DIR} = require('../test-utils');

// Constants
const SCRIPT_DIR = 'bin/config/';

// Tests
describe(SCRIPT_DIR, () => {
  describe('cfgbash', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'cfgbash'));

    it('should print configuration instructions for `bash`', async () => {
      const result = await testScript();

      expect(result).toMatch(/^### Copy the following into '~\/\.bashrc':/);
      expect(result).toMatch(/bind "TAB:menu-complete";$/);
    });
  });

  describe('cfggit', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'cfggit'));

    it('should print configuration instructions for `git`', async () => {
      const result = await testScript();

      expect(result).toMatch(/^### Run the following commands:/);
      expect(result).toMatch(/git config --global mergetool\.kdiff3\.trustExitCode false$/);
    });
  });

  describe('cfgvim', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'cfgvim'));

    it('should print configuration instructions for `vim`', async () => {
      const vimrcContent = readFileSync(join(ROOT_DIR, 'lib/assets/vimrc.txt'), 'utf8').trim().replace(/\r\n/g, '\n');
      const result = await testScript();

      expect(result).toMatch(/^""" Copy the following into '~\/\.vimrc':/);
      expect(result).toContain(vimrcContent);
    });
  });
});
