'use strict';

// Imports
const {commandUtils} = require('@gkalpak/cli-utils');
const {ALIASES} = require('../../lib/constants');
const nvuExps = require('../../lib/nvu');
const utils = require('../../lib/utils');
const {reversePromise} = require('../test-utils');

const {nvu, main} = nvuExps;

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

    beforeEach(() => {
      const fakeRun = cmd => Promise.resolve(runOutputs[cmd] || '');

      spyOn(console, 'log');
      spyOn(commandUtils, 'run').and.callFake(fakeRun);
    });

    it('should be a function', () => {
      expect(nvu).toEqual(jasmine.any(Function));
    });

    describe('(dryrun)', () => {
      it('should return a promise', async () => {
        const promise = nvu(['333'], {dryrun: true});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      describe('on *nix', () => {
        beforeEach(() => spyOn(utils, 'getPlatform').and.returnValue('*nix'));

        it('should log the intended command', async () => {
          const cmdStr = 'nvm use {{getVersion(333)}}';
          await nvu(['333'], {dryrun: true});

          expect(console.log).toHaveBeenCalledWith(cmdStr);
        });

        it('should include any extra arguments', async () => {
          const cmdStr = 'nvm use {{getVersion(333)}} --foo && bar --baz';
          await nvu(['333', '--foo', '&&', 'bar', '--baz'], {dryrun: true});

          expect(console.log).toHaveBeenCalledWith(cmdStr);
        });
      });

      describe('on Windows', () => {
        beforeEach(() => spyOn(utils, 'getPlatform').and.returnValue('win32'));

        it('should log the intended command', async () => {
          const cmdStr = 'nvm use {{getVersion(333, {{nvls}})}}';
          await nvu(['333'], {dryrun: true});

          expect(console.log).toHaveBeenCalledWith(cmdStr);
        });

        it('should include any extra arguments', async () => {
          const cmdStr = 'nvm use {{getVersion(333, {{nvls}})}} --foo && bar --baz';
          await nvu(['333', '--foo', '&&', 'bar', '--baz'], {dryrun: true});

          expect(console.log).toHaveBeenCalledWith(cmdStr);
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
        commandUtils.run.and.returnValue(Promise.reject('test'));
        const err = await reversePromise(nvu(['333'], {}));

        expect(err).toBe('test');
      });

      describe('on *nix', () => {
        beforeEach(() => spyOn(utils, 'getPlatform').and.returnValue('*nix'));

        it('should not run `nvls`', async () => {
          await nvu(['333'], {});
          expect(commandUtils.run).not.toHaveBeenCalledWith(nvlsCmdNix, jasmine.anything(), jasmine.anything());
        });

        it('should print a warning', async () => {
          const warningRe1 = /^node --print "\\".*WARNING/;
          const warningRe2 = /'nvu 333 \\\\\\"&&\\\\\\" <some-command>'/;  // Escaped `\"` --> `\\\"`.
          let actualCmd;

          await nvu(['333'], {});
          actualCmd = commandUtils.run.calls.mostRecent().args[0];

          expect(actualCmd).toMatch(warningRe1);
          expect(actualCmd).toMatch(warningRe2);

          await nvu(['333', 'foo', '"bar"'], {});
          actualCmd = commandUtils.run.calls.mostRecent().args[0];

          expect(actualCmd).toMatch(warningRe1);
          expect(actualCmd).toMatch(warningRe1);
        });

        it('should print no warning with chained command', async () => {
          const cmdStr = '. $NVM_DIR/nvm.sh && nvm use 333 $*';
          await nvu(['333', '&&', 'foo'], {});

          expect(commandUtils.run.calls.mostRecent().args[0]).toBe(cmdStr);
        });

        it('should run the appropriate `nvm` command (with or without warning)', async () => {
          const cmdRe = /\. \$NVM_DIR\/nvm\.sh && nvm use 333 \$\*$/;

          await nvu(['333'], {});
          expect(commandUtils.run.calls.mostRecent().args[0]).toMatch(cmdRe);

          await nvu(['333', '&&', 'foo'], {});
          expect(commandUtils.run.calls.mostRecent().args[0]).toMatch(cmdRe);
        });

        it('should pass appropriate runtime arguments', async () => {
          const originalArgs = ['333', 'foo', '"bar"'];
          const runtimeArgs = originalArgs.slice(1);

          await nvu(originalArgs, {});

          expect(commandUtils.run.calls.mostRecent().args[1]).toEqual(runtimeArgs);
          expect(originalArgs.length).toBe(3);
        });

        it('should pass appropriate config', async () => {
          const config = {foo: 'bar'};
          await nvu(['333'], config);

          expect(commandUtils.run.calls.mostRecent().args[2]).toBe(config);
        });
      });

      describe('on Windows', () => {
        beforeEach(() => spyOn(utils, 'getPlatform').and.returnValue('win32'));

        it('should first run `nvls` (and return the output)', async () => {
          await nvu(['333'], {});
          expect(commandUtils.run).toHaveBeenCalledWith(nvlsCmdWin, [], {returnOutput: true});
        });

        it('should return `nvls` output even if `config.returnOutput` is false (but not affect `config`)', async () => {
          const config = {returnOutput: false};
          await nvu(['333'], config);

          expect(commandUtils.run).toHaveBeenCalledWith(nvlsCmdWin, [], {returnOutput: true});
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
          const chainBranchTest = async (prev, branch) => {
            await prev;
            await nvu([branch], {});
            expect(commandUtils.run.calls.mostRecent().args[0]).toBe(branchToCmdMap[branch]);
          };

          await Object.keys(branchToCmdMap).reduce(chainBranchTest, Promise.resolve());
        });

        it('should fail when requesting non-existent branch', async () => {
          let count = 0;
          const verifyBranch = async branch => {
            const err = await reversePromise(nvu([branch], {}));
            expect(err).toEqual(jasmine.any(Error));
            expect(err.message).toBe(`No installed Node.js version found for '${branch}'.`);
            ++count;
          };

          await Promise.all(['2', '333.2'].map(verifyBranch));

          expect(count).toBe(2);
        });

        it('should pass appropriate runtime arguments', async () => {
          const originalArgs = ['333', 'foo', '"bar"'];
          const runtimeArgs = originalArgs.slice(1);

          await nvu(originalArgs, {});

          expect(commandUtils.run.calls.mostRecent().args[1]).toEqual(runtimeArgs);
          expect(originalArgs.length).toBe(3);
        });

        it('should pass appropriate config', async () => {
          const config = {foo: 'bar'};
          await nvu(['333'], config);

          expect(commandUtils.run.calls.mostRecent().args[2]).toBe(config);
        });
      });
    });
  });

  describe('main()', () => {
    let nvuSpy;

    beforeEach(() => nvuSpy = spyOn(nvuExps, 'nvu'));

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
