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
    gs   // git status
    gl1  // git log --decorate --oneline
    lla  // ls -ahl
    nv   // node --version
    nls  // npm list --depth=0
    ```

3. All aliases also accept the following arguments:
    - `--gkcu-debug`: Produce verbose, debug-friendly output.
    - `--gkcu-dryrun`*: Print the command instead of actually running it.
    - `--gkcu-sapVersion`: Choose a different implementation for the command runner. (Default: 2)
    - `--gkcu-suppressTbj`*: Suppress the "Terminate batch job (Y/N)?" confirmation on Windows.

    See [cli-utils] for more details.

    NOTE: All arguments starting with `--gkcu-` will be ignored when substituting input arguments or
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

- `git`: [git] >=2.35
- `docker`: [docker] >= 17
- `grep`: [grep] >=3 (could come through a bash emulation environment on Windows, such as [git for
    Windows][git-win]' `Git BASH`)
- `http-server`: [http-server] >=0.12.0 (installed globally via [npm] or [yarn])
- `light-server`: [light-server] >=2.5.0 (installed globally via [npm] or [yarn])
- `ls`: [ls] >=8 (could come through a bash emulation environment on Windows, such as [git for
    Windows][git-win]' `Git BASH`)
- `ngm-diff-wh`: `ngm-diff-wh` >=0.0.4 (part of the [ng-maintain] suite)
- `ngm-pr-merge`: `ngm-pr-merge` >=0.0.4 (part of the [ng-maintain] suite)
- `node`: [Node.js][node] >=16
- `npm`: [npm] >=3 (comes bundled with Node.js)
- `nvm`: [nvm] >=0.30 (on *nix) / [nvm-windows][nvm-win] >=1 (on Windows)
- `yarn`: [yarn] >=0.24

## Testing

The following test-types/modes are available:

- **Code-linting:** `npm run lint`
  _Lint JavaScript files using ESLint._

- **Unit tests:** `npm run test-unit`
  _Run all the unit tests once. These tests are quick and suitable to be run on every change._

- **E2E tests:** `npm run test-e2e`
  _Run all the end-to-end tests once. These test may hit actual API endpoints or perform expensive
  I/O operations and are considerably slower than unit tests._

- **All tests:** `npm test` / `npm run test`
  _Run all of the above tests (code-linting, unit tests, e2e tests). This command is automatically
  run before every release (via `npm run release`)._

- **"Dev" mode:** `npm run dev`
  _Watch all files and rerun linting and the unit tests whenever something changes. For performance
  reasons, e2e tests are omitted._

## TODO

Things I want to (but won't necessarily) do:

- Investigate `suppressTbj` issue (e.g. `nrx`/`yrx`) on Node.js v10.2.0-10.10.0+.
- Add more e2e tests.
- Add aliases for:
  - Updating to the latest Node.js version on a branch. E.g. `nvup 6` would:
    - Install the latest 6.x version.
    - Install packages (either via `naga` or by looking at the previously installed 6.x version).
    - Uninstall older 6.x versions.
  - Installing the latest Node.js version on a branch. E.g. `nvi 8` would:
    - Install the latest 8.x version.
    - Install packages (either via `naga` or by looking at the highest installed version).


[build-status]: https://github.com/gkalpak/aliases/actions/workflows/ci.yml
[build-status-image]: https://github.com/gkalpak/aliases/actions/workflows/ci.yml/badge.svg?branch=master&event=push
[cli-utils]: https://www.npmjs.com/package/@gkalpak/cli-utils
[docker]: https://www.docker.com/
[git]: https://git-scm.com/
[git-win]: https://git-for-windows.github.io/
[grep]: https://en.wikipedia.org/wiki/Grep
[http-server]: https://www.npmjs.com/package/http-server
[light-server]: https://www.npmjs.com/package/light-server
[ls]: https://en.wikipedia.org/wiki/Ls
[ng-maintain]: https://www.npmjs.com/package/@gkalpak/ng-maintain
[node]: https://nodejs.org/en/
[npm]: https://www.npmjs.com/
[nvm]: https://github.com/creationix/nvm
[nvm-win]: https://github.com/coreybutler/nvm-windows
[yarn]: https://yarnpkg.com/lang/en/
