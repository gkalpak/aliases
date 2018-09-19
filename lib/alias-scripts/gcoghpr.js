'use strict';

// Imports
const {commandUtils} = require('@gkalpak/cli-utils');
const chalk = require('chalk');

// Constants
const GH_TOKEN_NAME = 'GITHUB_ACCESS_TOKEN';

// Classes
/**
 * @class Gcoghpr
 *
 * @description
 * Allow checking out a GitHub pull request (PR) as a local branch.
 *
 * @example
 * ```js
 * new Gcoghpr().run(['12345'])
 * ```
 */
class _Gcoghpr {
  get _rl() { return this._lazyLoader.get('readline'); }
  get _constants() { return this._lazyLoader.get('../constants'); }

  constructor() {
    this._logger = new exps._Logger();
    this._lazyLoader = new exps._LazyLoader();
    this._ghUtils = new exps._GitHubUtils(this._logger, this._lazyLoader);
    this._remoteUrlRe = /^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git|\/)?$/i;
  }

  /**
   * @method run
   *
   * @description
   * Do all necessary operations to check out the specified PR as a local branch.
   *
   * In a nutshell, this involves the following:
   *
   * 1. Guess the upstream URL (looking at remotes `upstream` or `origin`).
   * 2. Retrieve the PR author and branch (either extracting it from the input or fetching it from GitHub).
   * 3. Check if a local branch with the same name already exists. (If it does, ask for permission to overwrite it.)
   * 4. Check out master.
   * 5. Fetch the PR branch from the author's remote into a local branch (with the same name).
   * 6. Switch to the new branch.
   * 7. Set up the local branch to track the PR branch.
   * 8. If the number of commits in the PR is available (e.g. retrieved from GitHub), log them.
   *
   * The PR can be identified either as `<author>:<branch>` or as a PR number (in which case the PR info is fetched from
   * GitHub).
   *
   * NOTE: Making requests to the GitHub API is subject to rate-limiting. You can avoid this, by setting an environment
   *       variable to a GitHub access token (with an appropriate scope).
   *
   * @param {string[]} runtimeArgs - A list of arguments. Currently only the PR identifier (either as
   *     `<author>:<branch>` or as a number).
   * @param {IRunConfig} [config={}] - A configuration object. See {@link commandUtils#IRunConfig} for more details.
   *
   * @return {Promise<void>} - A promise that resolves once all operations have completed.
   */
  run(runtimeArgs, config = {}) {
    if (config.dryrun) {
      this._logger.log('Check out a GitHub pull request on a local branch.');
      return Promise.resolve();
    }

    const executor = new exps._Executor(this._logger, Object.assign({sapVersion: 2}, config), config.debug);
    const {prId} = this._validateInput(runtimeArgs);

    return !prId ? Promise.resolve() : Promise.resolve().
      then(() => this._logger.forceColor('gray')).
      then(() => executor.exec('git remote get-url upstream || git remote get-url origin', {returnOutput: true})).
      then(upstreamUrl => {
        const [, upstreamUser, upstreamRepo] = this._remoteUrlRe.exec(upstreamUrl.trim());
        const upstreamInfo = {user: upstreamUser, repo: upstreamRepo, url: upstreamUrl};

        if (config.debug) {
          this._logger.debug(`Upstream info: ${JSON.stringify(upstreamInfo)}`);
        }

        return this._getPrInfo(upstreamInfo, prId);
      }).
      then(prInfo => {
        if (config.debug) {
          this._logger.debug(`PR info: ${JSON.stringify(prInfo)}`);
        }
        return prInfo;
      }).
      then(({branch, originUrl, commits}) => Promise.resolve().
        then(() => executor.exec(`git show-ref --heads --quiet ${branch}`).
          then(() => this._confirmOverwriteBranch(branch), () => undefined)).
        then(() => executor.exec('git checkout master')).
        then(() => executor.exec(`git fetch --no-tags ${originUrl} ${branch}:${branch}`)).
        then(() => executor.exec(`git checkout ${branch}`)).
        then(() => executor.exec(`git push --set-upstream ${originUrl}`)).
        then(() => this._logger.forceColor(null)).
        then(() => this._logPrCommits(commits, executor))).
      catch(err => {
        this._logger.forceColor(null);
        return Promise.reject(err);
      });
  }

  _confirmOverwriteBranch(branch) {
    return new Promise((resolve, reject) => {
      const rlInstance = this._rl.createInterface(process.stdin, process.stdout);
      const question = chalk.yellow(
        `Branch '${branch}' does already exist.\n` +
        `Overwrite it? ${chalk.white('[y/N]')} `);

      rlInstance.question(question, answer => {
        rlInstance.close();
        /^(?:y|yes)$/i.test(answer) ? resolve() : reject('Aborting...');
      });
    });
  }

  _getPrInfo(upstreamInfo, prId) {
    const prDataPromise = (prId.indexOf(':') !== -1) ?
      // `author:branch`
      Promise.resolve({commits: 0, label: prId}) :
      // `12345`
      this._ghUtils.getPr(upstreamInfo, prId).then(({commits, head}) => ({commits, label: head.label}));

    return prDataPromise.then(({commits, label}) => {
      const [author, branch] = label.split(':');
      const originUrl = `https://github.com/${author}/${upstreamInfo.repo}.git`;
      return {author, branch, originUrl, commits};
    });
  }

  _logPrCommits(commits, executor) {
    if (!commits) return Promise.resolve();

    const header = `PR commits (${commits})\\n---`;
    const gl1Cmd = this._constants.ALIASES.git.gl1.getSpec().command;
    const gl1Args = [`-${commits}`];

    return commandUtils.expandCmd(gl1Cmd, gl1Args, {}).
      then(cmd => executor.exec(`node --print "'${header}'" && ${cmd}`));
  }

  _usage() {
    const scriptName = __filename.slice(__dirname.length +1).replace(/\.js$/, '');
    const command = chalk.bgBlack.green(`${scriptName} @(<pr-number>|<author>:<branch>)`);
    const usageMessage = `${chalk.cyan('Usage:')} ${command}`;

    this._logger.log(`\n${usageMessage}\n`);
  }

  _validateInput(args) {
    const onError = errorMsg => {
      this._logger.error(errorMsg);
      this._usage();
      throw new Error('Invalid input.');
    };
    const [prId] = args;

    switch (args.length) {
      case 0:
        this._usage();
        return {};
      case 1:
        if ((prId.indexOf(':') === -1) && !/^\d+$/.test(prId)) {
          onError(`Unexpected PR identifier: ${prId}`);
          break;
        }

        return {prId};
      default:
        onError(`Expected 1 argument, found: ${args.join(', ')}`);
        break;
    }
  }
}

