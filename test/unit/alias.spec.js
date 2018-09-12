'use strict';

// Imports
const {Alias, AliasDefault, AliasSpec, AliasSpecDefault} = require('../../lib/alias');
const utils = require('../../lib/utils');

// Tests
describe('alias', () => {
  describe('Alias', () => {
    describe('.constructor()', () => {
      it('should support passing a single `IAliasSpec` object', () => {
        const mockSpec = new AliasSpec();
        const alias = new Alias(mockSpec);

        expect(alias.getSpec()).toBe(mockSpec);
        expect(alias.getSpec('foo')).toBe(mockSpec);
      });

      it('should support passing an `ISpecPerPlatformMap` object', () => {
        const mockSpecMap = {default: {}};
        const alias = new Alias(mockSpecMap);

        expect(alias.getSpec()).toBe(mockSpecMap.default);
        expect(alias.getSpec('foo')).toBe(mockSpecMap.default);
      });
    });

    describe('.getAdditionalPlatforms()', () => {
      it('should return all additional platforms defined for the alias', () => {
        const alias = new Alias({default: {}, foo: {}, bar: {}});
        expect(alias.getAdditionalPlatforms()).toEqual(['foo', 'bar']);
      });

      it('should return an empty array if not additional platforms', () => {
        const alias1 = new Alias({default: {}});
        expect(alias1.getAdditionalPlatforms()).toEqual([]);

        const alias2 = new Alias(new AliasSpec());
        expect(alias2.getAdditionalPlatforms()).toEqual([]);
      });
    });

    describe('.getSpec()', () => {
      it('should return the `AliasSpec` for the specified platform', () => {
        const mockSpecMap = {default: {}, foo: {}};
        const alias = new Alias(mockSpecMap);

        expect(alias.getSpec('default')).toBe(mockSpecMap.default);
        expect(alias.getSpec('foo')).toBe(mockSpecMap.foo);
      });

      it('should return the default `AliasSpec` if none is available for the specified platform', () => {
        const mockSpecMap = {default: {}, foo: {}};
        const alias1 = new Alias(mockSpecMap);

        expect(alias1.getSpec('bar')).toBe(mockSpecMap.default);

        const mockSpec = new AliasSpec();
        const alias2 = new Alias(mockSpec);

        expect(alias2.getSpec('bar')).toBe(mockSpec);
      });

      it('should default to `utils.getPlatform()` for the platform', () => {
        spyOn(utils, 'getPlatform').and.returnValue('foo');

        const mockSpecMap = {default: {}, foo: {}};
        const alias = new Alias(mockSpecMap);

        expect(alias.getSpec()).toBe(mockSpecMap.foo);
      });
    });
  });

  describe('AliasDefault', () => {
    mockDefCode();

    it('should extend `Alias`', () => {
      const alias = new AliasDefault('');
      expect(alias).toEqual(jasmine.any(Alias));
    });

    it('should use an `AliasSpecDefault` as spec', () => {
      const alias = new AliasDefault('foo', {bar: 'baz'});
      const spec = alias.getSpec();

      expect(AliasSpecDefault.DEF_CODE).toHaveBeenCalledWith('foo', jasmine.objectContaining({bar: 'baz'}));
      expect(spec).toEqual(jasmine.any(AliasSpecDefault));
      expect(spec.code).toBe('MOCK_DEF_CODE');
      expect(spec.command).toBe('foo');
      expect(spec.description).toBe('foo');
    });
  });

  describe('AliasSpec', () => {
    it('should expose the specified code and description (but no command)', () => {
      const spec = new AliasSpec('foo', 'bar');

      expect(spec.code).toBe('foo');
      expect(spec.command).toBeUndefined();
      expect(spec.description).toBe('bar');
    });
  });

  describe('AliasSpecDefault', () => {
    mockDefCode();

    it('should extend `AliasSpec`', () => {
      const spec = new AliasSpecDefault('');
      expect(spec).toEqual(jasmine.any(AliasSpec));
    });

    it('should use the command and config to generate code (with `AliasSpecDefault.DEF_CODE()`)', () => {
      const spec = new AliasSpecDefault('foo', {bar: 'baz'});

      expect(spec.code).toBe('MOCK_DEF_CODE');
      expect(AliasSpecDefault.DEF_CODE).toHaveBeenCalledWith('foo', jasmine.objectContaining({bar: 'baz'}));
    });

    it('should default to `sapVersion: 2`', () => {
      new AliasSpecDefault('foo');
      expect(AliasSpecDefault.DEF_CODE).toHaveBeenCalledWith('foo', {sapVersion: 2});

      new AliasSpecDefault('foo', {bar: 'baz'});
      expect(AliasSpecDefault.DEF_CODE).toHaveBeenCalledWith('foo', {bar: 'baz', sapVersion: 2});
    });

    it('should allow overwriting `sapVersion`', () => {
      new AliasSpecDefault('foo', {bar: 'baz', sapVersion: 3});
      expect(AliasSpecDefault.DEF_CODE).toHaveBeenCalledWith('foo', {bar: 'baz', sapVersion: 3});
    });

    it('should use the command as description', () => {
      const spec = new AliasSpecDefault('foo', {bar: 'baz'});
      expect(spec.description).toBe('foo');
    });

    it('should expose the specified command', () => {
      const spec = new AliasSpecDefault('foo', {bar: 'baz'});
      expect(spec.command).toBe('foo');
    });
  });
});

// Helpers
function mockDefCode(defCode = () => 'MOCK_DEF_CODE') {
  let originalDefCode;

  // Use `global` to prevent `jasmine/no-global-setup` ESLint error.
  global.beforeEach(() => {
    originalDefCode = AliasSpecDefault.DEF_CODE;
    // eslint-disable-next-line jasmine/no-unsafe-spy
    AliasSpecDefault.DEF_CODE = jasmine.createSpy('DEF_CODE').and.callFake(defCode);
  });

  // Use `global` to prevent `jasmine/no-global-setup` ESLint error.
  global.afterEach(() => AliasSpecDefault.DEF_CODE = originalDefCode);
}
