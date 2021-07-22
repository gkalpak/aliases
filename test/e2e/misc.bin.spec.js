'use strict';

// Imports
const {testingUtils} = require('@gkalpak/cli-utils');
const {join} = require('path');
const {version} = require('../../package.json');
const {ROOT_DIR} = require('../test-utils');

// Constants
const SCRIPT_DIR = 'bin/misc/';

// Tests
describe(SCRIPT_DIR, testingUtils.withJasmineTimeout(30000, () => {
  describe('alv', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'alv'));

    it('should print the current version stamp', async () => {
      const result = await testScript();
      expect(result).toBe(`@gkalpak/aliases v${version}`);
    });
  });

  describe('halp', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'halp'));

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
      expect(result1).toContain('--gkcu-sapVersion');
      expect(result1).toContain('--gkcu-suppressTbj');

      const result2 = await testScript('misc');
      expect(result2).toContain('--gkcu-debug');
      expect(result2).toContain('--gkcu-dryrun');
      expect(result2).toContain('--gkcu-sapVersion');
      expect(result2).toContain('--gkcu-suppressTbj');
    });

    it('should print all available aliases, when called without an argument', async () => {
      const result = await testScript();

      expect(result).toContain('Available aliases');

      expect(result).toContain('Aio aliases');
      expect(result).toContain('  aioall  ');
      expect(result).toContain('  aiorm  ');

      expect(result).toContain('Git aliases');
      expect(result).toContain('  gaa  ');
      expect(result).toContain('  gsync  ');

      expect(result).toContain('Misc aliases');
      expect(result).toContain('  alv  ');
      expect(result).toContain('  salfup  ');

      expect(result).toContain('Node aliases');
      expect(result).toContain('  nad  ');
      expect(result).toContain('  yt  ');
    });

    it('should print help for the specified category only, when called with an argument', async () => {
      const result = await testScript('misc');

      expect(result).not.toContain('Available aliases');

      expect(result).not.toContain('Aio aliases');
      expect(result).not.toContain('  aioall  ');
      expect(result).not.toContain('  aiorm  ');

      expect(result).not.toContain('Git aliases');
      expect(result).not.toContain('  gaa  ');
      expect(result).not.toContain('  gsync  ');

      expect(result).toContain('Misc aliases');
      expect(result).toContain('  alv  ');
      expect(result).toContain('  salfup  ');

      expect(result).not.toContain('Node aliases');
      expect(result).not.toContain('  nad  ');
      expect(result).not.toContain('  yt  ');
    });

    it('should print help for the specified aliases only, when called with multiple arguments', async () => {
      const result = await testScript('aioall yt xyz');

      expect(result).not.toContain('Available aliases');

      expect(result).toContain('Aio aliases subset');
      expect(result).toContain('  aioall  ');
      expect(result).not.toContain('  aiorm  ');

      expect(result).not.toContain('Git aliases');
      expect(result).not.toContain('  gaa  ');
      expect(result).not.toContain('  gsync  ');

      expect(result).not.toContain('Misc aliases');
      expect(result).not.toContain('  alv  ');
      expect(result).not.toContain('  salfup  ');

      expect(result).toContain('Node aliases subset');
      expect(result).toContain('  yt  ');
      expect(result).not.toContain('  nad  ');

      expect(result).toContain('Unknown aliases');
      expect(result).toContain('  xyz  ');
    });

    it('should support alias name wildcards', async () => {
      const result = await testScript('aio* yt xyz*');

      expect(result).not.toContain('Available aliases');

      expect(result).toContain('Aio aliases subset');
      expect(result).toContain('  aiorm  ');
      expect(result).toContain('  aiobd  ');
      expect(result).toContain('  aiord  ');
      expect(result).toContain('  aioatt  ');
      expect(result).toContain('  aioall  ');

      expect(result).not.toContain('Git aliases');
      expect(result).not.toContain('  gaa  ');
      expect(result).not.toContain('  gsync  ');

      expect(result).not.toContain('Misc aliases');
      expect(result).not.toContain('  alv  ');
      expect(result).not.toContain('  salfup  ');

      expect(result).toContain('Node aliases subset');
      expect(result).toContain('  yt  ');
      expect(result).not.toContain('  nad  ');

      expect(result).not.toContain('Unknown aliases');
      expect(result).not.toContain('xyz');
    });

    it('should replace private aliases in descriptions', async () => {
      const result = await testScript();
      expect(result).not.toContain('__');
      expect(result).toContain('(interactively pick a branch)');
      expect(result).toContain('(interactively pick a commit)');
    });
  });

  describe('ll', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'll'));

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

      expect(result).not.toContain('.github');
      expect(result).not.toContain('.gitignore');
    });

    it('should list the current directory\'s files by default', async () => {
      const result1 = await testScript(process.cwd());
      const result2 = await testScript();

      expect(result2).toBe(result1);
    });
  });

  describe('lla', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'lla'));

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

      expect(result).toContain('.github');
      expect(result).toContain('.gitignore');
    });

    it('should list the current directory\'s files by default', async () => {
      const result1 = await testScript(process.cwd());
      const result2 = await testScript();

      expect(result2).toBe(result1);
    });
  });
}));
