'use strict';

// Imports
const constants = require('../../lib/constants');
const helper = require('../../lib/helper');
const utils = require('../../lib/utils');
const {async} = require('../test-utils');

// Tests
describe('helper', () => {
  describe('.help()', () => {
    const help = helper.help;
    const categories = Object.keys(constants.ALIASES);
    const categoryToHeading = cat => `${utils.capitalize(cat)} aliases`;

    beforeEach(() => {
      spyOn(console, 'log');
      spyOn(helper, '_helpForCategory').and.callThrough();
      spyOn(utils, 'onError');
    });

    it('should be a function', () => {
      expect(help).toEqual(jasmine.any(Function));
    });

    [null, 'misc'].forEach(category => {
      describe(category ? '(for specific category)' : '(for all categories)', () => {
        const getHelpMessage = () => help(category).then(() => console.log.calls.mostRecent().args[0]);

        it('should return a promise', async(() => {
          return help(category);
        }));

        it('should log a help message', async(() => {
          expect(console.log).not.toHaveBeenCalled();
          return help(category).
            then(() => expect(console.log).toHaveBeenCalledTimes(1));
        }));

        it('should display the version stamp', async(() => {
          return getHelpMessage().
            then(msg => expect(msg).toContain(constants.VERSION_STAMP));
        }));

        it('should mention "universal" arguments', async(() => {
          return getHelpMessage().
            then(msg => {
              expect(msg).toContain('--al-debug');
              expect(msg).toContain('--al-dryrun');
            });
        }));

        it('should mention ignoring `--al-` arguments', async(() => {
          const expected = utils.wrapLine(
            '(NOTE: All arguments starting with `--al-` will be ignored when substituting input arguments or ' +
            'determining their index.)', 0);

          return getHelpMessage().
            then(msg => expect(msg).toContain(expected));
        }));
      });
    });

    describe('(for all categories)', () => {
      const getHelpMessage = () => help().then(() => console.log.calls.mostRecent().args[0]);

      it('should contain "Available aliases"', async(() => {
        return getHelpMessage().
          then(msg => expect(msg).toContain('Available aliases'));
      }));

      it('should contain all aliases', async(() => {
        return getHelpMessage().
          then(msg => categories.forEach(cat => expect(msg).toContain(categoryToHeading(cat))));
      }));

      it('should contain help for each category', async(() => {
        helper._helpForCategory.and.callFake(catName => `_helpForCategory(${catName})`);

        return getHelpMessage().
          then(msg => categories.forEach(cat => {
            expect(helper._helpForCategory).toHaveBeenCalledWith(cat, constants.ALIASES[cat], jasmine.any(String));
            expect(msg).toContain(`_helpForCategory(${cat})`);
          }));
      }));
    });

    describe('(for specific category)', () => {
      const getHelpMessage = cat => help(cat).then(() => console.log.calls.mostRecent().args[0]);

      it('should not contain "Available aliases"', async(() => {
        return getHelpMessage('foo').
          then(msg => expect(msg).not.toContain('Available aliases'));
      }));

      it('should only contain aliases for the specified category', async(() => {
        const expectToOnlyContain = (msg, cat) => categories.forEach(c => {
          const heading = categoryToHeading(c);
          if (c === cat) {
            expect(msg).toContain(heading);
          } else {
            expect(msg).not.toContain(heading);
          }
        });
        const chainCategoryTest = (aggr, cat) => aggr.
          then(() => getHelpMessage(cat)).
          then(msg => expectToOnlyContain(msg, cat));

        return categories.
          reduce(chainCategoryTest, Promise.resolve());
      }));

      it('should only contain help for the specified category', async(() => {
        helper._helpForCategory.and.callFake(catName => `_helpForCategory(${catName})`);

        const expectToOnlyContain = (msg, cat) => categories.forEach(c => {
          const message = `_helpForCategory(${c})`;
          if (c === cat) {
            expect(helper._helpForCategory).toHaveBeenCalledWith(c, constants.ALIASES[c], jasmine.any(String));
            expect(msg).toContain(message);
          } else {
            expect(helper._helpForCategory).not.toHaveBeenCalledWith(c, constants.ALIASES[c], jasmine.any(String));
            expect(msg).not.toContain(message);
          }
        });
        const chainCategoryTest = (aggr, cat) => aggr.
          then(() => getHelpMessage(cat)).
          then(msg => expectToOnlyContain(msg, cat)).
          then(() => helper._helpForCategory.calls.reset());

        return categories.
          reduce(chainCategoryTest, Promise.resolve());
      }));
    });
  });

  describe('._helpForCategory()', () => {
    const _helpForCategory = helper._helpForCategory;
    const originalDescReplacements = constants.DESC_REPLACEMENTS;

    afterEach(() => constants.DESC_REPLACEMENTS = originalDescReplacements);

    it('should be a function', () => {
      expect(_helpForCategory).toEqual(jasmine.any(Function));
    });

    it('should return help for the specified category', () => {
      const catName = 'test';
      const catSpec = {foo: 'bar', baz: 'qux'};
      const joiner = ' ~ ';

      const expected =
        'Test aliases:\n' +
        '\n' +
        '  foo ~ bar\n' +
        '  baz ~ qux\n';

      expect(_helpForCategory(catName, catSpec, joiner)).toBe(expected);
    });

    it('should pad all alias names to the same length', () => {
      const catName = 'test';
      const catSpec = {foo: 'bar', bazzz: 'qux'};
      const joiner = ' ~ ';

      const expected =
        'Test aliases:\n' +
        '\n' +
        '  foo   ~ bar\n' +
        '  bazzz ~ qux\n';

      expect(_helpForCategory(catName, catSpec, joiner)).toBe(expected);
    });

    it('should ignore `__`-prefixed (private) aliases', () => {
      const catName = 'test';
      const catSpec = {foo: 'bar', __baz: 'qux'};
      const joiner = ' ~ ';

      const expected =
        'Test aliases:\n' +
        '\n' +
        '  foo   ~ bar\n';

      expect(_helpForCategory(catName, catSpec, joiner)).toBe(expected);
    });

    it('should use `utils.getSpec()` to retrieve the spec for each alias', () => {
      spyOn(utils, 'getSpec').and.callThrough();

      const catName = 'test';
      const catSpec = {foo: 'bar', baz: 'qux'};
      const joiner = ' ~ ';

      expect(utils.getSpec).not.toHaveBeenCalled();

      _helpForCategory(catName, catSpec, joiner);

      expect(utils.getSpec).toHaveBeenCalledTimes(2);
      expect(utils.getSpec).toHaveBeenCalledWith(catSpec, 'foo');
      expect(utils.getSpec).toHaveBeenCalledWith(catSpec, 'baz');
    });

    it('should use `spec.desc` if available', () => {
      const catName = 'test';
      const catSpec = {foo: 'bar', baz: {desc: 'qux'}};
      const joiner = ' ~ ';

      const expected =
        'Test aliases:\n' +
        '\n' +
        '  foo ~ bar\n' +
        '  baz ~ qux\n';

      expect(_helpForCategory(catName, catSpec, joiner)).toBe(expected);
    });

    it('should replace certain strings in descriptions', () => {
      constants.DESC_REPLACEMENTS = {test: '~TeSt~'};
      const catName = 'test';
      const catSpec = {
        foo: 'foo --test',
        bar: 'test --bar-- test',
        baz: {desc: 'baz(test)'},
        qux: {desc: '-test- qux -test-'},
      };
      const joiner = ' ~ ';

      const expected =
        'Test aliases:\n' +
        '\n' +
        '  foo ~ foo --~TeSt~\n' +
        '  bar ~ ~TeSt~ --bar-- ~TeSt~\n' +
        '  baz ~ baz(~TeSt~)\n' +
        '  qux ~ -~TeSt~- qux -~TeSt~-\n';

      expect(_helpForCategory(catName, catSpec, joiner)).toBe(expected);
    });

    it('should wrap long descriptions (using `utils.wrapLine()`)', () => {
      spyOn(utils, 'wrapLine').and.callThrough();

      const catName = 'test';
      const catSpec = {foo: 'bar', bazzz: 'qux'};
      const joiner = ' ~ ';

      expect(utils.wrapLine).not.toHaveBeenCalled();

      _helpForCategory(catName, catSpec, joiner);

      expect(utils.wrapLine).toHaveBeenCalledTimes(2);
      expect(utils.wrapLine).toHaveBeenCalledWith('bar', 10);
      expect(utils.wrapLine).toHaveBeenCalledWith('qux', 10);
    });
  });
});
