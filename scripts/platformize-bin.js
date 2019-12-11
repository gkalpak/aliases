#!/usr/bin/env/ node
'use strict';

// Imports
const {chmodSync, copyFileSync, existsSync, readdirSync, renameSync, statSync} = require('fs');
const {join} = require('path');
const {BIN_DIR} = require('../lib/constants');
const {getPlatform} = require('../lib/utils');

// Run
_main();

// Function - Definitions
function _main() {
  // Nothing to do if `bin/` does not exist (e.g. first local `npm install`).
  if (!existsSync(BIN_DIR)) return;

  // Restore any "deactivated" default scripts.
  const defaultExtRe = /\.default\.js$/;
  const defaultScripts = findFiles(BIN_DIR).filter(x => defaultExtRe.test(x));
  defaultScripts.forEach(defaultScriptPath => {
    const activeScriptPath = defaultScriptPath.replace(defaultExtRe, '.js');
    moveFile(defaultScriptPath, activeScriptPath);
  });

  // "Activate" any platform-specific scripts.
  const platform = getPlatform();
  const platformExtRe = new RegExp(`\\.${platform}\\.js$`);
  const platformScripts = findFiles(BIN_DIR).filter(x => platformExtRe.test(x));
  platformScripts.forEach(platformScriptPath => {
    const activeScriptPath = platformScriptPath.replace(platformExtRe, '.js');
    const defaultScriptPath = platformScriptPath.replace(platformExtRe, '.default.js');
    const activeScriptMode = statSync(activeScriptPath).mode;

    // Back up the default script for future restoration.
    moveFile(activeScriptPath, defaultScriptPath);

    // Copy the platform-specific script (not move just in case).
    copyFile(platformScriptPath, activeScriptPath);

    // Preserve active script mode (including "executability") for the scripts to work on *nix platforms.
    chmodSync(activeScriptPath, activeScriptMode);
  });
}

function copyFile(fromPath, toPath) {
  copyFileSync(fromPath, toPath);
}

function findFiles(rootDir) {
  const unvisitedDirectories = [rootDir];
  const files = [];

  while (unvisitedDirectories.length) {
    const currentDir = unvisitedDirectories.pop();
    readdirSync(currentDir).forEach(name => {
      const path = join(currentDir, name);
      const info = statSync(path);
      const targetList = info.isDirectory() ? unvisitedDirectories : files;

      targetList.push(path);
    });
  }

  return files;
}

function moveFile(fromPath, toPath) {
  renameSync(fromPath, toPath);
}
