// Imports
import {statSync} from 'node:fs';
import {basename, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

import {Alias, AliasSpecDefault, AliasUnknown} from '../../lib/alias.js';
import {
  _testing,
  ALIASES,
  BIN_DIR,
  DEF_CODE,
  getDescReplacements,
  PR_LOCAL_BRANCH_PREFIX,
  PR_REMOTE_ALIAS_PREFIX,
  ROOT_DIR,
  VERSION_STAMP,
} from '../../lib/constants.js';


// Tests
describe('constants', () => {
  describe('.ALIASES', () => {
    const getObjectValues = obj => Object.keys(obj).map(key => obj[key]);

    it('should be an object', () => {
      expect(ALIASES).toEqual(jasmine.any(Object));
    });

    it('should contain aliases grouped by category', () => {
      expect(Object.keys(ALIASES)).toEqual(['git', 'node', 'docker', 'aio', 'config', 'misc']);
    });

    it('should only contain `Alias` instances in each category', () => {
      const categorySpecs = getObjectValues(ALIASES);
      const allAliases = categorySpecs.
        map(categorySpec => getObjectValues(categorySpec)).
        reduce((aggr, categoryAliases) => aggr.concat(categoryAliases));

      expect(allAliases.length).toBeGreaterThan(10);
      allAliases.forEach(alias => expect(alias).toEqual(jasmine.any(Alias)));
    });
  });

  describe('.BIN_DIR', () => {
    it('should be a string', () => {
      expect(BIN_DIR).toEqual(jasmine.any(String));
    });

    it('should point to the `bin` directory', () => {
      expect(basename(BIN_DIR)).toBe('bin');
      expect(statSync(BIN_DIR).isDirectory()).toBe(true);
    });
  });

  describe('.DEF_CODE()', () => {
    it('should be a function', () => {
      expect(DEF_CODE).toEqual(jasmine.any(Function));
    });

    it('should be set as `AliasSpecDefault.DEF_CODE`', () => {
      expect(AliasSpecDefault.DEF_CODE.toString()).toBe(DEF_CODE.toString());
    });

    it('should return the code as string', () => {
      expect(DEF_CODE('')).toEqual(jasmine.any(String));
    });

    it('should return code for a node script', () => {
      expect(DEF_CODE('')).toContain('#!/usr/bin/env node');
    });

    it('should return code that exports the command', () => {
      expect(DEF_CODE('foo bar')).toContain('const cmd = \'foo bar\'');
      expect(DEF_CODE('foo bar')).toContain('export default cmd');
    });

    it('should return code with escaped `\'` in the command', () => {
      expect(DEF_CODE('foo \'bar\'')).toContain('const cmd = \'foo \\\'bar\\\'\'');
    });

    it('should support passing default config options', () => {
      expect(DEF_CODE('')).toContain('Object.assign({}, config)');
      expect(DEF_CODE('', {})).toContain('Object.assign({}, config)');
      expect(DEF_CODE('', {foo: true})).toContain('Object.assign({"foo":true}, config)');
    });
  });

  describe('.getDescReplacements()', () => {
    const descReplacements = getDescReplacements();

    it('should be a function', () => {
      expect(getDescReplacements).toEqual(jasmine.any(Function));
    });

    it('should delegate to its internal counterpart', async () => {
      const mockRepl = {foo: 'bar'};
      const internalSpy = spyOn(_testing, '_getDescReplacements').and.returnValue(mockRepl);

      expect(getDescReplacements()).toBe(mockRepl);
      expect(internalSpy).toHaveBeenCalledWith();
    });

    it('should return an object', () => {
      expect(descReplacements).toEqual(jasmine.any(Object));
    });

    it('should return an object with string values only', () => {
      const nonStringValueTypes = Object.keys(descReplacements).
        map(key => typeof descReplacements[key]).
        filter(type => type !== 'string');

      expect(nonStringValueTypes.length).toBe(0);
    });

    it('should return a replacement for `AliasUnknown.DESCRIPTION`', () => {
      expect(Object.keys(descReplacements)).toContain(AliasUnknown.DESCRIPTION);
    });
  });

  describe('.PR_LOCAL_BRANCH_PREFIX', () => {
    it('should be a string', () => {
      expect(PR_LOCAL_BRANCH_PREFIX).toEqual(jasmine.any(String));
    });

    it('should contain lowercase alphanumeric characters only', () => {
      expect(PR_LOCAL_BRANCH_PREFIX).toMatch(/^[a-z\d]+$/);
    });
  });

  describe('.PR_REMOTE_ALIAS_PREFIX', () => {
    it('should be a string', () => {
      expect(PR_REMOTE_ALIAS_PREFIX).toEqual(jasmine.any(String));
    });

    it('should contain lowercase alphanumeric characters only', () => {
      expect(PR_REMOTE_ALIAS_PREFIX).toMatch(/^[a-z\d]+$/);
    });
  });

  describe('.ROOT_DIR', () => {
    it('should be a string', () => {
      expect(ROOT_DIR).toEqual(jasmine.any(String));
    });

    it('should point to the `root` directory', () => {
      const __dirname = fileURLToPath(new URL('.', import.meta.url));
      const expectedRootDir = normalize(`${__dirname}/../..`);

      expect(basename(ROOT_DIR)).toBe(basename(expectedRootDir));
      expect(statSync(ROOT_DIR).isDirectory()).toBe(true);
    });
  });

  describe('.VERSION_STAMP', () => {
    it('should be a string', () => {
      expect(VERSION_STAMP).toEqual(jasmine.any(String));
    });

    it('should contain the package name an version', () => {
      expect(VERSION_STAMP).toMatch(/^@gkalpak\/aliases v\d+\.\d+\.\d+$/);
    });
  });
});
