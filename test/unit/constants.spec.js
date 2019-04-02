'use strict';

// Imports
const {statSync} = require('fs');
const {basename, normalize} = require('path');
const {Alias, AliasSpecDefault, AliasUnknown} = require('../../lib/alias');
const constants = require('../../lib/constants');

// Tests
describe('constants', () => {
  describe('.ALIASES', () => {
    const aliases = constants.ALIASES;
    const getObjectValues = obj => Object.keys(obj).map(key => obj[key]);

    it('should be an object', () => {
      expect(aliases).toEqual(jasmine.any(Object));
    });

    it('should contain aliases grouped by category', () => {
      expect(Object.keys(aliases)).toEqual(['git', 'node', 'aio', 'config', 'misc']);
    });

    it('should only contain `Alias` instances in each category', () => {
      const categorySpecs = getObjectValues(aliases);
      const allAliases = categorySpecs.
        map(categorySpec => getObjectValues(categorySpec)).
        reduce((aggr, categoryAliases) => aggr.concat(categoryAliases));

      expect(allAliases.length).toBeGreaterThan(10);
      allAliases.forEach(alias => expect(alias).toEqual(jasmine.any(Alias)));
    });
  });

  describe('.BIN_DIR', () => {
    const binDir = constants.BIN_DIR;

    it('should be a string', () => {
      expect(binDir).toEqual(jasmine.any(String));
    });

    it('should point to the `bin` directory', () => {
      expect(basename(binDir)).toBe('bin');
      expect(statSync(binDir).isDirectory()).toBe(true);
    });
  });

  describe('.DEF_CODE()', () => {
    const defCode = constants.DEF_CODE;

    it('should be a function', () => {
      expect(defCode).toEqual(jasmine.any(Function));
    });

    it('should be set as `AliasSpecDefault.DEF_CODE`', () => {
      expect(AliasSpecDefault.DEF_CODE.toString()).toBe(defCode.toString());
    });

    it('should return the code as string', () => {
      expect(defCode('')).toEqual(jasmine.any(String));
    });

    it('should return code for a node script', () => {
      expect(defCode('')).toContain('#!/usr/bin/env node');
    });

    it('should return code that runs in strict mode', () => {
      expect(defCode('')).toContain('\'use strict\'');
    });

    it('should return code that exports the command', () => {
      expect(defCode('foo bar')).toContain('module.exports = \'foo bar\'');
    });

    it('should return code with escaped `\'` in the command', () => {
      expect(defCode('foo \'bar\'')).toContain('module.exports = \'foo \\\'bar\\\'\'');
    });

    it('should support passing default config options', () => {
      expect(defCode('')).toContain('Object.assign({}, config)');
      expect(defCode('', {})).toContain('Object.assign({}, config)');
      expect(defCode('', {foo: true})).toContain('Object.assign({"foo":true}, config)');
    });
  });

  describe('.DESC_REPLACEMENTS', () => {
    const descReplacements = constants.DESC_REPLACEMENTS;

    it('should be an object', () => {
      expect(descReplacements).toEqual(jasmine.any(Object));
    });

    it('should have string values only', () => {
      const nonStringValueTypes = Object.keys(descReplacements).
        map(key => typeof descReplacements[key]).
        filter(type => type !== 'string');

      expect(nonStringValueTypes.length).toBe(0);
    });

    it('should have a replacement for `AliasUnknown.DESCRIPTION`', () => {
      expect(Object.keys(descReplacements)).toContain(AliasUnknown.DESCRIPTION);
    });
  });

  describe('.ROOT_DIR', () => {
    const rootDir = constants.ROOT_DIR;

    it('should be a string', () => {
      expect(rootDir).toEqual(jasmine.any(String));
    });

    it('should point to the `root` directory', () => {
      const expectedRootDir = normalize(`${__dirname}/../..`);

      expect(basename(rootDir)).toBe(basename(expectedRootDir));
      expect(statSync(rootDir).isDirectory()).toBe(true);
    });
  });

  describe('.VERSION_STAMP', () => {
    const versionStamp = constants.VERSION_STAMP;

    it('should be a string', () => {
      expect(versionStamp).toEqual(jasmine.any(String));
    });

    it('should contain the package name an version', () => {
      expect(versionStamp).toMatch(/^@gkalpak\/aliases v\d+\.\d+\.\d+$/);
    });
  });
});
