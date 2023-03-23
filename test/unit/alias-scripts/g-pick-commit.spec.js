// Imports
import {commandUtils, processUtils} from '@gkalpak/cli-utils';
import inquirer from 'inquirer';

import {_testing, gPickCommit, main} from '../../../lib/alias-scripts/g-pick-commit.js';


// Tests
describe('g-pick-commit', () => {
  describe('gPickCommit()', () => {
    let cmdUtilsRunSpy;
    let consoleLogSpy;
    let promptSpy;

    beforeEach(() => {
      cmdUtilsRunSpy = spyOn(commandUtils, 'run').and.resolveTo('');
      consoleLogSpy = spyOn(console, 'log');
      promptSpy = spyOn(inquirer, 'prompt').and.resolveTo({commit: ''});
    });

    it('should be a function', () => {
      expect(gPickCommit).toEqual(jasmine.any(Function));
    });

    it('should delegate to its internal counterpart', async () => {
      const mockConfig = {foo: 'bar'};
      const internalSpy = spyOn(_testing, '_gPickCommit').and.resolveTo('foo');

      expect(await gPickCommit(mockConfig)).toBe('foo');
      expect(internalSpy).toHaveBeenCalledWith(mockConfig);
    });

    describe('(dryrun)', () => {
      it('should return a resolved promise', async () => {
        const promise = gPickCommit({dryrun: true});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should log a short description', async () => {
        const cmdDesc = 'Pick one from a list of commits.';
        await gPickCommit({dryrun: true});

        expect(consoleLogSpy).toHaveBeenCalledWith(cmdDesc);
      });
    });

    describe('(no dryrun)', () => {
      it('should return a promise', async () => {
        const promise = gPickCommit({});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should run `git log ...` (and return the output)', async () => {
        await gPickCommit({});
        expect(cmdUtilsRunSpy).toHaveBeenCalledWith('git log --oneline -50', [], {returnOutput: true});
      });

      it('should return `git log ...` output even if `config.returnOutput` is false (but not affect `config`)',
          async () => {
            const config = {returnOutput: false};
            await gPickCommit(config);

            expect(cmdUtilsRunSpy).toHaveBeenCalledWith('git log --oneline -50', [], {returnOutput: true});
            expect(config.returnOutput).toBe(false);
          }
      );

      it('should propagate errors', async () => {
        cmdUtilsRunSpy.and.rejectWith('test');
        await expectAsync(gPickCommit({})).toBeRejectedWith('test');
      });

      describe('picking a commit', () => {
        let commits;
        let procUtilsDoOnExitSpy;

        const verifyPromptedWith = (prop, value) => () => {
          if (prop === 'choices') value.push(new inquirer.Separator());
          expect(inquirer.prompt).toHaveBeenCalledWith([jasmine.objectContaining({[prop]: value})]);
        };

        beforeEach(() => {
          commits = [];
          cmdUtilsRunSpy.and.callFake(() => Promise.resolve(commits.join('\n')));

          procUtilsDoOnExitSpy = spyOn(processUtils, 'doOnExit').and.callThrough();
        });

        it('should prompt the user to pick a commit', async () => {
          await gPickCommit({});

          verifyPromptedWith('type', 'list');
          verifyPromptedWith('message', 'Pick a commit:');
        });

        it('should pass the commits as options (as returned by `git log ...`)', async () => {
          commits = [
            '123456 The foo commit',
            '234567 The bar commit',
            '3456789 The baz commit',
            '456789 The qux commit',
          ];
          await gPickCommit({});

          verifyPromptedWith('choices', [
            '123456 The foo commit',
            '234567 The bar commit',
            '3456789 The baz commit',
            '456789 The qux commit',
          ]);
        });

        it('should trim whitespace around commit lines', async () => {
          commits = [
            '    123456 The foo commit    ',
            '\r\n234567 The bar commit\r\n',
            '\t\t3456789 The baz commit\t\t',
            ' \n 456789 The qux commit \t ',
          ];
          await gPickCommit({});

          verifyPromptedWith('choices', [
            '123456 The foo commit',
            '234567 The bar commit',
            '3456789 The baz commit',
            '456789 The qux commit',
          ]);
        });

        it('should ignore empty or whitespace-only lines', async () => {
          commits = [
            '123456 The foo commit',
            '',
            ' \n 234567 The bar commit \n ',
            '3456789 The baz commit',
            ' \t\r\n ',
            '456789 The qux commit',
          ];
          await gPickCommit({});

          verifyPromptedWith('choices', [
            '123456 The foo commit',
            '234567 The bar commit',
            '3456789 The baz commit',
            '456789 The qux commit',
          ]);
        });

        it('should specify the first choice as default', async () => {
          commits = [
            '123456 The foo commit',
            '234567 The bar commit',
            '3456789 The baz commit',
            '456789 The qux commit',
          ];
          await gPickCommit({});

          verifyPromptedWith('default', 0);
        });

        it('should register a callback to exit with an error if exited while the prompt is shown', async () => {
          let callback;

          promptSpy.and.callFake(() => {
            expect(procUtilsDoOnExitSpy).toHaveBeenCalledWith(process, jasmine.any(Function));
            callback = procUtilsDoOnExitSpy.calls.mostRecent().args[1];
            return Promise.resolve({commit: ''});
          });

          await gPickCommit({});

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
            return Promise.resolve({commit: ''});
          });

          await gPickCommit({});

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

          await expectAsync(gPickCommit({})).toBeRejected();

          expect(promptSpy).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });
      });

      describe('output', () => {
        it('should log the selected commit SHA (removing other info)', async () => {
          promptSpy.and.returnValues(
              Promise.resolve({commit: 'f00ba2 (foo, origin/baz) This is the foo commit message'}),
              Promise.resolve({commit: 'b4r9ux (bar, origin/qux) This is the bar commit message'}));

          expect(await gPickCommit({})).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('f00ba2');

          expect(await gPickCommit({returnOutput: false})).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('b4r9ux');
        });

        it('should return the selected commit SHA (removing other info) if `returnOutput` is `true`', async () => {
          const commit = 'f00ba2 (foo, origin/baz) This is the commit message';
          promptSpy.and.resolveTo({commit});

          expect(await gPickCommit({returnOutput: true})).toBe('f00ba2');
          expect(consoleLogSpy).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('main()', () => {
    let gPickCommitSpy;

    beforeEach(() => gPickCommitSpy = spyOn(_testing, '_gPickCommit'));

    it('should be a function', () => {
      expect(main).toEqual(jasmine.any(Function));
    });

    it('should delegate to `gPickCommit()` (with appropriate arguments)', () => {
      gPickCommitSpy.and.returnValue('foo');
      const result = main('runtimeArgs', 'config');

      expect(gPickCommitSpy).toHaveBeenCalledWith('config');
      expect(result).toBe('foo');
    });
  });
});
