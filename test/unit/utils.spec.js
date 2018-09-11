'use strict';

// Imports
const chalk = require('chalk');
const utils = require('../../lib/utils');
const {reversePromise, tickAsPromised} = require('../test-utils');

// Tests
describe('utils', () => {
  describe('.capitalize()', () => {
    const capitalize = utils.capitalize;

    it('should be a function', () => {
      expect(capitalize).toEqual(jasmine.any(Function));
    });

    it('should capitalize the input', () => {
      expect(capitalize('foo')).toBe('Foo');
      expect(capitalize('BAR')).toBe('BAR');
      expect(capitalize('bAz')).toBe('BAz');
      expect(capitalize('qux quX')).toBe('Qux quX');
    });
  });

  describe('.finallyAsPromised()', () => {
    const finallyAsPromised = utils.finallyAsPromised;
    let callback;

    beforeEach(() => callback = jasmine.createSpy('callback'));

    it('should be a function', () => {
      expect(finallyAsPromised).toEqual(jasmine.any(Function));
    });

    it('should return a promise', () => {
      const noop = () => {};
      expect(finallyAsPromised(new Promise(noop), noop)).toEqual(jasmine.any(Promise));
    });

    describe('when the original promise is resolved', () => {
      it('should call the callback afterwards', async () => {
        const promiseSpy = jasmine.createSpy('promiseSpy').and.callFake(() => expect(callback).not.toHaveBeenCalled());
        const promise = Promise.resolve().then(promiseSpy);

        await finallyAsPromised(promise, callback);

        expect(promiseSpy).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledTimes(1);
      });

      it('should wait if callback returns a promise', async () => {
        const callbackSpy = jasmine.createSpy('callbackSpy');
        callback.and.callFake(() => tickAsPromised().then(callbackSpy));

        await finallyAsPromised(Promise.resolve(), callback);

        expect(callbackSpy).toHaveBeenCalledTimes(1);
      });

      it('should ignore the return result of callback', async () => {
        const promise = Promise.resolve('foo');
        callback.and.returnValue('bar');

        const val = await finallyAsPromised(promise, callback);

        expect(val).toBe('foo');
      });

      it('should ignore the resolved value of callback (if it returns a promise)', async () => {
        const promise = Promise.resolve('foo');
        callback.and.returnValue(Promise.resolve('bar'));

        const val = await finallyAsPromised(promise, callback);

        expect(val).toBe('foo');
      });

      it('should reject with the value thrown by callback', async () => {
        const promise = Promise.resolve('foo');
        callback.and.callFake(() => { throw 'bar'; });

        const err = await reversePromise(finallyAsPromised(promise, callback));

        expect(err).toBe('bar');
      });

      it('should reject with the rejected value of callback (if it returns a promise)', async () => {
        const promise = Promise.resolve('foo');
        callback.and.callFake(() => Promise.reject('bar'));

        const err = await reversePromise(finallyAsPromised(promise, callback));

        expect(err).toBe('bar');
      });
    });

    describe('when the original promise is rejected', () => {
      it('should call the callback afterwards', async () => {
        const promiseSpy = jasmine.createSpy('promiseSpy').and.callFake(() => expect(callback).not.toHaveBeenCalled());
        const promise = Promise.resolve().then(promiseSpy).then(() => Promise.reject());

        await reversePromise(finallyAsPromised(promise, callback));

        expect(promiseSpy).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledTimes(1);
      });

      it('should wait if callback returns a promise', async () => {
        const callbackSpy = jasmine.createSpy('callbackSpy');
        callback.and.callFake(() => tickAsPromised().then(callbackSpy));

        await reversePromise(finallyAsPromised(Promise.reject(), callback));

        expect(callbackSpy).toHaveBeenCalledTimes(1);
      });

      it('should ignore the return result of callback', async () => {
        const promise = Promise.reject('foo');
        callback.and.returnValue('bar');

        const err = await reversePromise(finallyAsPromised(promise, callback));

        expect(err).toBe('foo');
      });

      it('should ignore the resolved value of callback (if it returns a promise)', async () => {
        const promise = Promise.reject('foo');
        callback.and.returnValue(Promise.resolve('bar'));

        const err = await reversePromise(finallyAsPromised(promise, callback));

        expect(err).toBe('foo');
      });

      it('should reject with the value thrown by callback', async () => {
        const promise = Promise.reject('foo');
        callback.and.callFake(() => { throw 'bar'; });

        const err = await reversePromise(finallyAsPromised(promise, callback));

        expect(err).toBe('bar');
      });

      it('should reject with the rejected value of callback (if it returns a promise)', async () => {
        const promise = Promise.reject('foo');
        callback.and.callFake(() => Promise.reject('bar'));

        const err = await reversePromise(finallyAsPromised(promise, callback));

        expect(err).toBe('bar');
      });
    });
  });

  describe('.getPlatform()', () => {
    const getPlatform = utils.getPlatform;

    it('should be a function', () => {
      expect(getPlatform).toEqual(jasmine.any(Function));
    });

    it('should return the current platform', () => {
      expect(getPlatform()).toBe(process.platform);
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

    it('should log the error (in red)', () => {
      onError('foo');
      expect(console.error).toHaveBeenCalledWith(chalk.red('Error: foo'));
    });

    it('should log the error as exit code if a (non-zero) number', () => {
      onError(42);
      expect(console.error).toHaveBeenCalledWith(chalk.red('Exit code: 42'));

      console.error.calls.reset();

      onError('42');
      expect(console.error).toHaveBeenCalledWith(chalk.red('Error: 42'));

      console.error.calls.reset();

      onError(0);
      expect(console.error).toHaveBeenCalledWith(chalk.red('Error: 0'));
    });

    it('should log the error\'s stacktrace (in red) if an `Error`', () => {
      onError(Object.assign(new Error('bar'), {stack: 'bar'}));
      expect(console.error).toHaveBeenCalledWith(chalk.red('bar'));
    });

    it('should exit the process with 1', () => {
      onError('foo');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit the process with `error` if a (non-zero) number', () => {
      onError(42);
      expect(process.exit).toHaveBeenCalledWith(42);

      onError('42');
      expect(process.exit).toHaveBeenCalledWith(1);

      onError(0);
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

  describe('.require()', () => {
    const require_ = utils.require;

    it('should be a function', () => {
      expect(require_).toEqual(jasmine.any(Function));
    });

    it('should delegate to `require()`', () => {
      expect(require_('path')).toBe(require('path'));
    });
  });

  describe('.requireWithEnv()', () => {
    const requireWithEnv = utils.requireWithEnv;
    let requireSpy;

    beforeEach(() => requireSpy = spyOn(utils, 'require'));

    it('should be a function', () => {
      expect(requireWithEnv).toEqual(jasmine.any(Function));
    });

    it('should load and return the specified dependency', () => {
      const mockDep = {};
      requireSpy.and.returnValue(mockDep);

      const dep = requireWithEnv('foo', {}, {});

      expect(dep).toBe(mockDep);
      expect(requireSpy).toHaveBeenCalledWith('foo');
    });

    it('should augment the environment with the specified values before loading the dependency', () => {
      const mockEnv = {foo: 'foo', bar: 'bar'};
      const tempEnv = {bar: 'temp-bar', baz: 'temp-baz'};
      requireSpy.and.callFake(() => expect(mockEnv).toEqual({
        foo: 'foo',
        bar: 'temp-bar',
        baz: 'temp-baz',
      }));

      requireWithEnv('foo', mockEnv, tempEnv);

      expect(requireSpy).toHaveBeenCalledTimes(1);
    });

    it('should restore the environment after loading the dependency', () => {
      const mockEnv = {foo: 'foo', bar: 'bar'};
      const tempEnv = {bar: 'temp-bar', baz: 'temp-baz'};

      requireWithEnv('foo', mockEnv, tempEnv);

      expect(mockEnv).toEqual({foo: 'foo', bar: 'bar'});
      expect(mockEnv.hasOwnProperty('baz')).toBe(false);
    });

    it('should restore the environment if loading the dependency errors', () => {
      const mockEnv = {foo: 'foo', bar: 'bar'};
      const tempEnv = {bar: 'temp-bar', baz: 'temp-baz'};
      requireSpy.and.callFake(() => { throw new Error('test'); });

      expect(() => requireWithEnv('foo', mockEnv, tempEnv)).toThrowError('test');
      expect(mockEnv).toEqual({foo: 'foo', bar: 'bar'});
      expect(mockEnv.hasOwnProperty('baz')).toBe(false);
    });

    it('should throw an error if a relative path is specified', () => {
      const relativePaths = ['./foo', '../bar'];

      relativePaths.forEach(p => {
        const errorMessage =
          `Unable to resolve '${p}'. Relative paths are not supported.\n` +
          `(To load relative files use \`requireWithEnv(require.resolve('${p}'), ...)\`.)`;
        expect(() => requireWithEnv(p, {}, {})).toThrowError(errorMessage);
      });

      expect(requireSpy).not.toHaveBeenCalled();
    });
  });

  describe('.stripIndentation()', () => {
    const stripIndentation = utils.stripIndentation;

    it('should be a function', () => {
      expect(stripIndentation).toEqual(jasmine.any(Function));
    });

    it('should strip leading/trailing whitespace-only lines and `\n`', () => {
      expect(stripIndentation('\nFoo\n')).toBe('Foo');
      expect(stripIndentation(' \nFoo\n ')).toBe('Foo');
      expect(stripIndentation(' \n F\noo \n ')).toBe(' F\noo ');
    });

    it('should preserve whitespace-only lines as second/second-last', () => {
      expect(stripIndentation(' \n \nFoo\n \n ')).toBe(' \nFoo\n ');
    });

    it('should remove extra indentation', () => {
      const input = `
        Hello
          world
        !
      `;
      expect(stripIndentation(input)).toBe('Hello\n  world\n!');
    });

    it('should ignore (but preserve) whitespace-only lines', () => {
      const input =
        '        \n' +
        '    Hello\n' +
        '        \n' +
        '      world\n' +
        '  \n' +
        '    !\n' +
        '        ';
      expect(stripIndentation(input)).toBe(
        'Hello\n' +
        '    \n' +
        '  world\n' +
        '\n' +
        '!');
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
