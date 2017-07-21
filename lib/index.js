#!/usr/bin/env node
'use strict';

// Imports
const {spawn} = require('child_process');
const {PassThrough} = require('stream');
const {ALIASES, VERSION_STAMP} = require('./constants');

// Variables
const aliasNames = Object.keys(ALIASES).
  map(group => Object.keys(ALIASES[group])).
  reduce((aggr, arr) => aggr.concat(arr)).
  sort();

// Exports
module.exports = {
  /**
   * @function help
   *
   * @description
   * Print a help message, including:
   * - The version of the package.
   * - All available aliases and the asociated commands.
   * - Special, "universal" arguments.
   *
   * @return {Promise<void>} - A promise that resolves once the message has been printed.
   */
  help: _help,

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
   * @param {string} cmd - The command to run. Could be a complex command with `|`, `&&` and `||` (but not guaranteed to
   *     work if too complex :)).
   * @param {{[option: string]: boolean}} [config={}] - A configuration object. Available options to configure:
   *     - `debug`: If true, produce verbose, debug-friendly output. (Default: false)
   *     - `dryrun`: If true, print the commands instead of actually running them (hopefully). (Default: false)
   *                 NOTE: This is still an experimental feature and not guaranteed to work as expected.
   *     - `returnOutput`: If true, return the output of the command instead of printing it to stdout.
   *
   * @return {Promise<string>} - A promise that resolves once the command has been executed. The resolved value is
   *     either an empty string or the output of the command (if `returnOutput` is true).
   */
  run: _run,
};

// Run
if (require.main === module) {
  _help();
}

// Functions - Definitions
function _help() {
  return Promise.resolve().
    then(() => {
      const sep = '~'.repeat(75);
      const joiner = '  -->  ';
      const message = [
        '',
        versionHeader(),
        '',
        ' Available aliases',
        '===================',
        '',
        Object.keys(ALIASES).
          map(name => helpForGroup(name, ALIASES[name], joiner)).
          join(`\n${sep}\n\n`),
        sep,
        '',
        'All aliases also accept the following arguments:',
        '--al-debug:  Produce verbose, debug-friendly output.',
        '--al-dryrun: Print the commands instead of actually running them (hopefully).',
        '',
      ].join('\n');

      console.log(message);
    }).
    catch(onError);
}

function _run(cmd, config) {
  return doRun(cmd, config || {}).catch(onError);
}

function capitalize(str) {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
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

function doRun(cmd, config) {
  const alArgRe = /^--al-(?=[a-z])/;
  const args = process.argv.slice(2).filter(arg => {
    if (alArgRe.test(arg)) {
      const option = arg.replace(alArgRe, '');
      if (!config.hasOwnProperty(option)) {
        config[option] = true;
      }
      return false;
    }
    return true;
  });

  return expandCmd(cmd, args, config).then(expandedCmd => {
    if (config.debug) {
      console.log(`Input command: '${cmd}'`);
      console.log(`Expanded command: '${expandedCmd}'`);
    }
    return spawnAsPromised(expandedCmd, config);
  });
}

function expandCmd(cmd, args, config) {
  // 1, 3: $*
  // 2, 4: $\d+
  // 5: default/fallback value
  const re = /\$(?:(\*)|(\d+)|{(?:(?:(\*)|(\d+))(?::([^}]*))?)})/g;
  const quote = arg => /\s/.test(arg) ? `"${arg}"` : arg;
  const runConfig = Object.assign({}, config, {returnOutput: true});
  const cmdPromises = {};

  args = args.map(quote);
  let expandedCmd = cmd.replace(re, (_, g1, g2, g3, g4, g5) => {
    // Value based on the supplied arguments.
    let value = (g1 || g3) ? args.join(' ') : args[(g2 || g4) - 1];

    // No argument(s), fall back to default.
    if (!value && g5) {
      const match = /^`(.+)`$/.exec(g5);

      if (!match) {
        // It is a plain ol' fallback value.
        value = quote(g5);
      } else {
        // It is a command.
        const cmd = match[1];
        const placeholder = Math.random();

        cmdPromises[cmd] = (cmdPromises[cmd] || doRun(cmd, runConfig)).
          then(result => result.trim()).
          then(result => {
            const repl = runConfig.dryrun ? `{{ ${result.replace(/\s/g, '_')}) }}` : result;
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

function helpForGroup(groupName, groupSpec, joiner) {
  const maxNameLen = Math.max.apply(Math, Object.keys(groupSpec).map(a => a.length));
  const indent1 = ' '.repeat(2);
  const indent2 = indent1.length + maxNameLen + joiner.length;

  return [
    `${capitalize(groupName)} aliases:`,
    '',
    Object.keys(groupSpec).
      map(name => ({name, spec: groupSpec[name]})).
      map(({name, spec}) => [padRight(name, maxNameLen), wrapLine(spec.desc || spec, indent2)]).
      map(([name, desc]) => `${indent1}${name}${joiner}${desc}`).
      join('\n'),
    '',
  ].join('\n');
}

function insertAfter(newItem, afterItem, arr) {
  for (let i = 0; i < arr.length; ++i) {
    if (arr[i] === afterItem) {
      checkInsertAt(newItem, i + 1, arr);
    }
  }
}

function onError(err) {
  console.error('Error:', err);
  process.exit(1);
}

function padRight(str, len) {
  return `${str}${' '.repeat(len - str.length)}`;
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
    checkInsertAt('echo', 0, tokens);
    insertAfter('echo', '&&', tokens);
    insertAfter('echo', '||', tokens);
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

      const proc = spawn(executable, args, options).
        on('error', reject).
        on('exit', (code, signal) => {
          if (code !== 0) return reject(code || signal);
          if (isLast) return resolve(data);
        });

      if (prevStdout) prevStdout.pipe(proc.stdin);

      return proc.stdout;
    }, null);

    if (returnOutput) {
      const outputStream = new PassThrough();
      outputStream.on('data', d => data += d);
      lastStdout.pipe(outputStream);
    }
  });
}

function versionHeader() {
  const versionLine = `|  ${VERSION_STAMP}  |`;
  const len = versionLine.length - 2;
  const outerLine = ` ${'-'.repeat(len)} `;
  const innerLine = `|${' '.repeat(len)}|`;

  return [
    outerLine,
    innerLine,
    versionLine,
    innerLine,
    outerLine,
  ].join('\n');
}

function wrapLine(line, indentLen) {
  const limit = 75;

  if (line.length <= limit) {
    return line;
  }

  const extraIndentLen = 2;
  const extraIndent = ' '.repeat(extraIndentLen);
  const indent = ' '.repeat(indentLen);
  const sep = Date.now() + Math.random();
  const re = RegExp(/\s&&/.test(line) ? '(\\s)(&&)' : `(.{${limit},}?\\s)()`, 'g');

  let lines = line.replace(re, `$1${sep}$2`).split(sep).filter(Boolean);
  if (lines.length > 1) {
    lines = lines.map(l => wrapLine(l, indentLen + extraIndentLen));
  }

  return lines.join(`\n${indent}${extraIndent}`);
}
