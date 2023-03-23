/* eslint-disable max-classes-per-file */
// Imports
import {get as httpsGet} from 'node:https';
import {basename} from 'node:path';
import {createInterface} from 'node:readline';

import {commandUtils} from '@gkalpak/cli-utils';
import chalk from 'chalk';

import {ALIASES, PR_LOCAL_BRANCH_PREFIX, PR_REMOTE_ALIAS_PREFIX, VERSION_STAMP} from '../constants.js';


// Constants
const internal = {
  _GH_TOKEN_NAME: 'GITHUB_ACCESS_TOKEN',
  _PR_LOCAL_BRANCH_BASE: `${PR_LOCAL_BRANCH_PREFIX}-base`,
  _PR_LOCAL_BRANCH_TOP: `${PR_LOCAL_BRANCH_PREFIX}-top`,
  get _Executor() { return Executor; },
  get _GitHubUtils() { return GitHubUtils; },
  get _Logger() { return Logger; },

  _httpsGet,
  _rlCreateInterface,
};

// Classes
class Executor {
  constructor(logger, baseConfig = {}, debugMode = false) {
    this._logger = logger;
    this._baseConfig = baseConfig;
    this._debugMode = debugMode;
  }

  exec(cmd, config) {
    config = Object.assign({}, this._baseConfig, config);

    const cmdSep = ' && ';
    const printableCmd = cmd.
      split(cmdSep).
      filter(c => !/^(?:echo|node (?:-p|--print)) /.test(c)).
      join(cmdSep);

    if (this._debugMode) {
      this._logger.debug(`Running command '${cmd}' (config: ${JSON.stringify(config)})...`);
    }
    this._logger.info(`RUN: ${printableCmd}`);

    return commandUtils.spawnAsPromised(cmd, config);
  }

  async execForOutput(cmd, config) {
    config = Object.assign({}, config, {returnOutput: true});
    const output = await this.exec(cmd, config);

    return output.trim();
  }

  async execWithStyle(color, cmd, config) {
    const tempStyle = this._logger.getTempStyle(color);
    const preCmd = `node --print ${JSON.stringify(`'\b${tempStyle.open}'`)}`;
    const resetStyle = () => process.stdout.write(tempStyle.close);

    try {
      return await this.exec(`${preCmd} && ${cmd}`, config);
    } finally {
      resetStyle();
    }
  }
}

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
class Gcoghpr {
  constructor() {
    this._logger = new internal._Logger();
    this._ghUtils = new internal._GitHubUtils(this._logger);
    this._remoteUrlRe = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git|\/)?$/i;
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
   * 4. Check out the default branch.
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
  async run(runtimeArgs, config = {}) {
    if (config.dryrun) {
      this._logger.log('Check out a GitHub pull request on a local branch.');
      return;
    }

    const executor = new internal._Executor(this._logger, Object.assign({sapVersion: 2}, config), config.debug);
    const {prId = null} = this._validateInput(runtimeArgs);

    if (prId === null) {
      return;
    }

    try {
      this._logger.forceColor('gray');

      const upstreamUrl = await executor.execForOutput('git remote get-url upstream || git remote get-url origin');
      const [, upstreamUser, upstreamRepo] = this._remoteUrlRe.exec(upstreamUrl);
      const upstreamInfo = {user: upstreamUser, repo: upstreamRepo, url: upstreamUrl};

      if (config.debug) {
        this._logger.debug(`Upstream info: ${JSON.stringify(upstreamInfo)}`);
      }

      const prInfo = await this._getPrInfo(upstreamInfo, prId);
      const localBranchSuffix = (prId.indexOf(':') !== -1) ? prInfo.branch : `pr${prId}`;
      const localBranch = `${PR_LOCAL_BRANCH_PREFIX}-${localBranchSuffix}`;
      const remoteAlias = `${PR_REMOTE_ALIAS_PREFIX}-${prInfo.author}`;

      if (config.debug) {
        this._logger.debug(`PR info: ${JSON.stringify(prInfo)}`);
        this._logger.debug(`Local branch: ${localBranch}`);
      }

      let localBranchExists;

      try {
        await executor.exec(`git show-ref --heads --quiet ${localBranch}`);
        localBranchExists = true;
      } catch {
        localBranchExists = false;
      }

      if (localBranchExists) {
        await this._confirmOverwriteBranch(localBranch);
      }

      const currentBranch = await executor.execForOutput('git rev-parse --abbrev-ref HEAD');

      if (currentBranch === localBranch) {
        const defaultBranch = await executor.execForOutput(ALIASES.git.gdefb.getSpec().command);
        await executor.exec(`git checkout ${defaultBranch}`);
      }

      await executor.exec(`git remote remove ${remoteAlias} || true`);
      await executor.exec(`git remote add ${remoteAlias} ${prInfo.originUrl}`);
      await executor.exec(`git fetch --no-tags ${remoteAlias} ${prInfo.branch}`);
      await executor.exec(`git branch --force --track ${localBranch} ${remoteAlias}/${prInfo.branch}`);
      await executor.exec(`git branch --force ${internal._PR_LOCAL_BRANCH_TOP} ${localBranch}`);
      await executor.exec(`git branch --force ${internal._PR_LOCAL_BRANCH_BASE} ${localBranch}~${prInfo.commits || 0}`);
      await executor.exec(`git checkout ${localBranch}`);

      await this._reportSuccess(localBranch, prInfo.commits, executor);
    } finally {
      this._logger.forceColor(null);
    }
  }

