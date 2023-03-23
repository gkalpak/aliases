#!/usr/bin/env/ node
// Imports
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

import sh from 'shelljs';

import {ALIASES, BIN_DIR} from '../lib/constants.js';

sh.set('-e');


// Run
_main();

// Helpers
function _main() {
  // Clean up `bin/`.
  sh.rm('-rf', BIN_DIR);
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
}
