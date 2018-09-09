'use strict';

// Imports
const {commandUtils, processUtils} = require('@gkalpak/cli-utils');
const utils = require('./utils');

// Ensure colors are always used (even when running with `returnOutput: <number>`).
const inquirer = utils.requireWithEnv('inquirer', process.env, {FORCE_COLOR: '1'});

// Exports
/**
 * @function gPickBranch
 *
 * @description
 * Prompt the user to pick one of the available git branches via an interactive list.
 *
 * @param {IRunConfig} [config={}] - A configuration object. See {@link CommandUtils#IRunConfig} for more details.
 *
 * @return {Promise<void|string>} - A promise that resolves to either `undefined` or the selected branch (depending on
 *     the value of `config.returnOutput`).
 */
module.exports = _gPickBranch;

// Functions - Definitions
function _gPickBranch(config) {
  const gbConfig = Object.assign({}, config, {returnOutput: true});

  if (config.dryrun) {
    console.log('Pick one from a list of branches.');
    return Promise.resolve();
  }

  return commandUtils.run('git branch', [], gbConfig).
    then(output => pickBranch(output)).
    then(branch => config.returnOutput ? branch : console.log(branch)).
    catch(utils.onError);
}

function pickBranch(branchesStr) {
  const currentSuffix = ' (current)';
  const currentRe = / \(current\)$/;

  let currentBranch;
  const branches = branchesStr.
    split('\n').
    map(line => line.trim()).
    filter(Boolean).
    map(branch => branch.replace(/^\*\s*(.*)$/, (_, g) => currentBranch = `${g}${currentSuffix}`)).
    concat(new inquirer.Separator());

  const unlisten = processUtils.doOnExit(process, code => {
    if (code === 0) {
      // On some OSes (e.g. Ubuntu), abruptly terminating the process via `Ctrl+C` (or other similar method),
      // exits the current sub-process (with a 0) and not the parent process.
      // We need to detect this and explicitly exit the sub-process with an error, so that chained execution stops.
      process.exit(1);
    }
  });

  const promise = inquirer.
    prompt([
      {
        type: 'list',
        name: 'branch',
        message: 'Pick a branch:',
        choices: branches,
        default: currentBranch,
      },
    ]).
    then(({branch}) => branch.replace(currentRe, ''));

  return utils.finallyAsPromised(promise, unlisten);
}
