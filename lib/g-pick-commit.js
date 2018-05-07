'use strict';

// Imports
const inquirer = require('inquirer');
const runner = require('./runner');
const utils = require('./utils');

// Exports
/**
 * @function gPickCommit
 *
 * @description
 * Prompt the user to pick one of the available git commits via an interactive list.
 *
 * @param {RunConfig} [config={}] - A configuration object. See {@link runner#RunConfig} for more details.
 *
 * @return {Promise<void>} - A promise that resolves once the selected commit has been printed.
 */
module.exports = _gPickCommit;

// Functions - Definitions
function _gPickCommit(config) {
  const glConfig = Object.assign({}, config, {returnOutput: true});

  if (config.dryrun) {
    console.log('Pick one from a list of commits.');
    return Promise.resolve();
  }

  return runner.run('git log --oneline -50', [], glConfig).
    then(output => pickCommit(output)).
    then(commit => console.log(commit)).
    catch(utils.onError);
}

function pickCommit(commitsStr) {
  const commits = commitsStr.
    split('\n').
    map(line => line.trim()).
    filter(Boolean).
    concat(new inquirer.Separator());

  const unlisten = utils.doOnExit(process, code => {
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
        name: 'commit',
        message: 'Pick a commit:',
        choices: commits,
        default: 0,
      },
    ]).
    then(({commit}) => commit.replace(/\s+.*$/, ''));

  return utils.finallyAsPromised(promise, unlisten);
}