// Imports
import {commandUtils} from '@gkalpak/cli-utils';

import {main, nvu, _testing as nvuTesting} from '../../../lib/alias-scripts/nvu.js';
import {ALIASES} from '../../../lib/constants.js';
import {_testing as utilsTesting} from '../../../lib/utils.js';


// Tests
describe('nvu', () => {
  describe('nvu()', () => {
    const nvlsCmdNix = ALIASES.node.nvls.getSpec('*nix').command;
    const nvlsCmdWin = ALIASES.node.nvls.getSpec('win32').command;
    const runOutputs = {
      [nvlsCmdWin]:
        '    333.100.0 (Version variation 3)\n' +
        '    333.99.1 (Version variation 2)\n' +
        '    333.22.9 (Version variation 1)\n' +
        '    333.22.1 (Even nicer version)\n' +
        '  * 1.22.333 (Very nice version)\n' +
        '    0.0.7 (Obsolete version)\n',
    };
    let cmdUtilsRunSpy;
    let consoleLogSpy;

    beforeEach(() => {
      cmdUtilsRunSpy = spyOn(commandUtils, 'run').and.callFake(async cmd => runOutputs[cmd] ?? '');
      consoleLogSpy = spyOn(console, 'log');
    });

    it('should be a function', () => {
      expect(nvu).toEqual(jasmine.any(Function));
    });

    it('should delegate to its internal counterpart', async () => {
      const mockRuntimeArgs = ['foo', 'bar'];
      const mockConfig = {baz: 'qux'};
      const internalSpy = spyOn(nvuTesting, '_nvu').and.resolveTo('quux');

      expect(await nvu(mockRuntimeArgs, mockConfig)).toBe('quux');
      expect(internalSpy).toHaveBeenCalledWith(mockRuntimeArgs, mockConfig);
    });

    describe('(dryrun)', () => {
      it('should return a promise', async () => {
        const promise = nvu(['333'], {dryrun: true});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      describe('on *nix', () => {
        beforeEach(() => spyOn(utilsTesting, '_getPlatform').and.returnValue('*nix'));

        it('should log the intended command', async () => {
          const expectedCmdStr = 'nvm use {{getVersion(333)}}';
          await nvu(['333'], {dryrun: true});

          expect(consoleLogSpy).toHaveBeenCalledWith(expectedCmdStr);
        });

        it('should include any extra arguments', async () => {
          const expectedCmdStr = 'nvm use {{getVersion(333)}} --foo && bar --baz';
          await nvu(['333', '--foo', '&&', 'bar', '--baz'], {dryrun: true});

          expect(consoleLogSpy).toHaveBeenCalledWith(expectedCmdStr);
        });
      });

      describe('on Windows', () => {
        beforeEach(() => spyOn(utilsTesting, '_getPlatform').and.returnValue('win32'));

        it('should log the intended command', async () => {
          const expectedCmdStr = 'nvm use {{getVersion(333, {{nvls}})}}';
          await nvu(['333'], {dryrun: true});

          expect(console.log).toHaveBeenCalledWith(expectedCmdStr);
        });

        it('should include any extra arguments', async () => {
          const expectedCmdStr = 'nvm use {{getVersion(333, {{nvls}})}} --foo && bar --baz';
          await nvu(['333', '--foo', '&&', 'bar', '--baz'], {dryrun: true});

          expect(console.log).toHaveBeenCalledWith(expectedCmdStr);
        });
      });
    });

    describe('(no dryrun)', () => {
      it('should return a promise', async () => {
        const promise = nvu(['333'], {});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should propagate errors', async () => {
        cmdUtilsRunSpy.and.rejectWith('test');
        await expectAsync(nvu(['333'], {})).toBeRejectedWith('test');
      });

      describe('on *nix', () => {
        beforeEach(() => spyOn(utilsTesting, '_getPlatform').and.returnValue('*nix'));

        it('should not run `nvls`', async () => {
          await nvu(['333'], {});
          expect(cmdUtilsRunSpy).not.toHaveBeenCalledWith(nvlsCmdNix, jasmine.anything(), jasmine.anything());
        });

        it('should print a warning', async () => {
          const warningRe1 = /^node --print "\\".*WARNING/;
          const warningRe2 = /'nvu 333 \\\\\\"&&\\\\\\" <some-command>'/;  // Escaped `\"` --> `\\\"`.
          let actualCmd;

          await nvu(['333'], {});
          actualCmd = cmdUtilsRunSpy.calls.mostRecent().args[0];

          expect(actualCmd).toMatch(warningRe1);
          expect(actualCmd).toMatch(warningRe2);

          await nvu(['333', 'foo', '"bar"'], {});
          actualCmd = cmdUtilsRunSpy.calls.mostRecent().args[0];

          expect(actualCmd).toMatch(warningRe1);
          expect(actualCmd).toMatch(warningRe1);
        });

        it('should print no warning with chained command', async () => {
          const expectedCmdStr = '. $NVM_DIR/nvm.sh && nvm use 333 $*';
          await nvu(['333', '&&', 'foo'], {});

          expect(cmdUtilsRunSpy.calls.mostRecent().args[0]).toBe(expectedCmdStr);
        });

        it('should run the appropriate `nvm` command (with or without warning)', async () => {
          const expectedCmdRe = /\. \$NVM_DIR\/nvm\.sh && nvm use 333 \$\*$/;

          await nvu(['333'], {});
          expect(cmdUtilsRunSpy.calls.mostRecent().args[0]).toMatch(expectedCmdRe);

          await nvu(['333', '&&', 'foo'], {});
          expect(cmdUtilsRunSpy.calls.mostRecent().args[0]).toMatch(expectedCmdRe);
        });

        it('should pass appropriate runtime arguments', async () => {
          const originalArgs = ['333', 'foo', '"bar"'];
          const runtimeArgs = originalArgs.slice(1);

          await nvu(originalArgs, {});

          expect(cmdUtilsRunSpy.calls.mostRecent().args[1]).toEqual(runtimeArgs);
          expect(originalArgs.length).toBe(3);
        });

        it('should pass appropriate config', async () => {
          const config = {foo: 'bar'};
          await nvu(['333'], config);

          expect(cmdUtilsRunSpy.calls.mostRecent().args[2]).toBe(config);
        });
      });

      describe('on Windows', () => {
        beforeEach(() => spyOn(utilsTesting, '_getPlatform').and.returnValue('win32'));

        it('should first run `nvls` (and return the output)', async () => {
          await nvu(['333'], {});
          expect(cmdUtilsRunSpy).toHaveBeenCalledWith(nvlsCmdWin, [], {returnOutput: true});
        });

        it('should return `nvls` output even if `config.returnOutput` is false (but not affect `config`)', async () => {
          const config = {returnOutput: false};
          await nvu(['333'], config);

          expect(cmdUtilsRunSpy).toHaveBeenCalledWith(nvlsCmdWin, [], {returnOutput: true});
          expect(config.returnOutput).toBe(false);
        });

        it('should run the appropriate `nvm` command for the branch', async () => {
          const branchToCmdMap = {
            '333': 'nvm use 333.100.0 $*',
            '333.99': 'nvm use 333.99.1 $*',
            '333.22': 'nvm use 333.22.9 $*',
            '333.22.1': 'nvm use 333.22.1 $*',
            '0': 'nvm use 0.0.7 $*',
            '1': 'nvm use 1.22.333 $*',
          };

          for (const branch of Object.keys(branchToCmdMap)) {
            await nvu([branch], {});
            expect(cmdUtilsRunSpy.calls.mostRecent().args[0]).toBe(branchToCmdMap[branch]);
          }
        });

        it('should fail when requesting non-existent branch', async () => {
          await expectAsync(nvu(['2'], {})).toBeRejectedWithError('No installed Node.js version found for \'2\'.');
          await expectAsync(nvu(['333.2'], {})).
            toBeRejectedWithError('No installed Node.js version found for \'333.2\'.');
        });

        it('should pass appropriate runtime arguments', async () => {
          const originalArgs = ['333', 'foo', '"bar"'];
          const runtimeArgs = originalArgs.slice(1);

          await nvu(originalArgs, {});

          expect(cmdUtilsRunSpy.calls.mostRecent().args[1]).toEqual(runtimeArgs);
          expect(originalArgs.length).toBe(3);
        });

        it('should pass appropriate config', async () => {
          const config = {foo: 'bar'};
          await nvu(['333'], config);

          expect(cmdUtilsRunSpy.calls.mostRecent().args[2]).toBe(config);
        });
      });
    });
  });

  describe('main()', () => {
    let nvuSpy;

    beforeEach(() => nvuSpy = spyOn(nvuTesting, '_nvu'));

    it('should be a function', () => {
      expect(main).toEqual(jasmine.any(Function));
    });

    it('should delegate to `nvu()` (with appropriate arguments)', () => {
      nvuSpy.and.returnValue('foo');
      const result = main('runtimeArgs', 'config');

      expect(nvuSpy).toHaveBeenCalledWith('runtimeArgs', 'config');
      expect(result).toBe('foo');
    });
  });
});
