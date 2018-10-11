'use strict';

// Imports
const {EventEmitter} = require('events');
const stripAnsi = require('strip-ansi');
const {format} = require('url');
const {_LazyLoader} = require('../../../lib/alias-scripts/gcoghpr');

// Classes
class MockExecutor {
  constructor(logger, baseConfig = {}, debugMode = false) {
    this.logger = logger;
    this.baseConfig = baseConfig;
    this.debugMode = debugMode;
    this.executions = [];

    MockExecutor.instances.push(this);
  }

  exec(command, config) {
    command = stripAnsi(command);
    this.execDouble(command, config);

    if (!MockExecutor.definitions.hasOwnProperty(command)) {
      const expectedCmds = Object.keys(MockExecutor.definitions).map(d => `\n  ${d}`).join('');
      throw new Error(`Unexpected command: ${command}\nExpecting one of: ${expectedCmds}`);
    }

    let result = MockExecutor.definitions[command];
    let success = true;

    if (result.lastIndexOf('error:', 0) === 0) {
      result = result.replace('error:', '');
      success = false;
    }

    this.executions.push({command, config, result, success});

    return Promise[success ? 'resolve' : 'reject'](result);
  }

  execDouble() {
    // Dummy method, useful for spying on `exec()` calls,
    // while keeping original behavior.
  }

  execWithStyle(color, command, config) {
    return this.exec(`withStyle(${color || 'reset'}): ${command}`, config);
  }

  getExecutedCommands() {
    return this.executions.map(({command}) => command);
  }
}
MockExecutor.definitions = {};
MockExecutor.instances = [];

class MockHttps {
  constructor() {
    this.reset();
  }

  whenGet(url) {
    const definition = new MockHttpsDefinition(url);
    this._definitions.push(definition);

    return definition;
  }

  get(url, options, cb) {
    url = format(url);
    cb = cb  || options;

    const definition = this._definitions.find(d => d.$match(url));

    if (!definition) {
      const expectedUrls = this._definitions.map(d => `\n  ${d.url}`).join('');
      throw new Error(`Unexpected URL: ${url}\nExpecting one that matches: ${expectedUrls}`);
    }

    const requestObj = new EventEmitter();
    const mockResponse = definition.$getResponse(url);
    const mockResponseError = !mockResponse && definition.$getResponseError(url);
    const mockRequestError = !mockResponseError && definition.$getRequestError(url);

    if (mockRequestError) {
      Promise.resolve().then(() => requestObj.emit('error', mockRequestError));
    } else {
      const responseObj = new EventEmitter();
      const cbPromise = Promise.resolve().then(() => cb(responseObj));

      if (mockResponseError) {
        cbPromise.then(() => responseObj.emit('error', mockResponseError));
      } else {
        const [statusCode, responseText] = mockResponse;
        responseObj.statusCode = statusCode;
        cbPromise.
          then(() => {
            for (let i = 0, ii = responseText.length + 2; i < ii; i += 3) {
              responseObj.emit('data', Buffer.from(responseText.slice(i, i + 3), 'utf8'));
            }
          }).
          then(() => responseObj.emit('end'));
      }
    }

    return requestObj;
  }

  reset() {
    this._definitions = [];
  }
}

class MockHttpsDefinition {
  constructor(url) {
    this.url = (typeof url !== 'string') ? url : {toString: () => url, test: url2 => url2 === url};

    this._requestErrorFactory = null;
    this._responseFactory = null;
    this._responseErrorFactory = null;
  }

  // requestError(errorMessage: string)
  // requestError(errorFactory: (url: string) => string)
  requestError(errorMessage) {
    this._ensureNotSet();
    this._requestErrorFactory = (typeof errorMessage === 'function') ? errorMessage : () => errorMessage;
  }

  // response(statusCode: number, responseText: string)
  // response(responseFactory: (url: string) => [number, string])
  response(statusCode, responseText) {
    this._ensureNotSet();
    this._responseFactory = (typeof statusCode === 'function') ? statusCode : () => [statusCode, responseText];
  }

  // responseError(errorMessage: string)
  // responseError(errorFactory: (url: string) => string)
  responseError(errorMessage) {
    this._ensureNotSet();
    this._responseErrorFactory = (typeof errorMessage === 'function') ? errorMessage : () => errorMessage;
  }

  $getRequestError(url) {
    return this._requestErrorFactory && this._requestErrorFactory(url);
  }

  $getResponse(url) {
    return this._responseFactory && this._responseFactory(url);
  }

  $getResponseError(url) {
    return this._responseErrorFactory && this._responseErrorFactory(url);
  }

  $match(url) {
    this._ensureSet();
    return this.url.test(url);
  }

  _ensureNotSet() {
    const prefix = `This definition (${this.url}) already has a `;
    let problem;

    if (this._requestErrorFactory) {
      problem = `${prefix}request error set: ${this.requestErrorFactory}`;
    } else if (this._responseErrorFactory) {
      problem = `${prefix}response error set: ${this._responseErrorFactory}`;
    } else if (this._responseFactory) {
      problem = `${prefix}response set: ${this._responseFactory}`;
    }

    if (problem) {
      throw new Error(problem);
    }
  }

  _ensureSet() {
    if (!this._requestErrorFactory && !this._responseFactory && !this._responseErrorFactory) {
      throw new Error(`This definition (${this.url}) has no response or error set.`);
    }
  }
}

class MockLazyLoader extends _LazyLoader {
  get(dep) {
    return MockLazyLoader.mockedDependencies[dep] || super.get(dep);
  }
}
MockLazyLoader.mockedDependencies = {};


class MockLogger {
  constructor() {
    this.color = 'reset';
    this.logs = {
      debug: [],
      error: [],
      info: [],
      log: [],
      warn: [],
    };
  }

  forceColor(color) {
    this.color = color || 'reset';
  }

  getTempStyle(color) {
    color = color || 'reset';

    return {
      color: `${this.color} --> ${color}`,
      open: `switchColor(${this.color} --> ${color})`,
      close: `switchColor(${color} --> ${this.color})`,
    };
  }

  debug(msg) { this.logs.debug.push(stripAnsi(msg)); }
  error(msg) { this.logs.error.push(stripAnsi(msg)); }
  info(msg) { this.logs.info.push(stripAnsi(msg)); }
  log(msg) { this.logs.log.push(stripAnsi(msg)); }
  warn(msg) { this.logs.warn.push(stripAnsi(msg)); }
}

// Exports
module.exports = {
  MockExecutor,
  MockHttps,
  MockLazyLoader,
  MockLogger,
};
