'use strict';

// Imports
const inquirer = require('inquirer');
const gbp = require('../../lib/gbp');
const runner = require('../../lib/runner');
const utils = require('../../lib/utils');
const {async} = require('../testUtils');

// Tests
describe('gbp()', () => {
  beforeEach(() => {
    spyOn(console, 'log');
    spyOn(inquirer, 'prompt').and.returnValue(Promise.resolve(''));
    spyOn(runner, 'run').and.returnValue(Promise.resolve(''));
    spyOn(utils, 'onError');
  });

  it('should be a function', () => {
    expect(gbp).toEqual(jasmine.any(Function));
  });

  describe('(dryrun)', () => {
    it('should return a resolved promise', async(() => {
      return gbp({dryrun: true});
    }));

    it('should log a short description', async(() => {
      const cmdDesc = 'Pick one from {{git branch}}';

      return gbp({dryrun: true}).
        then(() => expect(console.log).toHaveBeenCalledWith(cmdDesc));
    }));
  });

  describe('(no dryrun)', () => {
    it('should return a promise', async(() => {
      return gbp({});
    }));

    it('should run `git branch` (and return the output)', async(() => {
      return gbp({}).
        then(() => expect(runner.run).toHaveBeenCalledWith('git branch', [], {returnOutput: true}));
    }));

    it('should return `git branch` output even if `config.returnOutput` is false (but not affect `config`)',
      async(() => {
        const config = {returnOutput: false};

        return gbp(config).then(() => {
          expect(runner.run).toHaveBeenCalledWith('git branch', [], {returnOutput: true});
          expect(config.returnOutput).toBe(false);
        });
      })
    );

    it('should handle errors', async(() => {
      runner.run.and.returnValue(Promise.reject('test'));

      return gbp({}).
        then(() => expect(utils.onError).toHaveBeenCalledWith('test'));
    }));

    describe('picking a branch', () => {
      let branches;
      const verifyPromptedWith = (prop, value) => () => expect(inquirer.prompt).toHaveBeenCalledWith([
        jasmine.objectContaining({[prop]: value}),
      ]);

      beforeEach(() => {
        branches = [];
        runner.run.and.callFake(() => Promise.resolve(branches.join('\n')));
      });

      it('should prompt the user to pick a branch', async(() => {
        return gbp({}).
          then(verifyPromptedWith('type', 'list')).
          then(verifyPromptedWith('message', 'Pick a branch:'));
      }));

      it('should pass the branches as options (as returned by `git branch`)', async(() => {
        branches = [
          'foo',
          'bar',
          'master',
        ];

        return gbp({}).
          then(verifyPromptedWith('choices', ['foo', 'bar', 'master']));
      }));

      it('should trim whitespace around branches', async(() => {
        branches = [
          '  foo  ',
          '\r\nbar\r\n',
          '\t\tmaster\t\t',
        ];

        return gbp({}).
          then(verifyPromptedWith('choices', ['foo', 'bar', 'master']));
      }));

      it('should ignore empty or whitespace-only lines', async(() => {
        branches = [
          'foo',
          '',
          ' \n bar \n ',
          ' \t\r\n',
          'master',
        ];

        return gbp({}).
          then(verifyPromptedWith('choices', ['foo', 'bar', 'master']));
      }));

      it('should mark the current branch (and remove leading `*`)', async(() => {
        branches = [
          '  foo',
          '* bar',
          '  master',
        ];

        return gbp({}).
          then(verifyPromptedWith('choices', ['foo', 'bar (current)', 'master']));
      }));

      it('should specify the default choice (if any)', async(() => {
        const branches1 = [
          '  foo',
          '  bar',
          '  master',
        ];
        const branches2 = [
          '  foo',
          '* bar',
          '  master',
        ];

        return Promise.resolve().
          then(() => branches = branches1).
          then(() => gbp({})).
          then(verifyPromptedWith('default', undefined)).
          then(() => branches = branches2).
          then(() => gbp({})).
          then(verifyPromptedWith('default', 'bar (current)'));
      }));
    });

    it('should log the selected branch', async(() => {
      inquirer.prompt.and.returnValue(Promise.resolve({branch: 'foo'}));

      return gbp({}).
        then(() => expect(console.log).toHaveBeenCalledWith('foo'));
    }));

    it('should remove the "current" marker from the selected branch\'s name', async(() => {
      inquirer.prompt.and.returnValue(Promise.resolve({branch: 'foo (current)'}));

      return gbp({}).
        then(() => expect(console.log).toHaveBeenCalledWith('foo'));
    }));
  });
});
