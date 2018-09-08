'use strict';

// Imports
const {commandUtils, processUtils} = require('@gkalpak/cli-utils');
const inquirer = require('inquirer');
const gPickBranch = require('../../lib/g-pick-branch');
const utils = require('../../lib/utils');
const {async, reversePromise} = require('../test-utils');

// Tests
describe('gPickBranch()', () => {
  beforeEach(() => {
    spyOn(console, 'log');
    spyOn(inquirer, 'prompt').and.returnValue(Promise.resolve({branch: ''}));
    spyOn(commandUtils, 'run').and.returnValue(Promise.resolve(''));
    spyOn(utils, 'onError').and.callFake(err => Promise.reject(err));
  });

  it('should be a function', () => {
    expect(gPickBranch).toEqual(jasmine.any(Function));
  });

  describe('(dryrun)', () => {
    it('should return a resolved promise', async(() => {
      return gPickBranch({dryrun: true});
    }));

    it('should log a short description', async(() => {
      const cmdDesc = 'Pick one from a list of branches.';

      return gPickBranch({dryrun: true}).
        then(() => expect(console.log).toHaveBeenCalledWith(cmdDesc));
    }));
  });

  describe('(no dryrun)', () => {
    it('should return a promise', async(() => {
      return gPickBranch({});
    }));

    it('should run `git branch` (and return the output)', async(() => {
      return gPickBranch({}).
        then(() => expect(commandUtils.run).toHaveBeenCalledWith('git branch', [], {returnOutput: true}));
    }));

    it('should return `git branch` output even if `config.returnOutput` is false (but not affect `config`)',
      async(() => {
        const config = {returnOutput: false};

        return gPickBranch(config).then(() => {
          expect(commandUtils.run).toHaveBeenCalledWith('git branch', [], {returnOutput: true});
          expect(config.returnOutput).toBe(false);
        });
      })
    );

    it('should handle errors', async(() => {
      commandUtils.run.and.returnValue(Promise.reject('test'));

      return reversePromise(gPickBranch({})).
        then(() => expect(utils.onError).toHaveBeenCalledWith('test'));
    }));

    describe('picking a branch', () => {
      let branches;
      const verifyPromptedWith = (prop, value) => () => {
        if (prop === 'choices') value.push(new inquirer.Separator());
        expect(inquirer.prompt).toHaveBeenCalledWith([jasmine.objectContaining({[prop]: value})]);
      };

      beforeEach(() => {
        branches = [];
        commandUtils.run.and.callFake(() => Promise.resolve(branches.join('\n')));

        spyOn(processUtils, 'doOnExit').and.callThrough();
        spyOn(utils, 'finallyAsPromised').and.callThrough();
      });

      it('should prompt the user to pick a branch', async(() => {
        return gPickBranch({}).
          then(verifyPromptedWith('type', 'list')).
          then(verifyPromptedWith('message', 'Pick a branch:'));
      }));

      it('should pass the branches as options (as returned by `git branch`)', async(() => {
        branches = [
          'foo',
          'bar',
          'master',
        ];

        return gPickBranch({}).
          then(verifyPromptedWith('choices', ['foo', 'bar', 'master']));
      }));

      it('should trim whitespace around branches', async(() => {
        branches = [
          '  foo  ',
          '\r\nbar\r\n',
          '\t\tmaster\t\t',
        ];

        return gPickBranch({}).
          then(verifyPromptedWith('choices', ['foo', 'bar', 'master']));
      }));

      it('should ignore empty or whitespace-only lines', async(() => {
        branches = [
          'foo',
          '',
          ' \n bar \n ',
          ' \t\r\n',
          'master',
        ];

        return gPickBranch({}).
          then(verifyPromptedWith('choices', ['foo', 'bar', 'master']));
      }));

      it('should mark the current branch (and remove leading `*`)', async(() => {
        branches = [
          '  foo',
          '* bar',
          '  master',
        ];

        return gPickBranch({}).
          then(verifyPromptedWith('choices', ['foo', 'bar (current)', 'master']));
      }));

      it('should specify the default choice (if any)', async(() => {
        const branches1 = [
          '  foo',
          '  bar',
          '  master',
        ];
        const branches2 = [
          '  foo',
          '* bar',
          '  master',
        ];

        return Promise.resolve().
          then(() => branches = branches1).
          then(() => gPickBranch({})).
          then(verifyPromptedWith('default', undefined)).
          then(() => branches = branches2).
          then(() => gPickBranch({})).
          then(verifyPromptedWith('default', 'bar (current)'));
      }));

      it('should register a callback to exit with an error if exited while the prompt is shown', async(() => {
        let callback;

        inquirer.prompt.and.callFake(() => {
          expect(processUtils.doOnExit).toHaveBeenCalledWith(process, jasmine.any(Function));
          callback = processUtils.doOnExit.calls.mostRecent().args[1];
          return Promise.resolve({branch: ''});
        });

        return gPickBranch({}).then(() => {
          spyOn(process, 'exit');

          callback(undefined);
          callback(false);
          callback(1);
          callback(42);
          expect(process.exit).not.toHaveBeenCalled();

          callback(0);
          expect(process.exit).toHaveBeenCalledWith(1);

          process.exit.and.callThrough();
        });
      }));

      it('should unregister the `onExit` callback once prompting completes successfully', async(() => {
        const unlistenSpy = jasmine.createSpy('unlisten');

        processUtils.doOnExit.and.returnValue(unlistenSpy);
        inquirer.prompt.and.callFake(() => {
          expect(processUtils.doOnExit).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).not.toHaveBeenCalled();
          return Promise.resolve({branch: ''});
        });

        return gPickBranch({}).then(() => {
          expect(inquirer.prompt).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });
      }));

      it('should unregister the `onExit` callback once prompting completes with error', async(() => {
        const unlistenSpy = jasmine.createSpy('unlisten');

        processUtils.doOnExit.and.returnValue(unlistenSpy);
        inquirer.prompt.and.callFake(() => {
          expect(processUtils.doOnExit).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).not.toHaveBeenCalled();
          return Promise.reject('');
        });

        return reversePromise(gPickBranch({})).then(() => {
          expect(inquirer.prompt).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });
      }));
    });

    describe('output', () => {
      it('should log the selected branch', async(() => {
        inquirer.prompt.and.returnValues(Promise.resolve({branch: 'foo'}), Promise.resolve({branch: 'bar'}));

        return Promise.resolve().
          then(() => gPickBranch({})).
          then(result => expect(result).toBeUndefined()).
          then(() => expect(console.log).toHaveBeenCalledWith('foo')).
          then(() => gPickBranch({returnOutput: false})).
          then(result => expect(result).toBeUndefined()).
          then(() => expect(console.log).toHaveBeenCalledWith('bar'));
      }));

      it('should return the selected branch if `returnOutput` is `true`', async(() => {
        inquirer.prompt.and.returnValue(Promise.resolve({branch: 'foo'}));

        return gPickBranch({returnOutput: true}).
          then(result => expect(result).toBe('foo')).
          then(() => expect(console.log).not.toHaveBeenCalled());
      }));

      it('should remove the "current" marker from the selected branch\'s name', async(() => {
        inquirer.prompt.and.returnValues(
          Promise.resolve({branch: 'foo (current)'}),
          Promise.resolve({branch: 'bar (current)'}));

        return Promise.resolve().
          then(() => gPickBranch({returnOutput: false})).
          then(() => expect(console.log).toHaveBeenCalledWith('foo')).
          then(() => gPickBranch({returnOutput: true})).
          then(result => expect(result).toBe('bar'));
      }));
    });
  });
});
