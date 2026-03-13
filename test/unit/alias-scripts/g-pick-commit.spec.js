// Imports
import {commandUtils, processUtils} from '@gkalpak/cli-utils';
import {Separator} from '@inquirer/select';

import {_testing, gPickCommit, main} from '../../../lib/alias-scripts/g-pick-commit.js';
import {_testing as utilsTesting} from '../../../lib/utils.js';


// Tests
describe('g-pick-commit', () => {
  describe('gPickCommit()', () => {
    let cmdUtilsRunSpy;
    let consoleLogSpy;
    let selectSpy;

    beforeEach(() => {
      cmdUtilsRunSpy = spyOn(commandUtils, 'run').and.resolveTo('');
      consoleLogSpy = spyOn(console, 'log');
      selectSpy = jasmine.createSpy('select').and.resolveTo('');

      const originalImportWithEnv = utilsTesting._importWithEnv;
      spyOn(utilsTesting, '_importWithEnv').and.callFake(async (...args) => {
        if (/import\((["'])@inquirer\/select\1\)/.test(args[0].toString())) {
          return {
            default: selectSpy,
            ...(await import('@inquirer/select').then(({default: _, ...rest}) => rest)),
          };
        } else {
          return originalImportWithEnv(...args);
        }
      });
    });

    it('should be a function', () => {
      expect(gPickCommit).toEqual(jasmine.any(Function));
    });

    it('should delegate to its internal counterpart', async () => {
      const mockArgs = ['--foo', 'bar'];
      const mockConfig = {baz: 'qux'};
      const internalSpy = spyOn(_testing, '_gPickCommit').and.resolveTo('quux');

      expect(await gPickCommit(mockArgs, mockConfig)).toBe('quux');
      expect(internalSpy).toHaveBeenCalledWith(mockArgs, mockConfig);
    });

    describe('(dryrun)', () => {
      it('should return a resolved promise', async () => {
        const promise = gPickCommit([], {dryrun: true});
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should log a short description (when not filtering commits)', async () => {
        const cmdDesc = 'Pick one from the first 50 commits.';
        await gPickCommit([], {dryrun: true});

        expect(consoleLogSpy).toHaveBeenCalledWith(cmdDesc);
      });

      it('should log a short description (when filtering commits)', async () => {
        const cmdDesc = 'Pick one from the first 50 commits whose header matches \'foo or bar\'.';
        const runtimeArgsList = [
          ['--filter-commits', 'foo or bar'],
          ['--filter-commits', '"foo or bar"'],
          ['--filter-commits', '\'foo or bar\''],
          ['--filter-commits=foo or bar'],
          ['--filter-commits="foo or bar"'],
          ['--filter-commits=\'foo or bar\''],
        ];

        for (const testArgs of runtimeArgsList) {
          consoleLogSpy.calls.reset();
          await gPickCommit(testArgs, {dryrun: true});

          expect(consoleLogSpy).withContext(`With args: ${testArgs.join(', ')}`).toHaveBeenCalledWith(cmdDesc);
        }
      });
    });

    describe('(no dryrun)', () => {
      it('should return a promise', async () => {
        const promise1 = gPickCommit();
        expect(promise1).toEqual(jasmine.any(Promise));

        const promise2 = gPickCommit([]);
        expect(promise2).toEqual(jasmine.any(Promise));

        const promise3 = gPickCommit([], {});
        expect(promise3).toEqual(jasmine.any(Promise));

        await Promise.all([promise1, promise2, promise3]);
      });

      it('should run `git log ...` (and return the output)', async () => {
        await gPickCommit();
        expect(cmdUtilsRunSpy).toHaveBeenCalledWith('git log --oneline --max-count=50', [], {returnOutput: true});
      });

      it('should return `git log ...` output even if `config.returnOutput` is false (but not affect `config`)',
          async () => {
            const config = {returnOutput: false};
            await gPickCommit([], config);

            expect(cmdUtilsRunSpy).toHaveBeenCalledWith('git log --oneline --max-count=50', [], {returnOutput: true});
            expect(config.returnOutput).toBe(false);
          }
      );

      it('should propagate errors', async () => {
        cmdUtilsRunSpy.and.rejectWith('test');
        await expectAsync(gPickCommit()).toBeRejectedWith('test');
      });

      describe('filtering commits', () => {
        let runtimeArgsList;

        beforeEach(() => {
          runtimeArgsList = [
            ['--filter-commits', 'foo or bar'],
            ['--filter-commits', '"foo or bar"'],
            ['--filter-commits', '\'foo or bar\''],
            ['--filter-commits=foo or bar'],
            ['--filter-commits="foo or bar"'],
            ['--filter-commits=\'foo or bar\''],
          ];
        });

        it('should run `git log ... | grep ...` (and return the output)', async () => {
          for (const testArgs of runtimeArgsList) {
            cmdUtilsRunSpy.calls.reset();
            await gPickCommit(testArgs);

            expect(cmdUtilsRunSpy).withContext(`With args: ${testArgs.join(', ')}`).toHaveBeenCalledWith(
                'git log --oneline | grep "foo or bar" --max-count=50', [], {returnOutput: true});
          }
        });

        it(
            'should return `git log ... | grep ...` output even if `config.returnOutput` is false (but not affect ' +
            '`config`)',
            async () => {
              for (const testArgs of runtimeArgsList) {
                cmdUtilsRunSpy.calls.reset();

                const config = {returnOutput: false};
                await gPickCommit(testArgs, config);

                expect(cmdUtilsRunSpy).withContext(`With args: ${testArgs.join(', ')}`).toHaveBeenCalledWith(
                    'git log --oneline | grep "foo or bar" --max-count=50', [], {returnOutput: true});
                expect(config.returnOutput).toBe(false);
              }
            }
        );
      });

      describe('picking a commit', () => {
        let commits;
        let procUtilsDoOnExitSpy;

        const verifyPromptedWith = (prop, value) => {
          if (prop === 'choices') value.push(new Separator());
          expect(selectSpy).toHaveBeenCalledWith(jasmine.objectContaining({[prop]: value}));
        };

        beforeEach(() => {
          commits = [];
          cmdUtilsRunSpy.and.callFake(() => Promise.resolve(commits.join('\n')));

          procUtilsDoOnExitSpy = spyOn(processUtils, 'doOnExit').and.callThrough();
        });

        it('should prompt the user to pick a commit', async () => {
          await gPickCommit();

          verifyPromptedWith('message', 'Pick a commit:');
        });

        it('should pass the commit SHAs (removing other info returned by `git log ...`) as options', async () => {
          commits = [
            '123456 The foo commit',
            '234567 The bar commit',
            '3456789 The baz commit',
            '456789 The qux commit',
          ];
          await gPickCommit();

          verifyPromptedWith('choices', [
            {name: '123456 The foo commit', value: '123456'},
            {name: '234567 The bar commit', value: '234567'},
            {name: '3456789 The baz commit', value: '3456789'},
            {name: '456789 The qux commit', value: '456789'},
          ]);
        });

        it('should trim whitespace around commit lines', async () => {
          commits = [
            '    123456 The foo commit    ',
            '\r\n234567 \r\r The bar commit\r\n',
            '\t\t3456789\t\tThe baz commit\t\t',
            ' \n 456789 The qux commit \t ',
          ];
          await gPickCommit();

          verifyPromptedWith('choices', [
            {name: '123456 The foo commit', value: '123456'},
            {name: '234567 \r\r The bar commit', value: '234567'},
            {name: '3456789\t\tThe baz commit', value: '3456789'},
            {name: '456789 The qux commit', value: '456789'},
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
          await gPickCommit();

          verifyPromptedWith('choices', [
            {name: '123456 The foo commit', value: '123456'},
            {name: '234567 The bar commit', value: '234567'},
            {name: '3456789 The baz commit', value: '3456789'},
            {name: '456789 The qux commit', value: '456789'},
          ]);
        });

        it('should specify the first choice as default', async () => {
          commits = [
            '123456 The foo commit',
            '234567 The bar commit',
            '3456789 The baz commit',
            '456789 The qux commit',
          ];
          await gPickCommit();

          verifyPromptedWith('default', '123456');
        });

        it('should register a callback to exit with an error if exited while the prompt is shown', async () => {
          let callback;

          selectSpy.and.callFake(() => {
            expect(procUtilsDoOnExitSpy).toHaveBeenCalledWith(process, jasmine.any(Function));
            callback = procUtilsDoOnExitSpy.calls.mostRecent().args[1];
            return Promise.resolve({commit: ''});
          });

          await gPickCommit();

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
          selectSpy.and.callFake(() => {
            expect(procUtilsDoOnExitSpy).toHaveBeenCalledTimes(1);
            expect(unlistenSpy).not.toHaveBeenCalled();
            return Promise.resolve({commit: ''});
          });

          await gPickCommit();

          expect(selectSpy).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });

        it('should unregister the `onExit` callback once prompting completes with error', async () => {
          const unlistenSpy = jasmine.createSpy('unlisten');

          procUtilsDoOnExitSpy.and.returnValue(unlistenSpy);
          selectSpy.and.callFake(() => {
            expect(procUtilsDoOnExitSpy).toHaveBeenCalledTimes(1);
            expect(unlistenSpy).not.toHaveBeenCalled();
            return Promise.reject('');
          });

          await expectAsync(gPickCommit()).toBeRejected();

          expect(selectSpy).toHaveBeenCalledTimes(1);
          expect(unlistenSpy).toHaveBeenCalledWith();
        });
      });

      describe('output', () => {
        it('should log the selected commit SHA', async () => {
          selectSpy.and.returnValues(
              Promise.resolve('f00f00'),
              Promise.resolve('b4rb4r'),
              Promise.resolve('b4zb4z'),
              Promise.resolve('9ux9ux'));

          expect(await gPickCommit()).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('f00f00');

          expect(await gPickCommit([])).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('b4rb4r');

          expect(await gPickCommit([], {})).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('b4zb4z');

          expect(await gPickCommit([], {returnOutput: false})).toBeUndefined();
          expect(consoleLogSpy).toHaveBeenCalledWith('9ux9ux');
        });

        it('should return the selected commit SHA if `returnOutput` is `true`', async () => {
          selectSpy.and.resolveTo('f00b4r');

          expect(await gPickCommit([], {returnOutput: true})).toBe('f00b4r');
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

    it('should delegate to `gPickCommit()` (with appropriate arguments)', async () => {
      gPickCommitSpy.and.resolveTo('foo');
      const result = await main('runtimeArgs', 'config');

      expect(gPickCommitSpy).toHaveBeenCalledWith('runtimeArgs', 'config');
      expect(result).toBe('foo');
    });
  });
});
