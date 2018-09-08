'use strict';

// Imports
const {version} = require('../../package.json');
const {ROOT_DIR, testBinScriptFactory, withJasmineTimeout} = require('./test-utils');

// Constants
const SCRIPT_NAMESPACE = 'misc';

// Tests
describe(`bin/${SCRIPT_NAMESPACE}/`, withJasmineTimeout(30000, () => {
  describe('alv', () => {
    const testScript = testBinScriptFactory(SCRIPT_NAMESPACE, 'alv');

    it('should print the current version stamp', async () => {
      const result = await testScript();
      expect(result).toBe(`@gkalpak/aliases v${version}`);
    });
  });

  describe('halp', () => {
    const testScript = testBinScriptFactory(SCRIPT_NAMESPACE, 'halp');

    it('should print the current version stamp', async () => {
      const result1 = await testScript();
      expect(result1).toContain(`@gkalpak/aliases v${version}`);

      const result2 = await testScript('misc');
      expect(result2).toContain(`@gkalpak/aliases v${version}`);
    });

    it('should mention the "universal" arguments', async () => {
      const result1 = await testScript();
      expect(result1).toContain('--gkcu-debug');
      expect(result1).toContain('--gkcu-dryrun');
      expect(result1).toContain('--gkcu-suppressTbj');

      const result2 = await testScript('misc');
      expect(result2).toContain('--gkcu-debug');
      expect(result2).toContain('--gkcu-dryrun');
      expect(result2).toContain('--gkcu-suppressTbj');
    });

    it('should print all available aliases when called without an argument', async () => {
      const result = await testScript();

      expect(result).toContain('Available aliases');

      expect(result).toContain('Aio aliases');
      expect(result).toContain(' aioall ');
      expect(result).toContain(' aiorm ');

      expect(result).toContain('Git aliases');
      expect(result).toContain(' gaa ');
      expect(result).toContain(' gsync ');

      expect(result).toContain('Misc aliases');
      expect(result).toContain(' alv ');
      expect(result).toContain(' salfup ');

      expect(result).toContain('Node aliases');
      expect(result).toContain(' nad ');
      expect(result).toContain(' yt ');
    });

    it('should print help for the specified category only when called with an argument', async () => {
      const result = await testScript('misc');

      expect(result).not.toContain('Available aliases');

      expect(result).not.toContain('Aio aliases');
      expect(result).not.toContain(' aioall ');
      expect(result).not.toContain(' aiorm ');

      expect(result).not.toContain('Git aliases');
      expect(result).not.toContain(' gaa ');
      expect(result).not.toContain(' gsync ');

      expect(result).toContain('Misc aliases');
      expect(result).toContain(' alv ');
      expect(result).toContain(' salfup ');

      expect(result).not.toContain('Node aliases');
      expect(result).not.toContain(' nad ');
      expect(result).not.toContain(' yt ');
    });
  });

  describe('ll', () => {
    const testScript = testBinScriptFactory(SCRIPT_NAMESPACE, 'll');

    it('should list the specified directory\'s files', async () => {
      const result = await testScript(ROOT_DIR);

      expect(result).toContain('bin');
      expect(result).toContain('lib');
      expect(result).toContain('test');
      expect(result).toContain('package.json');
      expect(result).toContain('README.md');
    });

    it('should list one file per line', async () => {
      const result = await testScript(ROOT_DIR);

      expect(result).toMatch(/bin(\n|$)/);
      expect(result).toMatch(/lib(\n|$)/);
      expect(result).toMatch(/test(\n|$)/);
      expect(result).toMatch(/package.json(\n|$)/);
      expect(result).toMatch(/README.md(\n|$)/);
    });

    it('should not list hidden files', async () => {
      const result = await testScript(ROOT_DIR);

      expect(result).not.toContain('.gitignore');
      expect(result).not.toContain('.travis.yml');
    });

    it('should list the current directory\'s files by default', async () => {
      const result1 = await testScript(process.cwd());
      const result2 = await testScript();

      expect(result2).toBe(result1);
    });
  });

  describe('lla', () => {
    const testScript = testBinScriptFactory(SCRIPT_NAMESPACE, 'lla');

    it('should list the specified directory\'s files', async () => {
      const result = await testScript(ROOT_DIR);

      expect(result).toContain('bin');
      expect(result).toContain('lib');
      expect(result).toContain('test');
      expect(result).toContain('package.json');
      expect(result).toContain('README.md');
    });

    it('should list one file per line', async () => {
      const result = await testScript(ROOT_DIR);

      expect(result).toMatch(/bin(\n|$)/);
      expect(result).toMatch(/lib(\n|$)/);
      expect(result).toMatch(/test(\n|$)/);
      expect(result).toMatch(/package.json(\n|$)/);
      expect(result).toMatch(/README.md(\n|$)/);
    });

    it('should also list hidden files', async () => {
      const result = await testScript(ROOT_DIR);

      expect(result).toContain('.gitignore');
      expect(result).toContain('.travis.yml');
    });

    it('should list the current directory\'s files by default', async () => {
      const result1 = await testScript(process.cwd());
      const result2 = await testScript();

      expect(result2).toBe(result1);
    });
  });
}));
