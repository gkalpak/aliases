'use strict';

// Imports
const {statSync} = require('fs');
const {basename, normalize} = require('path');
const constants = require('../../lib/constants');

// Tests
describe('constants', () => {
  describe('.ALIASES', () => {
    const aliases = constants.ALIASES;

    it('should be an object', () => {
      expect(aliases).toEqual(jasmine.any(Object));
    });

    it('should contain aliases grouped by category', () => {
      expect(Object.keys(aliases)).toContain('git', 'node', 'misc');
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
