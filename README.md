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

3. Pass `--debug` as argument to any command for debug-friendly output.

Run `halp` for a list of all available aliases.


## TODO

- Add unit tests.
- Fix/Improve commands. E.g.:
  - Some commands are currently broken (e.g. `gcp(l)`, `nvu`).
  - Some commands are Windows-specific (e.g. `gcp(l)`, `nvu`).
  - Some commands would benefit from default/fallback values, e.g.:
    - `gsync` --> master
    - `gcp(l)` --> current branch
    - ...
  - ...
- Add support for default args (with same syntax on all OSes).
- (?) Add support for different commands, based on current OS.
- ...


[build-status]: https://travis-ci.org/gkalpak/aliases
[build-status-image]: https://travis-ci.org/gkalpak/aliases.svg?branch=master
