/* eslint-disable max-classes-per-file */
// Imports
import {EventEmitter} from 'node:events';

import stripAnsi from 'strip-ansi';


// Classes
class MockExecutor {
  static definitions = {};
  static instances = [];

  constructor(logger, baseConfig = {}, debugMode = false) {
    this.logger = logger;
    this.baseConfig = baseConfig;
    this.debugMode = debugMode;
    this.executions = [];

    MockExecutor.instances.push(this);
  }

  exec(command, config = {}) {
    command = stripAnsi(command);
    this.execDouble(command, config);

    if (!MockExecutor.definitions.hasOwnProperty(command)) {
      const expectedCmds = Object.keys(MockExecutor.definitions).map(d => `\n  ${d}`).join('');
      throw new Error(`Unexpected command: ${command}\nExpecting one of: ${expectedCmds}`);
    }

    let output = MockExecutor.definitions[command];
    let success = true;

    if (output.startsWith('error:')) {
      output = output.replace('error:', '');
      success = false;
    }

    this.executions.push({command, config, output, success});

    const promiseMethod = success ? 'resolve' : 'reject';
    const promiseArg = config.returnOutput ? output : '';

    return Promise[promiseMethod](promiseArg);
  }

  execDouble() {
    // Dummy method, useful for spying on `exec()` calls,
    // while keeping original behavior.
  }

  execForOutput(command, config) {
    config = Object.assign({}, config, {returnOutput: true});
    return this.exec(command, config).then(output => output.trim());
  }

  execWithStyle(color, command, config) {
    return this.exec(`withStyle(${color || 'reset'}): ${command}`, config);
  }

  getExecutedCommands() {
    return this.executions.map(({command}) => command);
  }
}

class MockHttps {
  _definitions = [];

  whenGet(url) {
    const definition = new MockHttpsDefinition(url);
    this._definitions.push(definition);

    return definition;
  }

  get(url, options, cb = options) {
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
export {
  MockExecutor,
  MockHttps,
  MockLogger,
};
