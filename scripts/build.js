#!/usr/bin/env/ node
'use strict';

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
        const basePath = join(categoryDir, aliasName);
        const outputPath = `${basePath}.js`;
        const alias = categorySpec[aliasName];
        const aliasCode = `${alias.getSpec('default').code}\n`;

        // ...create the default alias script file.
        writeFileSync(outputPath, aliasCode);

        // ...for each additional platform that the alias needs special handling on...
        alias.getAdditionalPlatforms().
          map(platform => ({
            outputPath2: `${basePath}.${platform}.js`,
            aliasCode2: `${alias.getSpec(platform).code}\n`,
          })).
          // ...and for which the code will be different (not just the description for example)...
          filter(({aliasCode2}) => aliasCode2 !== aliasCode).
          // ...create the platform-specific alias script file.
          forEach(({outputPath2, aliasCode2}) => writeFileSync(outputPath2, aliasCode2));
      });
    });
  } catch (err) {
    onError(err);
  }
}
