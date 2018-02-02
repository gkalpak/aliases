#!/usr/bin/env node
'use strict';

// Imports
const {green, red} = require('chalk');
const {existsSync} = require('fs');
const {join} = require('path');
const {ALIASES, ROOT_DIR} = require('../lib/constants');
const {bin} = require('../package.json');

// Constants
const CHECK_MARK = green('\u2714');
const X_MARK = red('\u2716');

// Run
_main();

// Function - Definitions
function _main() {
  compareToAliases(bin, ALIASES);
  compareToBinDir(bin, ROOT_DIR);
}

function aliasesToBin(aliases) {
  const bin = {};

  Object.keys(aliases).forEach(groupName =>
    Object.keys(aliases[groupName]).forEach(name => {
      bin[name] = `./bin/${groupName}/${name}.js`;
    })
  );

  return bin;
}

function compareToAliases(bin, aliases) {
  const expected = sortedPairs(aliasesToBin(aliases));
  const actual = sortedPairs(bin);

  const {missing, extra} = diff(expected, actual);

  reportResults(
    'The `bin` property in `./package.json` is in-sync with the aliases in `./lib/constants.js`.',
    'The `bin` property in `./package.json` is out-of-sync with the aliases in `./lib/constants.js`.',
    {
      'Missing aliases': missing,
      'Extra aliases': extra,
    }
  );
}

function compareToBinDir(bin, rootDir) {
  const missingScripts = Object.keys(bin).
    map(key => join(rootDir, bin[key])).
    filter(path => !existsSync(path));

  reportResults(
    'All scripts mentioned in the `bin` property in `./package.json` exist.',
    'Some scripts mentioned in the `bin` property in `./package.json` are missing.',
    {'Missing scripts': missingScripts}
  );
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
      map(line => `    ${line}`).
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
