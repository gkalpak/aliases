// Imports
import {_testing, aBuildsDir, main} from '../../../lib/alias-scripts/a-builds-dir.js';


// Tests
describe('a-builds-dir', () => {
  describe('aBuildsDir()', () => {
    let consoleLogSpy;
    let fsStatSpy;
    let pathResolveSpy;

    beforeEach(() => {
      let resolveCount = 0;

      consoleLogSpy = spyOn(console, 'log');
      fsStatSpy = spyOn(_testing, '_fsStat').and.resolveTo({isDirectory: () => true});
      pathResolveSpy = spyOn(_testing, '_pathResolve').and.callFake(p => `/absolute/${++resolveCount}/${p}`);
    });

    it('should be a function', () => {
      expect(aBuildsDir).toEqual(jasmine.any(Function));
    });

    it('should delegate to its internal counterpart', async () => {
      const mockConfig = {foo: 'bar'};
      const internalSpy = spyOn(_testing, '_aBuildsDir').and.resolveTo('foo');

      expect(await aBuildsDir(mockConfig)).toBe('foo');
      expect(internalSpy).toHaveBeenCalledWith(mockConfig);
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

        expect(consoleLogSpy).toHaveBeenCalledWith(cmdDesc);
      });
    });

    describe('(no dryrun)', () => {
      it('should return a promise', async () => {
        const promise = aBuildsDir({});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should propagate errors', async () => {
        pathResolveSpy.and.callFake(() => { throw 'test'; });
        await expectAsync(aBuildsDir({})).toBeRejectedWith('test');
      });

      describe('locating the directory', () => {
        it('should look at `./aio/aio-builds-setup/`', async () => {
          pathResolveSpy.and.callFake(p => (p === 'aio/aio-builds-setup') ?
            '/ng/1/aio/aio-builds-setup' : '/wrong/path');

          await aBuildsDir({});

          expect(pathResolveSpy).toHaveBeenCalledTimes(1);
          expect(consoleLogSpy).toHaveBeenCalledWith('/ng/1/aio/aio-builds-setup');
        });

        it('should look at `./aio-builds-setup/` next', async () => {
          pathResolveSpy.and.callFake(p => (p === 'aio-builds-setup') ?
            '/ng/2/aio/aio-builds-setup' : '/wrong/path');

          await aBuildsDir({});

          expect(pathResolveSpy).toHaveBeenCalledTimes(2);
          expect(consoleLogSpy).toHaveBeenCalledWith('/ng/2/aio/aio-builds-setup');
        });

        it('should look at `./` next', async () => {
          pathResolveSpy.and.callFake(p => (p === '') ?
            '/ng/3/aio/aio-builds-setup' : '/wrong/path');

          await aBuildsDir({});

          expect(pathResolveSpy).toHaveBeenCalledTimes(3);
          expect(consoleLogSpy).toHaveBeenCalledWith('/ng/3/aio/aio-builds-setup');
        });

        it('should look at `../` next', async () => {
          pathResolveSpy.and.callFake(p => (p === '..') ?
            '/ng/4/aio/aio-builds-setup' : '/wrong/path');

          await aBuildsDir({});

          expect(pathResolveSpy).toHaveBeenCalledTimes(4);
          expect(consoleLogSpy).toHaveBeenCalledWith('/ng/4/aio/aio-builds-setup');
        });

        it('should look at `../../` next', async () => {
          pathResolveSpy.and.callFake(p => (p === '../..') ?
            '/ng/5/aio/aio-builds-setup' : '/wrong/path');

          await aBuildsDir({});

          expect(pathResolveSpy).toHaveBeenCalledTimes(5);
          expect(consoleLogSpy).toHaveBeenCalledWith('/ng/5/aio/aio-builds-setup');
        });

        it('should fail (with an informative error) if unable to locate the directory', async () => {
          pathResolveSpy.and.returnValue('/wrong/path');

          await expectAsync(aBuildsDir({})).toBeRejectedWithError(
              'Unable to locate the \'.../aio/aio-setup-builds/\' directory.\n' +
              'Make sure you are in a directory between \'angular/\' and ' +
              '\'angular/aio/aio-builds-setup/dockerbuild/scripts-js/\'.');
        });

        it('should verify that the directory matches `.../aio/aio-builds-setup/`', async () => {
          pathResolveSpy.and.returnValues(
              '/ng/aio/foo',
              '/ng/notaio/aio-builds-setup',
              '/ng/1/aio/aio-builds-setup',
              '/ng/aio/aio-builds-setup/bar',
              '/ng/aio/aio-builds-setupnot',
              '/ng/2/aio/aio-builds-setup');

          await aBuildsDir({});
          expect(consoleLogSpy).toHaveBeenCalledWith('/ng/1/aio/aio-builds-setup');

          await aBuildsDir({});
          expect(consoleLogSpy).toHaveBeenCalledWith('/ng/2/aio/aio-builds-setup');
        });

        it('should verify that the directory exists', async () => {
          fsStatSpy.and.callFake(async p => {
            if (p.includes('/existing/')) {
              return {isDirectory: () => true};
            } else {
              throw new Error('File not found.');
            }
          });
          pathResolveSpy.and.returnValues('/ng/1/missing/aio/aio-builds-setup', '/ng/2/existing/aio/aio-builds-setup');

          await aBuildsDir({});

          expect(consoleLogSpy).toHaveBeenCalledWith('/ng/2/existing/aio/aio-builds-setup');
        });

        it('should verify that the directory is a...directory', async () => {
          fsStatSpy.and.callFake(async p => ({isDirectory: () => p.includes('/dir/')}));
          pathResolveSpy.and.returnValues('/ng/1/non-dir/aio/aio-builds-setup', '/ng/2/dir/aio/aio-builds-setup');

          await aBuildsDir({});

          expect(console.log).toHaveBeenCalledWith('/ng/2/dir/aio/aio-builds-setup');
        });

        it('should fail if `fs.stat()` fails', async () => {
          fsStatSpy.and.rejectWith('test');

          await expectAsync(aBuildsDir({})).toBeRejectedWithError(
              'Unable to locate the \'.../aio/aio-setup-builds/\' directory.\n' +
              'Make sure you are in a directory between \'angular/\' and ' +
              '\'angular/aio/aio-builds-setup/dockerbuild/scripts-js/\'.');
        });

        describe('(debug mode)', () => {
          it('should log the currently checked directory', async () => {
            const debugMsg = (i, p) => `Checking '${p}' (resolved to '/absolute/${i}/${p}')...`;
            fsStatSpy.and.resolveTo({isDirectory: () => false});

            await expectAsync(aBuildsDir({})).toBeRejected();
            expect(consoleLogSpy).not.toHaveBeenCalled();

            await expectAsync(aBuildsDir({debug: true})).toBeRejected();
            expect(consoleLogSpy).toHaveBeenCalledTimes(5);
            expect(consoleLogSpy).toHaveBeenCalledWith(debugMsg(6, 'aio/aio-builds-setup'));
            expect(consoleLogSpy).toHaveBeenCalledWith(debugMsg(7, 'aio-builds-setup'));
            expect(consoleLogSpy).toHaveBeenCalledWith(debugMsg(8, ''));
            expect(consoleLogSpy).toHaveBeenCalledWith(debugMsg(9, '..'));
            expect(consoleLogSpy).toHaveBeenCalledWith(debugMsg(10, '../..'));
          });

          it('should log the found directory', async () => {
            const foundRe = /^Target directory found: /;
            fsStatSpy.and.callFake(async p => ({isDirectory: () => p !== '/absolute/2/aio/aio-builds-setup'}));

            // Directory found, but not in debug mode.
            await aBuildsDir({});

            // In debug mode, but directory not found.
            await expectAsync(aBuildsDir({debug: true})).toBeRejected();

            const allArgs = consoleLogSpy.calls.allArgs().map(args => args[0]);
            allArgs.forEach(arg => expect(arg).not.toMatch(foundRe));

            // Directory found and in debug mode.
            await aBuildsDir({debug: true});

            const foundMsg = 'Target directory found: /absolute/7/aio/aio-builds-setup';
            expect(foundMsg).toMatch(foundRe);
            expect(consoleLogSpy).toHaveBeenCalledWith(foundMsg);
          });
        });
      });

      describe('output', () => {
        it('should log the absolute directory path', async () => {
          expect(await aBuildsDir({})).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('/absolute/1/aio/aio-builds-setup');

          expect(await aBuildsDir({returnOutput: false})).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('/absolute/2/aio/aio-builds-setup');
        });

        it('should return the absolute directory path if `returnOutput` is `true`', async () => {
          const result = await aBuildsDir({returnOutput: true});

          expect(result).toBe('/absolute/1/aio/aio-builds-setup');
          expect(consoleLogSpy).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('main()', () => {
    let aBuildsDirSpy;

    beforeEach(() => aBuildsDirSpy = spyOn(_testing, '_aBuildsDir'));

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
