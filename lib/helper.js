'use strict';

// Imports
const {ALIASES, VERSION_STAMP} = require('./constants');
const {getSpec, onError, padRight, wrapLine} = require('./utils');

// Exports
module.exports = {
  /**
   * @function help
   *
   * @description
   * Print a help message, including:
   * - The version of the package.
   * - All available aliases and the associated commands.
   * - Special, "universal" arguments.
   *
   * You can limit the listed aliases to a specific category by passing it as an argument. * For example, `help('git')`
   * will only show git-related aliases.
   *
   * @param {string} [category] - The name of the category for which to list aliases. If omitted, all available aliases
   *     will be shown.
   *
   * @return {Promise<void>} - A promise that resolves once the message has been printed.
   */
  help: _help,
};

// Functions - Definitions
function _help(categoryName) {
  return Promise.resolve().
    then(() => {
      const sep = '~'.repeat(75);
      const joiner = '  -->  ';

      const header = categoryName ? VERSION_STAMP : [
        '',
        versionHeader(),
        '',
        ' Available aliases',
        '===================',
      ].join('\n');
      const message = [
        header,
        '',
        Object.keys(ALIASES).
          filter(name => !categoryName || (name === categoryName)).
          map(name => helpForCategory(name, ALIASES[name], joiner)).
          join(`\n${sep}\n\n`),
        sep,
        '',
        'All aliases also accept the following arguments:',
        '--al-debug:  Produce verbose, debug-friendly output.',
        '--al-dryrun: Print the command instead of actually running it. (Still experimental.)',
        '',
        wrapLine(
          '(NOTE: All arguments starting with `--al-` will be ignored when substituting input arguments or ' +
          'determining their index.)', 0),
        '',
      ].join('\n');

      console.log(message);
    }).
    catch(onError);
}

function capitalize(str) {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}

function helpForCategory(catName, catSpec, joiner) {
  const maxNameLen = Math.max.apply(Math, Object.keys(catSpec).map(a => a.length));
  const indent1 = ' '.repeat(2);
  const indent2 = indent1.length + maxNameLen + joiner.length;

  return [
    `${capitalize(catName)} aliases:`,
    '',
    Object.keys(catSpec).
      map(name => ({name, spec: getSpec(catSpec, name)})).
      map(({name, spec}) => [padRight(name, maxNameLen), wrapLine(spec.desc || spec, indent2)]).
      map(([name, desc]) => `${indent1}${name}${joiner}${desc}`).
      join('\n'),
    '',
  ].join('\n');
}

function versionHeader() {
  const versionLine = `|  ${VERSION_STAMP}  |`;
  const len = versionLine.length - 2;
  const outerLine = ` ${'-'.repeat(len)} `;
  const innerLine = `|${' '.repeat(len)}|`;

  return [
    outerLine,
    innerLine,
    versionLine,
    innerLine,
    outerLine,
  ].join('\n');
}
