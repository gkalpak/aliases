'use strict';

// Imports
const inquirer = require('inquirer');
const runner = require('./runner');
const utils = require('./utils');

// Exports
/**
 * @function gbp
 *
 * @description
 * Prompt the user to pick one of the available git branches via an interactive list.
 *
 * @param {RunConfig} [config={}] - A configuration object. See {@link runner#RunConfig} for more details.
 *
 * @return {Promise<void>} - A promise that resolves once the selected branch has been printed.
 */
module.exports = _gbp;

// Functions - Definitions
function _gbp(config) {
  const gbConfig = Object.assign({}, config, {returnOutput: true});

  if (config.dryrun) {
    console.log('Pick one from {{git branch}}');
    return Promise.resolve();
  }

  return runner.run('git branch', [], gbConfig).
    then(output => pickBranch(output)).
    then(branch => console.log(branch)).
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
    map(branch => branch.replace(/^\*\s*(.*)$/, (_, g) => currentBranch = `${g}${currentSuffix}`));

  return inquirer.
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
}
