'use strict';

// Imports
const childProcess = require('child_process');
const runner = require('../../lib/runner');
const utils = require('../../lib/utils');
const {async, reversePromise, tickAsPromised} = require('../test-utils');

// Tests
describe('runner', () => {
  describe('.preprocessArgs()', () => {
    const preprocessArgs = runner.preprocessArgs;

    it('should be a function', () => {
      expect(preprocessArgs).toEqual(jasmine.any(Function));
    });

    it('should return an object with `args` and `config` properties', () => {
      const rawArgs = [];
      const result = jasmine.objectContaining({
        args: jasmine.any(Array),
        config: jasmine.any(Object),
      });

      expect(preprocessArgs(rawArgs)).toEqual(result);
    });

    it('should quote arguments with spaces', () => {
      const rawArgs = ['foo', 'bar baz', 'qux'];
      const result = jasmine.objectContaining({
        args: ['foo', '"bar baz"', 'qux'],
        config: jasmine.any(Object),
      });

      expect(preprocessArgs(rawArgs)).toEqual(result);
    });

    it('should remove `--al-`-prefixed arguments', () => {
      const rawArgs = ['foo', '--al-bar', 'baz', '--al-qux'];
      const result = jasmine.objectContaining({
        args: ['foo', 'baz'],
        config: jasmine.any(Object),
      });

      expect(preprocessArgs(rawArgs)).toEqual(result);
    });

    it('should use `--al-`-prefixed arguments to populate `config`', () => {
      const rawArgs = ['foo', '--al-bar', 'baz', '--al-qux'];
      const result = jasmine.objectContaining({
        args: jasmine.any(Array),
        config: {bar: true, qux: true},
      });

      expect(preprocessArgs(rawArgs)).toEqual(result);
    });
  });

  describe('.run()', () => {
    const run = runner.run;
    let cmd;
    let runtimeArgs;
    let config;

    beforeEach(() => {
      spyOn(runner, '_expandCmd').and.callFake(cmd => Promise.resolve(`expanded:${cmd}`));
      spyOn(runner, '_spawnAsPromised').and.returnValue(Promise.resolve(''));
      spyOn(utils, 'onError');

      cmd = 'foo --bar';
      runtimeArgs = ['baz', '--qux'];
      config = {quux: 'quuux'};
    });

    it('should be a function', () => {
      expect(run).toEqual(jasmine.any(Function));
    });

    it('should return a promise', async(() => {
      return run('');
    }));

    it('should expand the command', async(() => {
      return run(cmd, runtimeArgs, config).
        then(() => expect(runner._expandCmd).toHaveBeenCalledWith(cmd, runtimeArgs, config));
    }));

    it('should default to `[]` for `runtimeArgs`', async(() => {
      return run(cmd, null, config).
        then(() => expect(runner._expandCmd).toHaveBeenCalledWith(cmd, [], config));
    }));

    it('should default to `{}` for `config`', async(() => {
      return run(cmd, runtimeArgs, null).
        then(() => expect(runner._expandCmd).toHaveBeenCalledWith(cmd, runtimeArgs, {}));
    }));

    it('should call `_spawnAsPromised()` (with the expanded command)', async(() => {
      return run(cmd, runtimeArgs, config).
        then(() => expect(runner._spawnAsPromised).toHaveBeenCalledWith(`expanded:${cmd}`, config));
    }));

    it('should log debug info (in debug mode)', async(() => {
      spyOn(console, 'log');

      return Promise.resolve().
        then(() => run(cmd, runtimeArgs, config)).
        then(() => expect(console.log).not.toHaveBeenCalled()).
        then(() => run(cmd, runtimeArgs, {debug: true})).
        then(() => {
          expect(console.log).toHaveBeenCalledTimes(2);
          expect(console.log).toHaveBeenCalledWith(`Input command: '${cmd}'`);
          expect(console.log).toHaveBeenCalledWith(`Expanded command: 'expanded:${cmd}'`);
        });
    }));

    it('should pass errors to `utils.onError()`', async(() => {
      runner._expandCmd.and.returnValues(Promise.reject('expandCmd error'), Promise.resolve(''));
      runner._spawnAsPromised.and.returnValue(Promise.reject('spawnAsPromised error'));

      return Promise.
        all([
          run(cmd, runtimeArgs, config),
          run(cmd, runtimeArgs, config),
        ]).
        then(() => {
          expect(runner._expandCmd).toHaveBeenCalledTimes(2);
          expect(runner._spawnAsPromised).toHaveBeenCalledTimes(1);

          expect(utils.onError).toHaveBeenCalledTimes(2);
          expect(utils.onError).toHaveBeenCalledWith('expandCmd error');
          expect(utils.onError).toHaveBeenCalledWith('spawnAsPromised error');
        });
    }));
  });

  describe('._expandCmd()', () => {
    const _expandCmd = runner._expandCmd;
    let cmd;
    let runtimeArgs;
    let config;

    beforeEach(() => {
      cmd = 'foo --bar';
      runtimeArgs = ['baz', '"q u x"'];
      config = {quux: 'quuux'};
    });

    it('should be a function', () => {
      expect(_expandCmd).toEqual(jasmine.any(Function));
    });

    it('should return a promise', async(() => {
      return _expandCmd(cmd, runtimeArgs, config);
    }));

    it('should return the command unchanged if there is nothing to expand', async(() => {
      return _expandCmd(cmd, runtimeArgs, config).
        then(expandedCmd => expect(expandedCmd).toBe(cmd));
    }));

    it('should remove argument placeholders if there are no corresponding arguments', async(() => {
      cmd = 'foo $1 --bar ${2} $k $* $$ ${*} || _$* && $3*-${3*}';

      return _expandCmd(cmd, [], config).
        then(expandedCmd => expect(expandedCmd).toBe('foo --bar $k $$ || _ &&-'));
    }));

    it('should replace all occurences of `$*`/`${*}` with all arguments', async(() => {
      cmd = 'foo $* | ${*} | $* | ${*}';

      return _expandCmd(cmd, runtimeArgs, config).
        then(expandedCmd => expect(expandedCmd).toBe('foo baz "q u x" | baz "q u x" | baz "q u x" | baz "q u x"'));
    }));

    it('should replace all occurences of `$n*`/`${n*}` with all arguments (starting at `n`)', async(() => {
      cmd = 'foo $1* | ${1*} | $2* | ${2*} | $33* | ${33*}';

      return _expandCmd(cmd, runtimeArgs, config).
        then(expandedCmd => expect(expandedCmd).toBe('foo baz "q u x" | baz "q u x" | "q u x" | "q u x" | |'));
    }));

    it('should replace all occurrences of `$n`/`${n}` with the nth argument (1-based index)', async(() => {
      cmd = 'foo $2 | ${2} | $1 | ${1}';

      return _expandCmd(cmd, runtimeArgs, config).
        then(expandedCmd => expect(expandedCmd).toBe('foo "q u x" | "q u x" | baz | baz'));
    }));

    it('should always treat `$0`/`${0}` as not having an associated argument', async(() => {
      cmd = 'foo $0 | $1 | ${0}';

      return _expandCmd(cmd, runtimeArgs, config).
        then(expandedCmd => expect(expandedCmd).toBe('foo | baz |'));
    }));

    it('should not recognize `$0*`/`${0*}`', async(() => {
      cmd = 'foo $0* | $1* | ${0*} | ${2*}';

      return _expandCmd(cmd, runtimeArgs, config).
        then(expandedCmd => expect(expandedCmd).toBe('foo* | baz "q u x" | ${0*} | "q u x"'));
    }));

    it('should recognize argument placeholders even if not preceded by whitespace', async(() => {
      cmd = 'foo .$1. | -${2}- | 1$1*1 | 4${2*}4 | p$*p | $${*}$';
      const expectedCmd = 'foo .baz. | -"q u x"- | 1baz "q u x"1 | 4"q u x"4 | pbaz "q u x"p | $baz "q u x"$';

      return _expandCmd(cmd, runtimeArgs, config).
        then(expandedCmd => expect(expandedCmd).toBe(expectedCmd));
    }));

    describe('(with static fallback values)', () => {
      it('should ignore fallback values if actual values passed as arguments', async(() => {
        cmd = 'foo ${2:two} | ${2*:all-skip-1} | ${*:all}';

        return _expandCmd(cmd, runtimeArgs, config).
          then(expandedCmd => expect(expandedCmd).toBe('foo "q u x" | "q u x" | baz "q u x"'));
      }));

      it('should use fallback values if actual values not passed for specific argument', async(() => {
        cmd = 'foo ${3:three} | ${1*:all-skip-0} | ${3*:all-skip-2} | ${*:all}';

        return Promise.resolve().
          then(() => _expandCmd(cmd, runtimeArgs, config)).
          then(expandedCmd => expect(expandedCmd).toBe('foo three | baz "q u x" | all-skip-2 | baz "q u x"')).
          then(() => _expandCmd(cmd, [], config)).
          then(expandedCmd => expect(expandedCmd).toBe('foo three | all-skip-0 | all-skip-2 | all'));
      }));

      it('should always use fallback values for `$0`/`${0}`', async(() => {
        cmd = 'foo ${0:zero} | ${1} | ${0*:ooops} | $* | "${0:nil}"';

        return Promise.resolve().
          then(() => _expandCmd(cmd, runtimeArgs, config)).
          then(expandedCmd => expect(expandedCmd).toBe('foo zero | baz | ${0*:ooops} | baz "q u x" | "nil"')).
          then(() => _expandCmd(cmd, [], config)).
          then(expandedCmd => expect(expandedCmd).toBe('foo zero | | ${0*:ooops} | | "nil"'));
      }));

      it('should allow using "`" in fallback values (as long as not starting and ending with "`")', async(() => {
        cmd = 'foo ${3:t`h`r`e`e} | ${4:```4} | ${5:5````}';

        return _expandCmd(cmd, runtimeArgs, config).
          then(expandedCmd => expect(expandedCmd).toBe('foo t`h`r`e`e | ```4 | 5````'));
      }));
    });

    describe('(with commands as fallback values)', () => {
      beforeEach(() => {
        spyOn(runner, '_spawnAsPromised').and.callFake(rawCmd => Promise.resolve(`{{${rawCmd}}}`));
      });

      it('should recognize fallback values wrapped in "`" as commands', async(() => {
        cmd = 'foo ${3:`three`}';

        return _expandCmd(cmd, runtimeArgs, config).then(expandedCmd => {
          expect(runner._spawnAsPromised).toHaveBeenCalledWith('three', jasmine.any(Object));
          expect(expandedCmd).toBe('foo {{three}}');
        });
      }));

      it('should not call the fallback command if not necessary', async(() => {
        cmd = 'foo ${1:`three`}';

        return _expandCmd(cmd, runtimeArgs, config).then(expandedCmd => {
          expect(runner._spawnAsPromised).not.toHaveBeenCalled();
          expect(expandedCmd).toBe('foo baz');
        });
      }));

      it('should replace all occurrences', async(() => {
        cmd = 'foo ${3:`three`} ${3:`three`} ${2*:`all-skip-1`} ${2*:`all-skip-1`} ${*:`all`} ${*:`all`}';
        const expectedCmd = 'foo {{three}} {{three}} {{all-skip-1}} {{all-skip-1}} {{all}} {{all}}';

        return _expandCmd(cmd, [], config).
          then(expandedCmd => expect(expandedCmd).toBe(expectedCmd));
      }));

      it('should not call a fallback command more than once (but reuse the result)', async(() => {
        cmd = 'foo ${3:`three`} ${3:`three`} ${4:`three`} ${4:`four`}';

        return _expandCmd(cmd, runtimeArgs, config).then(expandedCmd => {
          expect(runner._spawnAsPromised).toHaveBeenCalledTimes(2);
          expect(expandedCmd).toBe('foo {{three}} {{three}} {{three}} {{four}}');
        });
      }));

      it('should treat empty output as non-specified value', async(() => {
        runner._spawnAsPromised.and.returnValue(Promise.resolve(''));

        cmd = 'foo ${3:`three`} --bar ${4:`four`}';

        return _expandCmd(cmd, runtimeArgs, config).
          then(expandedCmd => expect(expandedCmd).toBe('foo --bar'));
      }));

      it('should trim the fallback command output (including cursor move ANSI escape sequences)', async(() => {
        const output = ' \n\u001b[1a\r\u001B[987B\t {{test}} \t\u001b[23C\r\u001B[00d\n ';
        runner._spawnAsPromised.and.returnValue(Promise.resolve(output));

        cmd = 'foo ${3:`three`} --bar ${4:`four`}';

        return _expandCmd(cmd, runtimeArgs, config).
          then(expandedCmd => expect(expandedCmd).toBe('foo {{test}} --bar {{test}}'));
      }));

      it('should call `_spawnAsPromised()` with `returnOutput: true` (but not affect the original config)',
        async(() => {
          cmd = 'foo ${3:`three`}';
          config.returnOutput = false;

          return _expandCmd(cmd, runtimeArgs, config).then(() => {
            expect(runner._spawnAsPromised).toHaveBeenCalledWith('three', jasmine.objectContaining({
              quux: 'quuux',
              returnOutput: true,
            }));
            expect(config.returnOutput).toBe(false);
          });
        })
      );

      it('should support setting `returnOutput: n` (with the special `--al-returnOutput=n` syntax)', async(() => {
        cmd = 'foo ${3:`three --al-returnOutput=33`}';
        config.returnOutput = false;

        return _expandCmd(cmd, runtimeArgs, config).then(() => {
          expect(runner._spawnAsPromised).toHaveBeenCalledWith('three', jasmine.objectContaining({
            quux: 'quuux',
            returnOutput: 33,
          }));
          expect(config.returnOutput).toBe(false);
        });
      }));

      it('should only recognize `--al-returnOutput=n` at the end (and separated by a space)', async(() => {
        const fbCmd1 = 'three --al-returnOutput=33 --bar';
        const fbCmd2 = 'three--al-returnOutput=33';
        const cmd1 = `foo \${3:\`${fbCmd1}\`}`;
        const cmd2 = `foo \${3:\`${fbCmd2}\`}`;

        return Promise.resolve().
          then(() => _expandCmd(cmd1, runtimeArgs, config)).
          then(() => expect(runner._spawnAsPromised).toHaveBeenCalledWith(fbCmd1, jasmine.objectContaining({
            returnOutput: true,
          }))).
          then(() => _expandCmd(cmd2, runtimeArgs, config)).
          then(() => expect(runner._spawnAsPromised).toHaveBeenCalledWith(fbCmd2, jasmine.objectContaining({
            returnOutput: true,
          })));
      }));

      it('should support expanding `$*`/`$n*`/`$n` in fallback commands (with same runtime arguments)', async(() => {
        cmd = 'foo ${3:`three $1 $2 $3 | $2* | $*`}';

        return _expandCmd(cmd, runtimeArgs, config).
          then(expandedCmd => expect(expandedCmd).toBe('foo {{three baz "q u x" | "q u x" | baz "q u x"}}'));
      }));

      it('should log debug info when expanding fallback commands (in debug mode)', async(() => {
        spyOn(console, 'log');

        cmd = 'foo ${3:`three $*`}';

        return Promise.resolve().
          then(() => _expandCmd(cmd, runtimeArgs, config)).
          then(() => expect(console.log).not.toHaveBeenCalled()).
          then(() => _expandCmd(cmd, runtimeArgs, {debug: true})).
          then(() => {
            expect(console.log).toHaveBeenCalledTimes(2);
            expect(console.log).toHaveBeenCalledWith('Input command: \'three $*\'');
            expect(console.log).toHaveBeenCalledWith('Expanded command: \'three baz "q u x"\'');
          });
      }));
    });
  });

  describe('._spawnAsPromised()', () => {
    const _spawnAsPromised = runner._spawnAsPromised;
    const createMockProcess = jsmn => {
      let proc = new childProcess.ChildProcess();

      proc.stdin = {};
      proc.stdout = {pipe: jsmn.createSpy('mockProcess.stdout.pipe')};

      return proc;
    };
    let spawned;
    let autoExitSpawned;
    let anyObj;
    let rawCmd;
    let config;

    beforeEach(() => {
      let spawnedIndex = -1;
      spawned = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => createMockProcess(jasmine));

      spyOn(childProcess, 'spawn').and.callFake(() => {
        const proc = spawned[++spawnedIndex];

        if (!proc) {
          throw Error('Ran out of pre-spawned MockChildProcesses.');
        } else if (autoExitSpawned) {
          Promise.resolve().then(() => proc.emit('exit', 0));
        }

        return proc;
      });

      autoExitSpawned = true;
      anyObj = jasmine.any(Object);
      rawCmd = 'foo --bar';
      config = {};
    });

    it('should be a function', () => {
      expect(_spawnAsPromised).toEqual(jasmine.any(Function));
    });

    it('should return a promise', async(() => {
      return _spawnAsPromised(rawCmd, config);
    }));

    it('should spawn a process for the specified command', async(() => {
      return _spawnAsPromised(rawCmd, config).
        then(() => expect(childProcess.spawn).toHaveBeenCalledWith('foo', ['--bar'], jasmine.any(Object)));
    }));

    it('should parse the specified command (respecting double-quoted values)', async(() => {
      return Promise.resolve().
        then(() => _spawnAsPromised('foo1     "bar1" --baz1 --qux1="foo bar" "baz qux 1"', config)).
        then(() => {
          const parsedArgs = ['"bar1"', '--baz1', '--qux1="foo bar"', '"baz qux 1"'];
          expect(childProcess.spawn).toHaveBeenCalledWith('foo1', parsedArgs, anyObj);
        }).
        then(() => _spawnAsPromised('"foo2"     "bar2" --baz2 --qux2="foo bar" "baz qux 2"', config)).
        then(() => {
          const parsedArgs = ['"bar2"', '--baz2', '--qux2="foo bar"', '"baz qux 2"'];
          expect(childProcess.spawn).toHaveBeenCalledWith('"foo2"', parsedArgs, anyObj);
        });
    }));

    it('should support command "piping" (and spawn a process for each command)', async(() => {
      return _spawnAsPromised('foo bar | bar "baz" | "baz" qux | qux "q u u x"', config).then(() => {
        expect(childProcess.spawn).toHaveBeenCalledTimes(4);

        expect(childProcess.spawn.calls.argsFor(0)).toEqual(['foo', ['bar'], anyObj]);
        expect(childProcess.spawn.calls.argsFor(1)).toEqual(['bar', ['"baz"'], anyObj]);
        expect(childProcess.spawn.calls.argsFor(2)).toEqual(['"baz"', ['qux'], anyObj]);
        expect(childProcess.spawn.calls.argsFor(3)).toEqual(['qux', ['"q u u x"'], anyObj]);

        expect(spawned[0].stdout.pipe.calls.argsFor(0)[0]).toBe(spawned[1].stdin);
        expect(spawned[1].stdout.pipe.calls.argsFor(0)[0]).toBe(spawned[2].stdin);
        expect(spawned[2].stdout.pipe.calls.argsFor(0)[0]).toBe(spawned[3].stdin);
      });
    }));

    it('should use appropriate values for `stdio`', async(() => {
      return Promise.resolve().
        then(() => _spawnAsPromised(rawCmd, config)).
        then(() => {
          const expectedStdio = ['inherit', 'inherit', 'inherit'];
          expect(childProcess.spawn.calls.argsFor(0)[2].stdio).toEqual(expectedStdio);
          childProcess.spawn.calls.reset();
        }).
        then(() => _spawnAsPromised('foo bar | bar "baz" | "baz" qux | qux "q u u x"', config)).
        then(() => {
          const expectedStdio = [
            ['inherit', 'pipe', 'inherit'],
            ['pipe', 'pipe', 'inherit'],
            ['pipe', 'pipe', 'inherit'],
            ['pipe', 'inherit', 'inherit'],
          ];

          expect(childProcess.spawn.calls.argsFor(0)[2].stdio).toEqual(expectedStdio[0]);
          expect(childProcess.spawn.calls.argsFor(1)[2].stdio).toEqual(expectedStdio[1]);
          expect(childProcess.spawn.calls.argsFor(2)[2].stdio).toEqual(expectedStdio[2]);
          expect(childProcess.spawn.calls.argsFor(3)[2].stdio).toEqual(expectedStdio[3]);
        });
    }));

    describe('returned promise', () => {
      beforeEach(() => autoExitSpawned = false);

      it('should be rejected if a spawned process exits with error (single command)', async(() => {
        const promise = reversePromise(_spawnAsPromised(rawCmd, config)).
          then(err => expect(err).toBe(1));

        spawned[0].emit('exit', 1);

        return promise;
      }));

      it('should be rejected if a spawned process errors (single command)', async(() => {
        const promise = reversePromise(_spawnAsPromised(rawCmd, config)).
          then(err => expect(err).toBe('Test'));

        spawned[0].emit('error', 'Test');

        return promise;
      }));

      it('should be rejected if a spawned process exits with error (piped command)', async(() => {
        const promise = Promise.
          all([
            reversePromise(_spawnAsPromised('foo | bar | baz', config)),
            reversePromise(_spawnAsPromised('foo | bar | baz', config)),
            reversePromise(_spawnAsPromised('foo | bar | baz', config)),
          ]).
          then(values => expect(values).toEqual([1, 2, 'SIGNAL']));

        spawned[0].emit('exit', 1);
        spawned[4].emit('exit', 2);
        spawned[8].emit('exit', null, 'SIGNAL');

        return promise;
      }));

      it('should be rejected if a spawned process errors (piped command)', async(() => {
        const promise = Promise.
          all([
            reversePromise(_spawnAsPromised('foo | bar | baz', config)),
            reversePromise(_spawnAsPromised('foo | bar | baz', config)),
            reversePromise(_spawnAsPromised('foo | bar | baz', config)),
          ]).
          then(values => expect(values).toEqual(['Test0', 'Test1', 'Test2']));

        spawned[0].emit('error', 'Test0');
        spawned[4].emit('error', 'Test1');
        spawned[8].emit('error', 'Test2');

        return promise;
      }));

      it('should be resolved when all spawned processes complete (single command)', async(() => {
        const resolved = jasmine.createSpy('resolved');

        _spawnAsPromised(rawCmd, config).then(resolved);

        // The promise's success handlers are executed asynchronously.
        return Promise.resolve().
          then(tickAsPromised).
          then(() => {
            spawned[0].emit('exit', 0);
            expect(resolved).not.toHaveBeenCalled();
          }).
          then(tickAsPromised).
          then(() => expect(resolved).toHaveBeenCalledWith(''));
      }));

      it('should be resolved when all spawned processes complete (piped commands)', async(() => {
        const resolved = jasmine.createSpy('resolved');

        _spawnAsPromised('foo | bar | baz', config).then(resolved);

        // The promise's success handlers are executed asynchronously.
        return Promise.resolve().
          then(tickAsPromised).
          then(() => spawned[0].emit('exit', 0)).
          then(tickAsPromised).
          then(() => spawned[1].emit('exit', 0)).
          then(tickAsPromised).
          then(() => {
            spawned[2].emit('exit', 0);
            expect(resolved).not.toHaveBeenCalled();
          }).
          then(tickAsPromised).
          then(() => expect(resolved).toHaveBeenCalledWith(''));
      }));
    });
  });
});
