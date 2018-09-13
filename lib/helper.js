'use strict';

// Imports
const constants = require('./constants');
const utils = require('./utils');

// Exports
const helper = module.exports = {
  /**
   * @function help
   *
   * @description
   * Print a help message, including:
   * - The version of the package.
   * - All available aliases and the associated commands.
   * - Special, "universal" arguments.
   *
   * You can limit the listed aliases to a specific category by passing it as an argument. For example, `help('git')`
   * will only show git-related aliases.
   *
   * @param {string} [category] - The name of the category for which to list aliases. If omitted, all available aliases
   *     will be shown.
   *
   * @return {Promise<void>} - A promise that resolves once the message has been printed.
   */
  help: _help,

  /** Exposed for testing purposes only. */
  _helpForCategory: helpForCategory,
};

// Functions - Definitions
function _help(categoryName) {
  return Promise.resolve().
    then(() => {
      const sep = '~'.repeat(75);
      const joiner = '  -->  ';

      const header = categoryName ? constants.VERSION_STAMP : [
        '',
        versionHeader(),
        '',
        ' Available aliases',
        '===================',
      ].join('\n');
      const message = [
        header,
        '',
        Object.keys(constants.ALIASES).
          filter(name => !categoryName || (name === categoryName)).
          map(name => helper._helpForCategory(name, constants.ALIASES[name], joiner)).
          join(`\n${sep}\n\n`),
        sep,
        '',
        'All aliases also accept the following arguments:',
        '--gkcu-debug:       Produce verbose, debug-friendly output.',
        '--gkcu-dryrun:      Print the command instead of actually running it. (Still experimental.)',
        '--gkcu-sapVersion:  Choose a different implementation for the command runner. (Default: 2)',
        '--gkcu-suppressTbj: Suppress the "Terminate batch job (Y/N)?" confirmation on Windows. (Still experimental.)',
        '                    Does not work with certain types of commands (e.g. `vim`).',
        '',
        utils.wrapLine(
          '(NOTE: All arguments starting with `--gkcu-` will be ignored when substituting input arguments or ' +
          'determining their index.)', 0),
        '',
      ].join('\n');

      console.log(message);
    }).
    catch(utils.onError);
}

function getDescription(alias) {
  let desc = alias.getSpec().description;

  Object.keys(constants.DESC_REPLACEMENTS).forEach(original => {
    const repl = constants.DESC_REPLACEMENTS[original];
    desc = desc.split(original).join(repl);
  });

  return desc;
}

function helpForCategory(catName, catSpec, joiner) {
  const publicAliases = Object.keys(catSpec).filter(aliasName => !/^__/.test(aliasName));
  const maxNameLen = Math.max(...publicAliases.map(a => a.length));
  const indent1 = ' '.repeat(2);
  const indent2 = indent1.length + maxNameLen + joiner.length;

  return [
    `${utils.capitalize(catName)} aliases:`,
    '',
    publicAliases.
      map(aliasName => [aliasName, getDescription(catSpec[aliasName])]).
      map(([aliasName, aliasDesc]) => [utils.padRight(aliasName, maxNameLen), utils.wrapLine(aliasDesc, indent2)]).
      map(([aliasName, aliasDesc]) => `${indent1}${aliasName}${joiner}${aliasDesc}`).
      join('\n'),
    '',
  ].join('\n');
}

function versionHeader() {
  const versionLine = `|  ${constants.VERSION_STAMP}  |`;
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
