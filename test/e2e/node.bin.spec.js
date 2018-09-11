'use strict';

// Imports
const {testingUtils} = require('@gkalpak/cli-utils');
const {join} = require('path');
const {ROOT_DIR} = require('../test-utils');

// Constants
const SCRIPT_DIR = 'bin/node/';

// Tests
describe(SCRIPT_DIR, testingUtils.withJasmineTimeout(30000, () => {
  describe('nls', () => {
    const alias = 'npm list --depth=0';
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'nls'));

    it(`should be an alias for \`${alias}\``, async () => {
      // `npm list` fails due to missing peerDependency.
      const result1 = await testingUtils.testCmd(`${alias} 2>&1 || true`);
      const result2 = await testScript('2>&1 || true');

      expect(result2).toContain(result1);
    });
  });

  describe('nls1', () => {
    const alias = 'npm list --depth=1';
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'nls1'));

    it(`should be an alias for \`${alias}\``, async () => {
      // `npm list` fails due to missing peerDependency.
      const result1 = await testingUtils.testCmd(`${alias} 2>&1 || true`);
      const result2 = await testScript('2>&1 || true');

      expect(result2).toContain(result1);
    });
  });

  describe('nlsg', () => {
    const alias = 'npm list --depth=0 --global';
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'nlsg'));

    it(`should be an alias for \`${alias}\``, async () => {
      const result1 = await testingUtils.testCmd(alias);
      const result2 = await testScript();

      expect(result2).toContain(result1);
    });
  });

  describe('nlsg1', () => {
    const alias = 'npm list --depth=1 --global';
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'nlsg1'));

    it(`should be an alias for \`${alias}\``, async () => {
      const result1 = await testingUtils.testCmd(alias);
      const result2 = await testScript();

      expect(result2).toContain(result1);
    });
  });

  describe('nv', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'nv'));

    it('should print the Node.js version', async () => {
      const result = await testScript();
      expect(result).toBe(process.version);
    });
  });

  // `nvm` is being funny on non-Windows platforms,
  // giving errors when run during tests (but not directly in the terminal).
  describe('nvls', onlyOnWindows(() => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'nvls'));

    it('should at least list (pun intended) the current Node.js version', async () => {
      const result = await testScript();
      expect(result).toContain(process.version.replace(/^v/, ''));
    });
  }));

  // `nvm` is being funny on non-Windows platforms,
  // giving errors when run during tests (but not directly in the terminal).
  describe('nvlsa', onlyOnWindows(() => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'nvlsa'));

    it('should list some Node.js versions', async () => {
      const versionRe = /\d+\.\d+\.\d+/;
      const result = await testScript();
      const linesWithVersions = result.split('\n').filter(line => versionRe.test(line));

      expect(linesWithVersions.length).toBeGreaterThan(5);
    });

    it('should include the current Node.js version', async () => {
      const result = await testScript();
      expect(result).toContain(process.version.replace(/^v/, ''));
    });
  }));
}));

// Helpers
function onlyOnWindows(testSuite) {
  return (process.platform === 'win32') ? testSuite : () => undefined;
}
