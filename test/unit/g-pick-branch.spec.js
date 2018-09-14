'use strict';

// Imports
const {commandUtils, processUtils} = require('@gkalpak/cli-utils');
const inquirer = require('inquirer');
const gPickBranchExps = require('../../lib/g-pick-branch');
const {reversePromise} = require('../test-utils');

const {gPickBranch, main} = gPickBranchExps;

// Tests
describe('g-pick-branch', () => {
  describe('gPickBranch()', () => {
    beforeEach(() => {
      spyOn(console, 'log');
      spyOn(inquirer, 'prompt').and.returnValue(Promise.resolve({branch: ''}));
      spyOn(commandUtils, 'run').and.returnValue(Promise.resolve(''));
    });

    it('should be a function', () => {
      expect(gPickBranch).toEqual(jasmine.any(Function));
    });

    describe('(dryrun)', () => {
      it('should return a resolved promise', async () => {
        const promise = gPickBranch({dryrun: true});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should log a short description', async () => {
        const cmdDesc = 'Pick one from a list of branches.';
        await gPickBranch({dryrun: true});

        expect(console.log).toHaveBeenCalledWith(cmdDesc);
      });
    });

    describe('(no dryrun)', () => {
      it('should return a promise', async () => {
        const promise = gPickBranch({});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should run `git branch` (and return the output)', async () => {
        await gPickBranch({});
        expect(commandUtils.run).toHaveBeenCalledWith('git branch', [], {returnOutput: true});
      });

      it('should return `git branch` output even if `config.returnOutput` is false (but not affect `config`)',
        async () => {
          const config = {returnOutput: false};
          await gPickBranch(config);

          expect(commandUtils.run).toHaveBeenCalledWith('git branch', [], {returnOutput: true});
          expect(config.returnOutput).toBe(false);
        }
      );

      it('should propagate errors', async () => {
        commandUtils.run.and.returnValue(Promise.reject('test'));
        const err = await reversePromise(gPickBranch({}));

        expect(err).toBe('test');
      });

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
        });

        it('should prompt the user to pick a branch', async () => {
          await gPickBranch({});

          verifyPromptedWith('type', 'list');
          verifyPromptedWith('message', 'Pick a branch:');
        });

        it('should pass the branches as options (as returned by `git branch`)', async () => {
          branches = [
            'foo',
            'bar',
            'master',
          ];
          await gPickBranch({});

          verifyPromptedWith('choices', ['foo', 'bar', 'master']);
        });

        it('should trim whitespace around branches', async () => {
          branches = [
            '  foo  ',
            '\r\nbar\r\n',
            '\t\tmaster\t\t',
          ];
          await gPickBranch({});

          verifyPromptedWith('choices', ['foo', 'bar', 'master']);
        });

        it('should ignore empty or whitespace-only lines', async () => {
          branches = [
            'foo',
            '',
            ' \n bar \n ',
            ' \t\r\n',
            'master',
          ];
          await gPickBranch({});

          verifyPromptedWith('choices', ['foo', 'bar', 'master']);
        });

        it('should mark the current branch (and remove leading `*`)', async () => {
          branches = [
            '  foo',
            '* bar',
            '  master',
          ];
          await gPickBranch({});

          verifyPromptedWith('choices', ['foo', 'bar (current)', 'master']);
        });

        it('should specify the default choice (if any)', async () => {
          branches = [
            '  foo',
            '  bar',
            '  master',
          ];
          await gPickBranch({});

          verifyPromptedWith('default', undefined);

          branches = [
            '  foo',
            '* bar',
            '  master',
          ];
          await gPickBranch({});

          verifyPromptedWith('default', 'bar (current)');
        });

        it('should register a callback to exit with an error if exited while the prompt is shown', async () => {
          let callback;

          inquirer.prompt.and.callFake(() => {
            expect(processUtils.doOnExit).toHaveBeenCalledWith(process, jasmine.any(Function));
            callback = processUtils.doOnExit.calls.mostRecent().args[1];
            return Promise.resolve({branch: ''});
          });

          await gPickBranch({});

          spyOn(process, 'exit');

          callback(undefined);
          callback(false);
          callback(1);
          callback(42);
          expect(process.exit).not.toHaveBeenCalled();

          callback(0);
          expect(process.exit).toHaveBeenCalledWith(1);
        });

        it('should unregister the `onExit` callback once prompting completes successfully', async () => {
          const unlistenSpy = jasmine.createSpy('unlisten');

          processUtils.doOnExit.and.returnValue(unlistenSpy);
          inquirer.prompt.and.callFake(() => {
            expect(processUtils.doOnExit).toHaveBeenCalledTimes(1);
            expect(unlistenSpy).not.toHaveBeenCalled();
            return Promise.resolve({branch: ''});
          });

          await gPickBranch({});

          expect(inquirer.prompt).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });

        it('should unregister the `onExit` callback once prompting completes with error', async () => {
          const unlistenSpy = jasmine.createSpy('unlisten');

          processUtils.doOnExit.and.returnValue(unlistenSpy);
          inquirer.prompt.and.callFake(() => {
            expect(processUtils.doOnExit).toHaveBeenCalledTimes(1);
            expect(unlistenSpy).not.toHaveBeenCalled();
            return Promise.reject('');
          });

          await reversePromise(gPickBranch({}));

          expect(inquirer.prompt).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });
      });

      describe('output', () => {
        it('should log the selected branch', async () => {
          inquirer.prompt.and.returnValues(Promise.resolve({branch: 'foo'}), Promise.resolve({branch: 'bar'}));

          expect(await gPickBranch({})).toBeUndefined();
          expect(console.log).toHaveBeenCalledWith('foo');

          expect(await gPickBranch({returnOutput: false})).toBeUndefined();
          expect(console.log).toHaveBeenCalledWith('bar');
        });

        it('should return the selected branch if `returnOutput` is `true`', async () => {
          inquirer.prompt.and.returnValue(Promise.resolve({branch: 'foo'}));

          expect(await gPickBranch({returnOutput: true})).toBe('foo');
          expect(console.log).not.toHaveBeenCalled();
        });

        it('should remove the "current" marker from the selected branch\'s name', async () => {
          inquirer.prompt.and.returnValues(
            Promise.resolve({branch: 'foo (current)'}),
            Promise.resolve({branch: 'bar (current)'}));

          await gPickBranch({returnOutput: false});
          expect(console.log).toHaveBeenCalledWith('foo');

          expect(await gPickBranch({returnOutput: true})).toBe('bar');
        });
      });
    });
  });

  describe('main()', () => {
    let gPickBranchSpy;

    beforeEach(() => gPickBranchSpy = spyOn(gPickBranchExps, 'gPickBranch'));

    it('should be a function', () => {
      expect(main).toEqual(jasmine.any(Function));
    });

    it('should delegate to `gPickBranch()` (with appropriate arguments)', () => {
      gPickBranchSpy.and.returnValue('foo');
      const result = main('runtimeArgs', 'config');

      expect(gPickBranchSpy).toHaveBeenCalledWith('config');
      expect(result).toBe('foo');
    });
  });
});
