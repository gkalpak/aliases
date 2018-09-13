'use strict';

// Imports
const {AliasUnknown} = require('./alias');
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
   * Three modes are supported:
   * 1. No arguments: List all aliases.
   *    Example: `help()`
   * 2. One argument that matches a category name: List aliases of the specified category only.
   *    Example: `help('node')`
   * 3. One or more arguments: List only the specified aliases (if they exist). Suffixing an argument with `*` will only
   *    list aliases that start with that value.
   *    Example: `help('alv')` or `help('gs', gsh')`
   *
   * @param {string[]} [names] - The name of the category for which to list aliases or one or more aliases to list. If
   *     omitted, all available aliases will be shown.
   *
   * @return {Promise<void>} - A promise that resolves once the message has been printed.
   */
  help: _help,

  /** Exposed for testing purposes only. */
  _helpForCategory: helpForCategory,
};

// Functions - Definitions
function _help(...names) {
  const showAll = !names.length;
  const showCategory = (names.length === 1) && constants.ALIASES.hasOwnProperty(names[0]);
  const showAliases = !showAll && !showCategory;

  return Promise.resolve().
    then(() => {
      const sep = '~'.repeat(75);
      const joiner = '  -->  ';

      const matchedCategories = showAliases ?
        createCategoriesOnTheFly(names) :
        Object.keys(constants.ALIASES).
          filter(categoryName => showAll || (categoryName === names[0])).
          map(categoryName => ({name: categoryName, spec: constants.ALIASES[categoryName]}));

      const header = !showAll ? `${constants.VERSION_STAMP}\n` : [
        '',
        versionHeader(),
        '',
        ' Available aliases',
        '===================',
        '',
      ].join('\n');
      const mainSection = matchedCategories.
        filter(category => Object.keys(category.spec).length).
        map(category => helper._helpForCategory(category, joiner)).
        join(`\n\n${sep}\n\n`) || '  Nothing to see here :(';
      const footer = showAliases ? '' : [
        '',
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

      const message = [
        header,
        mainSection,
        footer,
      ].join('\n');

      console.log(message);
    }).
    catch(utils.onError);
}

function createCategoriesOnTheFly(aliasNames) {
  const onTheFlyCategorySpec = {};

  const regularNames = aliasNames.filter(name => name[name.length - 1] !== '*');
  const wildcardNames = aliasNames.
    filter(name => name[name.length - 1] === '*').
    map(name => name.slice(0, -1));
  const matches = name =>
    (regularNames.indexOf(name) !== -1) ||
    wildcardNames.some(prefix => name.startsWith(prefix));

  Object.keys(constants.ALIASES).
    // For each category...
    map(categoryName => constants.ALIASES[categoryName]).
    // ...get all aliases in the category...
    forEach(categorySpec => Object.keys(categorySpec).
      // ...find the ones we are interested in (if any)...
      filter(aliasName => matches(aliasName)).
      // ...add them to `onTheFlyCategorySpec`.
      forEach(aliasName => onTheFlyCategorySpec[aliasName] = categorySpec[aliasName]));

  const unknownAlias = new AliasUnknown();
  const unknownCategorySpec = regularNames.
    filter(name => !onTheFlyCategorySpec.hasOwnProperty(name)).
    reduce((aggr, name) => ((aggr[name] = unknownAlias), aggr), {});

  return [
    {name: 'matched', spec: onTheFlyCategorySpec},
    {name: 'unknown', spec: unknownCategorySpec, missing: true},
  ];
}

function getDescription(alias) {
  let desc = alias.getSpec().description;

  Object.keys(constants.DESC_REPLACEMENTS).forEach(original => {
    const repl = constants.DESC_REPLACEMENTS[original];
    desc = desc.split(original).join(repl);
  });

  return desc;
}

function helpForCategory(category, joiner) {
  const publicAliases = Object.keys(category.spec).filter(aliasName => !/^__/.test(aliasName));
  const maxNameLen = Math.max(...publicAliases.map(a => a.length));
  const indent1 = ' '.repeat(2);
  const indent2 = indent1.length + maxNameLen + joiner.length;

  return [
    `${utils.capitalize(category.name)} aliases:`,
    '',
    publicAliases.
      map(aliasName => [aliasName, getDescription(category.spec[aliasName])]).
      map(([aliasName, aliasDesc]) => [utils.padRight(aliasName, maxNameLen), utils.wrapLine(aliasDesc, indent2)]).
      map(([aliasName, aliasDesc]) => `${indent1}${aliasName}${joiner}${aliasDesc}`).
      join('\n'),
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
