'use strict';

// Imports
const constants = require('../../lib/constants');
const helper = require('../../lib/helper');
const utils = require('../../lib/utils');

// Tests
describe('helper', () => {
  describe('.help()', () => {
    const help = helper.help;
    const categories = Object.keys(constants.ALIASES);
    const categoryToHeading = cat => `${utils.capitalize(cat)} aliases`;

    beforeEach(() => {
      spyOn(console, 'log');
      spyOn(helper, '_helpForCategory').and.callThrough();
      spyOn(utils, 'onError').and.callFake(err => Promise.reject(err));
    });

    it('should be a function', () => {
      expect(help).toEqual(jasmine.any(Function));
    });

    [null, 'misc'].forEach(category => {
      describe(category ? '(for specific category)' : '(for all categories)', () => {
        const getHelpMessage = async () => {
          await help(category);
          return console.log.calls.mostRecent().args[0];
        };

        it('should return a promise', async () => {
          const promise = help(category);
          expect(promise).toEqual(jasmine.any(Promise));

          await promise;
        });

        it('should log a help message', async () => {
          expect(console.log).not.toHaveBeenCalled();

          await help(category);
          expect(console.log).toHaveBeenCalledTimes(1);
        });

        it('should display the version stamp', async () => {
          const msg = await getHelpMessage();
          expect(msg).toContain(constants.VERSION_STAMP);
        });

        it('should mention "universal" arguments', async () => {
          const msg = await getHelpMessage();

          expect(msg).toContain('--gkcu-debug');
          expect(msg).toContain('--gkcu-dryrun');
          expect(msg).toContain('--gkcu-suppressTbj');
        });

        it('should mention ignoring `--gkcu-` arguments', async () => {
          const expected = utils.wrapLine(
            '(NOTE: All arguments starting with `--gkcu-` will be ignored when substituting input arguments or ' +
            'determining their index.)', 0);
          const msg = await getHelpMessage();

          expect(msg).toContain(expected);
        });
      });
    });

    describe('(for all categories)', () => {
      const getHelpMessage = async () => {
        await help();
        return console.log.calls.mostRecent().args[0];
      };

      it('should contain "Available aliases"', async () => {
        const msg = await getHelpMessage();
        expect(msg).toContain('Available aliases');
      });

      it('should contain all aliases', async () => {
        const msg = await getHelpMessage();
        categories.forEach(cat => expect(msg).toContain(categoryToHeading(cat)));
      });

      it('should contain help for each category', async () => {
        helper._helpForCategory.and.callFake(catName => `_helpForCategory(${catName})`);
        const msg = await getHelpMessage();

        categories.forEach(cat => {
          expect(helper._helpForCategory).toHaveBeenCalledWith(cat, constants.ALIASES[cat], jasmine.any(String));
          expect(msg).toContain(`_helpForCategory(${cat})`);
        });
      });
    });

    describe('(for specific category)', () => {
      const getHelpMessage = async cat => {
        await help(cat);
        return console.log.calls.mostRecent().args[0];
      };

      it('should not contain "Available aliases"', async () => {
        const msg = await getHelpMessage('foo');
        expect(msg).not.toContain('Available aliases');
      });

      it('should only contain aliases for the specified category', async () => {
        const expectToOnlyContain = (msg, cat) => categories.forEach(c => {
          const heading = categoryToHeading(c);
          if (c === cat) {
            expect(msg).toContain(heading);
          } else {
            expect(msg).not.toContain(heading);
          }
        });
        const chainCategoryTest = async (prev, cat) => {
          await prev;
          const msg = await getHelpMessage(cat);
          expectToOnlyContain(msg, cat);
        };

        await categories.reduce(chainCategoryTest, Promise.resolve());
      });

      it('should only contain help for the specified category', async () => {
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
        const chainCategoryTest = async (prev, cat) => {
          await prev;
          const msg = await getHelpMessage(cat);
          expectToOnlyContain(msg, cat);
          helper._helpForCategory.calls.reset();
        };

        await categories.reduce(chainCategoryTest, Promise.resolve());
      });
    });
  });

  describe('._helpForCategory()', () => {
    const _helpForCategory = helper._helpForCategory;
    const originalDescReplacements = constants.DESC_REPLACEMENTS;
    const mockAlias = description => {
      const mockSpec = {code: '', description};
      return {getSpec: () => mockSpec};
    };

    afterEach(() => constants.DESC_REPLACEMENTS = originalDescReplacements);

    it('should be a function', () => {
      expect(_helpForCategory).toEqual(jasmine.any(Function));
    });

    it('should return help for the specified category', () => {
      const catName = 'test';
      const catSpec = {foo: mockAlias('bar'), baz: mockAlias('qux')};
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
      const catSpec = {foo: mockAlias('bar'), bazzz: mockAlias('qux')};
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
      const catSpec = {foo: mockAlias('bar'), __baz: mockAlias('qux')};
      const joiner = ' ~ ';

      const expected =
        'Test aliases:\n' +
        '\n' +
        '  foo   ~ bar\n';

      expect(_helpForCategory(catName, catSpec, joiner)).toBe(expected);
    });

    it('should replace certain strings in descriptions', () => {
      constants.DESC_REPLACEMENTS = {test: '~TeSt~'};
      const catName = 'test';
      const catSpec = {
        foo: mockAlias('foo --test'),
        bar: mockAlias('test --bar-- test'),
        baz: mockAlias('baz(test)'),
        qux: mockAlias('-test- qux -test-'),
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
      const catSpec = {foo: mockAlias('bar'), bazzz: mockAlias('qux')};
      const joiner = ' ~ ';

      expect(utils.wrapLine).not.toHaveBeenCalled();

      _helpForCategory(catName, catSpec, joiner);

      expect(utils.wrapLine).toHaveBeenCalledTimes(2);
      expect(utils.wrapLine).toHaveBeenCalledWith('bar', 10);
      expect(utils.wrapLine).toHaveBeenCalledWith('qux', 10);
    });
  });
});
