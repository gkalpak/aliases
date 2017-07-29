'use strict';

// Imports
const childProcess = require('child_process');
const stream = require('stream');
const utils = require('./utils');

// Variables
let aliasNames;

// Exports
module.exports = {
  /**
   * A configuration object, specifying the behavior of {@link runner#run run()}.
   * @typedef {Object} RunConfig
   * @property {boolean} debug - If true, produce verbose, debug-friendly output.
   *     (Default: false)
   * @property {boolean} dryrun - If true, print the command instead of actually running it.
   *     (Default: false)
   *     NOTE: This is still an experimental feature and not guaranteed to work as expected.
   * @property {boolean} returnOutput - If true, return the output of the command instead of printing it to stdout.
   *     (Default: false)
   */

  /**
   * @function preprocessArgs
   *
   * @description
   * Preprocess a list of input arguments (e.g. `process.argv.slice(2)`) into a list of arguments that can be used for
   * substituting into commands (i.e. filtering out `--al-` arguments and wrapping remaining argument in double-quotes,
   * if necessary). Also, derive a {@link runner#RunConfig configuration object} (based on `--al-` arguments) to modify
   * the behavior of {@link runner#run run()} (e.g. enable debug output).
   *
   * @param {string[]} rawArgs - The input arguments that will be preprocessed.
   *
   * @return {{args: string[], config: RunConfig}} result - An object contaning a list of arguments that can be used for
   *     substituting and a {@link runner#RunConfig configuration object}.
   */
  preprocessArgs: _preprocessArgs,

  /**
   * @function run
   *
   * @description
   * Run a command. Could be a complex command with `|`, `&&` and `||` (but not guaranteed to work if too complex :)).
   *
   * It supports argument substitution (independently of the underlying OS) and default/fallback arguments (specified
   * either as static values or as commands to execute and use the output). The following rules apply:
   * - `$*`, `${*}`: Substitute with all arguments (if any).
   * - `$n`, `${n}`: Substitute with the nth argument (if specified), where `n` is a positive integer.
   * - `${*:value}`, `${n:value}`: Substitute with all arguments (`*`) or the nth argument (`n`). If not specified,
   *   substitute with `value`.
   * - `${*:\`command\`}`, `${n:\`command\`}`: Substitute with all arguments (`*`) or the nth argument (`n`). If not
   *   specified, run `command` and substitute with its trimmed output.
   *
   * Hint: `${0:\`command\`}` will always be substituted with the output of `command`. This is useful when you want to
   *       always use the output of `command` in an OS-independent way.
   *
   * You can use {@link runner#preprocessArgs preprocessArgs()} to obtain the basic `runtimeArgs` and `config` values.
   * For example: `preprocessArgs(process.argv.slice(2))`.
   *
   * @param {string} cmd - The command to run. Could be a complex command with `|`, `&&` and `||` (but not guaranteed to
   *     work if too complex :)).
   * @param {string[]} [runtimeArgs=[]] - The runtime arguments that will be used for substituting.
   * @param {RunConfig} [config={}] - A configuration object. See {@link runner#RunConfig} for more details.
   *
   * @return {Promise<string>} - A promise that resolves once the command has been executed. The resolved value is
   *     either an empty string or the output of the command (if `returnOutput` is true).
   */
  run: _run,
};

// Functions - Definitions
function _preprocessArgs(rawArgs) {
  const alArgRe = /^--al-(?=[a-z])/;
  const quoteIfNecessary = arg => /\s/.test(arg) ? `"${arg}"` : arg;

  const config = Object.create(null);
  const args = rawArgs.
    filter(arg => !(alArgRe.test(arg) && (config[arg.replace(alArgRe, '')] = true))).
    map(quoteIfNecessary);

  return {args, config};
}

function _run(cmd, runtimeArgs, config) {
  return doRun(cmd, runtimeArgs || [], config || {}).catch(utils.onError);
}

function checkInsertAt(newItem, idx, arr) {
  if (arr[idx] === '(') {
    ++idx;
  }

  if (arr[idx] !== newItem) {
    if (aliasNames.indexOf(arr[idx]) === -1) {
      arr.splice(idx, 0, newItem);
    } else {
      arr.splice(idx + 1, 0, '--al-dryrun');
    }
  }
}

function doRun(cmd, runtimeArgs, config) {
  return expandCmd(cmd, runtimeArgs, config).then(expandedCmd => {
    if (config.debug) {
      console.log(`Input command: '${cmd}'`);
      console.log(`Expanded command: '${expandedCmd}'`);
    }
    return spawnAsPromised(expandedCmd, config);
  });
}

