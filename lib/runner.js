'use strict';

// Imports
const childProcess = require('child_process');
const stream = require('stream');
const utils = require('./utils');

// Variables
let aliasNames;

// Exports
const runner = module.exports = {
  /**
   * A configuration object, specifying the behavior of {@link runner#run run()}.
   * @typedef {Object} RunConfig
   * @property {boolean} debug - If true, produce verbose, debug-friendly output.
   *     (Default: false)
   * @property {boolean} dryrun - If true, print the command instead of actually running it.
   *     (Default: false)
   *     NOTE: This is still an experimental feature and not guaranteed to work as expected.
   * @property {boolean|Number} returnOutput - If true, return the output of the command instead of printing it to
   *     stdout. If a number (`n`), print the output to stdout, but also return the `n` last lines (ignoring trailing
   *     whitespace).
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

  /** Exposed for testing purposes only. */
  _expandCmd: expandCmd,

  /** Exposed for testing purposes only. */
  _spawnAsPromised: spawnAsPromised,
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
  return runner._expandCmd(cmd, runtimeArgs, config).then(expandedCmd => {
    if (config.debug) {
      console.log(`Input command: '${cmd}'`);
      console.log(`Expanded command: '${expandedCmd}'`);
    }
    return runner._spawnAsPromised(expandedCmd, config);
  });
}

function expandCmd(cmd, runtimeArgs, config) {
  // 1: leading \s
  // 2, 4: $*
  // 3, 5: $\d+
  // 6: default/fallback value (possibly with `returnOutput` limit)
  const re = /(\s{0,1})\$(?:(\*)|(\d+)|{(?:(?:(\*)|(\d+))(?::([^}]*))?)})/g;
  const cmdPromises = {};

  let expandedCmd = cmd.replace(re, (_, g1, g2, g3, g4, g5, g6) => {
    const valToReplacement = val => !val ? '' : `${g1}${val}`;

    // Value based on the supplied arguments.
    let value = (g2 || g4) ? runtimeArgs.join(' ') : runtimeArgs[(g3 || g5) - 1];

    // No argument(s), fall back to default.
    if (!value && g6) {
      const match = /^`(.+)`$/.exec(g6);

      if (!match) {
        // It is a plain ol' fallback value.
        value = g6;
      } else {
        // It is a command.
        let returnOutput = true;
        const cmd = match[1].replace(/ --al-returnOutput=(\d+)$/, (_, g) => {
          returnOutput = Number(g);
          return '';
        });
        const placeholder = Math.random();
        const runConfig = Object.assign({}, config, {returnOutput});

        cmdPromises[cmd] = (cmdPromises[cmd] || doRun(cmd, runtimeArgs, runConfig)).
          then(result => result.trim()).
          then(result => {
            const repl = valToReplacement(runConfig.dryrun ? `{{${result.replace(/\s/g, '_')}}}` : result);
            expandedCmd = expandedCmd.replace(placeholder, repl);
            return result;
          });

        return placeholder;
      }
    }

    return valToReplacement(value);
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
  const cleanUp = () => {
    if (debug) {
      console.log('  Reseting the output and cursor styles.');
    }

    // Reset the output style (e.g. bold) and show the cursor.
    process.stdout.write('\u001b[0m');
    process.stdout.write('\u001b[?25h');
  };
  const cancelCleanUp = utils.doOnExit(process, cleanUp);
  const onDone = () => {
    cancelCleanUp();
    cleanUp();
  };

  const promise = new Promise((resolve, reject) => {
    let data = '';

    const getReturnData = (typeof returnOutput !== 'number') ?
      () => data :
      () => data.trim().split('\n').slice(-returnOutput).join('\n');

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
          if (isLast) return resolve(getReturnData());
        });

      if (prevStdout) prevStdout.pipe(proc.stdin);

      return proc.stdout;
    }, null);

    if (returnOutput) {
      const outputStream = new stream.PassThrough();
      outputStream.on('data', d => data += d);
      lastStdout.pipe(outputStream);

      if (returnOutput !== true) {
        outputStream.pipe(process.stdout);
      }
    }
  });

  return utils.finallyAsPromised(promise, onDone);
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
