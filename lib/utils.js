'use strict';

// Imports
const {readFileSync} = require('fs');
const isWsl = require('is-wsl');
const {fileURLToPath} = require('url');

// Constants
const LINE_LIMIT = 75;
const INDENT_PER_LEVEL = 2;

// Variables
const platform = isWsl ? 'wsl' : process.platform;

// Exports
const utils = module.exports = {
  capitalize: _capitalize,
  finallyAsPromised: _finallyAsPromised,
  getPlatform: _getPlatform,
  isMain: _isMain,
  loadJson: _loadJson,
  onError: _onError,
  padRight: _padRight,
  require: _require,
  requireWithEnv: _requireWithEnv,
  stripIndentation: _stripIndentation,
  wrapLine: _wrapLine,
};

// Functions - Definitions
function _capitalize(str) {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}

function _finallyAsPromised(promise, callback) {
  return promise.then(
      val => Promise.resolve(callback()).then(() => val),
      err => Promise.resolve(callback()).then(() => Promise.reject(err)));
}

function _getPlatform() {
  return platform;
}

function _isMain(fileUrl) {
  const extRe = /\.[cm]?js$/;

  const filePath = fileURLToPath(fileUrl);
  const mainPath = process.argv[1];

  const filePathExt = extRe.exec(filePath)?.[0];
  const mainPathExt = extRe.exec(mainPath)?.[0];

  return (filePath === mainPath) ||
    ((filePathExt !== null) && (filePath === `${mainPath}${filePathExt}`)) ||
    ((mainPathExt !== null) && (`${filePath}${mainPathExt}` === mainPath));
}

function _loadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to load and parse JSON file '${filePath}': ${err?.message || err}`);
  }
}

function _onError(err) {
  const chalk = require('chalk');
  const isExitCode = err && (typeof err === 'number');
  const errorMsg = (err instanceof Error) ? err.stack : `${isExitCode ? 'Exit code' : 'Error'}: ${err}`;

  console.error(chalk.red(errorMsg));
  process.exit(isExitCode ? err : 1);
}

function _padRight(str, len) {
  const padLen = Math.max(0, len - str.length);
  const pad = ' '.repeat(padLen);

  return `${str}${pad}`;
}

function _require(depName) {
  return require(depName);
}

function _requireWithEnv(depName, env, tempEnvVars) {
  if (depName.startsWith('.')) {
    throw new Error(utils.stripIndentation(`
      Unable to resolve '${depName}'. Relative paths are not supported.
      (To load relative files use \`requireWithEnv(require.resolve('${depName}'), ...)\`.)
    `));
  }

  const tempEnvVarNames = Object.keys(tempEnvVars);
  const originalValues = tempEnvVarNames.
    filter(name => env.hasOwnProperty(name)).
    reduce((aggr, name) => Object.assign(aggr, {[name]: env[name]}), {});

  try {
    Object.assign(env, tempEnvVars);
    return utils.require(depName);
  } finally {
    tempEnvVarNames.forEach(name => originalValues.hasOwnProperty(name) ?
      env[name] = originalValues[name] :
      delete env[name]);
  }
}

function _stripIndentation(str) {
  const lines = str.replace(/^ *\n/, '').replace(/\n *$/, '').split('\n');
  const minIndentation = Math.min(...lines.
    filter(l => !/^ *$/.test(l)).
    map(l => /^ */.exec(l)[0].length));
  const re = new RegExp(`^ {0,${minIndentation}}`);

  return lines.map(l => l.replace(re, '')).join('\n');
}

function _wrapLine(line, indent = '') {
  if (line.length <= LINE_LIMIT) {
    return line;
  }

  const extraIndent = ' '.repeat(INDENT_PER_LEVEL);
  const sep = Date.now() + Math.random();
  const re = new RegExp(/\s&&/.test(line) ? '(\\s)(&&)' : `(.{${LINE_LIMIT},}?\\s)()`, 'g');

  let lines = line.replace(re, `$1${sep}$2`).split(sep).filter(l => l.trim());
  if (lines.length > 1) {
    lines = lines.map(l => _wrapLine(l, `${indent}${extraIndent}`));
  }

  return lines.join(`\n${indent}${extraIndent}`);
}
