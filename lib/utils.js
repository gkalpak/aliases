'use strict';

// Constants
const LINE_LIMIT = 75;
const INDENT_PER_LEVEL = 2;

// Variables
const platform = process.platform;

// Exports
const utils = module.exports = {
  capitalize: _capitalize,
  doOnExit: _doOnExit,
  finallyAsPromised: _finallyAsPromised,
  getAliasCmd: _getAliasCmd,
  getAliasSpec: _getAliasSpec,
  getPlatform: _getPlatform,
  noop: _noop,
  onError: _onError,
  padRight: _padRight,
  stripIndentation: _stripIndentation,
  suppressTerminateBatchJobConfirmation: _suppressTerminateBatchJobConfirmation,
  wrapLine: _wrapLine,
};

// Functions - Definitions
function _capitalize(str) {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}

function _doOnExit(proc, action) {
  if (!proc) {
    throw new Error('No process specified.');
  } else if (!action) {
    throw new Error('No action specified.');
  }

  const events = ['exit', 'SIGINT'];
  const listener = code => {
    action(code);
    proc.exit(code);
  };

  events.forEach(evt => proc.addListener(evt, listener));

  return () => events.forEach(evt => proc.removeListener(evt, listener));
}

function _finallyAsPromised(promise, callback) {
  return promise.then(
    val => Promise.resolve(callback()).then(() => val),
    err => Promise.resolve(callback()).then(() => Promise.reject(err)));
}

function _getPlatform() {
  return platform;
}

function _getAliasCmd(spec) {
  return spec.cmd || spec;
}

function _getAliasSpec(category, name) {
  const spec = category[name];
  return spec[utils.getPlatform()] || spec.default || spec;
}

function _noop() {}

function _onError(err) {
  const chalk = require('chalk');
  const errorMsg = (err instanceof Error) ? err.stack : `Error: ${err}`;

  console.error(chalk.red(errorMsg));
  process.exit(1);
}

function _padRight(str, len) {
  const padLen = Math.max(0, len - str.length);
  const pad = ' '.repeat(padLen);

  return `${str}${pad}`;
}

function _stripIndentation(str) {
  const lines = str.replace(/^ *\n/, '').replace(/\n *$/, '').split('\n');
  const minIndentation = lines.
    filter(l => !/^ *$/.test(l)).
    map(l => /^ */.exec(l)[0].length).
    reduce((min, len) => Math.min(min, len));
  const re = new RegExp(`^ {0,${minIndentation}}`);

  return lines.map(l => l.replace(re, '')).join('\n');
}

function _suppressTerminateBatchJobConfirmation(proc) {
  if (proc.platform !== 'win32') {
    // No need to suppress anything on non-Windows platforms.
    return _noop;
  }

  // On Windows, suppress the "Terminate batch job (Y/N)?" confirmation.
  const rl = require('readline');
  const rlInstance = rl.
    createInterface({input: proc.stdin, output: proc.stdout}).
    on('SIGINT', () => {
      const exec = require('child_process').exec;
      exec(`taskkill /F /PID ${proc.pid} /T`);
    });

  // Closing synchronously sometimes results in stale output (for whatever reason).
  return () => setTimeout(() => rlInstance.close());
}

function _wrapLine(line, indentLen) {
  if (line.length <= LINE_LIMIT) {
    return line;
  }

  indentLen = indentLen || 0;

  const extraIndent = ' '.repeat(INDENT_PER_LEVEL);
  const indent = ' '.repeat(indentLen);
  const sep = Date.now() + Math.random();
  const re = new RegExp(/\s&&/.test(line) ? '(\\s)(&&)' : `(.{${LINE_LIMIT},}?\\s)()`, 'g');

  let lines = line.replace(re, `$1${sep}$2`).split(sep).filter(l => l.trim());
  if (lines.length > 1) {
    lines = lines.map(l => _wrapLine(l, indentLen + INDENT_PER_LEVEL));
  }

  return lines.join(`\n${indent}${extraIndent}`);
}
