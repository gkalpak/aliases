#!/usr/bin/env/ node
'use strict';

// Imports
const {mkdirSync, writeFileSync} = require('fs');
const {join} = require('path');
const {ALIASES, BIN_DIR, DEF_CODE} = require('../lib/constants');
const {run} = require('../lib/index');

// Run
_main();

// Function - Definitions
function _main() {
  run(`rm -rf "${BIN_DIR}"`).
    then(() => {
      mkdirSync(BIN_DIR);

      Object.keys(ALIASES).forEach(groupName => {
        const group = ALIASES[groupName];
        const groupDir = join(BIN_DIR, groupName);

        mkdirSync(groupDir);

        Object.keys(group).forEach(aliasName => {
          const file = join(groupDir, `${aliasName}.js`);
          const spec = group[aliasName];
          const code = `${spec.code || DEF_CODE(spec)}\n`;

          writeFileSync(file, code);
        });
      });
    }).
    catch(onError);
}

function onError(err) {
  console.error(err);
  process.exit(1);
}
