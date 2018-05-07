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
  getPlatform: _getPlatform,
  getSpec: _getSpec,
  onError: _onError,
  padRight: _padRight,
  wrapLine: _wrapLine,
};

// Functions - Definitions
function _capitalize(str) {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}

function _doOnExit(proc, action) {
  if (!proc) {
    throw Error('No process specified.');
  } else if (!action) {
    throw Error('No action specified.');
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

function _getSpec(category, name) {
  const spec = category[name];
  return spec[utils.getPlatform()] || spec.default || spec;
}

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

function _wrapLine(line, indentLen) {
  if (line.length <= LINE_LIMIT) {
    return line;
  }

  indentLen = indentLen || 0;

  const extraIndent = ' '.repeat(INDENT_PER_LEVEL);
  const indent = ' '.repeat(indentLen);
  const sep = Date.now() + Math.random();
  const re = RegExp(/\s&&/.test(line) ? '(\\s)(&&)' : `(.{${LINE_LIMIT},}?\\s)()`, 'g');

  let lines = line.replace(re, `$1${sep}$2`).split(sep).filter(l => l.trim());
  if (lines.length > 1) {
    lines = lines.map(l => _wrapLine(l, indentLen + INDENT_PER_LEVEL));
  }

  return lines.join(`\n${indent}${extraIndent}`);
}
