'use strict';

// Imports
const fs = require('fs');
const path = require('path');
const aBuildsDirExps = require('../../../lib/alias-scripts/a-builds-dir');
const {reversePromise} = require('../../test-utils');

const {aBuildsDir, main} = aBuildsDirExps;

// Tests
describe('a-builds-dir', () => {
  describe('aBuildsDir()', () => {
    beforeEach(() => {
      let resolveCount = 0;

      spyOn(console, 'log');
      spyOn(fs, 'exists').and.callFake((p, cb) => cb(true));
      spyOn(fs, 'stat').and.callFake((p, cb) => cb(null, {isDirectory: () => true}));
      spyOn(path, 'resolve').and.callFake(p => `/absolute/${++resolveCount}/${p}`);
    });

    it('should be a function', () => {
      expect(aBuildsDir).toEqual(jasmine.any(Function));
    });

    describe('(dryrun)', () => {
      it('should return a resolved promise', async () => {
        const promise = aBuildsDir({dryrun: true});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should log a short description', async () => {
        const cmdDesc = 'Get the absolute path to \'.../angular/aio/aio-builds-setup/\'.';
        await aBuildsDir({dryrun: true});

        expect(console.log).toHaveBeenCalledWith(cmdDesc);
      });
    });

    describe('(no dryrun)', () => {
      it('should return a promise', async () => {
        const promise = aBuildsDir({});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should propagate errors', async () => {
        path.resolve.and.callFake(() => { throw 'test'; });
        const err = await reversePromise(aBuildsDir({}));

        expect(err).toBe('test');
      });

      describe('locating the directory', () => {
        it('should look at `./aio/aio-builds-setup/`', async () => {
          path.resolve.and.callFake(p => (p === 'aio/aio-builds-setup') ?
            '/ng/1/aio/aio-builds-setup' : '/wrong/path');

          await aBuildsDir({});

          expect(path.resolve).toHaveBeenCalledTimes(1);
          expect(console.log).toHaveBeenCalledWith('/ng/1/aio/aio-builds-setup');
        });

        it('should look at `./aio-builds-setup/` next', async () => {
          path.resolve.and.callFake(p => (p === 'aio-builds-setup') ?
            '/ng/2/aio/aio-builds-setup' : '/wrong/path');

          await aBuildsDir({});

          expect(path.resolve).toHaveBeenCalledTimes(2);
          expect(console.log).toHaveBeenCalledWith('/ng/2/aio/aio-builds-setup');
        });

        it('should look at `./` next', async () => {
          path.resolve.and.callFake(p => (p === '') ?
            '/ng/3/aio/aio-builds-setup' : '/wrong/path');

          await aBuildsDir({});

          expect(path.resolve).toHaveBeenCalledTimes(3);
          expect(console.log).toHaveBeenCalledWith('/ng/3/aio/aio-builds-setup');
        });

        it('should look at `../` next', async () => {
          path.resolve.and.callFake(p => (p === '..') ?
            '/ng/4/aio/aio-builds-setup' : '/wrong/path');

          await aBuildsDir({});

          expect(path.resolve).toHaveBeenCalledTimes(4);
          expect(console.log).toHaveBeenCalledWith('/ng/4/aio/aio-builds-setup');
        });

        it('should look at `../../` next', async () => {
          path.resolve.and.callFake(p => (p === '../..') ?
            '/ng/5/aio/aio-builds-setup' : '/wrong/path');

          await aBuildsDir({});

          expect(path.resolve).toHaveBeenCalledTimes(5);
          expect(console.log).toHaveBeenCalledWith('/ng/5/aio/aio-builds-setup');
        });

        it('should fail (with an informative error) if unable to locate the directory', async () => {
          path.resolve.and.returnValue('/wrong/path');

          const err = await reversePromise(aBuildsDir({}));

          expect(err.message).toBe(
              'Unable to locate the \'.../aio/aio-setup-builds/\' directory.\n' +
              'Make sure you are in a directory between \'angular/\' and ' +
              '\'angular/aio/aio-builds-setup/dockerbuild/scripts-js/\'.');
        });

        it('should verify that the directory matches `.../aio/aio-builds-setup/`', async () => {
          path.resolve.and.returnValues(
              '/ng/aio/foo',
              '/ng/notaio/aio-builds-setup',
              '/ng/1/aio/aio-builds-setup',
              '/ng/aio/aio-builds-setup/bar',
              '/ng/aio/aio-builds-setupnot',
              '/ng/2/aio/aio-builds-setup');

          await aBuildsDir({});
          expect(console.log).toHaveBeenCalledWith('/ng/1/aio/aio-builds-setup');

          await aBuildsDir({});
          expect(console.log).toHaveBeenCalledWith('/ng/2/aio/aio-builds-setup');
        });

        it('should verify that the directory exists', async () => {
          let existsCallIdx = -1;
          fs.exists.and.callFake((p, cb) => cb(Boolean(++existsCallIdx % 2)));
          path.resolve.and.returnValues('/ng/1/aio/aio-builds-setup', '/ng/2/aio/aio-builds-setup');

          await aBuildsDir({});

          expect(console.log).toHaveBeenCalledWith('/ng/2/aio/aio-builds-setup');
        });

        it('should verify that the directory is a...directory', async () => {
          let statCallIdx = -1;
          fs.stat.and.callFake((p, cb) => cb(null, {isDirectory: () => Boolean(++statCallIdx % 2)}));
          path.resolve.and.returnValues('/ng/1/aio/aio-builds-setup', '/ng/2/aio/aio-builds-setup');

          await aBuildsDir({});

          expect(console.log).toHaveBeenCalledWith('/ng/2/aio/aio-builds-setup');
        });

        it('should fail if `fs.stat()` fails', async () => {
          fs.stat.and.callFake((p, cb) => cb('test'));
          const err = await reversePromise(aBuildsDir({}));

          expect(err).toBe('test');
        });

        describe('(debug mode)', () => {
          it('should log the currently checked directory', async () => {
            const debugMsg = (i, p) => `Checking '${p}' (resolved to '/absolute/${i}/${p}')...`;
            fs.exists.and.callFake((p, cb) => cb(false));

            await reversePromise(aBuildsDir({}));
            expect(console.log).not.toHaveBeenCalled();

            await reversePromise(aBuildsDir({debug: true}));
            expect(console.log).toHaveBeenCalledTimes(5);
            expect(console.log).toHaveBeenCalledWith(debugMsg(6, 'aio/aio-builds-setup'));
            expect(console.log).toHaveBeenCalledWith(debugMsg(7, 'aio-builds-setup'));
            expect(console.log).toHaveBeenCalledWith(debugMsg(8, ''));
            expect(console.log).toHaveBeenCalledWith(debugMsg(9, '..'));
            expect(console.log).toHaveBeenCalledWith(debugMsg(10, '../..'));
          });

          it('should log the found directory', async () => {
            const foundRe = /^Target directory found: /;
            fs.exists.and.callFake((p, cb) => cb(p !== '/absolute/2/aio/aio-builds-setup'));

            // Directory found, but not in debug mode.
            await aBuildsDir({});

            // In debug mode, but directory not found.
            await reversePromise(aBuildsDir({debug: true}));

            const allArgs = console.log.calls.allArgs().map(args => args[0]);
            allArgs.forEach(arg => expect(arg).not.toMatch(foundRe));

            // Directory found and in debug mode.
            await aBuildsDir({debug: true});

            const foundMsg = 'Target directory found: /absolute/7/aio/aio-builds-setup';
            expect(foundMsg).toMatch(foundRe);
            expect(console.log).toHaveBeenCalledWith(foundMsg);
          });
        });
      });

      describe('output', () => {
        it('should log the absolute directory path', async () => {
          expect(await aBuildsDir({})).toBeUndefined();
          expect(console.log).toHaveBeenCalledWith('/absolute/1/aio/aio-builds-setup');

          expect(await aBuildsDir({returnOutput: false})).toBeUndefined();
          expect(console.log).toHaveBeenCalledWith('/absolute/2/aio/aio-builds-setup');
        });

        it('should return the absolute directory path if `returnOutput` is `true`', async () => {
          const result = await aBuildsDir({returnOutput: true});

          expect(result).toBe('/absolute/1/aio/aio-builds-setup');
          expect(console.log).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('main()', () => {
    let aBuildsDirSpy;

    beforeEach(() => aBuildsDirSpy = spyOn(aBuildsDirExps, 'aBuildsDir'));

    it('should be a function', () => {
      expect(main).toEqual(jasmine.any(Function));
    });

    it('should delegate to `aBuildsDir()` (with appropriate arguments)', () => {
      aBuildsDirSpy.and.returnValue('foo');
      const result = main('runtimeArgs', 'config');

      expect(aBuildsDirSpy).toHaveBeenCalledWith('config');
      expect(result).toBe('foo');
    });
  });
});
