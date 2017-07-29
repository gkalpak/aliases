'use strict';

// Constants
const LINE_LIMIT = 75;
const INDENT_PER_LEVEL = 2;

// Variables
const platform = process.platform;

// Exports
const utils = module.exports = {
  getPlatform: _getPlatform,
  getSpec: _getSpec,
  onError: _onError,
  padRight: _padRight,
  wrapLine: _wrapLine,
};

// Functions - Definitions
function _getPlatform() {
  return platform;
}

function _getSpec(category, name) {
  const spec = category[name];
  return spec[utils.getPlatform()] || spec.default || spec;
}

function _onError(err) {
  console.error('Error:', err);
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
