'use strict';

// Imports
const {testBinScriptFactory, testCmd, withJasmineTimeout} = require('./test-utils');

// Constants
const SCRIPT_NAMESPACE = 'node';

// Tests
describe(`bin/${SCRIPT_NAMESPACE}/`, withJasmineTimeout(30000, () => {
  describe('nls', () => {
    const alias = 'npm list --depth=0';
    const testScript = testBinScriptFactory(SCRIPT_NAMESPACE, 'nls');

    it(`should be an alias for \`${alias}\``, async () => {
      // `npm list` fails due to missing peerDependency.
      const result1 = await testCmd(`${alias} 2>&1 || true`);
      const result2 = await testScript('2>&1 || true');

      expect(result2).toContain(result1);
    });
  });

  describe('nls1', () => {
    const alias = 'npm list --depth=1';
    const testScript = testBinScriptFactory(SCRIPT_NAMESPACE, 'nls1');

    it(`should be an alias for \`${alias}\``, async () => {
      // `npm list` fails due to missing peerDependency.
      const result1 = await testCmd(`${alias} 2>&1 || true`);
      const result2 = await testScript('2>&1 || true');

      expect(result2).toContain(result1);
    });
  });

  describe('nlsg', () => {
    const alias = 'npm list --depth=0 --global';
    const testScript = testBinScriptFactory(SCRIPT_NAMESPACE, 'nlsg');

    it(`should be an alias for \`${alias}\``, async () => {
      const result1 = await testCmd(alias);
      const result2 = await testScript();

      expect(result2).toContain(result1);
    });
  });

  describe('nlsg1', () => {
    const alias = 'npm list --depth=1 --global';
    const testScript = testBinScriptFactory(SCRIPT_NAMESPACE, 'nlsg1');

    it(`should be an alias for \`${alias}\``, async () => {
      const result1 = await testCmd(alias);
      const result2 = await testScript();

      expect(result2).toContain(result1);
    });
  });

  describe('nv', () => {
    const testScript = testBinScriptFactory(SCRIPT_NAMESPACE, 'nv');

    it('should print the Node.js version', async () => {
      const result = await testScript();
      expect(result).toBe(process.version);
    });
  });
}));
