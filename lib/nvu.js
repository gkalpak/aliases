'use strict';

// Imports
const {commandUtils} = require('@gkalpak/cli-utils');
const chalk = require('chalk');
const utils = require('./utils');

// Constants
const PLATFORM_WINDOWS = 'win32';

// Exports
/**
 * @function nvu
 *
 * @description
 * Switch to the latest Node version that matches `branch` (passed as the 1st argument).
 * For example, assuming the following installed versions:
 * - 6.4.4
 * - 6.11.0
 * - 6.11.1
 * - 8.2.0
 * - 8.2.1
 *
 * @example
 * // Switches to v6.11.1
 * nvu 6
 *
 * @example
 * // Switches to v6.4.4
 * nvu 6.4
 *
 * @example
 * // Switches to v8.2.1
 * nvu 8
 *
 * @param {string[]} runtimeArgs - The runtime arguments that will be used for substituting. The 1st argument is
 *     required and denotes the version branch to switch to.
 * @param {IRunConfig} [config={}] - A configuration object. See {@link CommandUtils#IRunConfig} for more details.
 *
 * @return {Promise<void>} - A promise that resolves once switched to the new Node version.
 */
module.exports = _nvu;

// Functions - Definitions
function _nvu(runtimeArgs, config) {
  const branch = runtimeArgs[0];
  const nvmRuntimeArgs = runtimeArgs.slice(1);
  const nvlsConfig = Object.assign({}, config, {returnOutput: true});
  const buildCmd = getBuildCmdFn(utils.getPlatform());

  if (config.dryrun) {
    console.log(`nvm use {{getVersion('${branch}',{{nvls}})}} ${nvmRuntimeArgs.join(' ')}`.trim());
    return Promise.resolve();
  }

  return commandUtils.run('nvls', [], nvlsConfig).
    then(nvlsOutput => buildCmd(branch, nvmRuntimeArgs, nvlsOutput)).
    then(cmd => commandUtils.run(cmd, nvmRuntimeArgs, config)).
    catch(utils.onError);
}

function buildCmdDefault(branch, runtimeArgs) {
  const hasChainedCmd = runtimeArgs.indexOf('&&') !== -1;

  const nvuCmd = `nvu ${branch} \\&\\& <some command>`;
  const nvmCmd = `nvm use ${branch}`;
  let warnCmd = '';

  if (!hasChainedCmd) {
    const warning = hasChainedCmd ? '' : chalk.yellow(utils.stripIndentation(`
      WARNING:
        Running 'nvm use' like this will not affect the current proccess, only the spawned child process.
        You can still execute a single command using the specified Node version with '${nvuCmd}'.
        To switch the Node version for the current process run '${nvmCmd}'.
        Proceeding anyway...
    `));
    warnCmd = `node -e "console.warn(\\"${warning.replace(/\n/g, '\\n')}\\")" && `;
  }

  return `${warnCmd}. $NVM_DIR/nvm.sh && ${nvmCmd} $*`;
}

function buildCmdForWindows(branch, runtimeArgs, nvlsOutput) {
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
    throw new Error(`No installed Node version found for '${branch}'.`);
  }

  const version = versionArr.join('.');
  const cmd = `nvm use ${version} $*`;

  return cmd;
}

function getBuildCmdFn(platform) {
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
