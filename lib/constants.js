'use strict';

// Imports
const path = require('path');
const pkg = require('../package.json');
const {Alias, AliasDefault, AliasSpec, AliasSpecDefault, AliasUnknown} = require('./alias');
const utils = require('./utils');

// Constants
const VERSION_STAMP = `${pkg.name} v${pkg.version}`;
const ROOT_DIR = path.resolve(__dirname, '..');
const BIN_DIR = path.join(ROOT_DIR, 'bin');
const SOURCE_NVM_CMD = '. $NVM_DIR/nvm.sh';

const DESC_REPLACEMENTS = {
  [AliasUnknown.DESCRIPTION]: '???',
  '::__a-builds-dir': '(<.../angular/aio/aio-builds-setup>)',
  '::__g-pick-branch --gkcu-returnOutput=1': '(interactively pick a branch)',
  '::__g-pick-commit --gkcu-returnOutput=1': '(interactively pick a commit)',
};

const DEF_CODE = AliasSpecDefault.DEF_CODE = (cmd, cfg = {}) => utils.stripIndentation(`
  #!/usr/bin/env node
  'use strict';
  // eslint-disable-next-line max-len
  const cmd = module.exports = '${cmd.replace(/'/g, '\\\'')}';
  if (require.main === module) {
    const {commandUtils} = require('@gkalpak/cli-utils');
    const {onError} = require('../../lib/utils');
    const {args, config} = commandUtils.preprocessArgs(process.argv.slice(2));
    // eslint-disable-next-line quotes
    commandUtils.run(cmd, args, Object.assign(${JSON.stringify(cfg)}, config)).catch(onError);
  }
`);

const SCRIPT_BACKED_CODE = (scriptName, desc) => utils.stripIndentation(`
  #!/usr/bin/env node
  'use strict';
  module.exports = '${desc.replace(/'/g, '\\\'')}';
  if (require.main === module) {
    const {commandUtils} = require('@gkalpak/cli-utils');
    const {onError} = require('../../lib/utils');
    const {args, config} = commandUtils.preprocessArgs(process.argv.slice(2));

    const {main} = require('../../lib/alias-scripts/${scriptName}');
    main(args, config).catch(onError);
  }
`);

const SCRIPT_BACKED_ALIAS = (scriptName, desc) => {
  const code = SCRIPT_BACKED_CODE(scriptName, desc);
  return new Alias(new AliasSpec(code, desc));
};

