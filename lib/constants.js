'use strict';

// Imports
const {join} = require('path');
const {name, version} = require('../package.json');

// Constants
const VERSION_STAMP = `${name} v${version}`;
const BIN_DIR = join(__dirname, '../bin');
const DEF_CODE = cmd => [
  '#!/usr/bin/env node',
  '\'use strict\';',
  '// eslint-disable-next-line max-len',
  `const cmd = module.exports = '${cmd.replace(/'/g, '\\\'')}';`,
  'if (require.main === module) {',
  '  const aliases = require(\'../../lib/index\');',
  '  const {args, config} = aliases.preprocessArgs(process.argv.slice(2));',
  '  aliases.run(cmd, args, config);',
  '}',
].join('\n');
const ALIASES = {
  // Git
  git: {
    // STATUS
    gs: 'git status',
    gl: 'git log --decorate $* || true',
    gl1: 'git log --decorate --oneline $* || true',
    gd: 'ngm-diff-wh $*',
    gdh: 'ngm-diff-wh HEAD $*',
    gd1: 'ngm-diff-wh HEAD~1 $*',

    // STASH
    gst: 'git stash $*',
    gstk: 'git stash save --keep-index $*',
    gstl: 'git stash list $*',
    gstp: 'git stash pop --index $*',

    // CHECKOUT
    gco: 'git checkout $*',
    gcom: 'git checkout master $*',
    gcopr: 'git fetch upstream pull/$1/head && git checkout FETCH_HEAD',

    // ADD / COMMIT
    gaa: 'git add --all',
    gcm: 'git commit --all $*',
    gcmf: 'git commit --all --fixup HEAD~${1:0}',
    gcma: 'git commit --all --amend $*',
    gcmia: 'git commit --amend $*',
    gcmane: 'git commit --all --amend --no-edit $*',
    gcmiane: 'git commit --amend --no-edit $*',

    // PUSH
    gp: 'git push --verbose $*',
    gpf: 'git push --force-with-lease --verbose $*',


    // BRANCH
    gb: 'git branch $*',
    gbc: 'git checkout master -b $1 && git push --verbose --set-upstream origin $1',
    gbd: 'git branch --delete --force $*',

    // PULL(-REBASE)
    gpr: 'git pull --rebase $*',
    gpro: 'git pull --rebase origin $*',
    gprom: 'git pull --rebase origin master $*',
    gpru: 'git pull --rebase upstream $*',
    gprum: 'git pull --rebase upstream master $*',

    // SYNC MASTER
    gsync: 'git checkout ${1:master} && git pull upstream ${1:master} && git push origin ${1:master}',


    // REBASE
    grb: 'git rebase $*',
    grbm: 'git rebase master $*',
    grbi: 'git rebase --interactive HEAD~$1',
    grbia: 'git rebase --autosquash --interactive HEAD~$1',
    grbin: 'git rebase --no-autosquash --interactive HEAD~$1',
    grbc: 'git rebase --continue',
    grba: 'git rebase --abort',
    gmt: 'git mergetool',
    gcl: 'git clean --interactive',


    // MERGE NG PR
    gngprh: 'ngm-pr-merge $* --instructions',
    gngprm: 'ngm-pr-merge $*',

    // BACKPORT
    gcp: 'echo "  Cherry-picking SHA: $1  " && ' +
         'echo "----------------------------------------------------------------" && ' +
         'echo "                                                                " && ' +
         'git checkout $2 && ' +
         'git pull --rebase origin $2 && ' +
         'git cherry-pick $1 && ' +
         'ngm-diff-wh origin/$2 && ' +
         '(git log --decorate || true) && ' +
         'echo "                                                                " && ' +
         'echo "----------------------------------------------------------------" && ' +
         'echo "     >>>  (Don\'t forget to manually push the changes.)  <<<     "',
    gcpl: 'gcp ${0:`git rev-parse HEAD`} $1',
  },

  // Node
  node: {
    // INFO / SWITCHING
    nv: 'node --version',
    nls: 'npm list --depth=0',
    nls1: 'npm list --depth=1',
    nlsg: 'npm list --depth=0 --global',
    nlsg1: 'npm list --depth=1 --global',
    // nvu: 'FOR /F "TOKENS=1" %%i IN (\'nvm list ^| sed -n -e "s/^.*\\($1\\.[0-9]\\+\\.[0-9]\\+\\).*$/\\1/p"\') DO ' +
    //        'nvm use %%i',


    // INSTALL / UNINSTALL
    nis: 'npm install --save $*',
    nid: 'npm install --save-dev $*',
    nrms: 'npm rm --save $*',
    nrmd: 'npm rm --save-dev $*',


    // RUN / TEST
    nr: 'npm run $*',
    ns: 'npm start $*',
    nt: 'npm test $*',
    yr: 'yarn run $*',
    ys: 'yarn start $*',
    yt: 'yarn test $*',


    // SPECIAL
    niga: 'npm install --global ' + [
      'csslint',
      'eslint',
      'firebase-tools',
      'grunt-cli',
      'gulp',
      'http-server',
      'lr-http-server',
      'typescript',
      'yarn',
      '@gkalpak/aliases',
      '@gkalpak/ng-maintain',
    ].join(' '),
  },

  // Misc
  misc: {
    // DIRECTORY LISTING
    ll: 'ls -hl $*',
    lla: 'ls -ahl $*',


    // SELF-UPDATE
    salfup: `npm install --global ${name}`,

    // VERSION
    alv: {
      desc: `Display the installed version of ${name}.`,
      code: [
        '#!/usr/bin/env node',
        '\'use strict\';',
        `console.log('${VERSION_STAMP}');`,
      ].join('\n'),
    },

    // HELP
    halp: {
      desc: 'Display this message.',
      code: [
        '#!/usr/bin/env node',
        '\'use strict\';',
        'require(\'../../lib/index\').help(process.argv[2]);',
      ].join('\n'),
    },
  },
};

// Exports
module.exports = {
  ALIASES,
  BIN_DIR,
  DEF_CODE,
  VERSION_STAMP,
};
