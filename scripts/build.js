#!/usr/bin/env/ node
'use strict';

// Imports
const {mkdirSync, writeFileSync} = require('fs');
const {join} = require('path');
const {ALIASES, BIN_DIR, DEF_CODE} = require('../lib/constants');
const {getAliasSpec, onError} = require('../lib/utils');
const {run} = require('../lib/runner');

// Run
_main();

// Function - Definitions
function _main() {
  run(`rm -rf "${BIN_DIR}"`).
    then(() => {
      mkdirSync(BIN_DIR);

      Object.keys(ALIASES).forEach(categoryName => {
        const category = ALIASES[categoryName];
        const categoryDir = join(BIN_DIR, categoryName);

        mkdirSync(categoryDir);

        Object.keys(category).forEach(aliasName => {
          const file = join(categoryDir, `${aliasName}.js`);
          const spec = getAliasSpec(category, aliasName);
          const code = `${spec.code || DEF_CODE(spec)}\n`;

          writeFileSync(file, code);
        });
      });
    }).
    catch(onError);
}
