# aliases [![Build Status][build-status-image]][build-status]

_Warning:_
_This is still an experimental tool._
_Use at your own risk!_


## Description

My global aliases packaged as a node module for easy installation/update across machines.


## Usage

1. Install globally. E.g.:

    ```shell
    npm install --global @gkalpak/aliases
    ```

2. Use from anywhere. For example:

    ```shell
    gs    // git status
    gl1   // git log --decorate --oneline
    lla   // ls -ahl
    nv    // node --version
    nls   // npm list --depth=0
    ```

3. All aliases also accept the following arguments:
    - `--al-debug`: Produce verbose, debug-friendly output.
    - `--al-dryrun`*: Print the command instead of actually running it.
    - `--al-suppressTbj`*: Suppress the "Terminate batch job (Y/N)?" confirmation on Windows.


    NOTE: All arguments starting with `--al-` will be ignored when substituting input arguments or
    determining their index.

    <sub>(*): This is still an experimental feature and not guaranteed to work as expected.</sub>

Run `halp` for a list of all available aliases.
Run `halp <category>` for a list of available aliases for a particular category (e.g. `git`, `node`,
`misc`).


## Global Dependencies

Obviously, aliases refer to other global commands/scripts. In order for an alias to work, the
corresponding command must be globally available. You can see each alias' global dependency by
inspecting the associated command (e.g. via `halp`).

Here is the list of all global dependencies with associated min. version (older versions are not guaranteed work):

- `git`: [git] >=1.8
- `docker`: [docker] >= 17
- `ls`: [ls] >=8 (could come through a bash emulation environment on Windows, such as [git for
    Windows][git-win]' `Git BASH`)
- `ngm-diff-wh`: `ngm-diff-wh` >=0.0.4 (part of the [ng-maintain] suite)
- `ngm-pr-merge`: `ngm-pr-merge` >=0.0.4 (part of the [ng-maintain] suite)
- `node`: [Node.js][node] >=6
- `npm`: [npm] >=3 (comes bundled with Node.js)
- `nvm`: [nvm] >=0.30 (on *nix) / [nvm-windows][nvm-win] >=1 (on Windows)
- `yarn`: [yarn] >=0.24

## TODO

- Add more unit tests for `runner.spawnAsPromised()`.
- Add e2e tests.
- Add aliases for:
  - Updating to the latest Node version on a branch. E.g. `nvup 6` would:
    - Install the latest 6.x version.
    - Install packages (either via `niga` or by looking at the previously installed 6.x version).
    - Uninstall older 6.x versions.
  - Installing the latest Node version on a branch. E.g. `nvi 8` would:
    - Install the latest 8.x version.
    - Install packages (either via `niga` or by looking at the highest installed version).


[build-status]: https://travis-ci.org/gkalpak/aliases
[build-status-image]: https://travis-ci.org/gkalpak/aliases.svg?branch=master
[docker]: https://www.docker.com/
[git]: https://git-scm.com/
[git-win]: https://git-for-windows.github.io/
[ls]: https://en.wikipedia.org/wiki/Ls
[ng-maintain]: https://www.npmjs.com/package/@gkalpak/ng-maintain
[node]: https://nodejs.org/en/
[npm]: https://www.npmjs.com/
[nvm]: https://github.com/creationix/nvm
[nvm-win]: https://github.com/coreybutler/nvm-windows
[yarn]: https://yarnpkg.com/lang/en/
