#!/usr/bin/env node
// Imports
import {existsSync} from 'node:fs';
import {resolve as pathResolve} from 'node:path';

import chalk from 'chalk';

import {ALIASES, ROOT_DIR} from '../lib/constants.js';
import {loadPackageJson} from '../test/test-utils.js';


// Constants
const CHECK_MARK = chalk.green('\u2714');
const X_MARK = chalk.red('\u2716');
const {bin, main, types, typings} = loadPackageJson();

// Run
_main();

// Helpers
function _main() {
  checkBin(bin || {}, ROOT_DIR, ALIASES);
  checkFile('main', main || '', ROOT_DIR);
  checkFile('types', types || '', ROOT_DIR);
  checkFile('typings', typings || '', ROOT_DIR);
}

function aliasesToBin(aliases) {
  const bin = {};

  Object.keys(aliases).forEach(groupName =>
    Object.keys(aliases[groupName]).forEach(name => {
      bin[name] = `bin/${groupName}/${name}.js`;
    })
  );

  return bin;
}

function checkBin(bin, rootDir, aliases) {
  compareToAliases(bin, aliases);
  compareToBinDir(bin, rootDir);
}

function checkFile(propName, filePath, rootDir) {
  if (!filePath) return;

  const missingFile = !existsSync(pathResolve(rootDir, filePath));

  reportResults(
      `The file mentioned in \`package.json > ${propName}\` exists.`,
      `The file mentioned in \`package.json > ${propName}\` is missing.`,
      {'Missing script': missingFile ? [filePath] : []});
}

function compareToAliases(bin, aliases) {
  const expected = sortedPairs(aliasesToBin(aliases));
  const actual = sortedPairs(bin);

  const {missing, extra} = diff(expected, actual);

  reportResults(
      'Aliases in `lib/constants.js` are in-sync with `package.json > bin`.',
      'Aliases in `lib/constants.js` are not in-sync with `package.json > bin`.',
      {
        'Missing from `package.json > bin`': missing,
        'Missing from `lib/constants.js`': extra,
      });
}

function compareToBinDir(bin, rootDir) {
  const missingScripts = Object.keys(bin).
    map(key => pathResolve(rootDir, bin[key])).
    filter(path => !existsSync(path));

  reportResults(
      'All scripts mentioned in `package.json > bin` exist.',
      'Some scripts mentioned in `package.json > bin` are missing.',
      {'Missing scripts': missingScripts});
}

function diff(arr1, arr2) {
  return {
    missing: arr1.filter(item => arr2.indexOf(item) === -1),
    extra: arr2.filter(item => arr1.indexOf(item) === -1),
  };
}

function reportResults(successMessage, errorMessage, errors) {
  const errorHeaders = Object.keys(errors).filter(header => errors[header].length);

  if (!errorHeaders.length) {
    console.log(`${CHECK_MARK}  ${successMessage}`);
  } else {
    const errorSummary = `${X_MARK}  ${errorMessage}`;
    const errorDetails = errorHeaders.
      reduce((lines, header) => [
        ...lines,
        `${header}:`,
        ...errors[header].map(x => `  ${x}`),
      ], []).
      map(line => `     ${line}`).
      join('\n');

    console.error(errorSummary);
    console.error(errorDetails);
    console.error();

    process.exit(1);
  }
}

function sortedPairs(obj) {
  return Object.keys(obj).
    sort().
    map(key => `"${key}": "${obj[key]}",`);
}
