// Imports
import {commandUtils, processUtils} from '@gkalpak/cli-utils';
import inquirer from 'inquirer';

import {_testing, gPickBranch, main} from '../../../lib/alias-scripts/g-pick-branch.js';


// Tests
describe('g-pick-branch', () => {
  describe('gPickBranch()', () => {
    let cmdUtilsRunSpy;
    let consoleLogSpy;
    let promptSpy;

    beforeEach(() => {
      cmdUtilsRunSpy = spyOn(commandUtils, 'run').and.resolveTo('');
      consoleLogSpy = spyOn(console, 'log');
      promptSpy = spyOn(inquirer, 'prompt').and.resolveTo({branch: ''});
    });

    it('should be a function', () => {
      expect(gPickBranch).toEqual(jasmine.any(Function));
    });

    it('should delegate to its internal counterpart', async () => {
      const mockConfig = {foo: 'bar'};
      const internalSpy = spyOn(_testing, '_gPickBranch').and.resolveTo('foo');

      expect(await gPickBranch(mockConfig)).toBe('foo');
      expect(internalSpy).toHaveBeenCalledWith(mockConfig);
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

        expect(consoleLogSpy).toHaveBeenCalledWith(cmdDesc);
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
        expect(cmdUtilsRunSpy).toHaveBeenCalledWith('git branch', [], {returnOutput: true});
      });

      it('should return `git branch` output even if `config.returnOutput` is false (but not affect `config`)',
          async () => {
            const config = {returnOutput: false};
            await gPickBranch(config);

            expect(cmdUtilsRunSpy).toHaveBeenCalledWith('git branch', [], {returnOutput: true});
            expect(config.returnOutput).toBe(false);
          }
      );

      it('should propagate errors', async () => {
        cmdUtilsRunSpy.and.rejectWith('test');
        await expectAsync(gPickBranch({})).toBeRejectedWith('test');
      });

      describe('picking a branch', () => {
        let branches;
        let procUtilsDoOnExitSpy;

        const choice = (value, name = value) => ({name, value, short: value});
        const verifyPromptedWith = (prop, value) => {
          if (prop === 'choices') value.push(new inquirer.Separator());
          expect(promptSpy).toHaveBeenCalledWith([jasmine.objectContaining({[prop]: value})]);
        };

        beforeEach(() => {
          branches = [];
          cmdUtilsRunSpy.and.callFake(() => Promise.resolve(branches.join('\n')));

          procUtilsDoOnExitSpy = spyOn(processUtils, 'doOnExit').and.callThrough();
        });

        it('should prompt the user to pick a branch', async () => {
          await gPickBranch({});

          verifyPromptedWith('type', 'list');
          verifyPromptedWith('message', 'Pick a branch:');
        });

        it('should pass the branches (as returned by `git branch`) as options, sorted alphabetically', async () => {
          branches = [
            'foo',
            'bar',
            'master',
          ];
          await gPickBranch({});

          verifyPromptedWith('choices', [choice('bar'), choice('foo'), choice('master')]);
        });

        it('should trim whitespace around branches', async () => {
          branches = [
            '  foo  ',
            '\r\nbar\r\n',
            '\t\tmaster\t\t',
          ];
          await gPickBranch({});

          verifyPromptedWith('choices', [choice('bar'), choice('foo'), choice('master')]);
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

          verifyPromptedWith('choices', [choice('bar'), choice('foo'), choice('master')]);
        });

        it('should mark the current branch (and remove leading `*`)', async () => {
          branches = [
            '  foo',
            '* bar',
            '  master',
          ];
          await gPickBranch({});

          verifyPromptedWith('choices', [choice('bar', 'bar (current)'), choice('foo'), choice('master')]);
        });

        it('should mark branches checked out in other worktrees (and remove leading `+`)', async () => {
          branches = [
            '  foo',
            '+ bar',
            '  master',
          ];
          await gPickBranch({});

          verifyPromptedWith('choices', [choice('bar', 'bar (other worktree)'), choice('foo'), choice('master')]);
        });

        it('should specify the default choice (if any)', async () => {
          branches = [
            '  foo',
            '  bar',
            '  master',
          ];
          await gPickBranch({});

          verifyPromptedWith('default', 0);

          branches = [
            '  foo',
            '* bar',
            '  master',
          ];
          await gPickBranch({});

          verifyPromptedWith('default', 1);
        });

        it('should use italic for `gcoghpr-` branches', async () => {
          branches = [
            '  foo-gcoghpr',
            '* bar-gcoghpr',
            '  gcoghpr-master',
          ];
          await gPickBranch({});

          verifyPromptedWith('choices', [
            choice('gcoghpr-master', '[gcoghpr] master'),
            choice('bar-gcoghpr', 'bar-gcoghpr (current)'),
            choice('foo-gcoghpr'),
          ]);

          branches = [
            '  foo-gcoghpr',
            '* gcoghpr-bar',
            '  gcoghpr-master',
          ];
          await gPickBranch({});

          verifyPromptedWith('choices', [
            choice('gcoghpr-bar', '[gcoghpr] bar (current)'),
            choice('gcoghpr-master', '[gcoghpr] master'),
            choice('foo-gcoghpr'),
          ]);
        });

        it('should register a callback to exit with an error if exited while the prompt is shown', async () => {
          let callback;

          promptSpy.and.callFake(() => {
            expect(procUtilsDoOnExitSpy).toHaveBeenCalledWith(process, jasmine.any(Function));
            callback = procUtilsDoOnExitSpy.calls.mostRecent().args[1];
            return Promise.resolve({branch: ''});
          });

          await gPickBranch({});

          const processExitSpy = spyOn(process, 'exit');

          callback(undefined);
          callback(false);
          callback(1);
          callback(42);
          expect(processExitSpy).not.toHaveBeenCalled();

          callback(0);
          expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        it('should unregister the `onExit` callback once prompting completes successfully', async () => {
          const unlistenSpy = jasmine.createSpy('unlisten');

          procUtilsDoOnExitSpy.and.returnValue(unlistenSpy);
          promptSpy.and.callFake(() => {
            expect(procUtilsDoOnExitSpy).toHaveBeenCalledTimes(1);
            expect(unlistenSpy).not.toHaveBeenCalled();
            return Promise.resolve({branch: ''});
          });

          await gPickBranch({});

          expect(promptSpy).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });

        it('should unregister the `onExit` callback once prompting completes with error', async () => {
          const unlistenSpy = jasmine.createSpy('unlisten');

          procUtilsDoOnExitSpy.and.returnValue(unlistenSpy);
          promptSpy.and.callFake(() => {
            expect(procUtilsDoOnExitSpy).toHaveBeenCalledTimes(1);
            expect(unlistenSpy).not.toHaveBeenCalled();
            return Promise.reject('');
          });

          await expectAsync(gPickBranch({})).toBeRejected();

          expect(promptSpy).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });
      });

      describe('output', () => {
        it('should log the selected branch', async () => {
          promptSpy.and.returnValues(Promise.resolve({branch: 'foo'}), Promise.resolve({branch: 'bar'}));

          expect(await gPickBranch({})).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('foo');

          expect(await gPickBranch({returnOutput: false})).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('bar');
        });

        it('should return the selected branch if `returnOutput` is `true`', async () => {
          promptSpy.and.resolveTo({branch: 'foo'});

          expect(await gPickBranch({returnOutput: true})).toBe('foo');
          expect(consoleLogSpy).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('main()', () => {
    let gPickBranchSpy;

    beforeEach(() => gPickBranchSpy = spyOn(_testing, '_gPickBranch'));

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
