// Imports
import {commandUtils} from '@gkalpak/cli-utils';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';

import {_testing, Gcoghpr, main} from '../../../lib/alias-scripts/gcoghpr.js';
import {PR_LOCAL_BRANCH_PREFIX, PR_REMOTE_ALIAS_PREFIX} from '../../../lib/constants.js';
import {loadPackageJson} from '../../test-utils.js';

import {MockExecutor, MockHttps, MockLogger} from './gcoghpr.mocks.js';


// Tests
describe('gcoghpr', () => {
  describe('Gcoghpr()', () => {
    const defaultBranch = 'default-branch';
    let mockHttps;
    let gcoghpr;

    const addDefinitions =
        (upUser, upRepo, prAuthor, prBranch, prCommits = 0, prNumber = 0, currentBranch = 'master') => {
          const localBranch = `${PR_LOCAL_BRANCH_PREFIX}-${!prNumber ? prBranch : `pr${prNumber}`}`;
          const remoteUrl = `${PR_REMOTE_ALIAS_PREFIX}-${prAuthor}`;
          const gitGetDefaultBranchCmd =
                '(git show-ref --heads --quiet master && echo master) || ' +
                '(git show-ref --heads --quiet main && echo main) || echo unknown-branch';
          const reportSuccessCmd = !prCommits ?
            'withStyle(reset): ' +
              'node --print "\'\'" && ' +
              `node --print "'Fetched PR into local branch \\'${localBranch}\\'.'"` :
            'withStyle(reset): ' +
              'node --print "\'\'" && ' +
              `node --print "'Fetched PR into local branch \\'${localBranch}\\' (and also branch ` +
                `range \\'${_testing._PR_LOCAL_BRANCH_BASE}..${_testing._PR_LOCAL_BRANCH_TOP}\\').'" && ` +
              'node --print "\'\'" && ' +
              `node --print "'PR commits (${prCommits})\\n---'" && ` +
              `git log --decorate --oneline -${prCommits + 1} || true`;

          Object.assign(MockExecutor.definitions, {
            'git remote get-url upstream || git remote get-url origin': `https://github.com/${upUser}/${upRepo}.git\n`,
            [`git show-ref --heads --quiet ${localBranch}`]: 'error:',
            'git rev-parse --abbrev-ref HEAD': currentBranch,
            ...((currentBranch !== localBranch) ? undefined : {
              [gitGetDefaultBranchCmd]: defaultBranch,
              [`git checkout ${defaultBranch}`]: '',
            }),
            [`git remote remove ${remoteUrl} || true`]: '',
            [`git remote add ${remoteUrl} https://github.com/${prAuthor}/${upRepo}.git`]: '',
            [`git fetch --no-tags ${remoteUrl} ${prBranch}`]: '',
            [`git branch --force --track ${localBranch} ${remoteUrl}/${prBranch}`]: '',
            [`git branch --force ${_testing._PR_LOCAL_BRANCH_TOP} ${localBranch}`]: '',
            [`git branch --force ${_testing._PR_LOCAL_BRANCH_BASE} ${localBranch}~${prCommits}`]: '',
            [`git checkout ${localBranch}`]: '',
            [reportSuccessCmd]: '',
          });

          if (prNumber) {
            mockHttps.
              whenGet(`https://api.github.com/repos/${upUser}/${upRepo}/pulls/${prNumber}`).
              response(200, JSON.stringify({
                commits: prCommits,
                head: {label: `${prAuthor}:${prBranch}`},
              }));
          }
        };
    const overwriteDefinitions = (...args) => {
      MockExecutor.definitions = {};
      mockHttps.reset();
      addDefinitions(...args);
    };

    beforeEach(() => {
      mockHttps = new MockHttps();
      spyOn(_testing, '_httpsGet').and.callFake((...args) => mockHttps.get(...args));

      MockExecutor.instances = [];
      overwriteDefinitions('gkalpak', 'aliases', 'some-author', 'some-branch', 42, 1337);

      spyOnProperty(_testing, '_Executor').and.returnValue(MockExecutor);
      spyOnProperty(_testing, '_Logger').and.returnValue(MockLogger);

      gcoghpr = new Gcoghpr();
    });

    describe('.run()', () => {
      it('should complete successfully if all goes well', async () => {
        await gcoghpr.run(['1337']);
        const executor = MockExecutor.instances[0];

        expect(executor.getExecutedCommands()).toEqual(Object.keys(MockExecutor.definitions));
      });

      it('should correctly handle upstream repository names with a `.`', async () => {
        overwriteDefinitions('gkalpak', 'aliases.js', 'some-author', 'some-branch', 42, 1337);

        await gcoghpr.run(['1337']);
        const executor = MockExecutor.instances[0];

        expect(executor.getExecutedCommands()).toEqual(Object.keys(MockExecutor.definitions));
      });

      it('should correctly handle upstream repository URLs without a trailing `.git`', async () => {
        overwriteDefinitions('gkalpak', 'aliases.js', 'some-author', 'some-branch', 42, 1337);
        MockExecutor.definitions['git remote get-url upstream || git remote get-url origin'] =
            'https://github.com/gkalpak/aliases.js\n';

        await gcoghpr.run(['1337']);
        const executor = MockExecutor.instances[0];

        expect(executor.getExecutedCommands()).toEqual(Object.keys(MockExecutor.definitions));
      });

      it('should log a message and exit when `dryrun: true`', async () => {
        await gcoghpr.run(['1337'], {dryrun: true});

        expect(gcoghpr._logger.logs.log).toEqual(['Check out a GitHub pull request on a local branch.']);
        expect(MockExecutor.instances).toEqual([]);
      });

      it('should create an executor with appropriate parameters', async () => {
        await Promise.all([
          gcoghpr.run(['1337'], {foo: 'bar'}),
          gcoghpr.run(['1337'], {debug: true}),
        ]);
        const [executor1, executor2] = MockExecutor.instances;

        expect(MockExecutor.instances.length).toBe(2);

        expect(executor1.logger).toBe(gcoghpr._logger);
        expect(executor1.baseConfig).toEqual({sapVersion: 2, foo: 'bar'});
        expect(executor1.debugMode).toBe(false);

        expect(executor2.logger).toBe(gcoghpr._logger);
        expect(executor2.baseConfig).toEqual({sapVersion: 2, debug: true});
        expect(executor2.debugMode).toBe(true);
      });

      it('should print usage information and exit when no runtime argument', async () => {
        await gcoghpr.run([]);
        const executor = MockExecutor.instances[0];

        expect(gcoghpr._logger.logs.log).toEqual(['\nUsage: gcoghpr @(<pr-number>|<author>:<branch>)\n']);
        expect(executor.executions).toEqual([]);
      });

      it('should print usage information and exit (with error) when more than 1 arguments', async () => {
        await expectAsync(gcoghpr.run(['1', '3', '3', '7'])).toBeRejectedWithError('Invalid input.');
        const executor = MockExecutor.instances[0];

        expect(gcoghpr._logger.logs.error).toEqual(['Expected 1 argument, found: 1, 3, 3, 7']);
        expect(gcoghpr._logger.logs.log).toEqual(['\nUsage: gcoghpr @(<pr-number>|<author>:<branch>)\n']);
        expect(executor.executions).toEqual([]);
      });

      it('should print usage information and exit (with error) when invalid PR identifier format', async () => {
        await expectAsync(gcoghpr.run(['baz/qux'])).toBeRejectedWithError('Invalid input.');
        const executor = MockExecutor.instances[0];

        expect(gcoghpr._logger.logs.error).toEqual(['Unexpected PR identifier: baz/qux']);
        expect(gcoghpr._logger.logs.log).toEqual(['\nUsage: gcoghpr @(<pr-number>|<author>:<branch>)\n']);
        expect(executor.executions).toEqual([]);
      });

      it('should accept the PR identifier in `<author>:<branch>` format', async () => {
        overwriteDefinitions('gkalpak', 'aliases', 'foo', 'bar');

        await gcoghpr.run(['foo:bar']);
        const executor = MockExecutor.instances[0];

        expect(executor.getExecutedCommands()).toEqual(Object.keys(MockExecutor.definitions));
      });

      it('should log extra debug information when `debug: true`', async () => {
        const expectedUpstreamInfo = {user: 'gkalpak',repo: 'aliases', url: 'https://github.com/gkalpak/aliases.git'};
        const expectedPrInfo = {
          author: 'some-author',
          branch: 'some-branch',
          originUrl: 'https://github.com/some-author/aliases.git',
          commits: 42,
        };

        await gcoghpr.run(['1337'], {debug: true});

        expect(gcoghpr._logger.logs.debug).toEqual([
          `Upstream info: ${JSON.stringify(expectedUpstreamInfo)}`,
          `PR info: ${JSON.stringify(expectedPrInfo)}`,
          `Local branch: ${PR_LOCAL_BRANCH_PREFIX}-pr1337`,
        ]);
      });

      it('should call `_confirmOverwriteBranch()` if the branch already exists', async () => {
        const spy = spyOn(gcoghpr, '_confirmOverwriteBranch');

        await gcoghpr.run(['1337']);
        expect(spy).not.toHaveBeenCalled();

        const localBranch = `${PR_LOCAL_BRANCH_PREFIX}-pr1337`;
        MockExecutor.definitions[`git show-ref --heads --quiet ${localBranch}`] = '';

        await gcoghpr.run(['1337']);
        expect(spy).toHaveBeenCalledWith(localBranch);
      });

      it('should abort the operation if `_confirmOverwriteBranch()` rejects', async () => {
        spyOn(gcoghpr, '_confirmOverwriteBranch').and.callFake(() => Promise.reject('test'));

        const localBranch = `${PR_LOCAL_BRANCH_PREFIX}-pr1337`;
        MockExecutor.definitions[`git show-ref --heads --quiet ${localBranch}`] = '';

        await expectAsync(gcoghpr.run(['1337'])).toBeRejectedWith('test');

        const executor = MockExecutor.instances[0];
        expect(executor.getExecutedCommands()).toEqual([
          'git remote get-url upstream || git remote get-url origin',
          `git show-ref --heads --quiet ${localBranch}`,
        ]);
      });

      it('should not checkout the default branch if not already on the target branch', async () => {
        overwriteDefinitions(
            'gkalpak', 'aliases', 'some-author', 'some-branch', 42, 1337, `${PR_LOCAL_BRANCH_PREFIX}-pr1337-not`);

        await gcoghpr.run(['1337']);
        const executor = MockExecutor.instances[0];
        const executedCommands = executor.getExecutedCommands();

        expect(executedCommands).toEqual(Object.keys(MockExecutor.definitions));
        expect(executedCommands).not.toContain(`git checkout ${defaultBranch}`);
      });

      it('should checkout the default branch if already on the target branch', async () => {
        overwriteDefinitions(
            'gkalpak', 'aliases', 'some-author', 'some-branch', 42, 1337, `${PR_LOCAL_BRANCH_PREFIX}-pr1337`);

        await gcoghpr.run(['1337']);
        const executor = MockExecutor.instances[0];
        const executedCommands = executor.getExecutedCommands();

        expect(executedCommands).toEqual(Object.keys(MockExecutor.definitions));
        expect(executedCommands).toContain(`git checkout ${defaultBranch}`);
      });

      it('should not log PR commits if not available', async () => {
        const didLogCommits = executor => executor.
          getExecutedCommands().
          some(cmd => cmd.includes('git log'));

        await gcoghpr.run(['1337']);
        expect(didLogCommits(MockExecutor.instances.pop())).toBe(true);

        overwriteDefinitions('gkalpak', 'aliases', 'foo-author', 'bar-branch');

        await gcoghpr.run(['foo-author:bar-branch']);
        expect(didLogCommits(MockExecutor.instances.pop())).toBe(false);
      });

      it('should force the logger color to gray during execution', async () => {
        const execSpy = spyOn(MockExecutor.prototype, 'execDouble').and.
          callFake(() => expect(gcoghpr._logger.color).toBe('gray'));

        expect(gcoghpr._logger.color).toBe('reset');

        await gcoghpr.run(['1337']);

        expect(gcoghpr._logger.color).toBe('reset');
        expect(execSpy).toHaveBeenCalledTimes(11);
      });
    });

    describe('._confirmOverwriteBranch()', () => {
      let mockRlInterface;
      let mockAnswer;
      let rlCreateInterfaceSpy;

      beforeEach(() => {
        mockRlInterface = jasmine.createSpyObj(['close', 'question']);
        mockRlInterface.question.and.callFake((_, answerCb) => answerCb(mockAnswer));

        mockAnswer = 'y';

        rlCreateInterfaceSpy = spyOn(_testing, '_rlCreateInterface').and.returnValue(mockRlInterface);
      });

      it('should return a promise', async () => {
        const promise = gcoghpr._confirmOverwriteBranch('foo');
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should create a `readline` interface (on stdin/stdout)', async () => {
        await gcoghpr._confirmOverwriteBranch('foo');
        expect(rlCreateInterfaceSpy).toHaveBeenCalledWith(process.stdin, process.stdout);
      });

      it('should ask the user for confirmation', async () => {
        await gcoghpr._confirmOverwriteBranch('foo');

        expect(mockRlInterface.question).toHaveBeenCalledTimes(1);
        expect(mockRlInterface.question).toHaveBeenCalledWith(jasmine.any(String), jasmine.any(Function));

        const expectedQuestion = 'Branch \'foo\' does already exist.\nOverwrite it? [y/N] ';
        const actualQuestion = stripAnsi(mockRlInterface.question.calls.argsFor(0)[0]);

        expect(actualQuestion).toBe(expectedQuestion);
      });

      it('should resolve if the answer is `y`/`yes` (case-insensitively)', async () => {
        for (const answer of ['y', 'yes', 'Y', 'YES', 'yEs', 'YeS']) {
          mockAnswer = answer;
          await expectAsync(gcoghpr._confirmOverwriteBranch('foo')).toBeResolved();
        }
      });

      it('should reject if the answer is not `y`/`yes` (case-insensitively)', async () => {
        for (const answer of ['n', 'no', 'No', 'NO', 'NoOoOo', 'nope', 'maybe', 'OK', 'sure', '']) {
          mockAnswer = answer;
          await expectAsync(gcoghpr._confirmOverwriteBranch('foo')).toBeRejected();
        }
      });
    });
  });

  describe('_Executor', () => {
    let mockLogger;

    beforeEach(() => mockLogger = new MockLogger());

    describe('.constructor()', () => {
      it('should default to `{}` for `baseConfig`', () => {
        const executor1 = new _testing._Executor(mockLogger, {foo: 'bar'});
        expect(executor1._baseConfig).toEqual({foo: 'bar'});

        const executor2 = new _testing._Executor(mockLogger);
        expect(executor2._baseConfig).toEqual({});
      });

      it('should default to `false` for `debugMode`', () => {
        const executor1 = new _testing._Executor(mockLogger, {}, true);
        expect(executor1._debugMode).toBe(true);

        const executor2 = new _testing._Executor(mockLogger);
        expect(executor2._debugMode).toBe(false);
      });
    });

    describe('.exec()', () => {
      let cuSpawnAsPromisedSpy;
      let executor;

      beforeEach(() => {
        cuSpawnAsPromisedSpy = spyOn(commandUtils, 'spawnAsPromised').and.returnValue('ok');
        executor = new _testing._Executor(mockLogger);
      });

      it('should delegate to `commandUtils.spawnAsPromised()`', () => {
        const result = executor.exec('foo', {foo: 'bar'});

        expect(cuSpawnAsPromisedSpy).toHaveBeenCalledWith('foo', {foo: 'bar'});
        expect(result).toBe('ok');
      });

      it('should use `baseConfig` as a basis', () => {
        executor = new _testing._Executor(mockLogger, {foo: 'not bar', baz: 'qux'});
        executor.exec('foo', {foo: 'bar'});

        expect(cuSpawnAsPromisedSpy).toHaveBeenCalledWith('foo', {foo: 'bar', baz: 'qux'});
      });

      it('should log the executed command', () => {
        executor.exec('foo --bar');
        expect(mockLogger.logs.info).toEqual(['RUN: foo --bar']);
      });

      it('should filter out `echo`/`node -p` commands from the command log', () => {
        executor.exec('echo foo && foo --bar && node --print "42" && baz --qux && node -p "`success`"');
        expect(mockLogger.logs.info).toEqual(['RUN: foo --bar && baz --qux']);
      });

      it('should log more in debug mode', () => {
        executor.exec('foo --bar && echo test');
        expect(mockLogger.logs.info).toEqual(['RUN: foo --bar']);
        expect(mockLogger.logs.debug).toEqual([]);

        mockLogger.logs.info = [];

        executor = new _testing._Executor(mockLogger, {foo: 'bar'}, true);
        executor.exec('foo --bar && echo test', {baz: 'qux'});

        expect(mockLogger.logs.info).toEqual(['RUN: foo --bar']);
        expect(mockLogger.logs.debug).toEqual([
          'Running command \'foo --bar && echo test\' (config: {"foo":"bar","baz":"qux"})...',
        ]);
      });
    });

    describe('.execForOutput()', () => {
      let executor;
      let execSpy;

      beforeEach(() => {
        executor = new _testing._Executor(mockLogger);
        execSpy = spyOn(executor, 'exec').and.resolveTo('ok');
      });

      it('should delegate to `exec()` (with `returnOutput: true`)', async () => {
        await expectAsync(executor.execForOutput('foo', {bar: 'baz'})).toBeResolvedTo('ok');
        expect(execSpy).toHaveBeenCalledWith(jasmine.any(String), {bar: 'baz', returnOutput: true});

        execSpy.calls.reset();
        execSpy.and.rejectWith('Test error');

        await expectAsync(executor.execForOutput('foo2', {bar2: 'baz2'})).toBeRejectedWith('Test error');
        expect(execSpy).toHaveBeenCalledWith(jasmine.any(String), {bar2: 'baz2', returnOutput: true});
      });

      it('should be handle a missing `config`', async () => {
        await expectAsync(executor.execForOutput('foo')).toBeResolvedTo('ok');
        expect(execSpy).toHaveBeenCalledWith(jasmine.any(String), {returnOutput: true});
      });

      it('should override `returnOutput` from the passed in `config`', async () => {
        await expectAsync(executor.execForOutput('foo', {bar: 'baz', returnOutput: false})).toBeResolvedTo('ok');
        expect(execSpy).toHaveBeenCalledWith(jasmine.any(String), {bar: 'baz', returnOutput: true});
      });

      it('should not affect the original `config`', async () => {
        const config = {bar: 'baz', returnOutput: false};

        await expectAsync(executor.execForOutput('foo', config)).toBeResolvedTo('ok');
        expect(execSpy).toHaveBeenCalledWith(jasmine.any(String), {bar: 'baz', returnOutput: true});
        expect(config.returnOutput).toBeFalse();
      });

      it('should trim the output', async () => {
        execSpy.and.resolveTo('  \n  \t  trimmed  \t  \n  ');
        await expectAsync(executor.execForOutput('foo')).toBeResolvedTo('trimmed');
      });
    });

    describe('.execWithStyle()', () => {
      let executor;
      let execSpy;
      let stdoutWriteSpy;

      beforeEach(() => {
        executor = new _testing._Executor(mockLogger);

        execSpy = spyOn(executor, 'exec').and.resolveTo('ok');
        stdoutWriteSpy = spyOn(process.stdout, 'write');
      });

      it('should delegate to `exec()`', async () => {
        const result = await executor.execWithStyle('foo', 'bar', {baz: 'qux'});

        expect(execSpy).toHaveBeenCalledWith(jasmine.any(String), {baz: 'qux'});
        expect(result).toBe('ok');
      });

      it('should prefix the command with style', async () => {
        await executor.execWithStyle('red', 'foo --bar', {});
        expect(execSpy).toHaveBeenCalledWith('node --print "\'\\bswitchColor(reset --> red)\'" && foo --bar', {});

        await executor.execWithStyle(null, 'foo --bar', {});
        expect(execSpy).toHaveBeenCalledWith('node --print "\'\\bswitchColor(reset --> reset)\'" && foo --bar', {});

        executor._logger.forceColor('cyan');

        await executor.execWithStyle('red', 'foo --bar', {});
        expect(execSpy).toHaveBeenCalledWith('node --print "\'\\bswitchColor(cyan --> red)\'" && foo --bar', {});

        await executor.execWithStyle('reset', 'foo --bar', {});
        expect(execSpy).toHaveBeenCalledWith('node --print "\'\\bswitchColor(cyan --> reset)\'" && foo --bar', {});
      });

      it('should reset the style after the command has executed', async () => {
        await executor.execWithStyle('cyan', 'foo --bar');
        expect(stdoutWriteSpy).toHaveBeenCalledWith('switchColor(cyan --> reset)');

        execSpy.and.callFake(() => Promise.reject('not ok'));

        await expectAsync(executor.execWithStyle('cyan', 'foo --bar')).toBeRejected();
        expect(stdoutWriteSpy).toHaveBeenCalledWith('switchColor(cyan --> reset)');
      });
    });
  });

  describe('_GitHubUtils', () => {
    let mockHttps;
    let ghUtils;

    beforeEach(() => {
      mockHttps = new MockHttps();
      spyOn(_testing, '_httpsGet').and.callFake((...args) => mockHttps.get(...args));

      ghUtils = new _testing._GitHubUtils(new MockLogger());
    });

    describe('.get()', () => {
      const originalAccessToken = process.env[_testing._GH_TOKEN_NAME];
      let _httpsGetSpy;

      beforeEach(() => {
        process.env[_testing._GH_TOKEN_NAME] = 'TEST_TOKEN';
        _httpsGetSpy = spyOn(ghUtils, '_httpsGet').and.resolveTo('{"foo":"bar"}');
      });

      afterEach(() => process.env[_testing._GH_TOKEN_NAME] = originalAccessToken);

      it('should call `_GitHubUtils#_httpsGet()` with appropriate arguments', async () => {
        const {version} = loadPackageJson();

        await ghUtils.get('baz/qux');

        expect(_httpsGetSpy).toHaveBeenCalledWith('https://api.github.com/baz/qux', {
          headers: {
            Authorization: 'token TEST_TOKEN',
            'User-Agent': `@gkalpak/aliases_v${version}`,
          },
        });
      });

      it('should reject if `_GitHubUtils#_httpsGet()` fails', async () => {
        _httpsGetSpy.and.callFake(() => Promise.reject('test'));
        await expectAsync(ghUtils.get('baz/qux')).toBeRejectedWith('test');
      });

      it('should parse the response as JSON', async () => {
        const result = await ghUtils.get('baz/qux');

        expect(result).toEqual({foo: 'bar'});
        expect(ghUtils._logger.logs.error).toEqual([]);
      });

      it('should reject if the response is not valid JSON', async () => {
        _httpsGetSpy.and.resolveTo('{foo: \'bar\'}');

        await expectAsync(ghUtils.get('baz/qux')).toBeRejectedWithError(SyntaxError);
        expect(ghUtils._logger.logs.error).toEqual(['Response:\n{foo: \'bar\'}']);
      });

      it('should omit the access token if not available (and print a warning)', async () => {
        process.env[_testing._GH_TOKEN_NAME] = '';
        await ghUtils.get('baz/qux');

        expect(_httpsGetSpy).toHaveBeenCalledWith(jasmine.any(String), {
          headers: jasmine.objectContaining({Authorization: ''}),
        });
      });

      it('should print a warning for the missing access token (but only once)', async () => {
        process.env[_testing._GH_TOKEN_NAME] = '';

        const logs = ghUtils._logger.logs;
        expect(logs.warn).toEqual([]);

        await ghUtils.get('baz/qux');
        expect(logs.warn.length).toBe(1);
        expect(logs.warn).toEqual([
          `No GitHub access token found in \`${_testing._GH_TOKEN_NAME}\` environment variable.\n` +
          'Proceeding anonymously (and subject to rate-limiting)...',
        ]);

        await ghUtils.get('baz/qux');
        expect(logs.warn.length).toBe(1);
      });
    });

    describe('.getPr()', () => {
      let getSpy;

      beforeEach(() => getSpy = spyOn(ghUtils, 'get').and.returnValue('foo'));

      it('should call `_GitHubUtils#get()` with the correct path', () => {
        const result = ghUtils.getPr({user: 'gkalpak', repo: 'aliases'}, '1337');

        expect(getSpy).toHaveBeenCalledWith('repos/gkalpak/aliases/pulls/1337');
        expect(result).toBe('foo');
      });
    });

    describe('._httpsGet()', () => {
      const baseUrl = 'https://example.com';
      const request = (path, options) => ghUtils._httpsGet(`${baseUrl}/${path}`, options);

      beforeEach(() => {
        mockHttps.
          whenGet(/status-\d+$/).
          response(url => {
            const statusCode = +(url.split('-').pop());
            return [statusCode, `STATUS ${statusCode}`];
          });
      });

      it('should return a promise', async () => {
        const promise = request('status-200');
        expect(promise).toEqual(jasmine.any(Promise));

        await promise;
      });

      it('should call `https#get()` with appropriate arguments', async () => {
        const mockOpts = {bar: 'baz'};
        const httpsGetSpy = spyOn(mockHttps, 'get').and.callThrough();

        await request('status-200', mockOpts);

        expect(httpsGetSpy).toHaveBeenCalledWith('https://example.com/status-200', mockOpts, jasmine.any(Function));
      });

      it('should default to `{}` for `options`', async () => {
        const httpsGetSpy = spyOn(mockHttps, 'get').and.callThrough();
        await request('status-200');

        expect(httpsGetSpy).toHaveBeenCalledWith('https://example.com/status-200', {}, jasmine.any(Function));
      });

      it('should log the request (but not option values)', async () => {
        await request('status-200', {bar: 'baz'});
        expect(ghUtils._logger.logs.info).toEqual([`GET: ${baseUrl}/status-200 (options: {bar})`]);
      });

      it('should resolve with the response (on 2xx status code)', async () => {
        expect(await request('status-200')).toBe('STATUS 200');
        expect(await request('status-202')).toBe('STATUS 202');
        expect(await request('status-299')).toBe('STATUS 299');
      });

      it('should reject with the request and response info (on non-2xx status code)', async () => {
        for (const code of ['100', '300', '400', '500']) {
          await expectAsync(request(`status-${code}`)).
            toBeRejectedWith(`Request to '${baseUrl}/status-${code}' failed (status: ${code}):\nSTATUS ${code}`);
        }
      });

      it('should reject on request error', async () => {
        mockHttps.
          whenGet(`${baseUrl}/request-error`).
          requestError('REQUEST ERROR');

        await expectAsync(request('request-error')).toBeRejectedWith('REQUEST ERROR');
      });

      it('should reject on response error', async () => {
        mockHttps.
          whenGet(`${baseUrl}/response-error`).
          requestError('RESPONSE ERROR');

        await expectAsync(request('response-error')).toBeRejectedWith('RESPONSE ERROR');
      });
    });
  });

  describe('_Logger', () => {
    const colorsToMock = ['cyan', 'gray', 'red', 'yellow'];
    const basicColorLevel = 1;
    const originalChalkLevel = chalk.level;
    let restoreColors;
    let consoleSpies;
    let stdoutWriteSpy;
    let logger;
    let cyanLogger;

    // Ugly hack, because `chalk` makes it really hard to mock colors :(
    const mockChalkColors = mockedColors => {
      const originalColorStyles = {};
      const stylerSymbol = Object.
        getOwnPropertySymbols(chalk[mockedColors[0]]).
        find(s => s.toString() === 'Symbol(STYLER)');

      mockedColors.forEach(color => {
        const originalStyle = originalColorStyles[color] = chalk[color][stylerSymbol];
        chalk[color][stylerSymbol] = {
          ...originalStyle,
          open: `<${color}>`,
          close: `</${color}>`,
          openAll: `<${color}>`,
          closeAll: `</${color}>`,
        };
      });

      return () => mockedColors.forEach(color => chalk[color][stylerSymbol] = originalColorStyles[color]);
    };

    beforeEach(() => {
      // In some environments (e.g. Windows on CI), `chalk.level` is `0` (all colors disabled).
      chalk.level = originalChalkLevel || basicColorLevel;
      restoreColors = mockChalkColors(colorsToMock);

      consoleSpies = {};
      ['debug', 'error', 'info', 'log', 'warn'].forEach(method =>
        consoleSpies[method] = spyOn(console, method));

      stdoutWriteSpy = spyOn(process.stdout, 'write');

      logger = new _testing._Logger();
      cyanLogger = new _testing._Logger();
      cyanLogger.forceColor('cyan');
    });

    afterEach(() => {
      restoreColors();
      chalk.level = originalChalkLevel;
    });

    describe('.forceColor()', () => {
      it('should close the previous style and open the new one', () => {
        cyanLogger.forceColor('gray');
        expect(stdoutWriteSpy).toHaveBeenCalledWith('</cyan><gray>');
      });

      it('should affect future writes', () => {
        cyanLogger.forceColor('gray');
        cyanLogger.log('aha!');

        expect(consoleSpies.log).toHaveBeenCalledWith('<gray>aha!<gray>');
      });

      it('should reset colors with `reset`', () => {
        cyanLogger.forceColor('reset');
        expect(stdoutWriteSpy).toHaveBeenCalledWith('</cyan>');

        cyanLogger.log('aha!');
        expect(consoleSpies.log).toHaveBeenCalledWith('aha!');
      });

      it('should default to `reset` if no color is provided', () => {
        cyanLogger.forceColor();
        expect(stdoutWriteSpy).toHaveBeenCalledWith('</cyan>');

        cyanLogger.log('aha!');
        expect(consoleSpies.log).toHaveBeenCalledWith('aha!');
      });
    });

    describe('.getTempStyle()', () => {
      it('should return an appropriate style to switch from current color to specified one and back', () => {
        const noneToRedStyle = logger.getTempStyle('red');
        const noneToNoneStyle = logger.getTempStyle(null);

        expect(noneToRedStyle).toEqual({color: 'reset --> red', open: '<red>', close: '</red>'});
        expect(noneToNoneStyle).toEqual({color: 'reset --> reset', open: '', close: ''});

        const cyanToRedStyle = cyanLogger.getTempStyle('red');
        const cyanToCyanStyle = cyanLogger.getTempStyle('cyan');
        const cyanToNoneStyle = cyanLogger.getTempStyle('reset');

        expect(cyanToRedStyle).toEqual({color: 'cyan --> red', open: '</cyan><red>', close: '</red><cyan>'});
        expect(cyanToCyanStyle).toEqual({color: 'cyan --> cyan', open: '', close: ''});
        expect(cyanToNoneStyle).toEqual({color: 'cyan --> reset', open: '</cyan>', close: '<cyan>'});
      });
    });

    describe('.debug()', () => {
      it('should print debug content', () => {
        logger.debug('debug = fan');
        expect(consoleSpies.debug).toHaveBeenCalledWith('<gray>[debug] debug = fan</gray>');

        cyanLogger.debug('debug = fan');
        expect(consoleSpies.debug).toHaveBeenCalledWith('<cyan><gray>[debug] debug = fan</gray><cyan>');
      });
    });

    describe('.error()', () => {
      it('should print error content', () => {
        logger.error('error != fan');
        expect(consoleSpies.error).toHaveBeenCalledWith('<red>error != fan</red>');

        cyanLogger.error('error != fan');
        expect(consoleSpies.error).toHaveBeenCalledWith('<red>error != fan</red>');
      });
    });

    describe('.info()', () => {
      it('should print info content', () => {
        logger.info('info = fan');
        expect(consoleSpies.info).toHaveBeenCalledWith('[info] info = fan');

        cyanLogger.info('info = fan');
        expect(consoleSpies.info).toHaveBeenCalledWith('<cyan>[info] info = fan<cyan>');
      });
    });

    describe('.log()', () => {
      it('should print log content', () => {
        logger.log('log = fan');
        expect(consoleSpies.log).toHaveBeenCalledWith('log = fan');

        cyanLogger.log('log = fan');
        expect(consoleSpies.log).toHaveBeenCalledWith('<cyan>log = fan<cyan>');
      });
    });

    describe('.warn()', () => {
      it('should print warn content', () => {
        logger.warn('warn = so and so');
        expect(consoleSpies.warn).toHaveBeenCalledWith('<yellow>warn = so and so</yellow>');

        cyanLogger.warn('warn = so and so');
        expect(consoleSpies.warn).toHaveBeenCalledWith('<cyan><yellow>warn = so and so</yellow><cyan>');
      });
    });
  });

  describe('main()', () => {
    let gcoghprRunSpy;

    beforeEach(() => gcoghprRunSpy = spyOn(Gcoghpr.prototype, 'run'));

    it('should be a function', () => {
      expect(main).toEqual(jasmine.any(Function));
    });

    it('should delegate to `Gcoghpr#run()` (with appropriate arguments)', async () => {
      gcoghprRunSpy.and.resolveTo('foo');
      const result = await main('runtimeArgs', 'config');

      expect(gcoghprRunSpy).toHaveBeenCalledWith('runtimeArgs', 'config');
      expect(result).toBe('foo');
    });
  });
});
