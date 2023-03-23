// Imports
import chalk from 'chalk';

import {AliasUnknown} from './alias.js';
import {ALIASES, getDescReplacements, VERSION_STAMP} from './constants.js';
import {capitalize, hasOwnProperty, onError, padRight, wrapLine} from './utils.js';


// Constants
const internal = {
  _helpForCategory,
};

// Exports
export {
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
   *    Example (simple): `help('alv')` or `help('gs', 'gsh')`
   *    Example (wildcard): `help('grb*')` or `help('gst*', 'gsh')`
   *
   * @param {string[]} [names] - The name of the category for which to list aliases or one or more aliases to list. If
   *     omitted, all available aliases will be shown.
   *
   * @return {Promise<void>} - A promise that resolves once the message has been printed.
   */
  help,

  // Exposed for testing purposes only.
  internal as _testing,
};

// Helpers
function _helpForCategory(category, joiner) {
  const publicAliases = Object.keys(category.spec).filter(aliasName => !/^__/.test(aliasName));
  const maxNameLen = Math.max(...publicAliases.map(a => a.length));
  const indent1 = ' '.repeat(2);
  const indent2 = ' '.repeat(indent1.length + maxNameLen + joiner.length);

  const headerStyle = category.problematic ? chalk.yellowBright : chalk.cyan;
  const aliasStyle = category.problematic ? chalk.red : chalk.green;

  const headerText = `${category.name} aliases${category.partial ? ' subset' : ''}:`;

  return [
    headerStyle(capitalize(headerText)),
    '',
    publicAliases.
      map(aliasName => [aliasName, getDescription(category.spec[aliasName])]).
      map(([aliasName, aliasDesc]) => [padRight(aliasName, maxNameLen), wrapMultiline(aliasDesc, indent2)]).
      map(([aliasName, aliasDesc]) => `${indent1}${aliasStyle(aliasName)}${chalk.gray(joiner)}${aliasDesc}`).
      join('\n'),
  ].join('\n');
}

function createCategoriesOnTheFly(aliasNames) {
  // Keep track of the created partial categories.
  const partialCategories = [];
  const addNewPartialCategory = name => {
    const partialCategory = {name, spec: {}, partial: true};
    partialCategories.push(partialCategory);
    return partialCategory;
  };

  // Separate regular alias names from wildcards.
  const regularNames = aliasNames.filter(name => name[name.length - 1] !== '*');
  const wildcardNames = aliasNames.
    filter(name => name[name.length - 1] === '*').
    map(name => name.slice(0, -1));
  const matches = name =>
    (regularNames.indexOf(name) !== -1) ||
    wildcardNames.some(prefix => name.startsWith(prefix));

  // Find matching aliases.
  const foundNames = [];

  // For each category...
  Object.keys(ALIASES).
    // ...create a partial category...
    map(categoryName => addNewPartialCategory(categoryName)).
    // ...retrieve the original spec...
    map(partialCategory => [partialCategory.spec, ALIASES[partialCategory.name]]).
    // ...get all aliases in the category...
    forEach(([partialSpec, originalSpec]) => Object.keys(originalSpec).
      // ...find the ones we are interested in (if any)...
      filter(aliasName => matches(aliasName)).
      // ...add them to the partial spec and the list of found names.
      forEach(aliasName => {
        partialSpec[aliasName] = originalSpec[aliasName];
        foundNames.push(aliasName);
      }));

  // Add any unknown aliases.
  const unknownAlias = new AliasUnknown();
  const unknownCategorySpec = regularNames.
    filter(name => foundNames.indexOf(name) === -1).
    reduce((aggr, name) => ((aggr[name] = unknownAlias), aggr), {});
  partialCategories.push({name: 'unknown', spec: unknownCategorySpec, problematic: true});

  // Return the created partial categories.
  return partialCategories;
}

function getDescription(alias) {
  let desc = alias.getSpec().description;

  Object.entries(getDescReplacements()).forEach(([original, repl]) => {
    desc = desc.split(original).join(repl);
  });

  return desc;
}

async function help(...names) {
  const showAll = !names.length;
  const showCategory = (names.length === 1) && hasOwnProperty(ALIASES, names[0]);
  const showAliases = !showAll && !showCategory;

  try {
    const sep = '~'.repeat(75);
    const joiner = '  -->  ';

    const matchedCategories = showAliases ?
      createCategoriesOnTheFly(names) :
      Object.entries(ALIASES).
        filter(([categoryName]) => showAll || (categoryName === names[0])).
        map(([name, spec]) => ({name, spec}));

    const header = !showAll ? `${VERSION_STAMP}\n` : [
      '',
      versionHeader(),
      '',
      ' Available aliases',
      '===================',
      '',
    ].join('\n');
    const mainSection = matchedCategories.
      filter(category => Object.keys(category.spec).length).
      map(category => helpForCategory(category, joiner)).
      join(`\n\n${chalk.gray(sep)}\n\n`) || chalk.yellowBright('  Nothing to see here :(');
    const footer = showAliases ? '' : [
      '',
      chalk.magenta(sep),
      '',
      'All aliases also accept the following arguments:',
      '--gkcu-debug:       Produce verbose, debug-friendly output.',
      '--gkcu-dryrun:      Print the command instead of actually running it. (Still experimental.)',
      '--gkcu-sapVersion:  Choose a different implementation for the command runner. (Default: 2)',
      '--gkcu-suppressTbj: Suppress the "Terminate batch job (Y/N)?" confirmation on Windows. (Still experimental.)',
      '                    Does not work with certain types of commands (e.g. `vim`).',
      '',
      wrapLine(
          '(NOTE: All arguments starting with `--gkcu-` will be ignored when substituting input arguments or ' +
          'determining their index.)'),
      '',
    ].join('\n');

    const message = [
      chalk.magenta(header),
      mainSection,
      chalk.gray(footer),
    ].join('\n');

    console.log(message);
  } catch (err) {
    await onError(err);
  }
}

function helpForCategory(category, joiner) {
  return internal._helpForCategory(category, joiner);
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

function wrapMultiline(input, wrapIndent) {
  return input.
    split('\n').
    map(l => wrapLine(l, wrapIndent)).
    map((l, i) => (i === 0) ? l : `${wrapIndent}${l}`).
    join('\n');
}
