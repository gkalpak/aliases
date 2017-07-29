'use strict';

// Imports
const nvu = require('../../lib/nvu');
const runner = require('../../lib/runner');
const utils = require('../../lib/utils');

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
    it('should return a resolved promise', done => {
      nvu(['333'], {dryrun: true}).then(done);
    });

    it('should log the intended command', done => {
      const cmdStr = 'nvm use {{getVersion(\'333\',{{nvls}})}}';

      nvu(['333'], {dryrun: true}).
        then(() => expect(console.log).toHaveBeenCalledWith(cmdStr)).
        then(done);
    });
  });

  describe('(no dryrun)', () => {
    it('should return a promise', done => {
      nvu(['333'], {}).then(done);
    });

    it('should run `nvls` (and return the output)', done => {
      nvu(['333'], {}).
        then(() => expect(runner.run).toHaveBeenCalledWith('nvls', [], {returnOutput: true})).
        then(done);
    });

    it('should return `nvls` output even if `config.returnOutput` is false (but not affect `config`)', done => {
      const config = {returnOutput: false};

      nvu(['333'], config).
        then(() => {
          expect(runner.run).toHaveBeenCalledWith('nvls', [], {returnOutput: true});
          expect(config.returnOutput).toBe(false);
        }).
        then(done);
    });

    it('should handle errors', done => {
      runner.run.and.returnValue(Promise.reject('test'));

      nvu(['333'], {}).
        then(() => expect(utils.onError).toHaveBeenCalledWith('test')).
        then(done);
    });

    describe('on *nix', () => {
      beforeEach(() => spyOn(utils, 'getPlatform').and.returnValue('*nix'));

      it('should run the appropriate `nvm` command', done => {
        const cmdStr = '. $NVM_DIR/nvm.sh && nvm use 333 $*';

        nvu(['333'], {}).
          then(() => expect(runner.run.calls.mostRecent().args[0]).toBe(cmdStr)).
          then(done);
      });

      it('should pass appropriate runtime arguments', done => {
        const originalArgs = ['333', 'foo', '"bar"'];
        const runtimeArgs = originalArgs.slice(1);

        nvu(originalArgs, {}).
          then(() => {
            expect(runner.run.calls.mostRecent().args[1]).toEqual(runtimeArgs);
            expect(originalArgs.length).toBe(3);
          }).
          then(done);
      });

      it('should pass appropriate config', done => {
        const config = {foo: 'bar'};

        nvu(['333'], config).
          then(() => expect(runner.run.calls.mostRecent().args[2]).toBe(config)).
          then(done);
      });
    });

    describe('on Windows', () => {
      beforeEach(() => spyOn(utils, 'getPlatform').and.returnValue('win32'));

      it('should run the appropriate `nvm` command for the branch', done => {
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

        Object.keys(branchToCmdMap).
          reduce(chainBranchTest, Promise.resolve()).
          then(done);
      });

      it('should fail when requesting non-existent branch', done => {
        let count = 0;
        const verifyBranch = branch => nvu([branch], {}).then(() => {
          expect(utils.onError).toHaveBeenCalledWith(Error(`No installed Node version found for '${branch}'.`));
          count++;
        });

        Promise.
          all(['2', '333.2'].map(verifyBranch)).
          then(() => expect(count).toBe(2)).
          then(done);
      });

      it('should pass appropriate runtime arguments', done => {
        const originalArgs = ['333', 'foo', '"bar"'];
        const runtimeArgs = originalArgs.slice(1);

        nvu(originalArgs, {}).
          then(() => {
            expect(runner.run.calls.mostRecent().args[1]).toEqual(runtimeArgs);
            expect(originalArgs.length).toBe(3);
          }).
          then(done);
      });

      it('should pass appropriate config', done => {
        const config = {foo: 'bar'};

        nvu(['333'], config).
          then(() => expect(runner.run.calls.mostRecent().args[2]).toBe(config)).
          then(done);
      });
    });
  });
});