  _confirmOverwriteBranch(branch) {
    return new Promise((resolve, reject) => {
      const rlInstance = internal._rlCreateInterface(process.stdin, process.stdout);
      const question = chalk.yellow(
          `Branch '${branch}' does already exist.\n` +
          `Overwrite it? ${chalk.white('[y/N]')} `);

      rlInstance.question(question, answer => {
        rlInstance.close();
        /^(?:y|yes)$/i.test(answer) ? resolve() : reject('Aborting...');
      });
    });
  }

  async _getPrInfo(upstreamInfo, prId) {
    const {commits, label} = prId.includes(':') ?
      // `author:branch`
      {commits: 0, label: prId} :
      // `12345`
      await this._ghUtils.getPr(upstreamInfo, prId).then(({commits, head}) => ({commits, label: head.label}));

    const [author, branch] = label.split(':');
    const originUrl = `https://github.com/${author}/${upstreamInfo.repo}.git`;

    return {author, branch, originUrl, commits};
  }

  _getPrintCommand(message) {
    return message.
      split(/\r?\n/).
      map(line => `node --print "'${line.replace(/'/g, '\\$&')}'"`).
      join(' && ');
  }

  async _reportSuccess(localBranch, commits, executor) {
    let ready = Promise.resolve();
    const commands = [];

    const messageMain = `\nFetched PR into local branch '${chalk.green(localBranch)}'`;
    const messageExt = !commits ?
      '.' :
      ' (and also branch range ' +
        `'${chalk.cyan(internal._PR_LOCAL_BRANCH_BASE)}..${chalk.cyan(internal._PR_LOCAL_BRANCH_TOP)}').\n` +
      '\n' +
      `PR commits (${commits})\\n---`;
    commands.push(this._getPrintCommand(`${messageMain}${messageExt}`));

    if (commits) {
      const gl1RawCmd = ALIASES.git.gl1.getSpec().command;
      const gl1Args = [`-${commits + 1}`];

      ready = ready.
        then(() => commandUtils.expandCmd(gl1RawCmd, gl1Args, {})).
        then(gl1Cmd => commands.push(gl1Cmd));
    }

    await ready;
    return executor.execWithStyle(null, commands.join(' && '));
  }

