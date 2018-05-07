'use strict';

// Imports
const fs = require('fs');
const path = require('path');
const aBuildsDir = require('../../lib/a-builds-dir');
const utils = require('../../lib/utils');
const {async, reversePromise} = require('../test-utils');

// Tests
describe('aBuildsDir()', () => {
  beforeEach(() => {
    let resolveCount = 0;

    spyOn(console, 'log');
    spyOn(fs, 'exists').and.callFake((p, cb) => cb(true));
    spyOn(fs, 'stat').and.callFake((p, cb) => cb(null, {isDirectory: () => true}));
    spyOn(path, 'resolve').and.callFake(p => `/absolute/${++resolveCount}/${p}`);
    spyOn(utils, 'onError').and.callFake(err => Promise.reject(err));
  });

  it('should be a function', () => {
    expect(aBuildsDir).toEqual(jasmine.any(Function));
  });

  describe('(dryrun)', () => {
    it('should return a resolved promise', async(() => {
      return aBuildsDir({dryrun: true});
    }));

    it('should log a short description', async(() => {
      const cmdDesc = 'Get the absolute path to \'.../angular/aio/aio-builds-setup/\'.';

      return aBuildsDir({dryrun: true}).
        then(() => expect(console.log).toHaveBeenCalledWith(cmdDesc));
    }));
  });

  describe('(no dryrun)', () => {
    it('should return a promise', async(() => {
      return aBuildsDir({});
    }));

    it('should handle errors', async(() => {
      path.resolve.and.callFake(() => { throw 'test'; });

      return reversePromise(aBuildsDir({})).
        then(() => expect(utils.onError).toHaveBeenCalledWith('test'));
    }));

    describe('locating the directory', () => {
      it('should look at `./aio/aio-builds-setup/`', async(() => {
        path.resolve.and.callFake(p => (p === 'aio/aio-builds-setup') ?
          '/ng/1/aio/aio-builds-setup' : '/wrong/path');

        return aBuildsDir({}).
          then(() => expect(path.resolve).toHaveBeenCalledTimes(1)).
          then(() => expect(console.log).toHaveBeenCalledWith('/ng/1/aio/aio-builds-setup'));
      }));

      it('should look at `./aio-builds-setup/` next', async(() => {
        path.resolve.and.callFake(p => (p === 'aio-builds-setup') ?
          '/ng/2/aio/aio-builds-setup' : '/wrong/path');

        return aBuildsDir({}).
          then(() => expect(path.resolve).toHaveBeenCalledTimes(2)).
          then(() => expect(console.log).toHaveBeenCalledWith('/ng/2/aio/aio-builds-setup'));
      }));

      it('should look at `./` next', async(() => {
        path.resolve.and.callFake(p => (p === '') ?
          '/ng/3/aio/aio-builds-setup' : '/wrong/path');

        return aBuildsDir({}).
          then(() => expect(path.resolve).toHaveBeenCalledTimes(3)).
          then(() => expect(console.log).toHaveBeenCalledWith('/ng/3/aio/aio-builds-setup'));
      }));

      it('should fail (with an informative error) if unable to locate the directory', async(() => {
        path.resolve.and.returnValue('/wrong/path');

        return reversePromise(aBuildsDir({})).
          then(err => expect(err.message).toBe(
            'Unable to locate the \'.../aio/aio-setup-builds/\' directory.\n' +
            'Make sure you run the command from within either \'angular/\', \'angular/aio/\', or ' +
            '\'angular/aio/aio-builds-setup/\'.'));
      }));

      it('should verify that the directory matches `.../aio/aio-builds-setup/`', async(() => {
        path.resolve.and.returnValues(
          '/ng/aio/foo',
          '/ng/notaio/aio-builds-setup',
          '/ng/1/aio/aio-builds-setup',
          '/ng/aio/aio-builds-setup/bar',
          '/ng/aio/aio-builds-setupnot',
          '/ng/2/aio/aio-builds-setup');

        return Promise.resolve().
          then(() => aBuildsDir({})).
          then(() => expect(console.log).toHaveBeenCalledWith('/ng/1/aio/aio-builds-setup')).
          then(() => aBuildsDir({})).
          then(() => expect(console.log).toHaveBeenCalledWith('/ng/2/aio/aio-builds-setup'));
      }));

      it('should verify that the directory exists', async(() => {
        let existsCallIdx = -1;
        fs.exists.and.callFake((p, cb) => cb(Boolean(++existsCallIdx % 2)));
        path.resolve.and.returnValues('/ng/1/aio/aio-builds-setup', '/ng/2/aio/aio-builds-setup');

        return aBuildsDir({}).
          then(() => expect(console.log).toHaveBeenCalledWith('/ng/2/aio/aio-builds-setup'));
      }));

      it('should verify that the directory is a...directory', async(() => {
        let statCallIdx = -1;
        fs.stat.and.callFake((p, cb) => cb(null, {isDirectory: () => Boolean(++statCallIdx % 2)}));
        path.resolve.and.returnValues('/ng/1/aio/aio-builds-setup', '/ng/2/aio/aio-builds-setup');

        return aBuildsDir({}).
          then(() => expect(console.log).toHaveBeenCalledWith('/ng/2/aio/aio-builds-setup'));
      }));

      it('should fail if `fs.stat()` fails', async(() => {
        fs.stat.and.callFake((p, cb) => cb('test'));

        return reversePromise(aBuildsDir({})).
          then(() => expect(utils.onError).toHaveBeenCalledWith('test'));
      }));

      describe('(debug mode)', () => {
        it('should log the currently checked directory', async(() => {
          const debugMsg = (i, p) => `Checking '${p}' (resolved to '/absolute/${i}/${p}')...`;
          fs.exists.and.callFake((p, cb) => cb(false));

          return Promise.resolve().
            then(() => reversePromise(aBuildsDir({}))).
            then(() => expect(console.log).not.toHaveBeenCalled()).
            then(() => reversePromise(aBuildsDir({debug: true}))).
            then(() => {
              expect(console.log).toHaveBeenCalledTimes(3);
              expect(console.log).toHaveBeenCalledWith(debugMsg(4, 'aio/aio-builds-setup'));
              expect(console.log).toHaveBeenCalledWith(debugMsg(5, 'aio-builds-setup'));
              expect(console.log).toHaveBeenCalledWith(debugMsg(6, ''));
            });
        }));

        it('should log the found directory', async(() => {
          const foundRe = /^Target directory found: /;
          fs.exists.and.callFake((p, cb) => cb(p !== '/absolute/2/aio/aio-builds-setup'));

          return Promise.resolve().
            // Directory found, but not in debug mode.
            then(() => aBuildsDir({})).
            // In debug mode, but directory not found.
            then(() => reversePromise(aBuildsDir({debug: true}))).
            then(() => {
              const allArgs = console.log.calls.allArgs().map(args => args[0]);
              allArgs.forEach(arg => expect(arg).not.toMatch(foundRe));
            }).
            // Directory found and in debug mode.
            then(() => aBuildsDir({debug: true})).
            then(() => {
              const foundMsg = 'Target directory found: /absolute/5/aio/aio-builds-setup';
              expect(foundMsg).toMatch(foundRe);
              expect(console.log).toHaveBeenCalledWith(foundMsg);
            });
        }));
      });
    });

    describe('output', () => {
      it('should log the absolute directory path', async(() => {
        return Promise.resolve().
          then(() => aBuildsDir({})).
          then(result => expect(result).toBeUndefined()).
          then(() => expect(console.log).toHaveBeenCalledWith('/absolute/1/aio/aio-builds-setup')).
          then(() => aBuildsDir({returnOutput: false})).
          then(result => expect(result).toBeUndefined()).
          then(() => expect(console.log).toHaveBeenCalledWith('/absolute/2/aio/aio-builds-setup'));
      }));

      it('should return the absolute directory path if `returnOutput` is `true`', async(() => {
        return aBuildsDir({returnOutput: true}).
          then(result => expect(result).toBe('/absolute/1/aio/aio-builds-setup')).
          then(() => expect(console.log).not.toHaveBeenCalled());
      }));
    });
  });
});
