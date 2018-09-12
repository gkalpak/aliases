#!/usr/bin/env/ node
'use strict';

// Imports
const {existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync} = require('fs');
const {join} = require('path');
const {BIN_DIR} = require('../lib/constants');

// Run
_main();

// Function - Definitions
function _main() {
  try {
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
    const platformExtRe = new RegExp(`\\.${process.platform}\\.js$`);
    const platformScripts = findFiles(BIN_DIR).filter(x => platformExtRe.test(x));
    platformScripts.forEach(platformScriptPath => {
      const activeScriptPath = platformScriptPath.replace(platformExtRe, '.js');
      const defaultScriptPath = platformScriptPath.replace(platformExtRe, '.default.js');

      // Back up the default script for future restoration.
      moveFile(activeScriptPath, defaultScriptPath);

      // Copy the platform-specific script (not move just in case).
      copyFile(platformScriptPath, activeScriptPath);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

function copyFile(fromPath, toPath) {
  writeFileSync(toPath, readFileSync(fromPath));
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
