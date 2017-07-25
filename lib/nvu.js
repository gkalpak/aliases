'use strict';

// Imports
const {run} = require('./runner');
const {onError} = require('./utils');

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
 * @param {RunConfig} [config={}] - A configuration object. See {@link runner#RunConfig} for more details.
 *
 * @return {Promise<void>} - A promise that resolves once switched to the new Node version (or rejects on error).
 */
module.exports = _nvu;

// Functions - Definitions
function _nvu(runtimeArgs, config) {
  const branch = runtimeArgs.shift();
  const nvlsConfig = Object.assign({returnOutput: true}, config);
  const processFn = getProcessFn(process.platform);

  if (config.dryrun) {
    console.log(`nvm use {{getVersion('${branch}',{{nvls}})}}`);
    return Promise.resolve();
  }

  return run('nvls', [], nvlsConfig).
    then(output => processFn(branch, output)).
    then(cmd => run(cmd, runtimeArgs, config)).
    catch(onError);
}

function getProcessFn(platform) {
  switch (platform) {
    case PLATFORM_WINDOWS:
      return processOnWindows;
    default:
      return processDefault;
  }
}

function processDefault(branch) {
  return `. $NVM_DIR/nvm.sh && nvm use ${branch} $*`;
}

function processOnWindows(branch, output) {
  const versionRe = new RegExp(`(?:^|\\D)(${branch}(?:\\.\\d+){0,2})`);
  const targetLine = output.
    split('\n').
    filter(line => versionRe.test(line)).
    pop();

  if (!targetLine) {
    throw new Error(`No installed Node version found for '${branch}'.`);
  }

  const version = versionRe.exec(targetLine)[1];
  const cmd = `nvm use ${version} $*`;

  return cmd;
}
