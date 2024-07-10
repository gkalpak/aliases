// Imports
import {commandUtils, processUtils} from '@gkalpak/cli-utils';

import {importWithEnv} from '../utils.js';


// Constants
const internal = {
  _gPickCommit,
};

// Exports
export {
  /**
   * @function gPickCommit
   *
   * @description
   * Prompt the user to pick one of the available git commits via an interactive list. Optionally, filter the commits
   * based on the commit message. Supported runtime arguments:
   * - `--filter-commits` [string]: A basic pattern to filter commit messages (case-sensitive).
   *
   * @param {string[]} [runtimeArgs=[]] - The runtime arguments.
   * @param {IRunConfig} [config={}] - A configuration object. See {@link commandUtils#IRunConfig} for more details.
   *
   * @return {Promise<void|string>} - A promise that resolves to either `undefined` or the selected commit (depending on
   *     the value of `config.returnOutput`).
   */
  gPickCommit,

  main,

  // Exposed for testing purposes only.
  internal as _testing,
};

// Helpers
async function _gPickCommit(runtimeArgs = [], config = {}) {
  const maxCommits = 50;
  const glConfig = Object.assign({}, config, {returnOutput: true});
  let glCmd = 'git log --oneline';

  const filterCommitsPattern =
      (runtimeArgs.find((_arg, idx, arr) => (idx > 0) && (arr[idx - 1] === '--filter-commits')) ??
      runtimeArgs.find(arg => arg.startsWith('--filter-commits='))?.slice('--filter-commits='.length))?.
        replace(/^(['"])(.*)\1$/, '$2');
  if (filterCommitsPattern !== undefined) {
    glCmd += ` | grep "${filterCommitsPattern}"`;
  }

  glCmd += ` --max-count=${maxCommits}`;  // `--max-count` works both for `git log` and `grep`.

  if (config.dryrun) {
    console.log(
        `Pick one from the first ${maxCommits} commits` +
        `${(filterCommitsPattern === undefined) ? '' : ` whose header matches '${filterCommitsPattern}'`}.`);
    return;
  }

  const commitOutput = await commandUtils.run(glCmd, [], glConfig);
  const commit = await pickCommit(commitOutput);

  if (config.returnOutput) {
    return commit;
  }

  console.log(commit);
}

function gPickCommit(runtimeArgs, config) {
  return internal._gPickCommit(runtimeArgs, config);
}

function main(runtimeArgs, config) {
  return gPickCommit(runtimeArgs, config);
}

async function pickCommit(commitsStr) {
  // Ensure colors are always used (even when running with `returnOutput: <number>`).
  const {default: inquirer} = await importWithEnv(() => import('inquirer'), {FORCE_COLOR: '1'});

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

  try {
    const {commit} = await inquirer.prompt([
      {
        type: 'list',
        name: 'commit',
        message: 'Pick a commit:',
        choices: commits,
        default: 0,
      },
    ]);

    return commit.replace(/\s+.*$/, '');
  } finally {
    unlisten();
  }
}
