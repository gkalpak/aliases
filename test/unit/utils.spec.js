// Imports
import {sep} from 'node:path';

import chalk from 'chalk';
import isWsl from 'is-wsl';

import {
  _testing,
  capitalize,
  getPlatform,
  hasOwnProperty,
  importWithEnv,
  isMain,
  loadJson,
  onError,
  padRight,
  stripIndentation,
  wrapLine,
} from '../../lib/utils.js';
import {ROOT_DIR} from '../test-utils.js';


// Tests
describe('utils', () => {
  describe('.capitalize()', () => {
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

  describe('.getPlatform()', () => {
    it('should be a function', () => {
      expect(getPlatform).toEqual(jasmine.any(Function));
    });

    it('should delegate to its internal counterpart', () => {
      const internalSpy = spyOn(_testing, '_getPlatform').and.returnValue('foo');

      expect(getPlatform()).toBe('foo');
      expect(internalSpy).toHaveBeenCalledWith();
    });

    it('should return the current platform (or `wsl`)', () => {
      expect(getPlatform()).toBe(isWsl ? 'wsl' : process.platform);
    });
  });

  describe('.hasOwnProperty()', () => {
    it('should be a function', () => {
      expect(hasOwnProperty).toEqual(jasmine.any(Function));
    });

    it('should return `true` is the object owns the property', () => {
      expect(hasOwnProperty({foo: 'bar'}, 'foo')).toBeTrue();
    });

    it('should return `false` is the object does not have the property', () => {
      expect(hasOwnProperty({foo: 'bar'}, 'bar')).toBeFalse();
    });

    it('should return `false` is the object has but does not own the property', () => {
      const parent = {foo: 'bar'};
      const child = Object.create(parent);

      expect(child.foo).toBe('bar');
      expect(hasOwnProperty(parent, 'foo')).toBeTrue();
      expect(hasOwnProperty(child, 'foo')).toBeFalse();
    });

    it('should work on objects that do not inherit from `Object`', () => {
      const obj = Object.create(null);
      obj.foo = 'bar';

      expect(obj.hasOwnProperty).toBeUndefined();
      expect(hasOwnProperty(obj, 'foo')).toBeTrue();
      expect(hasOwnProperty(obj, 'bar')).toBeFalse();
    });
  });

  describe('.importWithEnv()', () => {
    let importSpy;
    let originalEnv;

    beforeEach(() => {
      importSpy = spyOn(_testing, '_import');

      originalEnv = process.env;
      process.env = {};
    });

    afterEach(() => process.env = originalEnv);

    it('should be a function', () => {
      expect(importWithEnv).toEqual(jasmine.any(Function));
    });

    it('should augment the environment with the specified values before loading the dependency', async () => {
      process.env = {foo: 'foo', bar: 'bar'};
      const tempEnv = {bar: 'temp-bar', baz: 'temp-baz'};

      importSpy.and.callFake(() => expect(process.env).toEqual({
        foo: 'foo',
        bar: 'temp-bar',
        baz: 'temp-baz',
      }));

      await importWithEnv('./utils.spec.js', import.meta.url, tempEnv);

      expect(importSpy).toHaveBeenCalledTimes(1);
    });

    it('should restore the environment after loading the dependency', async () => {
      process.env = {foo: 'foo', bar: 'bar'};
      const tempEnv = {bar: 'temp-bar', baz: 'temp-baz'};

      await importWithEnv('./utils.spec.js', import.meta.url, tempEnv);

      expect(process.env).toEqual({foo: 'foo', bar: 'bar'});
      expect(hasOwnProperty(process.env, 'baz')).toBe(false);
    });

    it('should restore the environment if loading the dependency errors', async () => {
      process.env = {foo: 'foo', bar: 'bar'};
      const tempEnv = {bar: 'temp-bar', baz: 'temp-baz'};
      importSpy.and.callFake(() => { throw new Error('test'); });

      await expectAsync(importWithEnv('./utils.spec.js', import.meta.url, tempEnv)).toBeRejectedWithError('test');
      expect(process.env).toEqual({foo: 'foo', bar: 'bar'});
      expect(hasOwnProperty(process.env, 'baz')).toBe(false);
    });

    it('should load and return the specified dependency', async () => {
      const mockDep = {};
      importSpy.and.returnValue(mockDep);

      await expectAsync(importWithEnv('./utils.spec.js', import.meta.url, {})).toBeResolvedTo(mockDep);
    });

    it('should resolve the path to a built-in module', async () => {
      await importWithEnv('events', import.meta.url, {});
      expect(importSpy).toHaveBeenCalledWith('events');
    });

    it('should resolve the path to a namespaced built-in module', async () => {
      await importWithEnv('node:events', import.meta.url, {});
      expect(importSpy).toHaveBeenCalledWith('node:events');
    });

    it('should resolve the path to a 3rd-party module', async () => {
      await importWithEnv('@gkalpak/cli-utils', import.meta.url, {});
      expect(importSpy).toHaveBeenCalledWith(jasmine.stringMatching(
          /^file:\/\/\/.*?\/node_modules\/@gkalpak\/cli-utils\/out\/lib\/index.js$/));
    });

    it('should resolve the path to a local file', async () => {
      await importWithEnv('../../lib/utils.js', import.meta.url, {});
      expect(importSpy).toHaveBeenCalledWith(jasmine.stringMatching(/^file:\/\/\/.*?\/lib\/utils.js$/));
    });

    it('should resolve the path to a local file without extension', async () => {
      await importWithEnv('../../lib/utils', import.meta.url, {});
      expect(importSpy).toHaveBeenCalledWith(jasmine.stringMatching(/^file:\/\/\/.*?\/lib\/utils.js$/));
    });
  });

  describe('.isMain()', () => {
    const pathRoot = (getPlatform() === 'win32') ? 'C:' : '';
    const originalArgv = process.argv;
    let fsExistsSyncSpy;
    let fsRealpathSyncSpy;

    const buildAbsPath = (...segments) => [pathRoot, ...segments].join(sep);
    const buildFileUrl = (...segments) => ['file:/', pathRoot, ...segments].join('/');

    beforeEach(() => {
      process.argv = ['node'];
      fsExistsSyncSpy = spyOn(_testing, '_fsExistsSync').and.returnValue(true);
      fsRealpathSyncSpy = spyOn(_testing, '_fsRealpathSync').and.callFake(path => path);
    });

    afterEach(() => process.argv = originalArgv);

    it('should be a function', () => {
      expect(isMain).toEqual(jasmine.any(Function));
    });

    it('should return `true` when the specified file URL corresponds to the main module', () => {
      process.argv[1] = buildAbsPath('foo', 'bar.js');
      expect(isMain(buildFileUrl('foo', 'bar.js'))).toBeTrue();

      process.argv[1] = buildAbsPath('foo', 'bar.mjs');
      expect(isMain(buildFileUrl('foo', 'bar.mjs'))).toBeTrue();

      process.argv[1] = buildAbsPath('foo', 'bar');
      expect(isMain(buildFileUrl('foo', 'bar'))).toBeTrue();
    });

    it('should return `false` when the specified file URL does not correspond to the main module', () => {
      process.argv[1] = buildAbsPath('foo', 'bar.js');
      expect(isMain(buildFileUrl('baz', 'qux.js'))).toBeFalse();

      process.argv[1] = buildAbsPath('foo', 'bar');
      expect(isMain(buildFileUrl('foo', 'baz'))).toBeFalse();

      process.argv[1] = buildAbsPath('foo', 'bar');
      expect(isMain(buildFileUrl('foo', 'bar', 'baz'))).toBeFalse();

      process.argv[1] = buildAbsPath('foo', 'bar');
      expect(isMain(buildFileUrl('qux', 'foo', 'bar'))).toBeFalse();
    });

    it('should account for an omitted `.js` file extension', () => {
      process.argv[1] = buildAbsPath('foo', 'bar');
      fsExistsSyncSpy.and.callFake(path => path === `${process.argv[1]}.js`);

      expect(isMain(buildFileUrl('foo', 'bar.js'))).toBeTrue();
    });

    it('should not assume a `.js` file extension if the resulting path does not exist', () => {
      process.argv[1] = buildAbsPath('foo', 'bar');
      fsExistsSyncSpy.and.callFake(path => path === process.argv[1]);

      expect(isMain(buildFileUrl('foo', 'bar.js'))).toBeFalse();
    });

    it('should correctly resolve symbolic links', () => {
      process.argv[1] = buildAbsPath('foo', 'bar.js');
      const spy = fsRealpathSyncSpy.withArgs(process.argv[1]);

      spy.and.returnValue(buildAbsPath('baz', 'qux.js'));
      expect(isMain(buildFileUrl('baz', 'qux.js'))).toBeTrue();

      spy.and.returnValue(buildAbsPath('foo', 'bar.mjs'));
      expect(isMain(buildFileUrl('foo', 'bar.mjs'))).toBeTrue();
    });

    it('should correctly resolve symbolic links when the `.js` file extension is omitted', () => {
      const absPathWithoutExt = process.argv[1] = buildAbsPath('foo', 'bar');
      const absPathWithExt = `${absPathWithoutExt}.js`;

      fsExistsSyncSpy.and.callFake(path => path === absPathWithExt);
      fsRealpathSyncSpy.withArgs(absPathWithExt).and.returnValue(buildAbsPath('baz', 'qux.js'));

      expect(isMain(buildFileUrl('baz', 'qux.js'))).toBeTrue();
    });
  });

  describe('.loadJson()', () => {
    it('should be a function', () => {
      expect(loadJson).toEqual(jasmine.any(Function));
    });

    it('should load and parse a JSON file', () => {
      expect(loadJson(`${ROOT_DIR}/package.json`)).toEqual(jasmine.objectContaining({
        name: '@gkalpak/aliases',
        homepage: 'https://github.com/gkalpak/aliases#readme',
      }));

      expect(loadJson(`${ROOT_DIR}/test/.eslintrc.json`)).toEqual(jasmine.objectContaining({
        extends: ['plugin:jasmine/recommended'],
        plugins: ['jasmine'],
        env: {jasmine: true},
      }));
    });

    it('should throw an error if the file does not exist', () => {
      expect(() => loadJson('/non/existing/file.json')).toThrowError(
          /^Failed to load and parse JSON file '\/non\/existing\/file\.json': ENOENT: no such file or directory/);
    });

    it('should throw an error if the file is not parsable', () => {
      expect(() => loadJson(`${ROOT_DIR}/LICENSE.txt`)).toThrowError(
          /^Failed to load and parse JSON file '[^']+\/LICENSE\.txt': Unexpected token .+ JSON/);
    });
  });

  describe('.onError()', () => {
    let consoleErrorSpy;
    let processExitSpy;

    beforeEach(() => {
      consoleErrorSpy = spyOn(console, 'error');
      processExitSpy = spyOn(process, 'exit');
    });

    it('should be a function', () => {
      expect(onError).toEqual(jasmine.any(Function));
    });

    it('should delegate to its internal counterpart', async () => {
      const internalSpy = spyOn(_testing, '_onError').and.resolveTo('foo');

      expect(await onError('bar')).toBe('foo');
      expect(internalSpy).toHaveBeenCalledWith('bar');
    });

    it('should log the error (in red)', async () => {
      await onError('foo');
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Error: foo'));
    });

    it('should log the error as exit code if a (non-zero) number', async () => {
      await onError(42);
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Exit code: 42'));

      consoleErrorSpy.calls.reset();

      await onError('42');
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Error: 42'));

      consoleErrorSpy.calls.reset();

      await onError(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Error: 0'));
    });

    it('should log the error\'s stacktrace (in red) if an `Error`', async () => {
      await onError(Object.assign(new Error('bar'), {stack: 'bar'}));
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('bar'));
    });

    it('should exit the process with 1', async () => {
      await onError('foo');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit the process with `error` if a (non-zero) number', async () => {
      await onError(42);
      expect(processExitSpy).toHaveBeenCalledWith(42);

      await onError('42');
      expect(processExitSpy).toHaveBeenCalledWith(1);

      await onError(0);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('.padRight()', () => {
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
    it('should be a function', () => {
      expect(wrapLine).toEqual(jasmine.any(Function));
    });

    it('should delegate to its internal counterpart', async () => {
      const internalSpy = spyOn(_testing, '_wrapLine').and.returnValue('foo');

      expect(wrapLine('bar')).toBe('foo');
      expect(internalSpy).toHaveBeenCalledWith('bar', '');

      expect(wrapLine('baz', '  ')).toBe('foo');
      expect(internalSpy).toHaveBeenCalledWith('baz', '  ');
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

      expect(wrapLine(line, '   ')).toBe(`${part} \n     && ${part} \n     && ${part}`);
    });

    it('should default `indent` to `\'\'` if not specified', () => {
      const part = 'foo bar baz qux'.repeat(2);
      const line = `${part} && ${part} && ${part}`;

      expect(wrapLine(line)).toBe(`${part} \n  && ${part} \n  && ${part}`);
    });

    it('should wrap lines at the first space after 75 characters if no `&&`', () => {
      const part1 = 'foo bar baz qux';
      const part2 = part1.repeat(5);
      const line1 = `${part2}${part1}`;
      const line2 = line1.replace(/ /g, '_');

      expect(wrapLine(line1, '   ')).toBe(`${part2}foo \n     bar baz qux`);
      expect(wrapLine(line2, '   ')).toBe(line2);
    });

    it('should iteratively wrap lines', () => {
      const part1 = 'foo bar baz qux';
      const part2 = ` && ${part1}`;
      const line = part2.repeat(5).slice(4);

      expect(wrapLine(line, '   ')).toBe(`${part1} \n    ${part2} \n    ${part2} \n    ${part2} \n    ${part2}`);
    });

    it('should use different rules on each iteration (if necessary)', () => {
      const part1 = 'foo bar baz qux';
      const part2 = part1.repeat(4);
      const line = `${part2} && ${part2}${part2}`;

      expect(wrapLine(line, '   ')).toBe(`${part2} \n     && ${part2}${part1}foo \n       bar baz qux${part1}${part1}`);
    });
  });
});
