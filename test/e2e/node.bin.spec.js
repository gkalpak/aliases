// Imports
import {join} from 'node:path';

import {testingUtils} from '@gkalpak/cli-utils';
import sh from 'shelljs';

import {getPlatform} from '../../lib/utils.js';
import {ROOT_DIR} from '../test-utils.js';


// Constants
const SCRIPT_DIR = 'bin/node/';
const NVM_EXISTS = !!sh.which('nvm');
const IS_WINDOWS = getPlatform() === 'win32';

// Tests
describe(SCRIPT_DIR, testingUtils.withJasmineTimeout(60000, () => {
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
    // Under some circumstances, `npm list` fails due to missing peerDependency even with the `--global` option.
    // For example, when running the E2E tests from a different directory: `npm --prefix=aliases test-e2e`

    const alias = 'npm list --depth=0 --global';
    const testScript = testingUtils.testScriptFactory(`${join(ROOT_DIR, SCRIPT_DIR, 'nlsg')} 2>&1 || true`);

    it(`should be an alias for \`${alias}\``, async () => {
      const result1 = await testingUtils.testCmd(`${alias} 2>&1 || true`);
      const result2 = await testScript();

      expect(result2).toContain(result1);
    }, IS_WINDOWS ? 180000 : undefined);  // `npm list` can be really slow on Windows (esp. CI).
  });

  describe('nlsg1', () => {
    // Under some circumstances, `npm list` fails due to missing peerDependency even with the `--global` option.
    // For example, when running the E2E tests from a different directory: `npm --prefix=aliases test-e2e`

    const alias = 'npm list --depth=1 --global';
    const testScript = testingUtils.testScriptFactory(`${join(ROOT_DIR, SCRIPT_DIR, 'nlsg1')} 2>&1 || true`);

    it(`should be an alias for \`${alias}\``, async () => {
      const result1 = await testingUtils.testCmd(`${alias} 2>&1 || true`);
      const result2 = await testScript();

      expect(result2).toContain(result1);
    }, IS_WINDOWS ? 180000 : undefined);  // `npm list` can be really slow on Windows (esp. CI).
  });

  describe('nv', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'nv'));

    it('should print the Node.js version', async () => {
      const result = await testScript();
      expect(result).toBe(process.version);
    });
  });

  // - `nvm` might not be available on some environments; e.g. Windows on CI.
  // - `nvm` is being funny on non-Windows platforms, giving errors when run during tests
  //   (but not directly in the terminal).
  describe('nvls', onlyWithNvm(onlyOnWindows(() => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'nvls'));

    it('should at least list (pun intended) the current Node.js version', async () => {
      const result = await testScript();
      expect(result).toContain(process.version.replace(/^v/, ''));
    });
  })));

  // - `nvm` might not be available on some environments; e.g. Windows on CI.
  // - `nvm` is being funny on non-Windows platforms, giving errors when run during tests
  //   (but not directly in the terminal).
  describe('nvlsa', onlyWithNvm(onlyOnWindows(() => {
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
  })));

  describe('ylsg', () => {
    const alias = 'yarn global list --depth=0';
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'ylsg'));

    it(`should be an alias for \`${alias}\``, async () => {
      const result1 = await testingUtils.testCmd(alias);
      const result2 = await testScript();

      expect(removeYarnDuration(result2)).toContain(removeYarnDuration(result1));
    });
  });

  describe('ylsg1', () => {
    const alias = 'yarn global list --depth=1';
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'ylsg1'));

    it(`should be an alias for \`${alias}\``, async () => {
      const result1 = await testingUtils.testCmd(alias);
      const result2 = await testScript();

      expect(removeYarnDuration(result2)).toContain(removeYarnDuration(result1));
    });
  });
}));

// Helpers
function onlyIf(condition, testSuite) {
  return condition ?
    testSuite :
    // Return a dummy test suite to avoid Jasmine's "describe with no children" error.
    () => it('is skipped', () => expect(true).toBeTrue());
}

function onlyOnWindows(testSuite) {
  return onlyIf(IS_WINDOWS, testSuite);
}

function onlyWithNvm(testSuite) {
  return onlyIf(NVM_EXISTS, testSuite);
}

// Yarn adds a `Done in <XYZ>s.` line at the end, which may defer between invocations. Remove it to
// make it easier to compare the command outputs.
function removeYarnDuration(output) {
  return output.replace(/Done in .+?s\.$/, '');
}
