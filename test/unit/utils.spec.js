'use strict';

// Imports
const utils = require('../../lib/utils');

// Tests
describe('utils', () => {
  describe('.getSpec()', () => {
    const getSpec = utils.getSpec;

    it('should be a function', () => {
      expect(getSpec).toEqual(jasmine.any(Function));
    });

    it('should retrieve the spec by name', () => {
      const obj = {foo: 'bar'};
      expect(getSpec(obj, 'foo')).toBe('bar');
    });

    it('should retrieve the OS-specific spec (if available)', () => {
      const obj = {foo: {default: 'bar1'}};
      obj.foo[process.platform] = 'bar2';

      expect(getSpec(obj, 'foo')).toBe('bar2');
    });

    it('should fall back to the default spec if non available for current OS', () => {
      const obj = {foo: {default: 'bar1'}};
      obj.foo[process.platform + ' not'] = 'bar2';

      expect(getSpec(obj, 'foo')).toBe('bar1');
    });
  });

  describe('.onError()', () => {
    const onError = utils.onError;

    beforeEach(() => {
      spyOn(console, 'error');
      spyOn(process, 'exit');
    });

    it('should be a function', () => {
      expect(onError).toEqual(jasmine.any(Function));
    });

    it('should log the error', () => {
      onError('foo');
      expect(console.error).toHaveBeenCalledWith('Error:', 'foo');
    });

    it('should exit the process with 1', () => {
      onError('foo');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('.padRight()', () => {
    const padRight = utils.padRight;

    it('should be a function', () => {
      expect(padRight).toEqual(jasmine.any(Function));
    });

    it('should pad the string on the right', () => {
      expect(padRight('foo', 5)).toBe('foo  ');
      expect(padRight('foo', 3)).toBe('foo');
      expect(padRight('', 5)).toBe('     ');
      expect(padRight('', 0)).toBe('');
    });

    it('should return the string unchanged if no padding is necessary', () => {
      expect(padRight('foooo', 5)).toBe('foooo');
      expect(padRight('foooo', 3)).toBe('foooo');
      expect(padRight('   ', 3)).toBe('   ');
      expect(padRight('   ', 2)).toBe('   ');
    });
  });

  describe('.wrapLine()', () => {
    const wrapLine = utils.wrapLine;

    it('should be a function', () => {
      expect(wrapLine).toEqual(jasmine.any(Function));
    });

    it('should return the line as is if less than 76 characters', () => {
      const line1 = 'foo bar baz qux';
      const line2 = '.'.repeat(75);

      expect(wrapLine(line1)).toBe(line1);
      expect(wrapLine(line2)).toBe(line2);
    });

    it('should wrap long lines at `&&`', () => {
      const part = 'foo bar baz qux'.repeat(2);
      const line = `${part} && ${part} && ${part}`;

      expect(wrapLine(line, 3)).toBe(`${part} \n     && ${part} \n     && ${part}`);
    });

    it('should default `indentLen` to 0 if not specified', () => {
      const part = 'foo bar baz qux'.repeat(2);
      const line = `${part} && ${part} && ${part}`;

      expect(wrapLine(line)).toBe(`${part} \n  && ${part} \n  && ${part}`);
    });

    it('should wrap lines at the first space after 75 characters if no `&&`', () => {
      const part1 = 'foo bar baz qux';
      const part2 = part1.repeat(5);
      const line1 = `${part2}${part1}`;
      const line2 = line1.replace(/ /g, '_');

      expect(wrapLine(line1, 3)).toBe(`${part2}foo \n     bar baz qux`);
      expect(wrapLine(line2, 3)).toBe(line2);
    });

    it('should iteratively wrap lines', () => {
      const part1 = 'foo bar baz qux';
      const part2 = ` && ${part1}`;
      const line = part2.repeat(5).slice(4);

      expect(wrapLine(line, 3)).toBe(`${part1} \n    ${part2} \n    ${part2} \n    ${part2} \n    ${part2}`);
    });

    it('should use different rules on each iteration (if necessary)', () => {
      const part1 = 'foo bar baz qux';
      const part2 = part1.repeat(4);
      const line = `${part2} && ${part2}${part2}`;

      expect(wrapLine(line, 3)).toBe(`${part2} \n     && ${part2}${part1}foo \n       bar baz qux${part1}${part1}`);
    });
  });
});
