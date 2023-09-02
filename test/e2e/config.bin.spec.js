// Imports
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {testingUtils} from '@gkalpak/cli-utils';

import {getPlatform} from '../../lib/utils.js';
import {ROOT_DIR} from '../test-utils.js';


// Constants
const SCRIPT_DIR = 'bin/config/';
const IS_WSL = getPlatform() === 'wsl';

// Tests
describe(SCRIPT_DIR, () => {
  const generatedByReSrc = '\\[Generated by: @gkalpak\\/aliases v\\d+\\.\\d+\\.\\d+]';

  describe('cfgbash', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'cfgbash'));

    it('should print configuration instructions for `bash`', async () => {
      const result = await testScript();

      expect(result).toMatch(new RegExp(`^### ${generatedByReSrc}\\n### Copy the following into '~/\\.bashrc':`));
      expect(result).toMatch(/#export HUSKY="0";\s+# For newer versions\.$/);

      if (IS_WSL) {
        expect(result).toMatch(/export GPG_TTY="\$\(tty\)";$/);
      }
    });
  });

  describe('cfggit', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'cfggit'));

    it('should print configuration instructions for `git`', async () => {
      const result = await testScript();

      expect(result).toMatch(new RegExp(`^### ${generatedByReSrc}\\n### Run the following commands:`));
      expect(result).toMatch(/git config --global user\.signingKey "[0-9A-F]{16}"$/);
    });
  });

  describe('cfggpg', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'cfggpg'));

    it('should print configuration instructions for GPG', async () => {
      const result = await testScript();

      expect(result).toMatch(
          new RegExp(`^### ${generatedByReSrc}\\n### Copy the following into '~/\\.gnupg/gpg-agent.conf':`));
      expect(result).toMatch(/max-cache-ttl \d+$/);
    });
  });

  describe('cfgssh', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'cfgssh'));

    it('should print configuration instructions for SSH', async () => {
      const result = await testScript();

      expect(result).toMatch(new RegExp(`^### ${generatedByReSrc}\\n### Copy the following into '~/\\.ssh/config':`));
      expect(result).toMatch(/IdentityFile ~\/\.ssh\/id-rsa-gkalpak\.ppk$/);
    });
  });

  describe('cfgvim', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'cfgvim'));

    it('should print configuration instructions for `vim`', async () => {
      const vimrcContent = readFileSync(join(ROOT_DIR, 'lib/assets/vimrc.txt'), 'utf8').trim().replace(/\r\n/g, '\n');
      const result = await testScript();

      expect(result).toMatch(new RegExp(`^""" ${generatedByReSrc}\\n""" Copy the following into '~/\\.vimrc':`));
      expect(result).toContain(vimrcContent);
    });
  });

  describe('cfgwsl', () => {
    const testScript = testingUtils.testScriptFactory(join(ROOT_DIR, SCRIPT_DIR, 'cfgwsl'));

    it('should print configuration instructions for setting up WSL', async () => {
      const result = await testScript();

      if (!IS_WSL) {
        expect(result).toBe('This alias only works in WSL.');
      } else {
        expect(result).toMatch(new RegExp(
            `^### ${generatedByReSrc}\\n` +
            '### Copy the following into a root-owned, 600-mode \'/etc/resolv\\.conf\' file:'));
        expect(result).toMatch(new RegExp(
            `### ${generatedByReSrc}\\n### Copy the following into a root-owned, 600-mode '/etc/wsl\\.conf' file:`));

        expect(result).toMatch(/generateResolvConf = false$/);
      }
    });
  });
});
