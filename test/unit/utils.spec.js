'use strict';

// Imports
const chalk = require('chalk');
const rl = require('readline');
const {EventEmitter} = require('events');
const utils = require('../../lib/utils');
const {async, reversePromise, tickAsPromised} = require('../test-utils');

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

  describe('.doOnExit()', () => {
    const doOnExit = utils.doOnExit;
    let mockProc;
    let mockAction;
    let cancelFn;

    beforeEach(() => {
      mockProc = new EventEmitter();
      mockProc.exit = jasmine.createSpy('mockProc.exit');
      mockAction = jasmine.createSpy('mockAction');

      spyOn(console, 'warn');
      spyOn(mockProc, 'addListener').and.callThrough();

      cancelFn = doOnExit(mockProc, mockAction);
    });

    it('should be a function', () => {
      expect(doOnExit).toEqual(jasmine.any(Function));
    });

    it('should throw if no process specified', () => {
      expect(() => doOnExit()).toThrowError('No process specified.');
    });

    it('should throw if no action specified', () => {
      expect(() => doOnExit(mockProc)).toThrowError('No action specified.');
    });

    it('should take action on `SIGINT`', () => {
      expect(mockAction).not.toHaveBeenCalled();

      mockProc.emit('sigint');
      expect(mockAction).not.toHaveBeenCalled();

      mockProc.emit('SIGINT');
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('should take action on `exit`', () => {
      expect(mockAction).not.toHaveBeenCalled();

      mockProc.emit('EXIT');
      expect(mockAction).not.toHaveBeenCalled();

      mockProc.emit('exit');
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('should pass the emitted code to the action', () => {
      mockProc.emit('SIGINT');
      expect(mockAction).toHaveBeenCalledWith(undefined);

      mockProc.emit('exit', 0);
      expect(mockAction).toHaveBeenCalledWith(0);

      mockProc.emit('SIGINT', 42);
      expect(mockAction).toHaveBeenCalledWith(42);

      mockProc.emit('exit', 1337);
      expect(mockAction).toHaveBeenCalledWith(1337);
    });

    it('should exit the process (after taking action)', () => {
      mockProc.exit.and.callFake(() => expect(mockAction).toHaveBeenCalledTimes(1));
      mockAction.and.callFake(() => expect(mockProc.exit).not.toHaveBeenCalled());

      mockProc.emit('SIGINT');
      expect(mockProc.exit).toHaveBeenCalledTimes(1);

      mockProc.exit.calls.reset();
      mockAction.calls.reset();
      expect(mockProc.exit).not.toHaveBeenCalled();

      mockProc.emit('exit');
      expect(mockProc.exit).toHaveBeenCalledTimes(1);
    });

    it('should exit the process with the emitted code', () => {
      mockProc.emit('SIGINT', 42);
      expect(mockProc.exit).toHaveBeenCalledWith(42);

      mockProc.emit('exit', 1337);
      expect(mockProc.exit).toHaveBeenCalledWith(1337);
    });

    it('should do nothing if canceled', () => {
      cancelFn();

      mockProc.emit('SIGINT');
      mockProc.emit('exit');

      expect(mockProc.exit).not.toHaveBeenCalled();
      expect(mockAction).not.toHaveBeenCalled();
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
      it('should call the callback afterwards', async(() => {
        const promiseSpy = jasmine.createSpy('promiseSpy').and.callFake(() => expect(callback).not.toHaveBeenCalled());
        const promise = Promise.resolve().then(promiseSpy);

        return finallyAsPromised(promise, callback).then(() => {
          expect(promiseSpy).toHaveBeenCalledTimes(1);
          expect(callback).toHaveBeenCalledTimes(1);
        });
      }));

      it('should wait if callback returns a promise', async(() => {
        const callbackSpy = jasmine.createSpy('callbackSpy');
        callback.and.callFake(() => tickAsPromised().then(callbackSpy));

        return finallyAsPromised(Promise.resolve(), callback).
          then(() => expect(callbackSpy).toHaveBeenCalledTimes(1));
      }));

      it('should ignore the return result of callback', async(() => {
        const promise = Promise.resolve('foo');
        callback.and.returnValue('bar');

        return finallyAsPromised(promise, callback).
          then(val => expect(val).toBe('foo'));
      }));

      it('should ignore the resolved value of callback (if it returns a promise)', async(() => {
        const promise = Promise.resolve('foo');
        callback.and.returnValue(Promise.resolve('bar'));

        return finallyAsPromised(promise, callback).
          then(val => expect(val).toBe('foo'));
      }));

      it('should reject with the value thrown by callback', async(() => {
        const promise = Promise.resolve('foo');
        callback.and.callFake(() => { throw 'bar'; });

        return reversePromise(finallyAsPromised(promise, callback)).
          then(err => expect(err).toBe('bar'));
      }));

      it('should reject with the rejected value of callback (if it returns a promise)', async(() => {
        const promise = Promise.resolve('foo');
        callback.and.callFake(() => Promise.reject('bar'));

        return reversePromise(finallyAsPromised(promise, callback)).
          then(err => expect(err).toBe('bar'));
      }));
    });

    describe('when the original promise is rejected', () => {
      it('should call the callback afterwards', async(() => {
        const promiseSpy = jasmine.createSpy('promiseSpy').and.callFake(() => expect(callback).not.toHaveBeenCalled());
        const promise = Promise.resolve().then(promiseSpy).then(() => Promise.reject());

        return reversePromise(finallyAsPromised(promise, callback)).then(() => {
          expect(promiseSpy).toHaveBeenCalledTimes(1);
          expect(callback).toHaveBeenCalledTimes(1);
        });
      }));

      it('should wait if callback returns a promise', async(() => {
        const callbackSpy = jasmine.createSpy('callbackSpy');
        callback.and.callFake(() => tickAsPromised().then(callbackSpy));

        return reversePromise(finallyAsPromised(Promise.reject(), callback)).
          then(() => expect(callbackSpy).toHaveBeenCalledTimes(1));
      }));

      it('should ignore the return result of callback', async(() => {
        const promise = Promise.reject('foo');
        callback.and.returnValue('bar');

        return reversePromise(finallyAsPromised(promise, callback)).
          then(err => expect(err).toBe('foo'));
      }));

      it('should ignore the resolved value of callback (if it returns a promise)', async(() => {
        const promise = Promise.reject('foo');
        callback.and.returnValue(Promise.resolve('bar'));

        return reversePromise(finallyAsPromised(promise, callback)).
          then(err => expect(err).toBe('foo'));
      }));

      it('should reject with the value thrown by callback', async(() => {
        const promise = Promise.reject('foo');
        callback.and.callFake(() => { throw 'bar'; });

        return reversePromise(finallyAsPromised(promise, callback)).
          then(err => expect(err).toBe('bar'));
      }));

      it('should reject with the rejected value of callback (if it returns a promise)', async(() => {
        const promise = Promise.reject('foo');
        callback.and.callFake(() => Promise.reject('bar'));

        return reversePromise(finallyAsPromised(promise, callback)).
          then(err => expect(err).toBe('bar'));
      }));
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
      expect(getSpec(obj, 'foo')).toBe('bar1');
    });
  });

  describe('.noop()', () => {
    const noop = utils.noop;

    it('should be a function', () => {
      expect(noop).toEqual(jasmine.any(Function));
    });

    it('should do nothing', () => {
      expect(noop).not.toThrow();
      expect(noop()).toBeUndefined();
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

    it('should log the error\'s stacktrace (in red) if an `Error`', () => {
      onError(Object.assign(new Error('bar'), {stack: 'bar'}));
      expect(console.error).toHaveBeenCalledWith(chalk.red('bar'));
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

  describe('.suppressTerminateBatchJobConfirmation()', () => {
    const suppressTerminateBatchJobConfirmation = utils.suppressTerminateBatchJobConfirmation;
    let mockProc;
    let mockRlInstance;
    let createInterfaceSpy;

    beforeEach(() => {
      mockProc = Object.assign(new EventEmitter(), {
        platform: 'win32',
        stdin: {},
        stdout: {},
      });

      mockRlInstance = Object.assign(new EventEmitter(), {
        close: jasmine.createSpy('mockRlInstance.close'),
      });

      createInterfaceSpy = spyOn(rl, 'createInterface').and.returnValue(mockRlInstance);
    });

    it('should be a function', () => {
      expect(suppressTerminateBatchJobConfirmation).toEqual(jasmine.any(Function));
    });

    it('should do nothing on non-Windows platforms', () => {
      mockProc.platform = 'not-win32';
      suppressTerminateBatchJobConfirmation(mockProc);

      expect(createInterfaceSpy).not.toHaveBeenCalled();
    });

    it('should create a `readline` interface (delegating stdio to the specified process)', () => {
      suppressTerminateBatchJobConfirmation(mockProc);
      expect(createInterfaceSpy).toHaveBeenCalledTimes(1);

      const options = createInterfaceSpy.calls.mostRecent().args[0];
      expect(options.input).toBe(mockProc.stdin);
      expect(options.output).toBe(mockProc.stdout);
    });

    it('should forward `SIGINT` to the specified process', () => {
      const onSigintSpy = jasmine.createSpy('onSigint');
      mockProc.on('SIGINT', onSigintSpy);

      suppressTerminateBatchJobConfirmation(mockProc);
      expect(onSigintSpy).not.toHaveBeenCalled();

      mockRlInstance.emit('SIGINT');
      expect(onSigintSpy).toHaveBeenCalledWith();
    });

    it('should return an `unsuppress` function', async(() => {
      const unsuppressTbj = suppressTerminateBatchJobConfirmation(mockProc);

      expect(unsuppressTbj).toEqual(jasmine.any(Function));
      expect(mockRlInstance.close).not.toHaveBeenCalled();

      unsuppressTbj();
      expect(mockRlInstance.close).not.toHaveBeenCalled();

      return tickAsPromised().then(() => expect(mockRlInstance.close).toHaveBeenCalledTimes(1));
    }));

    it('should still return a (no-op) `unsuppress` function on non-Windows platforms', () => {
      mockProc.platform = 'not-win32';
      const unsuppressTbj = suppressTerminateBatchJobConfirmation(mockProc);

      expect(unsuppressTbj).toBe(utils.noop);
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