const ALIASES = {
  // Git
  git: {
    // STATUS
    gs: new AliasDefault('git status $*'),
    gl: new AliasDefault('git log --decorate $* || true'),
    gl1: new AliasDefault('git log --decorate --oneline $* || true'),
    gl1g: new AliasDefault('git log --decorate --oneline | grep $*'),
    gsh: new AliasDefault('git show ${*:::__g-pick-commit --gkcu-returnOutput=1}'),
    gshn: new AliasDefault('git show --name-only ${*:::__g-pick-commit --gkcu-returnOutput=1}'),
    gd: new AliasDefault('ngm-diff-wh $*'),
    gdn: new AliasDefault('ngm-diff-wh --name-only $*'),
    gdh: new AliasDefault('ngm-diff-wh HEAD $*'),
    gdnh: new AliasDefault('ngm-diff-wh HEAD --name-only $*'),
    gd1: new AliasDefault('ngm-diff-wh HEAD~1 $*'),
    gdn1: new AliasDefault('ngm-diff-wh HEAD~1 --name-only $*'),

    // STASH
    gst: new AliasDefault('git stash $*'),
    gstk: new AliasDefault('git stash save --keep-index $*'),
    gstl: new AliasDefault('git stash list $*'),
    gstp: new AliasDefault('git stash pop --index $*'),

    // CHECKOUT
    gco: new AliasDefault('git checkout ${*:::__g-pick-branch --gkcu-returnOutput=1}'),
    gcom: new AliasDefault('git checkout master $*'),
    gcopr: new AliasDefault('git fetch upstream pull/$1/head && git checkout FETCH_HEAD'),
    gcoghpr: SCRIPT_BACKED_ALIAS('gcoghpr', 'Check out a GitHub pull request as a local branch.'),

    // ADD / COMMIT
    gaa: new AliasDefault('git add --all $*'),
    gcm: new AliasDefault('git commit --all $*'),
    gcmi: new AliasDefault('git commit $*'),
    gcmf: new AliasDefault('git commit --all --fixup HEAD~${1:0} $2*'),
    gcmif: new AliasDefault('git commit --fixup HEAD~${1:0} $2*'),
    gcmfc: new AliasDefault('git commit --all --fixup ${0:::__g-pick-commit --gkcu-returnOutput=1} $*'),
    gcmifc: new AliasDefault('git commit --fixup ${0:::__g-pick-commit --gkcu-returnOutput=1} $*'),
    gcmfs: new AliasDefault('git commit --all --fixup :/$1 $2*'),
    gcmifs: new AliasDefault('git commit --fixup :/$1 $2*'),
    gcma: new AliasDefault('git commit --all --amend $*'),
    gcmia: new AliasDefault('git commit --amend $*'),
    gcmane: new AliasDefault('git commit --all --amend --no-edit $*'),
    gcmiane: new AliasDefault('git commit --amend --no-edit $*'),

    // PUSH
    gp: new AliasDefault('git push --verbose $*'),
    gp1: new AliasDefault('git push --set-upstream --verbose $2* origin ${1:::git rev-parse --abbrev-ref HEAD}'),
    gpf: new AliasDefault('git push --force-with-lease --verbose $*'),


    // BRANCH
    gb: new AliasDefault('git branch $*'),
    gbc: new AliasDefault('git checkout master -b $1 && git push --set-upstream --verbose origin $1'),
    gbd: new AliasDefault('git branch --delete --force ${*:::__g-pick-branch --gkcu-returnOutput=1}'),

    // PULL(-REBASE)
    gpr: new AliasDefault('git pull --rebase $*'),
    gpro: new AliasDefault('git pull --rebase origin ${*:::git rev-parse --abbrev-ref HEAD}'),
    gprom: new AliasDefault('git pull --rebase origin master $*'),
    gpru: new AliasDefault('git pull --rebase upstream ${*:::git rev-parse --abbrev-ref HEAD}'),
    gprum: new AliasDefault('git pull --rebase upstream master $*'),

    // SYNC MASTER
    gsync: new AliasDefault('git checkout ${1:master} && git pull upstream ${1:master} && git push origin ${1:master}'),


    // REBASE
    grb: new AliasDefault('git rebase ${*:::__g-pick-branch --gkcu-returnOutput=1}'),
    grbm: new AliasDefault('git rebase master $*'),
    grbi: new AliasDefault('git rebase --interactive HEAD~$1'),
    grbia: new AliasDefault('git rebase --autosquash --interactive HEAD~$1'),
    grbin: new AliasDefault('git rebase --no-autosquash --interactive HEAD~$1'),
    grbc: new AliasDefault('git rebase --continue'),
    grba: new AliasDefault('git rebase --abort'),
    gmt: new AliasDefault('git mergetool'),
    gcl: new AliasDefault('git clean --interactive ${0:::git rev-parse --show-toplevel}'),


    // MERGE NG PR
    gngprh: new AliasDefault('ngm-pr-merge $* --instructions'),
    gngprm: new AliasDefault('ngm-pr-merge $*'),

    // BACKPORT
    gcp: new AliasDefault('git cherry-pick $*'),
    gcpc: new AliasDefault('git cherry-pick --continue'),
    gcpa: new AliasDefault('git cherry-pick --abort'),
    gcpx: new AliasDefault(utils.stripIndentation(`
      echo "  Cherry-picking SHA: $1  " &&
      echo "----------------------------------------------------------------" &&
      echo "                                                                " &&
      git checkout \${2:::__g-pick-branch --gkcu-returnOutput=1} &&
      git pull --rebase origin \${2:::__g-pick-branch --gkcu-returnOutput=1} &&
      git cherry-pick $1 &&
      ngm-diff-wh origin/\${2:::__g-pick-branch --gkcu-returnOutput=1} &&
      (git log --decorate || true) &&
      echo "                                                                " &&
      echo "----------------------------------------------------------------" &&
      echo "     >>>  (Don't forget to manually push the changes.)  <<<     "
    `).replace(/\r?\n/g, ' ')),
    gcpxl: new AliasDefault('gcpx ${0:::git rev-parse HEAD} $*'),


    // PRIVATE
    '__g-pick-branch': SCRIPT_BACKED_ALIAS('g-pick-branch', '[PRIVATE]: Pick one from a list of branches.'),
    '__g-pick-commit': SCRIPT_BACKED_ALIAS('g-pick-commit', '[PRIVATE]: Pick one from a list of commits.'),
  },

  // Node.js
  node: {
    // INFO / SWITCHING
    nv: new AliasDefault('node --version'),
    nls: new AliasDefault('npm list --depth=0'),
    nls1: new AliasDefault('npm list --depth=1'),
    nlsg: new AliasDefault('npm list --depth=0 --global'),
    nlsg1: new AliasDefault('npm list --depth=1 --global'),
    nvls: new Alias({
      default: new AliasSpecDefault(`${SOURCE_NVM_CMD} && nvm use \${0:::node --version} --silent && nvm list $*`),
      win32: new AliasSpecDefault('nvm list $*'),
    }),
    nvlsa: new Alias({
      default:
        new AliasSpecDefault(`${SOURCE_NVM_CMD} && nvm use \${0:::node --version} --silent && nvm list-remote $*`),
      win32: new AliasSpecDefault('nvm list available $*'),
    }),
    nvu: new Alias({
      default: new AliasSpec(
        SCRIPT_BACKED_CODE('nvu', 'nvm use $*'),
        `${SOURCE_NVM_CMD} && nvm use $* (it does not affect the currect process)`),
      win32: new AliasSpec(
        SCRIPT_BACKED_CODE('nvu', 'nvm use $*'),
        'nvm use $* (the 1st arg is replaced with the latest available version on the specified branch)'),
    }),


    // INSTALL / UNINSTALL
    nap: new AliasDefault('npm install $* --save'),
    nad: new AliasDefault('npm install $* --save-dev'),
    nrp: new AliasDefault('npm remove $* --save'),
    nrd: new AliasDefault('npm remove $* --save-dev'),
    yap: new AliasDefault('yarn add $*'),
    yad: new AliasDefault('yarn add $* --dev'),
    yrp: new AliasDefault('yarn remove $*'),
    yrd: new AliasDefault('yarn remove $* --dev'),


    // RUN / TEST
    nr: new AliasDefault('npm run $*'),
    ns: new AliasDefault('npm start $*'),
    nt: new AliasDefault('npm test $*'),
    yr: new AliasDefault('yarn run $*'),
    ys: new AliasDefault('yarn start $*'),
    yt: new AliasDefault('yarn test $*'),

    // `suppressTbj` causes issues on Node.js v10.2.0+.
    // (Jobs do not exit without additional interaction; e.g. hitting ENTER or switching focus ¯\_(ツ)_/¯)
    nrx: new AliasDefault('npm run $*', {suppressTbj: true}),
    nsx: new AliasDefault('npm start $*', {suppressTbj: true}),
    ntx: new AliasDefault('npm test $*', {suppressTbj: true}),
    yrx: new AliasDefault('yarn run $*', {suppressTbj: true}),
    ysx: new AliasDefault('yarn start $*', {suppressTbj: true}),
    ytx: new AliasDefault('yarn test $*', {suppressTbj: true}),


    // SPECIAL
    srv: new AliasDefault(
      'light-server --bind="localhost" --historyindex="/index.html" --no-reload --serve="${1:.}" $2*',
      {suppressTbj: true}),
    srvw: new AliasDefault(
      'light-server --bind="localhost" --historyindex="/index.html" --serve="${1:.}" --watchexp="${1:.}/**" $2*',
      {suppressTbj: true}),
    niga: new AliasDefault('npm install --global ' + [
      '@angular/cli',
      '@gkalpak/aliases',
      '@gkalpak/cli-utils',
      '@gkalpak/ng-maintain',
      'csslint',
      'eslint',
      'firebase-tools',
      'grunt-cli',
      'gulp-cli',
      'http-server',
      'light-server',
      'shelljs',
      'ts-node',
      'typescript',
      'watch',
      'yarn',
    ].join(' ')),
  },

  // angular.io
  aio: {
    // AIO-BUILDS DOCKER STUFF
    aiorm: new AliasDefault('docker stop aio & docker rm aio || true'),
    aiobd: new AliasDefault([
      'yarn --cwd ${0:::__a-builds-dir}/dockerbuild/scripts-js --frozen-lockfile --non-interactive install',
      'yarn --cwd ${0:::__a-builds-dir}/dockerbuild/scripts-js build',
      'docker build --tag aio-builds $* ${0:::__a-builds-dir}/dockerbuild',
    ].join(' && ')),
    aiord: new AliasDefault('docker run -d --dns 127.0.0.1 --name aio -p 80:80 -p 443:443 $* aio-builds'),
    aioatt: new AliasDefault('docker exec -it aio /bin/bash'),
    aioall: new AliasDefault('aiorm && aiobd && aiord && aioatt'),


    // PRIVATE
    '__a-builds-dir': SCRIPT_BACKED_ALIAS(
      'a-builds-dir', '[PRIVATE]: Return the absolute path to \'.../angular/aio/aio-builds-setup/\'.'),
  },

  // Misc
  misc: {
    // DIRECTORY LISTING
    ll: new AliasDefault('ls -hl $*'),
    lla: new AliasDefault('ls -ahl $*'),


    // SELF-UPDATE
    salfup: new AliasDefault(`npm install --global ${pkg.name}`),

    // VERSION
    alv: new Alias(new AliasSpec(
      utils.stripIndentation(`
        #!/usr/bin/env node
        'use strict';
        console.log('${VERSION_STAMP}');
      `),
      `Display the installed version of ${pkg.name}.`)),

    // HELP
    halp: new Alias(new AliasSpec(
      utils.stripIndentation(`
        #!/usr/bin/env node
        'use strict';
        require('../../lib/helper').help(...process.argv.slice(2));
      `),
      'Display this message.')),
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
