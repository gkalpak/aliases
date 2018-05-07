'use strict';

// Imports
const inquirer = require('inquirer');
const gPickCommit = require('../../lib/g-pick-commit');
const runner = require('../../lib/runner');
const utils = require('../../lib/utils');
const {async} = require('../test-utils');

// Tests
describe('gPickCommit()', () => {
  beforeEach(() => {
    spyOn(console, 'log');
    spyOn(inquirer, 'prompt').and.returnValue(Promise.resolve(''));
    spyOn(runner, 'run').and.returnValue(Promise.resolve(''));
    spyOn(utils, 'onError');
  });

  it('should be a function', () => {
    expect(gPickCommit).toEqual(jasmine.any(Function));
  });

  describe('(dryrun)', () => {
    it('should return a resolved promise', async(() => {
      return gPickCommit({dryrun: true});
    }));

    it('should log a short description', async(() => {
      const cmdDesc = 'Pick one from a list of commits.';

      return gPickCommit({dryrun: true}).
        then(() => expect(console.log).toHaveBeenCalledWith(cmdDesc));
    }));
  });

  describe('(no dryrun)', () => {
    it('should return a promise', async(() => {
      return gPickCommit({});
    }));

    it('should run `git log ...` (and return the output)', async(() => {
      return gPickCommit({}).
        then(() => expect(runner.run).toHaveBeenCalledWith('git log --oneline -50', [], {returnOutput: true}));
    }));

    it('should return `git log ...` output even if `config.returnOutput` is false (but not affect `config`)',
      async(() => {
        const config = {returnOutput: false};

        return gPickCommit(config).then(() => {
          expect(runner.run).toHaveBeenCalledWith('git log --oneline -50', [], {returnOutput: true});
          expect(config.returnOutput).toBe(false);
        });
      })
    );

    it('should handle errors', async(() => {
      runner.run.and.returnValue(Promise.reject('test'));

      return gPickCommit({}).
        then(() => expect(utils.onError).toHaveBeenCalledWith('test'));
    }));

    describe('picking a commit', () => {
      let commits;
      const verifyPromptedWith = (prop, value) => () => {
        if (prop === 'choices') value.push(new inquirer.Separator());
        expect(inquirer.prompt).toHaveBeenCalledWith([jasmine.objectContaining({[prop]: value})]);
      };

      beforeEach(() => {
        commits = [];
        runner.run.and.callFake(() => Promise.resolve(commits.join('\n')));

        spyOn(utils, 'doOnExit').and.callThrough();
        spyOn(utils, 'finallyAsPromised').and.callThrough();
      });

      it('should prompt the user to pick a commit', async(() => {
        return gPickCommit({}).
          then(verifyPromptedWith('type', 'list')).
          then(verifyPromptedWith('message', 'Pick a commit:'));
      }));

      it('should pass the commits as options (as returned by `git log ...`)', async(() => {
        commits = [
          '123456 The foo commit',
          '234567 The bar commit',
          '3456789 The baz commit',
          '456789 The qux commit',
        ];

        return gPickCommit({}).
          then(verifyPromptedWith('choices', [
            '123456 The foo commit',
            '234567 The bar commit',
            '3456789 The baz commit',
            '456789 The qux commit',
          ]));
      }));

      it('should trim whitespace around commit lines', async(() => {
        commits = [
          '    123456 The foo commit    ',
          '\r\n234567 The bar commit\r\n',
          '\t\t3456789 The baz commit\t\t',
          ' \n 456789 The qux commit \t ',
        ];

        return gPickCommit({}).
          then(verifyPromptedWith('choices', [
            '123456 The foo commit',
            '234567 The bar commit',
            '3456789 The baz commit',
            '456789 The qux commit',
          ]));
      }));

      it('should ignore empty or whitespace-only lines', async(() => {
        commits = [
          '123456 The foo commit',
          '',
          ' \n 234567 The bar commit \n ',
          '3456789 The baz commit',
          ' \t\r\n ',
          '456789 The qux commit',
        ];

        return gPickCommit({}).
          then(verifyPromptedWith('choices', [
            '123456 The foo commit',
            '234567 The bar commit',
            '3456789 The baz commit',
            '456789 The qux commit',
          ]));
      }));

      it('should specify the first choice as default', async(() => {
        commits = [
          '123456 The foo commit',
          '234567 The bar commit',
          '3456789 The baz commit',
          '456789 The qux commit',
        ];

        return gPickCommit({}).
          then(verifyPromptedWith('default', 0));
      }));

      it('should register a callback to exit with an error if exited while the prompt is shown', async(() => {
        let callback;

        inquirer.prompt.and.callFake(() => {
          expect(utils.doOnExit).toHaveBeenCalledWith(process, jasmine.any(Function));
          callback = utils.doOnExit.calls.mostRecent().args[1];
          return Promise.resolve('');
        });

        return gPickCommit({}).then(() => {
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

        utils.doOnExit.and.returnValue(unlistenSpy);
        inquirer.prompt.and.callFake(() => {
          expect(utils.doOnExit).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).not.toHaveBeenCalled();
          return Promise.resolve('');
        });

        return gPickCommit({}).then(() => {
          expect(inquirer.prompt).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });
      }));

      it('should unregister the `onExit` callback once prompting completes with error', async(() => {
        const unlistenSpy = jasmine.createSpy('unlisten');

        utils.doOnExit.and.returnValue(unlistenSpy);
        inquirer.prompt.and.callFake(() => {
          expect(utils.doOnExit).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).not.toHaveBeenCalled();
          return Promise.reject('');
        });

        return gPickCommit({}).then(() => {
          expect(inquirer.prompt).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });
      }));
    });

    it('should log the selected commit (removing other info)', async(() => {
      inquirer.prompt.and.returnValue(Promise.resolve({commit: 'f00ba2 (foo, origin/bar) This is the commit message'}));

      return gPickCommit({}).
        then(() => expect(console.log).toHaveBeenCalledWith('f00ba2'));
    }));
  });
});
