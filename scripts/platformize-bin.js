#!/usr/bin/env/ node
'use strict';

// Imports
const {cp, find, mv, set} = require('shelljs');
const {BIN_DIR} = require('../lib/constants');
const {getPlatform, onError} = require('../lib/utils');

// Run
_main();

// Function - Definitions
function _main() {
  try {
    set('-e');

    // Restore any "deactivated" default scripts.
    const defaultExtRe = /\.default\.js$/;
    const defaultScripts = find(BIN_DIR).filter(x => defaultExtRe.test(x));
    defaultScripts.forEach(defaultScriptPath => {
      const activeScriptPath = defaultScriptPath.replace(defaultExtRe, '.js');
      mv(defaultScriptPath, activeScriptPath);
    });

    // "Activate" any platform-specific scripts.
    const platformExtRe = new RegExp(`\\.${getPlatform()}\\.js$`);
    const platformScripts = find(BIN_DIR).filter(x => platformExtRe.test(x));
    platformScripts.forEach(platformScriptPath => {
      const activeScriptPath = platformScriptPath.replace(platformExtRe, '.js');
      const defaultScriptPath = platformScriptPath.replace(platformExtRe, '.default.js');

      // Back up the default script for future restoration.
      mv(activeScriptPath, defaultScriptPath);

      // Copy the platform-specific script (not move just in case).
      cp(platformScriptPath, activeScriptPath);
    });
  } catch (err) {
    onError(err);
  }
}
