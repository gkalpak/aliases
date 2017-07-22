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
   - `--al-dryrun`*: Print the commands instead of actually running them (hopefully).

<sub>(*): This is still an experimental feature and not guaranteed to work as expected.</sub>

Run `halp` for a list of all available aliases.


## TODO

- Add support for `halp <group>`.
- Test/Fix/Improve commands (`nvu`):
  - Some commands are currently broken (e.g. `nvu`).
  - Some commands are Windows-specific (e.g. `nvu`).
- Document that `ng-maintain` is a peer dependency (+ show in `halp` (if not installed?)) and
    which commands require it (e.g. in `halp`).
    (Or make a real dependency - if it works for global bin scripts.)
- Add unit tests.
- (?) Add support for different commands, based on current OS.


[build-status]: https://travis-ci.org/gkalpak/aliases
[build-status-image]: https://travis-ci.org/gkalpak/aliases.svg?branch=master
