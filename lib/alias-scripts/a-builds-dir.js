// Imports
import {stat} from 'node:fs/promises';
import {resolve as pathResolve} from 'node:path';

import {stripIndentation} from '../utils.js';


// Constants
const internal = {
  _aBuildsDir,
  _fsStat,
  _pathResolve,
};

// Exports
export {
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
  aBuildsDir,

  main,

  // Exposed for testing purposes only.
  internal as _testing,
};

// Helpers
async function _aBuildsDir(config) {
  if (config.dryrun) {
    console.log('Get the absolute path to \'.../angular/aio/aio-builds-setup/\'.');
    return;
  }

  const buildsDirPath = await locateBuildsDir(config.debug);

  if (config.returnOutput) {
    return buildsDirPath;
  }

  console.log(buildsDirPath);
}

function _fsStat(filePath) {
  return stat(filePath);
}

function _pathResolve(...paths) {
  return pathResolve(...paths);
}

function aBuildsDir(config) {
  return internal._aBuildsDir(config);
}

async function isBuildsDir(candidateAbsPath) {
  return /[\\/]aio[\\/]aio-builds-setup$/.test(candidateAbsPath) &&
    await pathExists(candidateAbsPath) &&
    await pathIsDirectory(candidateAbsPath);
}

async function locateBuildsDir(debug = false) {
  const candidateRelPaths = [
    'aio/aio-builds-setup', // Run from: angular/
    'aio-builds-setup',     // Run from: angular/aio/
    '',                     // Run from: angular/aio/aio-builds-setup/
    '..',                   // Run from: angular/aio/aio-builds-setup/dockerbuild/
    '../..',                // Run from: angular/aio/aio-builds-setup/dockerbuild/scripts-js/
  ];

  for (const p of candidateRelPaths) {
    const absPath = internal._pathResolve(p);

    if (debug) {
      console.log(`Checking '${p}' (resolved to '${absPath}')...`);
    }

    if (await isBuildsDir(absPath)) {
      if (debug) {
        console.log(`Target directory found: ${absPath}`);
      }

      return absPath;
    }
  }

  throw new Error(stripIndentation(`
    Unable to locate the '.../aio/aio-setup-builds/' directory.
    Make sure you are in a directory between 'angular/' and 'angular/aio/aio-builds-setup/dockerbuild/scripts-js/'.
  `));
}

function main(_runtimeArgs, config) {
  return aBuildsDir(config);
}

function pathExists(somePath) {
  return internal._fsStat(somePath).then(() => true, () => false);
}

async function pathIsDirectory(somePath) {
  const stats = await internal._fsStat(somePath);
  return stats.isDirectory();
}
