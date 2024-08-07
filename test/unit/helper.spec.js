// Imports
import stripAnsi from 'strip-ansi';

import {ALIASES, _testing as constantsTesting, VERSION_STAMP} from '../../lib/constants.js';
import {help, _testing as helperTesting} from '../../lib/helper.js';
import {capitalize, stripIndentation, _testing as utilsTesting, wrapLine} from '../../lib/utils.js';


// Tests
describe('helper', () => {
  describe('.help()', () => {
    const categories = Object.entries(ALIASES).map(([name, spec]) => ({name, spec}));
    const categoryToHeading = (cat, partial) => capitalize(`${cat.name} aliases${partial ? ' subset' : ''}`);
    const getHelpMessage = async (...args) => {
      await help(...args);
      return stripAnsi(consoleLogSpy.calls.mostRecent().args[0]);
    };
    let consoleLogSpy;
    let helpForCategorySpy;

    beforeEach(() => {
      consoleLogSpy = spyOn(console, 'log');
      helpForCategorySpy = spyOn(helperTesting, '_helpForCategory').and.callThrough();
      spyOn(utilsTesting, '_onError').and.callFake(err => Promise.reject(err));
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
          expect(consoleLogSpy).not.toHaveBeenCalled();

          await help(...args);
          expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        });

        it('should display the version stamp', async () => {
          const msg = await getHelpMessage(...args);
          expect(msg).toContain(VERSION_STAMP);
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
        helpForCategorySpy.and.callFake(cat => `helpForCategory(${cat.name})`);
        const msg = await getHelpMessage();

        categories.forEach(cat => {
          expect(helpForCategorySpy).toHaveBeenCalledWith(cat, jasmine.any(String));
          expect(msg).toContain(`helpForCategory(${cat.name})`);
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
        const expectedNote = wrapLine(
            '(NOTE: All arguments starting with `--gkcu-` will be ignored when substituting input arguments or ' +
            'determining their index.)');
        const msg = await getHelpMessage();

        expect(msg).toContain(expectedNote);
      });
    });

    describe('(for specific category)', () => {
      const chainCategoryTestFactory = runAssertions => async (prev, cat) => {
        await prev;
        const msg = await getHelpMessage(cat.name);
        runAssertions(msg, cat);
        helpForCategorySpy.calls.reset();
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
        helpForCategorySpy.and.callFake(cat => `helpForCategory(${cat.name})`);

        const runAssertions = (msg, cat) => categories.forEach(c => {
          const heading = `helpForCategory(${c.name})`;
          if (c === cat) {
            expect(helpForCategorySpy).toHaveBeenCalledWith(c, jasmine.any(String));
            expect(msg).toContain(heading);
          } else {
            expect(helpForCategorySpy).not.toHaveBeenCalledWith(c, jasmine.any(String));
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
        const expectedNote = wrapLine(
            '(NOTE: All arguments starting with `--gkcu-` will be ignored when substituting input arguments or ' +
            'determining their index.)');

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

      it('should contain "subset" category sections for found aliases', async () => {
        const msg1 = await getHelpMessage('gs', 'nv');

        expect(msg1).toContain(categoryToHeading({name: 'git', partial: true}));
        expect(msg1).toContain(categoryToHeading({name: 'node', partial: true}));
        expect(msg1).not.toContain(categoryToHeading({name: 'aio'}));
        expect(msg1).not.toContain(categoryToHeading({name: 'misc'}));
        expect(msg1).not.toContain(categoryToHeading({name: 'unknown'}));

        const msg2 = await getHelpMessage('gs');

        expect(msg2).toContain(categoryToHeading({name: 'git', partial: true}));
        expect(msg2).not.toContain(categoryToHeading({name: 'node'}));
        expect(msg2).not.toContain(categoryToHeading({name: 'aio'}));
        expect(msg2).not.toContain(categoryToHeading({name: 'misc'}));
        expect(msg2).not.toContain(categoryToHeading({name: 'unknown'}));
      });

      it('should contain an "unknown" section for missing aliases', async () => {
        const msg1 = await getHelpMessage('xgs', 'xnv');
        expect(msg1).toContain(categoryToHeading({name: 'unknown'}));
        categories.forEach(cat => expect(msg1).not.toContain(categoryToHeading(cat)));

        const msg2 = await getHelpMessage('xgs');
        expect(msg2).toContain(categoryToHeading({name: 'unknown'}));
        categories.forEach(cat => expect(msg1).not.toContain(categoryToHeading(cat)));
      });

      it('should contain both category-subset and "unknown" sections (if necessary)', async () => {
        const msg1 = await getHelpMessage('gs', 'xgs', 'nv', 'xnv');

        expect(msg1).toContain(categoryToHeading({name: 'git', partial: true}));
        expect(msg1).toContain(categoryToHeading({name: 'node', partial: true}));
        expect(msg1).toContain(categoryToHeading({name: 'unknown'}));
        expect(msg1).not.toContain(categoryToHeading({name: 'aio'}));
        expect(msg1).not.toContain(categoryToHeading({name: 'misc'}));

        const msg2 = await getHelpMessage('gs', 'xgs');

        expect(msg2).toContain(categoryToHeading({name: 'git', partial: true}));
        expect(msg2).toContain(categoryToHeading({name: 'unknown'}));
        expect(msg2).not.toContain(categoryToHeading({name: 'node'}));
        expect(msg2).not.toContain(categoryToHeading({name: 'aio'}));
        expect(msg2).not.toContain(categoryToHeading({name: 'misc'}));
      });

      it('should support wildcards', async () => {
        // Multiple arguments.
        const msg1 = await getHelpMessage('gd*', 'nv');

        expect(msg1).toContain(categoryToHeading({name: 'git', partial: true}));
        expect(msg1).toMatch(/\bgd\b/);
        expect(msg1).toMatch(/\bgdn\b/);
        expect(msg1).toMatch(/\bgd1\b/);
        expect(msg1).toMatch(/\bgdn1\b/);
        expect(msg1).toMatch(/\bgdh\b/);
        expect(msg1).toMatch(/\bgdnh\b/);

        expect(msg1).toContain(categoryToHeading({name: 'node', partial: true}));
        expect(msg1).toMatch(/\bnv\b/);

        expect(msg1).not.toContain(categoryToHeading({name: 'unknown'}));

        // Single argument.
        const msg2 = await getHelpMessage('gdn*');

        expect(msg1).toContain(categoryToHeading({name: 'git', partial: true}));
        expect(msg2).toMatch(/\bgdn\b/);
        expect(msg2).toMatch(/\bgdn1\b/);
        expect(msg2).toMatch(/\bgdnh\b/);
        expect(msg2).not.toMatch(/\bgd\b/);
        expect(msg2).not.toMatch(/\bgd1\b/);
        expect(msg2).not.toMatch(/\bgdh\b/);

        expect(msg2).not.toContain(categoryToHeading({name: 'unknown'}));
      });

      it('should not contain an "unknown" section if only wildcards are missing', async () => {
        const msg1 = await getHelpMessage('xgd*', 'nv');

        expect(msg1).toContain(categoryToHeading({name: 'node', partial: true}));
        expect(msg1).toMatch(/\bnv\b/);
        expect(msg1).not.toContain(categoryToHeading({name: 'git'}));
        expect(msg1).not.toContain(categoryToHeading({name: 'unknown'}));
        expect(msg1).not.toMatch(/\bxgd\b/);

        const msg2 = await getHelpMessage('xgd*', 'xnv');

        expect(msg2).toContain(categoryToHeading({name: 'unknown'}));
        expect(msg2).not.toContain(categoryToHeading({name: 'git'}));
        expect(msg2).not.toContain(categoryToHeading({name: 'node'}));
        expect(msg1).not.toMatch(/\bxgd\b/);
      });

      it('should handle not matching anything', async () => {
        const msg1 = await getHelpMessage('xgd*', 'xnv*');
        categories.forEach(cat => expect(msg1).not.toContain(categoryToHeading(cat)));
        expect(msg1).not.toContain(categoryToHeading({name: 'unknown'}));
        expect(msg1).toContain('Nothing to see here');

        const msg2 = await getHelpMessage('xgd*');
        categories.forEach(cat => expect(msg1).not.toContain(categoryToHeading(cat)));
        expect(msg2).not.toContain(categoryToHeading({name: 'unknown'}));
        expect(msg2).toContain('Nothing to see here');
      });

      it('should not mention "universal" arguments at all', async () => {
        const msg1 = await getHelpMessage('gst', 'foo');
        expect(msg1).not.toContain('--gkcu-');

        const msg2 = await getHelpMessage('gst');
        expect(msg2).not.toContain('--gkcu-');

        const msg3 = await getHelpMessage('gst*');
        expect(msg3).not.toContain('--gkcu-');

        const msg4 = await getHelpMessage('foo');
        expect(msg4).not.toContain('--gkcu-');
      });
    });
  });

  describe('._helpForCategory()', () => {
    const _helpForCategory = helperTesting._helpForCategory;
    const joiner = ' ~ ';
    const mockAlias = description => {
      const mockSpec = {code: '', description};
      return {getSpec: () => mockSpec};
    };

    it('should be a function', () => {
      expect(_helpForCategory).toEqual(jasmine.any(Function));
    });

    it('should return help for the specified category', () => {
      const category = {
        name: 'test',
        spec: {foo: mockAlias('bar'), baz: mockAlias('qux')},
      };
      const expected = stripIndentation(`
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
      const expected = stripIndentation(`
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
      const expected = stripIndentation(`
        Test aliases:

          foo ${joiner}bar
          bazz${joiner}quux
      `);

      expect(stripAnsi(_helpForCategory(category, joiner))).toBe(expected);
    });

    it('should replace certain strings in descriptions', () => {
      spyOn(constantsTesting, '_getDescReplacements').and.returnValue({test: '~TeSt~'});

      const category = {
        name: 'test',
        spec: {
          foo: mockAlias('foo --test'),
          bar: mockAlias('test --bar-- test'),
          baz: mockAlias('baz(test)'),
          qux: mockAlias('-test- qux -test-'),
        },
      };
      const expected = stripIndentation(`
        Test aliases:

          foo${joiner}foo --~TeSt~
          bar${joiner}~TeSt~ --bar-- ~TeSt~
          baz${joiner}baz(~TeSt~)
          qux${joiner}-~TeSt~- qux -~TeSt~-
      `);

      expect(stripAnsi(_helpForCategory(category, joiner))).toBe(expected);
    });

    it('should wrap long descriptions (using `utils.wrapLine()`)', () => {
      const wrapLineSpy = spyOn(utilsTesting, '_wrapLine').and.callThrough();

      const wrapIndent = ' '.repeat(10);
      const category = {
        name: 'test',
        spec: {foo: mockAlias('bar'), bazzz: mockAlias('qux')},
      };

      expect(wrapLineSpy).not.toHaveBeenCalled();

      _helpForCategory(category, joiner);

      expect(wrapLineSpy).toHaveBeenCalledTimes(2);
      expect(wrapLineSpy).toHaveBeenCalledWith('bar', wrapIndent);
      expect(wrapLineSpy).toHaveBeenCalledWith('qux', wrapIndent);
    });
  });
});
