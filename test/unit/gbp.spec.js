'use strict';

// Imports
const inquirer = require('inquirer');
const gbp = require('../../lib/gbp');
const runner = require('../../lib/runner');
const utils = require('../../lib/utils');

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
    it('should return a resolved promise', done => {
      gbp({dryrun: true}).then(done);
    });

    it('should log a short description', done => {
      const cmdDesc = 'Pick one from {{git branch}}';

      gbp({dryrun: true}).
        then(() => expect(console.log).toHaveBeenCalledWith(cmdDesc)).
        then(done);
    });
  });

  describe('(no dryrun)', () => {
    it('should return a promise', done => {
      gbp({}).then(done);
    });

    it('should run `git branch` (and return the output)', done => {
      gbp({}).
        then(() => expect(runner.run).toHaveBeenCalledWith('git branch', [], {returnOutput: true})).
        then(done);
    });

    it('should return `git branch` output even if `config.returnOutput` is false (but not affect `config`)', done => {
      const config = {returnOutput: false};

      gbp(config).
        then(() => {
          expect(runner.run).toHaveBeenCalledWith('git branch', [], {returnOutput: true});
          expect(config.returnOutput).toBe(false);
        }).
        then(done);
    });

    it('should handle errors', done => {
      runner.run.and.returnValue(Promise.reject('test'));

      gbp({}).
        then(() => expect(utils.onError).toHaveBeenCalledWith('test')).
        then(done);
    });

    describe('picking a branch', () => {
      let branches;
      const verifyPromptedWith = (prop, value) => () => expect(inquirer.prompt).toHaveBeenCalledWith([
        jasmine.objectContaining({[prop]: value}),
      ]);

      beforeEach(() => {
        branches = [];
        runner.run.and.callFake(() => Promise.resolve(branches.join('\n')));
      });

      it('should prompt the user to pick a branch', done => {
        gbp({}).
          then(verifyPromptedWith('type', 'list')).
          then(verifyPromptedWith('message', 'Pick a branch:')).
          then(done);
      });

      it('should pass the branches as options (as returned by `git branch`)', done => {
        branches = [
          'foo',
          'bar',
          'master',
        ];

        gbp({}).
          then(verifyPromptedWith('choices', ['foo', 'bar', 'master'])).
          then(done);
      });

      it('should trim whitespace around branches', done => {
        branches = [
          '  foo  ',
          '\r\nbar\r\n',
          '\t\tmaster\t\t',
        ];

        gbp({}).
          then(verifyPromptedWith('choices', ['foo', 'bar', 'master'])).
          then(done);
      });

      it('should ignore empty or whitespace-only lines', done => {
        branches = [
          'foo',
          '',
          ' \n bar \n ',
          ' \t\r\n',
          'master',
        ];

        gbp({}).
          then(verifyPromptedWith('choices', ['foo', 'bar', 'master'])).
          then(done);
      });

      it('should mark the current branch (and remove leading `*`)', done => {
        branches = [
          '  foo',
          '* bar',
          '  master',
        ];

        gbp({}).
          then(verifyPromptedWith('choices', ['foo', 'bar (current)', 'master'])).
          then(done);
      });

      it('should specify the default choice (if any)', done => {
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

        Promise.resolve().
          then(() => branches = branches1).
          then(() => gbp({})).
          then(verifyPromptedWith('default', undefined)).
          then(() => branches = branches2).
          then(() => gbp({})).
          then(verifyPromptedWith('default', 'bar (current)')).
          then(done);
      });
    });

    it('should log the selected branch', done => {
      inquirer.prompt.and.returnValue(Promise.resolve({branch: 'foo'}));

      gbp({}).
        then(() => expect(console.log).toHaveBeenCalledWith('foo')).
        then(done);
    });

    it('should remove the "current" marker from the selected branch\'s name', done => {
      inquirer.prompt.and.returnValue(Promise.resolve({branch: 'foo (current)'}));

      gbp({}).
        then(() => expect(console.log).toHaveBeenCalledWith('foo')).
        then(done);
    });
  });
});
