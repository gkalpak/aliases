#!/usr/bin/env node
'use strict';

// Imports
const {ALIASES} = require('../lib/constants');
const {bin} = require('../package.json');

// Run
_main();

// Function - Definitions
function _main() {
  const expected = sortedPairs(aliasesToBin(ALIASES));
  const actual = sortedPairs(bin);

  const {missing, extra} = diff(expected, actual);

  if (missing.length || extra.length) {
    const joiner = '\n  ';

    console.error('The `bin` property in `./package.json` is out-of-sync with the aliases in `./lib/constants.js`.');
    if (missing.length) {
      console.error(`Missing aliases:${joiner}${missing.join(joiner)}`);
    }
    if (extra.length) {
      console.error(`Extra aliases:${joiner}${extra.join(joiner)}`);
    }
    console.error();

    process.exit(1);
  }
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

function diff(arr1, arr2) {
  return {
    missing: arr1.filter(item => arr2.indexOf(item) === -1),
    extra: arr2.filter(item => arr1.indexOf(item) === -1),
  };
}

function sortedPairs(obj) {
  return Object.keys(obj).
    sort().
    map(key => `"${key}": "${obj[key]}",`);
}
