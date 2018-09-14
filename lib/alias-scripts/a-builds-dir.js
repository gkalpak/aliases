'use strict';

// Imports
const fs = require('fs');
const path = require('path');
const utils = require('../utils');

// Exports
const exps = module.exports = {
  /**
   * @function aBuildsDir
   *
   * @description
   * Look for and return the absolute (OS-specific) path to `.../angular/aio/aio-builds-setup/`. It
   * only works if run from a directory between 'angular/' and 'angular/aio/aio-builds-setup/dockerbuild/scripts-js/'.
   *
   * @param {IRunConfig} [config={}] - A configuration object. See {@link commandUtils#IRunConfig} for more details.
   *
   * @return {Promise<void|string>} - A promise that resolves to either `undefined` or the absolute directory path
   *     (depending on the value of `config.returnOutput`).
   */
  aBuildsDir: _aBuildsDir,

  main: __main,
};

// Functions - Definitions
function __main(_runtimeArgs, config) {
  return exps.aBuildsDir(config);
}

function _aBuildsDir(config) {
  if (config.dryrun) {
    console.log('Get the absolute path to \'.../angular/aio/aio-builds-setup/\'.');
    return Promise.resolve();
  }

  return locateBuildsDir(config.debug).
    then(buildsDirPath => config.returnOutput ? buildsDirPath : console.log(buildsDirPath));
}

function exists(somePath) {
  return new Promise(resolve => fs.exists(somePath, resolve));
}

function isBuildsDir(candidateAbsPath) {
  return Promise.resolve(true).
    then(prev => prev && /[\\/]aio[\\/]aio-builds-setup$/.test(candidateAbsPath)).
    then(prev => prev && exists(candidateAbsPath)).
    then(prev => prev && isDirectory(candidateAbsPath));
}

function isDirectory(somePath) {
  return new Promise((resolve, reject) =>
    fs.stat(somePath, (err, stats) =>
      err ? reject(err) : resolve(stats.isDirectory())));
}

function locateBuildsDir(debug = false) {
  const candidateRelPaths = [
    'aio/aio-builds-setup', // Run from: angular/
    'aio-builds-setup',     // Run from: angular/aio/
    '',                     // Run from: angular/aio/aio-builds-setup/
    '..',                   // Run from: angular/aio/aio-builds-setup/dockerbuild/
    '../..',                // Run from: angular/aio/aio-builds-setup/dockerbuild/scripts-js/
  ];

  return candidateRelPaths.
    reduce((prevPromise, p) => prevPromise.then(prevAbsPath => {
      if (prevAbsPath) return prevAbsPath;

      const absPath = path.resolve(p);

      if (debug) {
        console.log(`Checking '${p}' (resolved to '${absPath}')...`);
      }

      return isBuildsDir(absPath).then(itIs => itIs && absPath);
    }), Promise.resolve(false)).
    then(buildsDirPath => {
      if (debug && buildsDirPath) {
        console.log(`Target directory found: ${buildsDirPath}`);
      }
      return buildsDirPath || notFound();
    });
}

function notFound() {
  throw new Error(utils.stripIndentation(`
    Unable to locate the '.../aio/aio-setup-builds/' directory.
    Make sure you are in a directory between 'angular/' and 'angular/aio/aio-builds-setup/dockerbuild/scripts-js/'.
  `));
}
