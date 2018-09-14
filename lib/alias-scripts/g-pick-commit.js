'use strict';

// Imports
const {commandUtils, processUtils} = require('@gkalpak/cli-utils');
const utils = require('../utils');

// Ensure colors are always used (even when running with `returnOutput: <number>`).
const inquirer = utils.requireWithEnv('inquirer', process.env, {FORCE_COLOR: '1'});

// Exports
const exps = module.exports = {
  /**
   * @function gPickCommit
   *
   * @description
   * Prompt the user to pick one of the available git commits via an interactive list.
   *
   * @param {IRunConfig} [config={}] - A configuration object. See {@link commandUtils#IRunConfig} for more details.
   *
   * @return {Promise<void|string>} - A promise that resolves to either `undefined` or the selected commit (depending on
   *     the value of `config.returnOutput`).
   */
  gPickCommit: _gPickCommit,

  main: __main,
};

// Functions - Definitions
function __main(_runtimeArgs, config) {
  return exps.gPickCommit(config);
}

function _gPickCommit(config) {
  const glConfig = Object.assign({}, config, {returnOutput: true});

  if (config.dryrun) {
    console.log('Pick one from a list of commits.');
    return Promise.resolve();
  }

  return commandUtils.run('git log --oneline -50', [], glConfig).
    then(output => pickCommit(output)).
    then(commit => config.returnOutput ? commit : console.log(commit));
}

function pickCommit(commitsStr) {
  const commits = commitsStr.
    split('\n').
    map(line => line.trim()).
    filter(Boolean).
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
        name: 'commit',
        message: 'Pick a commit:',
        choices: commits,
        default: 0,
      },
    ]).
    then(({commit}) => commit.replace(/\s+.*$/, ''));

  return utils.finallyAsPromised(promise, unlisten);
}
