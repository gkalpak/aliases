'use strict';

// Imports
const path = require('path');
const pkg = require('../package.json');
const utils = require('./utils');

// Constants
const VERSION_STAMP = `${pkg.name} v${pkg.version}`;
const ROOT_DIR = path.join(__dirname, '..');
const BIN_DIR = path.join(ROOT_DIR, 'bin');

const DESC_REPLACEMENTS = {
  '`__a-builds-dir`': '(<.../angular/aio/aio-builds-setup>)',
  '`__g-pick-branch --al-returnOutput=1`': '(interactively pick a branch)',
  '`__g-pick-commit --al-returnOutput=1`': '(interactively pick a commit)',
};

const DEF_CODE = cmd => utils.stripIndentation(`
  #!/usr/bin/env node
  'use strict';
  // eslint-disable-next-line max-len
  const cmd = module.exports = '${cmd.replace(/'/g, '\\\'')}';
  if (require.main === module) {
    const runner = require('../../lib/runner');
    const {args, config} = runner.preprocessArgs(process.argv.slice(2));
    runner.run(cmd, args, config);
  }
`);

const NVU_CODE = utils.stripIndentation(`
  #!/usr/bin/env node
  'use strict';
  module.exports = 'nvm use $*';
  if (require.main === module) {
    const runner = require('../../lib/runner');
    const {args, config} = runner.preprocessArgs(process.argv.slice(2));

    const nvu = require('../../lib/nvu');
    nvu(args, config);
  }
`);

const G_PICKER_SPEC = (things, pickerScriptName) => {
  const desc = `[PRIVATE]: Pick one from a list of ${things}.`;
  const code = utils.stripIndentation(`
    #!/usr/bin/env node
    'use strict';
    module.exports = '${desc}';
    if (require.main === module) {
      const runner = require('../../lib/runner');
      const config = runner.preprocessArgs(process.argv.slice(2)).config;

      const gPicker = require('../../lib/${pickerScriptName}');
      gPicker(config);
    }
  `);

  return {desc, code};
};

const A_BUILDS_DIR_SPEC = () => {
  const desc = '[PRIVATE]: Return the absolute path to \'.../angular/aio/aio-builds-setup/\'.';
  const code = utils.stripIndentation(`
    #!/usr/bin/env node
    'use strict';
    module.exports = '${desc.replace(/'/g, '\\\'')}';
    if (require.main === module) {
      const runner = require('../../lib/runner');
      const config = runner.preprocessArgs(process.argv.slice(2)).config;

      const aBuildsDir = require('../../lib/a-builds-dir');
      aBuildsDir(config);
    }
  `);

  return {desc, code};
};

