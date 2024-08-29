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
      const mockArgs = ['--foo', 'bar'];
      const mockConfig = {baz: 'qux'};
      const internalSpy = spyOn(_testing, '_gPickBranch').and.resolveTo('quux');

      expect(await gPickBranch(mockArgs, mockConfig)).toBe('quux');
      expect(internalSpy).toHaveBeenCalledWith(mockArgs, mockConfig);
    });

    describe('(dryrun)', () => {
      it('should return a resolved promise', async () => {
        const promise = gPickBranch([], {dryrun: true});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should log a short description (when showing local branches)', async () => {
        const cmdDesc = 'Pick one from a list of local branches.';
        const runtimeArgsList = [
          [],
          ['-remote'],
          ['--remoter'],
          ['--no-remote'],
          ['--remote=not-a-flag'],
        ];

        for (const testArgs of runtimeArgsList) {
          consoleLogSpy.calls.reset();
          await gPickBranch(testArgs, {dryrun: true});

          expect(consoleLogSpy).withContext(`With args: ${testArgs.join(', ')}`).toHaveBeenCalledWith(cmdDesc);
        }
      });

      it('should log a short description (when showing remote branches)', async () => {
        const cmdDesc = 'Pick one from a list of remote branches.';
        const runtimeArgsList = [
          ['--remote'],
          ['--remote', '--plus', '--something'],
          ['--something', '--plus', '--remote'],
          ['--something', '--plus', '--remote', '--plus', '--something', 'else'],
        ];

        for (const testArgs of runtimeArgsList) {
          consoleLogSpy.calls.reset();
          await gPickBranch(testArgs, {dryrun: true});

          expect(consoleLogSpy).withContext(`With args: ${testArgs.join(', ')}`).toHaveBeenCalledWith(cmdDesc);
        }
      });
    });

    describe('(no dryrun)', () => {
      it('should return a promise', async () => {
        const promise1 = gPickBranch();
        expect(promise1).toEqual(jasmine.any(Promise));

        const promise2 = gPickBranch([]);
        expect(promise2).toEqual(jasmine.any(Promise));

        const promise3 = gPickBranch([], {});
        expect(promise3).toEqual(jasmine.any(Promise));

        await Promise.all([promise1, promise2, promise3]);
      });

      it('should run `git branch` (and return the output)', async () => {
        await gPickBranch();
        expect(cmdUtilsRunSpy).toHaveBeenCalledWith('git branch --all', [], {returnOutput: true});
      });

      it('should return `git branch` output even if `config.returnOutput` is false (but not affect `config`)',
          async () => {
            const config = {returnOutput: false};
            await gPickBranch([], config);

            expect(cmdUtilsRunSpy).toHaveBeenCalledWith('git branch --all', [], {returnOutput: true});
            expect(config.returnOutput).toBe(false);
          }
      );

      it('should propagate errors', async () => {
        cmdUtilsRunSpy.and.rejectWith('test');
        await expectAsync(gPickBranch()).toBeRejectedWith('test');
      });

      describe('picking a local branch', () => {
        let branches;
        let procUtilsDoOnExitSpy;

        const choice = (short, name = short) => ({name, short, value: short, remote: false});
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
          await gPickBranch();

          verifyPromptedWith('type', 'list');
          verifyPromptedWith('message', 'Pick a local branch:');
        });

        it('should pass the branches (as returned by `git branch ...`) as options, sorted alphabetically', async () => {
          branches = [
            'foo',
            'bar',
            'master',
          ];
          await gPickBranch();

          verifyPromptedWith('choices', [choice('bar'), choice('foo'), choice('master')]);
        });

        it('should filter out remote branches', async () => {
          branches = [
            'foo',
            'remotes/origin/foo',
            'bar',
            'remotes/upstream/bar',
            'master',
            'remotes/origin/master',
          ];
          await gPickBranch();

          verifyPromptedWith('choices', [choice('bar'), choice('foo'), choice('master')]);
        });

        it('should trim whitespace around branches', async () => {
          branches = [
            '  foo  ',
            '\r\nbar\r\n',
            '\t\tmaster\t\t',
          ];
          await gPickBranch();

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
          await gPickBranch();

          verifyPromptedWith('choices', [choice('bar'), choice('foo'), choice('master')]);
        });

        it('should mark the current branch (and remove leading `*`)', async () => {
          branches = [
            '  foo',
            '* bar',
            '  master',
          ];
          await gPickBranch();

          verifyPromptedWith('choices', [choice('bar', 'bar (current)'), choice('foo'), choice('master')]);
        });

        it('should mark branches checked out in other worktrees (and remove leading `+`)', async () => {
          branches = [
            '  foo',
            '+ bar',
            '  master',
          ];
          await gPickBranch();

          verifyPromptedWith('choices', [choice('bar', 'bar (other worktree)'), choice('foo'), choice('master')]);
        });

        it('should specify the default choice (if any)', async () => {
          branches = [
            '  foo',
            '  bar',
            '  master',
          ];
          await gPickBranch();

          verifyPromptedWith('default', 0);

          branches = [
            '  foo',
            '  bar',
            '* master',
          ];
          await gPickBranch();

          verifyPromptedWith('default', 2);
        });

        it('should "tag" `gcoghpr-` branches', async () => {
          branches = [
            '  foo-gcoghpr',
            '* bar-gcoghpr',
            '  gcoghpr-master',
          ];
          await gPickBranch();

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
          await gPickBranch();

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

          await gPickBranch();

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

          await gPickBranch();

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

          await expectAsync(gPickBranch()).toBeRejected();

          expect(promptSpy).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });
      });

      describe('picking a remote branch', () => {
        let branches;
        let procUtilsDoOnExitSpy;

        const choice = (short, name = short) => ({name, short, value: short.replace('/', ' '), remote: true});
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
          await gPickBranch(['--remote']);

          verifyPromptedWith('type', 'list');
          verifyPromptedWith('message', 'Pick a remote branch:');
        });

        it(
            'should pass the branch names, including the remote, (as returned by `git branch ...`) as options, ' +
            'sorted alphabetically',
            async () => {
              branches = [
                'remotes/origin/foo/1',
                'remotes/upstream/bar/2',
                'remotes/origin/master',
              ];
              await gPickBranch(['--remote']);

              // Use two assertions to ensure that `choice()` works as expected. (Ugly, but ¯\_(ツ)_/¯)
              verifyPromptedWith('choices', [
                choice('origin/foo/1'),
                choice('origin/master'),
                choice('upstream/bar/2'),
              ]);
              verifyPromptedWith('choices', [
                {
                  name: 'origin/foo/1',
                  short: 'origin/foo/1',
                  value: 'origin foo/1',
                  remote: true,
                },
                {
                  name: 'origin/master',
                  short: 'origin/master',
                  value: 'origin master',
                  remote: true,
                },
                {
                  name: 'upstream/bar/2',
                  short: 'upstream/bar/2',
                  value: 'upstream bar/2',
                  remote: true,
                },
              ]);
            }
        );

        it('should filter out local branches', async () => {
          branches = [
            'foo',
            'remotes/origin/foo',
            'bar',
            'remotes/upstream/bar',
            'master',
            'remotes/origin/master',
          ];
          await gPickBranch(['--remote']);

          verifyPromptedWith('choices', [choice('origin/foo'), choice('origin/master'), choice('upstream/bar')]);
        });

        it('should filter out `HEAD` "aliases"', async () => {
          branches = [
            'remotes/origin/HEAD -> origin/master',
            'remotes/origin/foo',
            'remotes/upstream/bar',
            'remotes/origin/master',
          ];
          await gPickBranch(['--remote']);

          verifyPromptedWith('choices', [choice('origin/foo'), choice('origin/master'), choice('upstream/bar')]);
        });

        it('should trim whitespace around branches', async () => {
          branches = [
            '  remotes/origin/foo  ',
            '\r\nremotes/upstream/bar\r\n',
            '\t\tremotes/origin/master\t\t',
          ];
          await gPickBranch(['--remote']);

          verifyPromptedWith('choices', [choice('origin/foo'), choice('origin/master'), choice('upstream/bar')]);
        });

        it('should ignore empty or whitespace-only lines', async () => {
          branches = [
            'remotes/origin/foo',
            '',
            ' \n remotes/upstream/bar \n ',
            ' \t\r\n',
            'remotes/origin/master',
          ];
          await gPickBranch(['--remote']);

          verifyPromptedWith('choices', [choice('origin/foo'), choice('origin/master'), choice('upstream/bar')]);
        });

        it('should mark the current branch (and remove leading `*`)', async () => {
          branches = [
            '  remotes/origin/foo',
            '* remotes/upstream/bar',
            '  remotes/origin/master',
          ];
          await gPickBranch(['--remote']);

          verifyPromptedWith('choices', [
            choice('origin/foo'),
            choice('origin/master'),
            choice('upstream/bar', 'upstream/bar (current)'),
          ]);
        });

        it('should mark branches checked out in other worktrees (and remove leading `+`)', async () => {
          branches = [
            '  remotes/origin/foo',
            '+ remotes/upstream/bar',
            '  remotes/origin/master',
          ];
          await gPickBranch(['--remote']);

          verifyPromptedWith('choices', [
            choice('origin/foo'),
            choice('origin/master'),
            choice('upstream/bar', 'upstream/bar (other worktree)'),
          ]);
        });

        it('should specify the default choice (if any)', async () => {
          branches = [
            '  remotes/origin/foo',
            '  remotes/upstream/bar',
            '  remotes/origin/master',
          ];
          await gPickBranch(['--remote']);

          verifyPromptedWith('default', 0);

          branches = [
            '  remotes/origin/foo',
            '  remotes/upstream/bar',
            '* remotes/origin/master',
          ];
          await gPickBranch(['--remote']);

          verifyPromptedWith('default', 1);
        });

        it('should register a callback to exit with an error if exited while the prompt is shown', async () => {
          let callback;

          promptSpy.and.callFake(() => {
            expect(procUtilsDoOnExitSpy).toHaveBeenCalledWith(process, jasmine.any(Function));
            callback = procUtilsDoOnExitSpy.calls.mostRecent().args[1];
            return Promise.resolve({branch: ''});
          });

          await gPickBranch(['--remote']);

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

          await gPickBranch(['--remote']);

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

          await expectAsync(gPickBranch(['--remote'])).toBeRejected();

          expect(promptSpy).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });
      });

      describe('output', () => {
        it('should log the selected branch', async () => {
          promptSpy.and.returnValues(Promise.resolve({branch: 'foo'}), Promise.resolve({branch: 'bar'}));

          expect(await gPickBranch()).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('foo');

          expect(await gPickBranch([], {returnOutput: false})).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('bar');
        });

        it('should return the selected branch if `returnOutput` is `true`', async () => {
          promptSpy.and.resolveTo({branch: 'foo'});

          expect(await gPickBranch([], {returnOutput: true})).toBe('foo');
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

    it('should delegate to `gPickBranch()` (with appropriate arguments)', async () => {
      gPickBranchSpy.and.resolveTo('foo');
      const result = await main('runtimeArgs', 'config');

      expect(gPickBranchSpy).toHaveBeenCalledWith('runtimeArgs', 'config');
      expect(result).toBe('foo');
    });
  });
});
