// Imports
import {join} from 'node:path';

import {testingUtils} from '@gkalpak/cli-utils';

import {ROOT_DIR} from '../test-utils.js';


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
