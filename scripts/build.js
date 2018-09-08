#!/usr/bin/env/ node
'use strict';

// Imports
const {mkdirSync, writeFileSync} = require('fs');
const {join} = require('path');
const {rm, set} = require('shelljs');
const {ALIASES, BIN_DIR, DEF_CODE} = require('../lib/constants');
const {getAliasCmd, getAliasSpec, onError} = require('../lib/utils');

// Run
_main();

// Function - Definitions
function _main() {
  try {
    set('-e');
    rm('-rf', BIN_DIR);
    mkdirSync(BIN_DIR);

    Object.keys(ALIASES).forEach(categoryName => {
      const category = ALIASES[categoryName];
      const categoryDir = join(BIN_DIR, categoryName);

      mkdirSync(categoryDir);

      Object.keys(category).forEach(aliasName => {
        const file = join(categoryDir, `${aliasName}.js`);
        const spec = getAliasSpec(category, aliasName);
        const code = `${getAliasCode(spec)}\n`;

        writeFileSync(file, code);
      });
    });
  } catch (err) {
    onError(err);
  }
}

function getAliasCode(spec) {
  if (spec.code) {
    return spec.code;
  }

  const cmd = getAliasCmd(spec);
  const cfg = spec.cfg || {};

  return DEF_CODE(cmd, cfg);
}