function expandCmd(cmd, runtimeArgs, config) {
  // 1, 3: $*
  // 2, 4: $\d+
  // 5: default/fallback value
  const re = /\$(?:(\*)|(\d+)|{(?:(?:(\*)|(\d+))(?::([^}]*))?)})/g;
  const runConfig = Object.assign({}, config, {returnOutput: true});
  const cmdPromises = {};

  let expandedCmd = cmd.replace(re, (_, g1, g2, g3, g4, g5) => {
    // Value based on the supplied arguments.
    let value = (g1 || g3) ? runtimeArgs.join(' ') : runtimeArgs[(g2 || g4) - 1];

    // No argument(s), fall back to default.
    if (!value && g5) {
      const match = /^`(.+)`$/.exec(g5);

      if (!match) {
        // It is a plain ol' fallback value.
        value = g5;
      } else {
        // It is a command.
        const cmd = match[1];
        const placeholder = Math.random();

        cmdPromises[cmd] = (cmdPromises[cmd] || doRun(cmd, runtimeArgs, runConfig)).
          then(result => result.trim()).
          then(result => {
            const repl = runConfig.dryrun ? `{{${result.replace(/\s/g, '_')}}}` : result;
            expandedCmd = expandedCmd.replace(placeholder, repl);
            return result;
          });

        return placeholder;
      }
    }

    return value || '';
  });

  return Promise.
    all(Object.keys(cmdPromises).map(cmd => cmdPromises[cmd])).
    then(() => expandedCmd);
}

function insertAfter(newItem, afterItem, arr) {
  for (let i = 0; i < arr.length; ++i) {
    if (arr[i] === afterItem) {
      checkInsertAt(newItem, i + 1, arr);
    }
  }
}

function parseSingleCmd(cmd, dryrun) {
  const tokens = cmd.
    split('"').
    reduce((arr, str, idx) => {
      const newTokens = (idx % 2) ? [`"${str}"`] : str.split(' ');
      const lastToken = arr[arr.length - 1];

      if (lastToken) arr[arr.length - 1] += newTokens.shift();

      return arr.concat(newTokens);
    }, []).
    filter(Boolean).
    reduce((arr, str) => {
      if (str[0] === '(') {
        arr.push('(', str.slice(1));
      } else {
        arr.push(str);
      }
      return arr;
    }, []);

  if (dryrun) {
    transformForDryrun(tokens);
  }

  return {
    executable: tokens.shift(),
    args: tokens,
  };
}

function spawnAsPromised(rawCmd, {debug, dryrun, returnOutput}) {
  return new Promise((resolve, reject) => {
    let data = '';

    const pipedCmdSpecs = rawCmd.
      split(/\s+\|\s+/).
      map(cmd => parseSingleCmd(cmd, dryrun));

    const lastStdout = pipedCmdSpecs.reduce((prevStdout, cmdSpec, idx, arr) => {
      const isLast = idx === arr.length - 1;
      const pipeOuput = !isLast || returnOutput;

      const executable = cmdSpec.executable;
      const args = cmdSpec.args;
      const options = {
        shell: true,
        stdio: [
          prevStdout ? 'pipe' : 'inherit',
          pipeOuput ? 'pipe' : 'inherit',
          'inherit',
        ],
      };

      if (debug) {
        console.log(`  Running ${idx + 1}/${arr.length}: '${executable}', '${args}', (stdio: ${options.stdio})`);
      }

      const proc = childProcess.spawn(executable, args, options).
        on('error', reject).
        on('exit', (code, signal) => {
          if (code !== 0) return reject(code || signal);
          if (isLast) return resolve(data);
        });

      if (prevStdout) prevStdout.pipe(proc.stdin);

      return proc.stdout;
    }, null);

    if (returnOutput) {
      const outputStream = new stream.PassThrough();
      outputStream.on('data', d => data += d);
      lastStdout.pipe(outputStream);
    }
  });
}

function transformForDryrun(tokens) {
  if (!aliasNames) {
    const aliases = require('./constants').ALIASES;
    aliasNames = Object.keys(aliases).
      map(category => Object.keys(aliases[category])).
      reduce((aggr, arr) => aggr.concat(arr)).
      sort();
  }

  checkInsertAt('echo', 0, tokens);
  insertAfter('echo', '&&', tokens);
  insertAfter('echo', '||', tokens);
}