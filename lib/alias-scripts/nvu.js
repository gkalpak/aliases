// Imports
import {commandUtils} from '@gkalpak/cli-utils';
import chalk from 'chalk';

import {ALIASES} from '../constants.js';
import {getPlatform, stripIndentation} from '../utils.js';


// Constants
const PLATFORM_WINDOWS = 'win32';
const internal = {
  _nvu,
};

// Exports
export {
  main,

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
  nvu,

  // Exposed for testing purposes only.
  internal as _testing,
};

// Helpers
async function _nvu(runtimeArgs, config) {
  const branch = runtimeArgs[0];
  const nvmRuntimeArgs = runtimeArgs.slice(1);
  const buildCmd = getBuildCmdFn(getPlatform(), config.dryrun);

  const cmd = await buildCmd(branch, nvmRuntimeArgs, config);

  if (config.dryrun) {
    console.log(cmd);
    return;
  }

  return commandUtils.run(cmd, nvmRuntimeArgs, config);
}

async function buildCmdDefault(branch, runtimeArgs) {
  const hasChainedCmd = runtimeArgs.indexOf('&&') !== -1;

  const nvuCmd = `nvu ${branch} "&&" <some-command>`;
  const nvmCmd = `nvm use ${branch}`;
  let warnCmd = '';

  if (!hasChainedCmd) {
    //        1|0       2|0       3|0       4|0       5|0       6|0       7|0
    const warning = chalk.yellow(stripIndentation(`
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

  return `${warnCmd}. $NVM_DIR/nvm.sh && ${nvmCmd} $*`;
}

async function buildCmdDryrun(platform, branch, nvmRuntimeArgs) {
  const getVersionArgs = (platform === PLATFORM_WINDOWS) ? `${branch}, {{nvls}}` : branch;
  const getVersionSubCmd = `getVersion(${getVersionArgs})`;

  return `nvm use {{${getVersionSubCmd}}} ${nvmRuntimeArgs.join(' ')}`.trim();
}

async function buildCmdForWindows(branch, _runtimeArgs, config) {
  const nvlsCmd = ALIASES.node.nvls.getSpec().command;
  const nvlsConfig = Object.assign({}, config, {returnOutput: true});

  const nvlsOutput = await commandUtils.run(nvlsCmd, [], nvlsConfig);

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

function main(runtimeArgs, config) {
  return nvu(runtimeArgs, config);
}

function nvu(runtimeArgs, config) {
  return internal._nvu(runtimeArgs, config);
}

function sortVersionArrays(a, b) {
  for (let i = 0, ii = a.length; i < ii; ++i) {
    const diff = a[i] - b[i];
    if (diff) return diff;
  }

  return 0;
}