const ALIASES = {
  // Git
  git: {
    // STATUS
    gs: 'git status',
    gl: 'git log --decorate $* || true',
    gl1: 'git log --decorate --oneline $* || true',
    gsh: 'git show ${*:`__g-pick-commit --al-returnOutput=1`}',
    gd: 'ngm-diff-wh $*',
    gdh: 'ngm-diff-wh HEAD $*',
    gd1: 'ngm-diff-wh HEAD~1 $*',

    // STASH
    gst: 'git stash $*',
    gstk: 'git stash save --keep-index $*',
    gstl: 'git stash list $*',
    gstp: 'git stash pop --index $*',

    // CHECKOUT
    gco: 'git checkout ${*:`__g-pick-branch --al-returnOutput=1`}',
    gcom: 'git checkout master $*',
    gcopr: 'git fetch upstream pull/$1/head && git checkout FETCH_HEAD',

    // ADD / COMMIT
    gaa: 'git add --all',
    gcm: 'git commit --all $*',
    gcmi: 'git commit $*',
    gcmf: 'git commit --all --fixup HEAD~${1:0} $2*',
    gcmif: 'git commit --fixup HEAD~${1:0} $2*',
    gcmfs: 'git commit --all --fixup :/$1 $2*',
    gcmifs: 'git commit --fixup :/$1 $2*',
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
    gbd: 'git branch --delete --force ${*:`__g-pick-branch --al-returnOutput=1`}',

    // PULL(-REBASE)
    gpr: 'git pull --rebase $*',
    gpro: 'git pull --rebase origin ${*:`git rev-parse --abbrev-ref HEAD`}',
    gprom: 'git pull --rebase origin master $*',
    gpru: 'git pull --rebase upstream ${*:`git rev-parse --abbrev-ref HEAD`}',
    gprum: 'git pull --rebase upstream master $*',

    // SYNC MASTER
    gsync: 'git checkout ${1:master} && git pull upstream ${1:master} && git push origin ${1:master}',


    // REBASE
    grb: 'git rebase ${*:`__g-pick-branch --al-returnOutput=1`}',
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
         'git checkout ${2:`__g-pick-branch --al-returnOutput=1`} && ' +
         'git pull --rebase origin ${2:`__g-pick-branch --al-returnOutput=1`} && ' +
         'git cherry-pick $1 && ' +
         'ngm-diff-wh origin/${2:`__g-pick-branch --al-returnOutput=1`} && ' +
         '(git log --decorate || true) && ' +
         'echo "                                                                " && ' +
         'echo "----------------------------------------------------------------" && ' +
         'echo "     >>>  (Don\'t forget to manually push the changes.)  <<<     "',
    gcpl: 'gcp ${0:`git rev-parse HEAD`} ${1:`__g-pick-branch --al-returnOutput=1`}',


    // PRIVATE
    '__g-pick-branch': G_PICKER_SPEC('branches', 'g-pick-branch'),
    '__g-pick-commit': G_PICKER_SPEC('commits', 'g-pick-commit'),
  },

  // Node
  node: {
    // INFO / SWITCHING
    nv: 'node --version',
    nls: 'npm list --depth=0',
    nls1: 'npm list --depth=1',
    nlsg: 'npm list --depth=0 --global',
    nlsg1: 'npm list --depth=1 --global',
    nvls: {
      default: '. $NVM_DIR/nvm.sh && nvm list $*',
      win32: 'nvm list $*',
    },
    nvlsa: {
      default: '. $NVM_DIR/nvm.sh && nvm list-remote $*',
      win32: 'nvm list available $*',
    },
    nvu: {
      default: {
        desc: '. $NVM_DIR/nvm.sh && nvm use $* (it does not affect the currect process)',
        code: NVU_CODE,
      },
      win32: {
        desc: 'nvm use $* (the 1st arg is replaced with the latest available version on the specified branch)',
        code: NVU_CODE,
      },
    },


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
      'light-server',
      'ts-node',
      'typescript',
      'yarn',
      '@angular/cli',
      '@gkalpak/aliases',
      '@gkalpak/ng-maintain',
    ].join(' '),
  },

  // angular.io
  aio: {
    // AIO-BUILDS DOCKER STUFF
    aiorm: 'docker stop aio & docker rm aio || true',
    aiobd: [
      'yarn --cwd ${0:`__a-builds-dir`}/dockerbuild/scripts-js --frozen-lockfile --non-interactive install',
      'yarn --cwd ${0:`__a-builds-dir`}/dockerbuild/scripts-js build',
      'docker build --tag aio-builds $* ${0:`__a-builds-dir`}/dockerbuild',
    ].join(' && '),
    aiord: 'docker run -d --dns 127.0.0.1 --name aio -p 80:80 -p 443:443 $* aio-builds',
    aioatt: 'docker exec -it aio /bin/bash',
    aioall: 'aiorm && aiobd && aiord && aioatt',


    // PRIVATE
    '__a-builds-dir': A_BUILDS_DIR_SPEC(),
  },

  // Misc
  misc: {
    // DIRECTORY LISTING
    ll: 'ls -hl $*',
    lla: 'ls -ahl $*',


    // SELF-UPDATE
    salfup: `npm install --global ${pkg.name}`,

    // VERSION
    alv: {
      desc: `Display the installed version of ${pkg.name}.`,
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
        'require(\'../../lib/helper\').help(process.argv[2]);',
      ].join('\n'),
    },
  },
};

// Exports
module.exports = {
  ALIASES,
  BIN_DIR,
  DEF_CODE,
  DESC_REPLACEMENTS,
  ROOT_DIR,
  VERSION_STAMP,
};
