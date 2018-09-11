#!/usr/bin/env/ node
'use strict';

// NOTE: This script has to run on the host machine, so that the correct platform is used.

// Imports
const {mkdirSync, writeFileSync} = require('fs');
const {join} = require('path');
const {rm, set} = require('shelljs');
const {ALIASES, BIN_DIR} = require('../lib/constants');
const {onError} = require('../lib/utils');

// Run
_main();

// Function - Definitions
function _main() {
  try {
    set('-e');

    // Clean up `bin/`.
    rm('-rf', BIN_DIR);
    mkdirSync(BIN_DIR);

    // For each alias category...
    Object.keys(ALIASES).forEach(categoryName => {
      const categoryDir = join(BIN_DIR, categoryName);
      const categorySpec = ALIASES[categoryName];

      // ...create the category directory.
      mkdirSync(categoryDir);

      // ...for each alias in the category...
      Object.keys(categorySpec).forEach(aliasName => {
        const outputPath = join(categoryDir, `${aliasName}.js`);
        const alias = categorySpec[aliasName];
        const aliasCode = `${alias.getSpec('default').code}\n`;

        // ...create the alias script file.
        writeFileSync(outputPath, aliasCode);
      });
    });
  } catch (err) {
    onError(err);
  }
}