class Executor {
  constructor(logger, baseConfig = {}, debugMode = false) {
    this._logger = logger;
    this._baseConfig = baseConfig;
    this._debugMode = debugMode;
  }

  exec(cmd, config) {
    config = Object.assign({}, this._baseConfig, config);

    if (this._debugMode) {
      this._logger.debug(`Running command '${cmd}' (config: ${JSON.stringify(config)})...`);
    }
    this._logger.info(`RUN: ${cmd}`);

    return commandUtils.spawnAsPromised(cmd, config);
  }
}

class GitHubUtils {
  get _https() { return this._lazyLoader.get('https'); }
  get _constants() { return this._lazyLoader.get('../constants'); }

  constructor(logger, lazyLoader) {
    this._logger = logger;
    this._lazyLoader = lazyLoader;
    this._baseUrl = 'https://api.github.com/';
    this._shownTokenWarning = false;
  }

  get(path) {
    const url = this._baseUrl + path;
    const ghToken = process.env[GH_TOKEN_NAME] || '';
    const options = {
      headers: {
        Authorization: ghToken && `token ${ghToken}`,
        'User-Agent': this._constants.VERSION_STAMP.replace(/\s/g, '_'),
      },
    };

    if (!ghToken && !this._shownTokenWarning) {
      this._shownTokenWarning = true;
      this._logger.warn(
        `No GitHub access token found in \`${GH_TOKEN_NAME}\` environment variable.\n` +
        'Proceeding anonymously (and subject to rate-limiting)...');
    }

    return this._httpsGet(url, options).then(responseText => {
      try {
        return JSON.parse(responseText);
      } catch (err) {
        this._logger.error(`Response:\n${responseText}`);
        throw err;
      }
    });
  }

  getPr({user: upstreamUser, repo: upstreamRepo}, prNumber) {
    return this.get(`repos/${upstreamUser}/${upstreamRepo}/pulls/${prNumber}`);
  }

  _httpsGet(url, options = {}) {
    return new Promise((resolve, reject) => {
      this._logger.info(`GET: ${url} (options: {${Object.keys(options).join(', ')}})`);

      let data = '';
      this._https.
        get(url, options, res => res.
          on('error', reject).
          on('data', d => data += d).
          on('end', () => ((200 <= res.statusCode) && (res.statusCode < 300)) ?
            resolve(data) :
            reject(`Request to '${url}' failed (status: ${res.statusCode}):\n${data}`))).
        on('error', reject);
    });
  }
}

class LazyLoader {
  constructor() {
    this._loaded = Object.create(null);
  }

  get(dep) {
    return this._loaded[dep] || (this._loaded[dep] = require(dep));
  }
}

class Logger {
  constructor() {
    this._forcedColor = 'reset';
    this._forcedStyle = {open: '', close: ''};
  }

  forceColor(color) {
    color = color || 'reset';
    const oldStyle = this._forcedStyle;

    this._forcedColor = color;
    this._forcedStyle = (color === 'reset') ?
      {open: '', close: ''} :
      {
        open: chalk[color]('foo').replace(/foo.+$/, ''),
        close: chalk[color]('foo').replace(/^.+foo/, ''),
      };

    process.stdout.write(oldStyle.close + this._forcedStyle.open);
  }

  debug(msg) { console.debug(this._withStyle(chalk.gray(`[debug] ${msg}`))); }
  error(msg) { console.error(chalk.red(msg)); }
  info(msg) { console.info(this._withStyle(`[info] ${msg}`)); }
  log(msg) { console.log(this._withStyle(msg)); }
  warn(msg) { console.warn(this._withStyle(chalk.yellow(msg))); }

  _withStyle(msg) { return this._forcedStyle.open + msg + this._forcedStyle.open; }
}

// Exports
const exps = module.exports = {
  Gcoghpr: _Gcoghpr,

  main: __main,

  /** Exposed for testing purposes only. */
  _GH_TOKEN_NAME: GH_TOKEN_NAME,

  /** Exposed for testing purposes only. */
  _Executor: Executor,

  /** Exposed for testing purposes only. */
  _GitHubUtils: GitHubUtils,

  /** Exposed for testing purposes only. */
  _LazyLoader: LazyLoader,

  /** Exposed for testing purposes only. */
  _Logger: Logger,
};

// Functions - Definitions
function __main(runtimeArgs, config) {
  return new exps.Gcoghpr().run(runtimeArgs, config);
}
