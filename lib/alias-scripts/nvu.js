'use strict';

// Imports
const {commandUtils} = require('@gkalpak/cli-utils');
const chalk = require('chalk');
const utils = require('../utils');

// Constants
const PLATFORM_WINDOWS = 'win32';

// Exports
const exps = module.exports = {
  /**
   * @function nvu
   *
   * @description
   * Switch to the latest Node.js version that matches `branch` (passed as the 1st argument).
   *
   * @example
   * For example, assuming the following installed versions:
   * - 6.4.4
   * - 6.11.0
   * - 6.11.1
   * - 8.2.0
   * - 8.2.1
   *
   * ```
   * # Switches to v6.11.1
   * nvu 6
   *
   * # Switches to v6.4.4
   * nvu 6.4
   *
   * # Switches to v8.2.1
   * nvu 8
   * ```
   *
   * @param {string[]} runtimeArgs - The runtime arguments that will be used for substituting. The 1st argument is
   *     required and denotes the version branch to switch to.
   * @param {IRunConfig} [config={}] - A configuration object. See {@link commandUtils#IRunConfig} for more details.
   *
   * @return {Promise<void>} - A promise that resolves once switched to the new Node.js version.
   */
  nvu: _nvu,

  main: __main,
};

// Functions - Definitions
function __main(runtimeArgs, config) {
  return exps.nvu(runtimeArgs, config);
}

function _nvu(runtimeArgs, config) {
  const branch = runtimeArgs[0];
  const nvmRuntimeArgs = runtimeArgs.slice(1);
  const buildCmd = getBuildCmdFn(utils.getPlatform(), config.dryrun);

  return buildCmd(branch, nvmRuntimeArgs, config).then(cmd => {
    if (config.dryrun) {
      console.log(cmd);
      return Promise.resolve();
    }

    return commandUtils.run(cmd, nvmRuntimeArgs, config);
  });
}

function buildCmdDefault(branch, runtimeArgs) {
  const hasChainedCmd = runtimeArgs.indexOf('&&') !== -1;

  const nvuCmd = `nvu ${branch} "&&" <some-command>`;
  const nvmCmd = `nvm use ${branch}`;
  let warnCmd = '';

  if (!hasChainedCmd) {
    //         10        20        30        40        50        60        70|
    const warning = chalk.yellow(utils.stripIndentation(`
      WARNING:
        Running 'nvu' like this will not affect the current proccess, only the
        spawned child process. You can still execute a single command using
        the specified Node.js version with '${nvuCmd}'.

        To switch the Node.js version for the current process run '${nvmCmd}'.

        Proceeding anyway...
    `));

    // We need two levels of escaping.
    warnCmd = `node --print ${JSON.stringify(JSON.stringify(warning))} && `;
  }

  return Promise.resolve(`${warnCmd}. $NVM_DIR/nvm.sh && ${nvmCmd} $*`);
}

function buildCmdDryrun(platform, branch, nvmRuntimeArgs) {
  const getVersionArgs = (platform === PLATFORM_WINDOWS) ? `${branch}, {{nvls}}` : branch;
  const getVersionSubCmd = `getVersion(${getVersionArgs})`;

  return Promise.resolve(`nvm use {{${getVersionSubCmd}}} ${nvmRuntimeArgs.join(' ')}`.trim());
}

function buildCmdForWindows(branch, runtimeArgs, config) {
  const {ALIASES} = require('../constants');
  const nvlsCmd = ALIASES.node.nvls.getSpec().command;
  const nvlsConfig = Object.assign({}, config, {returnOutput: true});

  return commandUtils.
    run(nvlsCmd, [], nvlsConfig).
    then(nvlsOutput => {
      const subVersionCount = 3 - branch.split('.').length;
      const versionRe = new RegExp(`(?:^|\\D)(${branch}(?:\\.\\d+){${subVersionCount}})`);
      const versionArr = nvlsOutput.
        split('\n').
        map(line => versionRe.exec(line)).
        filter(Boolean).
        map(match => match[1].split('.').map(Number)).
        sort(sortVersionArrays).
        pop();

      if (!versionArr) {
        throw new Error(`No installed Node.js version found for '${branch}'.`);
      }

      return `nvm use ${versionArr.join('.')} $*`;
    });
}

function getBuildCmdFn(platform, dryrun) {
  if (dryrun) return buildCmdDryrun.bind(null, platform);

  switch (platform) {
    case PLATFORM_WINDOWS:
      return buildCmdForWindows;
    default:
      return buildCmdDefault;
  }
}

function sortVersionArrays(a, b) {
  for (let i = 0, ii = a.length; i < ii; ++i) {
    const diff = a[i] - b[i];
    if (diff) return diff;
  }

  return 0;
}
