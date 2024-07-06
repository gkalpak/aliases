// Imports
import {commandUtils, processUtils} from '@gkalpak/cli-utils';

import {importWithEnv} from '../utils.js';


// Constants
const internal = {
  _gPickBranch,
};

// Exports
export {
  /**
   * @function gPickBranch
   *
   * @description
   * Prompt the user to pick one of the available git branches via an interactive list.
   *
   * @param {IRunConfig} [config={}] - A configuration object. See {@link commandUtils#IRunConfig} for more details.
   *
   * @return {Promise<void|string>} - A promise that resolves to either `undefined` or the selected branch (depending on
   *     the value of `config.returnOutput`).
   */
  gPickBranch,

  main,

  // Exposed for testing purposes only.
  internal as _testing,
};

// Helpers
async function _gPickBranch(config) {
  const gbConfig = Object.assign({}, config, {returnOutput: true});

  if (config.dryrun) {
    console.log('Pick one from a list of branches.');
    return;
  }

  const branchOutput = await commandUtils.run('git branch', [], gbConfig);
  const branch = await pickBranch(branchOutput);

  if (config.returnOutput) {
    return branch;
  }

  console.log(branch);
}

function gPickBranch(config) {
  return internal._gPickBranch(config);
}

function main(_runtimeArgs, config) {
  return gPickBranch(config);
}

async function pickBranch(branchesStr) {
  // Ensure colors are always used (even when running with `returnOutput: <number>`).
  const {default: inquirer} = await importWithEnv(() => import('inquirer'), {FORCE_COLOR: '1'});

  let currentBranchIdx = 0;
  const branches = branchesStr.
    split('\n').
    map(line => line.trim()).
    filter(Boolean).
    map((branch, i) => {
      const [, specialSymbol = '', branchName] = /^(?:([*+])\s*)?(\S.*)$/.exec(branch);
      let displayName = branchName.replace(/^(gcoghpr)-(.*)$/, '[$1] $2');

      switch (specialSymbol) {
        case '':
          break;
        case '*':
          currentBranchIdx = i;
          displayName += ' (current)';
          break;
        case '+':
          displayName += ' (other worktree)';
          break;
        default:
          throw new Error(`Unexpected branch prefix symbol: ${specialSymbol}`);
      }

      return {
        name: displayName,
        value: branchName,
        short: branchName,
      };
    }).
    sort((a, b) => (a.name > b.name) ? 1 : -1).
    concat(new inquirer.Separator());

  const unlisten = processUtils.doOnExit(process, code => {
    if (code === 0) {
      // On some OSes (e.g. Ubuntu), abruptly terminating the process via `Ctrl+C` (or other similar method),
      // exits the current sub-process (with a 0) and not the parent process.
      // We need to detect this and explicitly exit the sub-process with an error, so that chained execution stops.
      process.exit(1);
    }
  });

  try {
    const {branch} = await inquirer.prompt([
      {
        type: 'list',
        name: 'branch',
        message: 'Pick a branch:',
        choices: branches,
        default: currentBranchIdx,
      },
    ]);

    return branch;
  } finally {
    unlisten();
  }
}