  _usage() {
    const scriptName = basename(import.meta.url).replace(/\.js$/, '');
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
        if (!prId.includes(':') && !/^\d+$/.test(prId)) {
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

class GitHubUtils {
  constructor(logger) {
    this._logger = logger;
    this._baseUrl = 'https://api.github.com/';
    this._shownTokenWarning = false;
  }

  async get(path) {
    const url = `${this._baseUrl}${path}`;
    const ghToken = process.env[internal._GH_TOKEN_NAME] || '';
    const options = {
      headers: {
        Authorization: ghToken && `token ${ghToken}`,
        'User-Agent': VERSION_STAMP.replace(/\s/g, '_'),
      },
    };

    if (!ghToken && !this._shownTokenWarning) {
      this._shownTokenWarning = true;
      this._logger.warn(
          `No GitHub access token found in \`${internal._GH_TOKEN_NAME}\` environment variable.\n` +
          'Proceeding anonymously (and subject to rate-limiting)...');
    }

    const responseText = await this._httpsGet(url, options);

    try {
      return JSON.parse(responseText);
    } catch (err) {
      this._logger.error(`Response:\n${responseText}`);
      throw err;
    }
  }

  getPr({user: upstreamUser, repo: upstreamRepo}, prNumber) {
    return this.get(`repos/${upstreamUser}/${upstreamRepo}/pulls/${prNumber}`);
  }

  _httpsGet(url, options = {}) {
    return new Promise((resolve, reject) => {
      this._logger.info(`GET: ${url} (options: {${Object.keys(options).join(', ')}})`);
      let data = '';

      internal._httpsGet(url, options, res => res.
        on('error', reject).
        on('data', d => data += d).
        on('end', () => ((200 <= res.statusCode) && (res.statusCode < 300)) ?
          resolve(data) :
          reject(`Request to '${url}' failed (status: ${res.statusCode}):\n${data}`))).
        on('error', reject);
    });
  }
}

class Logger {
  constructor() {
    this._forcedStyle = {
      color: 'reset',
      open: '',
      close: '',
    };
  }

  forceColor(color) {
    const oldStyle = this._forcedStyle;
    const newStyle = this._forcedStyle = this._computeStyle(color);
    process.stdout.write(oldStyle.close + newStyle.open);
  }

  getTempStyle(color) {
    const originalStyle = this._forcedStyle;
    const tempStyle = this._computeStyle(color);
    const isSameColor = (originalStyle.color === tempStyle.color);

    const originalToTemp = isSameColor ? '' : originalStyle.close + tempStyle.open;
    const tempToOriginal = isSameColor ? '' : tempStyle.close + originalStyle.open;

    return {
      color: `${originalStyle.color} --> ${tempStyle.color}`,
      open: originalToTemp,
      close: tempToOriginal,
    };
  }

  debug(msg) { console.debug(this._withStyle(chalk.gray(`[debug] ${msg}`))); }
  error(msg) { console.error(chalk.red(msg)); }
  info(msg) { console.info(this._withStyle(`[info] ${msg}`)); }
  log(msg) { console.log(this._withStyle(msg)); }
  warn(msg) { console.warn(this._withStyle(chalk.yellow(msg))); }

  _computeStyle(color) {
    color = color || 'reset';
    return (color === 'reset') ?
      {color, open: '', close: ''} :
      {
        color,
        open: chalk[color]('foo').replace(/foo.+$/, ''),
        close: chalk[color]('foo').replace(/^.+foo/, ''),
      };
  }

  _withStyle(msg) { return this._forcedStyle.open + msg + this._forcedStyle.open; }
}

// Exports
export {
  Gcoghpr,
  main,

  // Exposed for testing purposes only.
  internal as _testing,
};

// Helpers
function _httpsGet(...args) {
  return httpsGet(...args);
}

function _rlCreateInterface(...args) {
  return createInterface(...args);
}

function main(runtimeArgs, config) {
  return new Gcoghpr().run(runtimeArgs, config);
}
