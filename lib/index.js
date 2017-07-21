#!/usr/bin/env node
'use strict';

// Imports
const {spawn} = require('child_process');
const {ALIASES, VERSION_STAMP} = require('./constants');

// Exports
module.exports = {
  help: _help,
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
        '(You can pass `--debug` to any command for debug-friendly output.)',
        '',
      ].join('\n');

      console.log(message);
    }).
    catch(onError);
}

function _run(cmd) {
  const args = process.argv.slice(2).filter(arg => arg !== '--debug');
  const debugMode = process.argv.length - args.length > 2;
  const expandedCmd = expandCmd(cmd, args);

  if (debugMode) {
    console.log(`Input command: '${cmd}'`);
    console.log(`Expanded command: '${expandedCmd}'`);
  }

  return spawnAsPromised(expandedCmd, debugMode).catch(onError);
}

function capitalize(str) {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}

function expandCmd(cmd, args) {
  // 1, 3: $*
  // 2, 4: $\d+
  // 5: default/fallback value
  const re = /\$(?:(\*)|(\d+)|{(?:(?:(\*)|(\d+))(?::([^}]*))?)})/g;
  const quote = arg => /\s/.test(arg) ? `"${arg}"` : arg;
  args = args.map(quote);

  return cmd.replace(re, (_, g1, g2, g3, g4, g5) =>
    ((g1 || g3) ? args.join(' ') : args[(g2 || g4) - 1]) || quote(g5) || '');
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

function onError(err) {
  console.error(err);
  process.exit(1);
}

function padRight(str, len) {
  return `${str}${' '.repeat(len - str.length)}`;
}

function parseSingleCmd(cmd) {
  const tokens = cmd.
    split('"').
    reduce((arr, str, idx) => {
      const newTokens = (idx % 2) ? [`"${str}"`] : str.split(' ');
      const lastToken = arr[arr.length - 1];

      if (lastToken) arr[arr.length - 1] += newTokens.shift();

      return arr.concat(newTokens);
    }, []).
    filter(Boolean);

  return {
    executable: tokens.shift(),
    args: tokens,
  };
}

function spawnAsPromised(rawCmd, debugMode) {
  return new Promise((resolve, reject) => {
    const pipedCmdSpecs = rawCmd.
      split(/\s+\|\s+/).
      map(cmd => parseSingleCmd(cmd));

    pipedCmdSpecs.reduce((prevStdout, cmdSpec, idx, arr) => {
      const isLast = idx === arr.length - 1;

      const executable = cmdSpec.executable;
      const args = cmdSpec.args;
      const options = {
        shell: true,
        stdio: [
          prevStdout ? 'pipe' : 'inherit',
          isLast ? 'inherit' : 'pipe',
          'inherit',
        ],
      };

      if (debugMode) {
        console.log(`  Running: '${executable}', '${args}', (stdio: ${options.stdio})`);
      }

      const proc = spawn(executable, args, options).
        on('error', reject).
        on('exit', (code, signal) => {
          if (code !== 0) return reject(code || signal);
          if (isLast) return resolve();
        });

      if (prevStdout) prevStdout.pipe(proc.stdin);

      return proc.stdout;
    }, null);
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
