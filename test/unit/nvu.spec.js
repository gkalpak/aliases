'use strict';

// Imports
const nvu = require('../../lib/nvu');
const runner = require('../../lib/runner');
const utils = require('../../lib/utils');
const {async} = require('../testUtils');

// Tests
describe('nvu()', () => {
  const runOutputs = {
    nvls:
      '    0.0.7 (Obsolete version)\n' +
      '  * 1.22.333 (Very nice version)\n' +
      '    333.22.1 (Even nicer version)\n' +
      '    333.22.9 (Version variation 1)\n' +
      '    333.99.1 (Version variation 2)\n',
    nvm: '',
  };

  beforeEach(() => {
    const fakeRun = cmd => {
      const executable = cmd.split(' ', 1).pop();
      return Promise.resolve(runOutputs[executable]);
    };

    spyOn(console, 'log');
    spyOn(runner, 'run').and.callFake(fakeRun);
    spyOn(utils, 'onError');
  });

  it('should be a function', () => {
    expect(nvu).toEqual(jasmine.any(Function));
  });

  describe('(dryrun)', () => {
    it('should return a resolved promise', async(() => {
      return nvu(['333'], {dryrun: true});
    }));

    it('should log the intended command', async(() => {
      const cmdStr = 'nvm use {{getVersion(\'333\',{{nvls}})}}';

      return nvu(['333'], {dryrun: true}).
        then(() => expect(console.log).toHaveBeenCalledWith(cmdStr));
    }));

    it('should include any extra arguments', async(() => {
      const cmdStr = 'nvm use {{getVersion(\'333\',{{nvls}})}} --foo && bar --baz';

      return nvu(['333', '--foo', '&&', 'bar', '--baz'], {dryrun: true}).
        then(() => expect(console.log).toHaveBeenCalledWith(cmdStr));
    }));
  });

  describe('(no dryrun)', () => {
    it('should return a promise', async(() => {
      return nvu(['333'], {});
    }));

    it('should run `nvls` (and return the output)', async(() => {
      return nvu(['333'], {}).
        then(() => expect(runner.run).toHaveBeenCalledWith('nvls', [], {returnOutput: true}));
    }));

    it('should return `nvls` output even if `config.returnOutput` is false (but not affect `config`)', async(() => {
      const config = {returnOutput: false};

      return nvu(['333'], config).then(() => {
        expect(runner.run).toHaveBeenCalledWith('nvls', [], {returnOutput: true});
        expect(config.returnOutput).toBe(false);
      });
    }));

    it('should handle errors', async(() => {
      runner.run.and.returnValue(Promise.reject('test'));

      return nvu(['333'], {}).
        then(() => expect(utils.onError).toHaveBeenCalledWith('test'));
    }));

    describe('on *nix', () => {
      beforeEach(() => spyOn(utils, 'getPlatform').and.returnValue('*nix'));

      it('should print a warning', async(() => {
        const warningRe = /^node -e "console.warn\(\\".*WARNING/;

        return Promise.resolve().
          then(() => nvu(['333'], {})).
          then(() => expect(runner.run.calls.mostRecent().args[0]).toMatch(warningRe)).
          then(() => nvu(['333', 'foo', '"bar"'], {})).
          then(() => expect(runner.run.calls.mostRecent().args[0]).toMatch(warningRe));
      }));

      it('should print no warning with chanined command', async(() => {
        const cmdStr = '. $NVM_DIR/nvm.sh && nvm use 333 $*';

        return nvu(['333', '&&', 'foo'], {}).
          then(() => expect(runner.run.calls.mostRecent().args[0]).toBe(cmdStr));
      }));

      it('should run the appropriate `nvm` command (with or without warning)', async(() => {
        const cmdRe = /\. \$NVM_DIR\/nvm\.sh && nvm use 333 \$\*$/;

        return Promise.resolve().
          then(() => nvu(['333'], {})).
          then(() => expect(runner.run.calls.mostRecent().args[0]).toMatch(cmdRe)).
          then(() => nvu(['333', '&&', 'foo'], {})).
          then(() => expect(runner.run.calls.mostRecent().args[0]).toMatch(cmdRe));
      }));

      it('should pass appropriate runtime arguments', async(() => {
        const originalArgs = ['333', 'foo', '"bar"'];
        const runtimeArgs = originalArgs.slice(1);

        return nvu(originalArgs, {}).then(() => {
          expect(runner.run.calls.mostRecent().args[1]).toEqual(runtimeArgs);
          expect(originalArgs.length).toBe(3);
        });
      }));

      it('should pass appropriate config', async(() => {
        const config = {foo: 'bar'};

        return nvu(['333'], config).
          then(() => expect(runner.run.calls.mostRecent().args[2]).toBe(config));
      }));
    });

    describe('on Windows', () => {
      beforeEach(() => spyOn(utils, 'getPlatform').and.returnValue('win32'));

      it('should run the appropriate `nvm` command for the branch', async(() => {
        const branchToCmdMap = {
          '333': 'nvm use 333.99.1 $*',
          '333.99': 'nvm use 333.99.1 $*',
          '333.22': 'nvm use 333.22.9 $*',
          '333.22.1': 'nvm use 333.22.1 $*',
          '0': 'nvm use 0.0.7 $*',
          '1': 'nvm use 1.22.333 $*',
        };
        const chainBranchTest = (aggr, branch) => aggr.
          then(() => nvu([branch], {})).
          then(() => expect(runner.run.calls.mostRecent().args[0]).toBe(branchToCmdMap[branch]));

        return Object.keys(branchToCmdMap).
          reduce(chainBranchTest, Promise.resolve());
      }));

      it('should fail when requesting non-existent branch', async(() => {
        let count = 0;
        const verifyBranch = branch => nvu([branch], {}).then(() => {
          expect(utils.onError).toHaveBeenCalledWith(Error(`No installed Node version found for '${branch}'.`));
          count++;
        });

        return Promise.
          all(['2', '333.2'].map(verifyBranch)).
          then(() => expect(count).toBe(2));
      }));

      it('should pass appropriate runtime arguments', async(() => {
        const originalArgs = ['333', 'foo', '"bar"'];
        const runtimeArgs = originalArgs.slice(1);

        return nvu(originalArgs, {}).then(() => {
          expect(runner.run.calls.mostRecent().args[1]).toEqual(runtimeArgs);
          expect(originalArgs.length).toBe(3);
        });
      }));

      it('should pass appropriate config', async(() => {
        const config = {foo: 'bar'};

        return nvu(['333'], config).
          then(() => expect(runner.run.calls.mostRecent().args[2]).toBe(config));
      }));
    });
  });
});
