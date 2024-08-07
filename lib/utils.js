// Imports
import {existsSync, readFileSync, realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

import isWsl from 'is-wsl';


// Constants
const LINE_LIMIT = 75;
const INDENT_PER_LEVEL = 2;
const PLATFORM = isWsl ? 'wsl' : process.platform;
const internal = {
  _fsExistsSync,
  _fsRealpathSync,
  _getPlatform,
  _onError,
  _wrapLine,
};

// Exports
export {
  capitalize,
  getPlatform,
  hasOwnProperty,
  importWithEnv,
  isMain,
  loadJson,
  onError,
  padRight,
  stripIndentation,
  wrapLine,

  // Exposed for testing purposes only.
  internal as _testing,
};

// Helpers
function _fsExistsSync(path) {
  return existsSync(path);
}

function _fsRealpathSync(path) {
  return realpathSync(path);
}

function _getPlatform() {
  return PLATFORM;
}

async function _onError(err) {
  // NOTE:
  //   Avoid eagerly loading `chalk` at the top of the file to allow for it to be imported (directly
  //   or transitively) with `importWithEnv()`. This is, for example, useful for being able to force
  //   the use of colors.
  const {default: chalk} = await import('chalk');

  const isExitCode = err && (typeof err === 'number');
  const errorMsg = (err instanceof Error) ? err.stack : `${isExitCode ? 'Exit code' : 'Error'}: ${err}`;

  console.error(chalk.red(errorMsg));
  process.exit(isExitCode ? err : 1);
}

function _wrapLine(line, indent) {
  if (line.length <= LINE_LIMIT) {
    return line;
  }

  const extraIndent = ' '.repeat(INDENT_PER_LEVEL);
  const sep = Date.now() + Math.random();
  const re = new RegExp(/\s&&/.test(line) ? '(\\s)(&&)' : `(.{${LINE_LIMIT},}?\\s)()`, 'g');

  let lines = line.replace(re, `$1${sep}$2`).split(sep).filter(l => l.trim());
  if (lines.length > 1) {
    lines = lines.map(l => wrapLine(l, `${indent}${extraIndent}`));
  }

  return lines.join(`\n${indent}${extraIndent}`);
}

function capitalize(str) {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}

function getPlatform() {
  return internal._getPlatform();
}

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

async function importWithEnv(importFn, tempEnvVars) {
  const {env} = process;

  const tempEnvVarNames = Object.keys(tempEnvVars);
  const originalValues = tempEnvVarNames.
    filter(name => hasOwnProperty(env, name)).
    reduce((aggr, name) => Object.assign(aggr, {[name]: env[name]}), {});

  try {
    Object.assign(env, tempEnvVars);
    return await importFn();
  } finally {
    tempEnvVarNames.forEach(name => hasOwnProperty(originalValues, name) ?
      env[name] = originalValues[name] :
      delete env[name]);
  }
}

function isMain(fileUrl) {
  const mainExt = ['', '.js'].find(ext => internal._fsExistsSync(`${process.argv[1]}${ext}`)) ?? '';
  const mainPath = internal._fsRealpathSync(`${process.argv[1]}${mainExt}`);
  const filePath = fileURLToPath(fileUrl);

  return filePath === mainPath;
}

function loadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to load and parse JSON file '${filePath}': ${err?.message || err}`);
  }
}

function onError(err) {
  return internal._onError(err);
}

function padRight(str, len) {
  const padLen = Math.max(0, len - str.length);
  const pad = ' '.repeat(padLen);

  return `${str}${pad}`;
}

function stripIndentation(str) {
  const lines = str.replace(/^ *\n/, '').replace(/\n *$/, '').split('\n');
  const minIndentation = Math.min(...lines.
    filter(l => !/^ *$/.test(l)).
    map(l => /^ */.exec(l)[0].length));
  const re = new RegExp(`^ {0,${minIndentation}}`);

  return lines.map(l => l.replace(re, '')).join('\n');
}

function wrapLine(line, indent = '') {
  return internal._wrapLine(line, indent);
}
