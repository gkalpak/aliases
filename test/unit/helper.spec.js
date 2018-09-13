'use strict';

// Imports
const stripAnsi = require('strip-ansi');
const constants = require('../../lib/constants');
const helper = require('../../lib/helper');
const utils = require('../../lib/utils');

// Tests
describe('helper', () => {
  describe('.help()', () => {
    const help = helper.help;
    const categories = Object.keys(constants.ALIASES).map(name => ({name, spec: constants.ALIASES[name]}));
    const categoryToHeading = cat => `${utils.capitalize(cat.name)} aliases`;
    const getHelpMessage = async (...args) => {
      await help(...args);
      return stripAnsi(console.log.calls.mostRecent().args[0]);
    };

    beforeEach(() => {
      spyOn(console, 'log');
      spyOn(helper, '_helpForCategory').and.callThrough();
      spyOn(utils, 'onError').and.callFake(err => Promise.reject(err));
    });

    it('should be a function', () => {
      expect(help).toEqual(jasmine.any(Function));
    });

    [
      ['all categories', []],
      ['specific category', ['misc']],
      ['specific aliases', ['gs', 'nv', 'aioall', 'll']],
    ].forEach(([desc, args]) => {
      describe(`(for ${desc})`, () => {
        it('should return a promise', async () => {
          const promise = help(...args);
          expect(promise).toEqual(jasmine.any(Promise));

          await promise;
        });

        it('should log a help message', async () => {
          expect(console.log).not.toHaveBeenCalled();

          await help(...args);
          expect(console.log).toHaveBeenCalledTimes(1);
        });

        it('should display the version stamp', async () => {
          const msg = await getHelpMessage(...args);
          expect(msg).toContain(constants.VERSION_STAMP);
        });
      });
    });

    describe('(for all categories)', () => {
      it('should contain "Available aliases"', async () => {
        const msg = await getHelpMessage();
        expect(msg).toContain('Available aliases');
      });

      it('should contain all aliases', async () => {
        const msg = await getHelpMessage();
        categories.forEach(cat => expect(msg).toContain(categoryToHeading(cat)));
      });

      it('should contain help for each category', async () => {
        helper._helpForCategory.and.callFake(cat => `_helpForCategory(${cat.name})`);
        const msg = await getHelpMessage();

        categories.forEach(cat => {
          expect(helper._helpForCategory).toHaveBeenCalledWith(cat, jasmine.any(String));
          expect(msg).toContain(`_helpForCategory(${cat.name})`);
        });
      });

      it('should mention "universal" arguments', async () => {
        const msg = await getHelpMessage();

        expect(msg).toContain('--gkcu-debug');
        expect(msg).toContain('--gkcu-dryrun');
        expect(msg).toContain('--gkcu-sapVersion');
        expect(msg).toContain('--gkcu-suppressTbj');
      });

      it('should mention ignoring `--gkcu-` arguments', async () => {
        const expectedNote = utils.wrapLine(
          '(NOTE: All arguments starting with `--gkcu-` will be ignored when substituting input arguments or ' +
          'determining their index.)', 0);
        const msg = await getHelpMessage();

        expect(msg).toContain(expectedNote);
      });
    });

    describe('(for specific category)', () => {
      const chainCategoryTestFactory = (runAssertions) => async (prev, cat) => {
        await prev;
        const msg = await getHelpMessage(cat.name);
        runAssertions(msg, cat);
        helper._helpForCategory.calls.reset();
      };

      it('should not contain "Available aliases"', async () => {
        const msg = await getHelpMessage('misc');
        expect(msg).not.toContain('Available aliases');
      });

      it('should only contain aliases for the specified category', async () => {
        const runAssertions = (msg, cat) => categories.forEach(c => {
          const heading = categoryToHeading(c);
          if (c === cat) {
            expect(msg).toContain(heading);
          } else {
            expect(msg).not.toContain(heading);
          }
        });
        const chainCategoryTest = chainCategoryTestFactory(runAssertions);

        await categories.reduce(chainCategoryTest, Promise.resolve());
      });

      it('should only contain help for the specified category', async () => {
        helper._helpForCategory.and.callFake(cat => `_helpForCategory(${cat.name})`);

        const runAssertions = (msg, cat) => categories.forEach(c => {
          const heading = `_helpForCategory(${c.name})`;
          if (c === cat) {
            expect(helper._helpForCategory).toHaveBeenCalledWith(c, jasmine.any(String));
            expect(msg).toContain(heading);
          } else {
            expect(helper._helpForCategory).not.toHaveBeenCalledWith(c, jasmine.any(String));
            expect(msg).not.toContain(heading);
          }
        });
        const chainCategoryTest = chainCategoryTestFactory(runAssertions);

        await categories.reduce(chainCategoryTest, Promise.resolve());
      });

      it('should mention "universal" arguments', async () => {
        const runAssertions = msg => {
          expect(msg).toContain('--gkcu-debug');
          expect(msg).toContain('--gkcu-dryrun');
          expect(msg).toContain('--gkcu-sapVersion');
          expect(msg).toContain('--gkcu-suppressTbj');
        };
        const chainCategoryTest = chainCategoryTestFactory(runAssertions);

        await categories.reduce(chainCategoryTest, Promise.resolve());
      });

      it('should mention ignoring `--gkcu-` arguments', async () => {
        const expectedNote = utils.wrapLine(
          '(NOTE: All arguments starting with `--gkcu-` will be ignored when substituting input arguments or ' +
          'determining their index.)', 0);

        const runAssertions = msg => expect(msg).toContain(expectedNote);
        const chainCategoryTest = chainCategoryTestFactory(runAssertions);

        await categories.reduce(chainCategoryTest, Promise.resolve());
      });
    });

    describe('(for specific aliases)', () => {
      it('should not contain "Available aliases"', async () => {
        const msg1 = await getHelpMessage('gs', 'foo');
        expect(msg1).not.toContain('Available aliases');

        const msg2 = await getHelpMessage('gs');
        expect(msg2).not.toContain('Available aliases');

        const msg3 = await getHelpMessage('foo');
        expect(msg3).not.toContain('Available aliases');
      });

      it('should not contain category info', async () => {
        const headings = categories.map(categoryToHeading);

        const msg1 = await getHelpMessage('gs', 'foo');
        headings.forEach(h => expect(msg1).not.toContain(h));

        const msg2 = await getHelpMessage('gs');
        headings.forEach(h => expect(msg2).not.toContain(h));

        const msg3 = await getHelpMessage('foo');
        headings.forEach(h => expect(msg3).not.toContain(h));
      });

      it('should contain a "matched" section (with found aliases)', async () => {
        const msg1 = await getHelpMessage('gs', 'nv');
        expect(msg1).toContain(categoryToHeading({name: 'matched'}));
        expect(msg1).not.toContain(categoryToHeading({name: 'unknown'}));

        const msg2 = await getHelpMessage('gs');
        expect(msg2).toContain(categoryToHeading({name: 'matched'}));
        expect(msg2).not.toContain(categoryToHeading({name: 'unknown'}));
      });

      it('should contain an "unknown" section (with missing aliases)', async () => {
        const msg1 = await getHelpMessage('xgs', 'xnv');
        expect(msg1).not.toContain(categoryToHeading({name: 'matched'}));
        expect(msg1).toContain(categoryToHeading({name: 'unknown'}));

        const msg2 = await getHelpMessage('xgs');
        expect(msg2).not.toContain(categoryToHeading({name: 'matched'}));
        expect(msg2).toContain(categoryToHeading({name: 'unknown'}));
      });

      it('should contain both "matched" and "unknown" section (if necessary)', async () => {
        const msg1 = await getHelpMessage('gs', 'xgs', 'nv', 'xnv');
        expect(msg1).toContain(categoryToHeading({name: 'matched'}));
        expect(msg1).toContain(categoryToHeading({name: 'unknown'}));

        const msg2 = await getHelpMessage('gs', 'xgs');
        expect(msg2).toContain(categoryToHeading({name: 'matched'}));
        expect(msg2).toContain(categoryToHeading({name: 'unknown'}));
      });

      it('should support wildcards', async () => {
        const msg1 = await getHelpMessage('gd*', 'nv');
        expect(msg1).toContain(categoryToHeading({name: 'matched'}));
        expect(msg1).not.toContain(categoryToHeading({name: 'unknown'}));
        expect(msg1).toMatch(/\bgd\b/);
        expect(msg1).toMatch(/\bgdn\b/);
        expect(msg1).toMatch(/\bgd1\b/);
        expect(msg1).toMatch(/\bgdn1\b/);
        expect(msg1).toMatch(/\bgdh\b/);
        expect(msg1).toMatch(/\bgdnh\b/);
        expect(msg1).toMatch(/\bnv\b/);

        const msg2 = await getHelpMessage('gdn*');
        expect(msg2).toContain(categoryToHeading({name: 'matched'}));
        expect(msg2).not.toContain(categoryToHeading({name: 'unknown'}));
        expect(msg2).toMatch(/\bgdn\b/);
        expect(msg2).toMatch(/\bgdn1\b/);
        expect(msg2).toMatch(/\bgdnh\b/);
        expect(msg2).not.toMatch(/\bgd\b/);
        expect(msg2).not.toMatch(/\bgd1\b/);
        expect(msg2).not.toMatch(/\bgdh\b/);
      });

      it('should not contain an "unknown" section if only wildcards are missing', async () => {
        const msg1 = await getHelpMessage('xgd*', 'nv');
        expect(msg1).toContain(categoryToHeading({name: 'matched'}));
        expect(msg1).not.toContain(categoryToHeading({name: 'unknown'}));
        expect(msg1).toMatch(/\bnv\b/);
        expect(msg1).not.toMatch(/\bxgd\b/);

        const msg2 = await getHelpMessage('xgd*', 'xnv');
        expect(msg2).not.toContain(categoryToHeading({name: 'matched'}));
        expect(msg2).toContain(categoryToHeading({name: 'unknown'}));
      });

      it('should handle not matching anything', async () => {
        const msg1 = await getHelpMessage('xgd*', 'xnv*');
        expect(msg1).not.toContain(categoryToHeading({name: 'matched'}));
        expect(msg1).not.toContain(categoryToHeading({name: 'unknown'}));
        expect(msg1).toContain('Nothing to see here');

        const msg2 = await getHelpMessage('xgd*');
        expect(msg2).not.toContain(categoryToHeading({name: 'matched'}));
        expect(msg2).not.toContain(categoryToHeading({name: 'unknown'}));
        expect(msg2).toContain('Nothing to see here');
      });

      it('should not mention "universal" arguments at all', async () => {
        const msg1 = await getHelpMessage('gs', 'foo');
        expect(msg1).not.toContain('--gkcu-');

        const msg2 = await getHelpMessage('gs');
        expect(msg2).not.toContain('--gkcu-');

        const msg3 = await getHelpMessage('foo');
        expect(msg3).not.toContain('--gkcu-');
      });
    });
  });

  describe('._helpForCategory()', () => {
    const _helpForCategory = helper._helpForCategory;
    const originalDescReplacements = constants.DESC_REPLACEMENTS;
    const joiner = ' ~ ';
    const mockAlias = description => {
      const mockSpec = {code: '', description};
      return {getSpec: () => mockSpec};
    };

    afterEach(() => constants.DESC_REPLACEMENTS = originalDescReplacements);

    it('should be a function', () => {
      expect(_helpForCategory).toEqual(jasmine.any(Function));
    });

    it('should return help for the specified category', () => {
      const category = {
        name: 'test',
        spec: {foo: mockAlias('bar'), baz: mockAlias('qux')},
      };
      const expected = utils.stripIndentation(`
        Test aliases:

          foo${joiner}bar
          baz${joiner}qux
      `);

      expect(stripAnsi(_helpForCategory(category, joiner))).toBe(expected);
    });

    it('should pad all alias names to the same length', () => {
      const category = {
        name: 'test',
        spec: {foo: mockAlias('bar'), bazzz: mockAlias('qux')},
      };
      const expected = utils.stripIndentation(`
        Test aliases:

          foo  ${joiner}bar
          bazzz${joiner}qux
      `);

      expect(stripAnsi(_helpForCategory(category, joiner))).toBe(expected);
    });

    it('should ignore `__`-prefixed (private) aliases', () => {
      const category = {
        name: 'test',
        spec: {
          foo: mockAlias('bar'),
          __baz: mockAlias('qux'),
          bazz: mockAlias('quux'),
        },
      };
      const expected = utils.stripIndentation(`
        Test aliases:

          foo ${joiner}bar
          bazz${joiner}quux
      `);

      expect(stripAnsi(_helpForCategory(category, joiner))).toBe(expected);
    });

    it('should replace certain strings in descriptions', () => {
      constants.DESC_REPLACEMENTS = {test: '~TeSt~'};

      const category = {
        name: 'test',
        spec: {
          foo: mockAlias('foo --test'),
          bar: mockAlias('test --bar-- test'),
          baz: mockAlias('baz(test)'),
          qux: mockAlias('-test- qux -test-'),
        },
      };
      const expected = utils.stripIndentation(`
        Test aliases:

          foo${joiner}foo --~TeSt~
          bar${joiner}~TeSt~ --bar-- ~TeSt~
          baz${joiner}baz(~TeSt~)
          qux${joiner}-~TeSt~- qux -~TeSt~-
      `);

      expect(stripAnsi(_helpForCategory(category, joiner))).toBe(expected);
    });

    it('should wrap long descriptions (using `utils.wrapLine()`)', () => {
      spyOn(utils, 'wrapLine').and.callThrough();

      const category = {
        name: 'test',
        spec: {foo: mockAlias('bar'), bazzz: mockAlias('qux')},
      };

      expect(utils.wrapLine).not.toHaveBeenCalled();

      _helpForCategory(category, joiner);

      expect(utils.wrapLine).toHaveBeenCalledTimes(2);
      expect(utils.wrapLine).toHaveBeenCalledWith('bar', 10);
      expect(utils.wrapLine).toHaveBeenCalledWith('qux', 10);
    });
  });
});
