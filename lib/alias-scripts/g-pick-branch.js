// Imports
import {commandUtils, processUtils} from '@gkalpak/cli-utils';

import {importWithEnv} from '../utils.js';


// Constants
const branchNameSuffices = {
  '': '',
  '*': ' (current)',
  '+': ' (other worktree)',
};
const internal = {
  _gPickBranch,
};

// Exports
export {
  /**
   * @function gPickBranch
   *
   * @description
   * Prompt the user to pick one of the available git branches via an interactive list. By default, local branches are
   * shown, but this can be optionally switched to remote branches only. Supported runtime arguments:
   * - `--remote` [flag]: Only show remote branches when present (otherwise only show local branches).
   *
   * @param {string[]} [runtimeArgs=[]] - The runtime arguments.
   * @param {IRunConfig} [config={}] - A configuration object. See {@link commandUtils#IRunConfig} for more details.
   *
   * @return {Promise<void|string>} - A promise that resolves to either `undefined` or the selected branch (depending on
   *     the value of `config.returnOutput`). When switched to remote branches only the selected branch consists of the
   *     remote name, followed by a space, followed by the actual branch name (for example, `origin some-branch`).
   */
  gPickBranch,

  main,

  // Exposed for testing purposes only.
  internal as _testing,
};

// Helpers
async function _gPickBranch(runtimeArgs = [], config = {}) {
  const gbConfig = Object.assign({}, config, {returnOutput: true});
  const branchType = runtimeArgs.includes('--remote') ? 'remote' : 'local';

  if (config.dryrun) {
    console.log(`Pick one from a list of ${branchType} branches.`);
    return;
  }

  const branchOutput = await commandUtils.run('git branch --all', [], gbConfig);
  const branches = processBranches(branchOutput).filter(({remote}) => remote === (branchType === 'remote'));
  const branch = await pickBranch(branchType, branches);

  if (config.returnOutput) {
    return branch;
  }

  console.log(branch);
}

function gPickBranch(runtimeArgs, config) {
  return internal._gPickBranch(runtimeArgs, config);
}

function main(runtimeArgs, config) {
  return gPickBranch(runtimeArgs, config);
}

async function pickBranch(branchType, branches) {
  // Ensure colors are always used (even when running with `returnOutput: <number>`).
  const {default: inquirer} = await importWithEnv(() => import('inquirer'), {FORCE_COLOR: '1'});

  const currentBranchIdx = Math.max(0, branches.findIndex(({name}) => name.endsWith(branchNameSuffices['*'])));

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
        message: `Pick a ${branchType} branch:`,
        choices: branches.concat(new inquirer.Separator()),
        default: currentBranchIdx,
      },
    ]);

    return branch;
  } finally {
    unlisten();
  }
}

function processBranches(branchesStr) {
  return branchesStr.
    split('\n').
    map(line => line.trim()).
    // Filter out empty lines and `HEAD` "aliases".
    filter(line => (line.length > 0) && !line.includes('/HEAD -> ')).
    map(branch => {
      const [, specialSymbol = '', remote = false, branchName] = /^(?:([*+])\s*)?(remotes\/)?(\S.*)$/.exec(branch);
      const branchNameSuffix = branchNameSuffices[specialSymbol];

      if (branchNameSuffix === undefined) {
        throw new Error(`Unexpected branch prefix symbol: ${specialSymbol}`);
      }

      const displayName = branchName.replace(/^(gcoghpr)-(.*)$/, '[$1] $2') + branchNameSuffix;
      const isRemote = remote !== false;

      return {
        name: displayName,
        short: branchName,
        value: isRemote ? branchName.replace('/', ' ') : branchName,
        remote: isRemote,
      };
    }).
    sort((a, b) => (a.name > b.name) ? 1 : -1);
}
