/* eslint-disable max-classes-per-file */
'use strict';

// Imports
const utils = require('./utils');

// Interfaces
/*
interface IAlias {
  getAdditionalPlatforms(): string[];
  getSpec(platform?: string): IAliasSpec;
}

interface IAliasSpec {
  code: string;
  description: string;
  command?: string;
}

interface ISpecPerPlatformMap {
  default: IAliasSpec;
  [platform: string]: IAliasSpec;
}
*/

// Classes
class Alias/* implements IAlias */ {
  constructor(specOrSpecs/* IAliasSpec | ISpecPerPlatformMap */) {
    if (specOrSpecs instanceof AliasSpec) {
      specOrSpecs = {default: specOrSpecs};
    }

    this._specPerPlatform/* ISpecPerPlatformMap */ = specOrSpecs;
  }

  getAdditionalPlatforms()/* string[] */ {
    return Object.keys(this._specPerPlatform).
      filter(platform => platform !== 'default');
  }

  getSpec(platform = utils.getPlatform())/* IAliasSpec */ {
    return this._specPerPlatform[platform] || this._specPerPlatform.default;
  }
}

class AliasDefault extends Alias {
  constructor(command/* string */, config/*? IRunConfig */) {
    super(new AliasSpecDefault(command, config));
  }
}

class AliasUnknown extends Alias {
  static get DESCRIPTION() { return '__unknownAlias__'; }

  constructor() {
    super(new AliasSpec('', AliasUnknown.DESCRIPTION));
  }
}

class AliasSpec/* implements IAliasSpec */ {
  constructor(code/* string */, description/* string */) {
    this.code = code;
    this.description = description;
  }
}

class AliasSpecDefault extends AliasSpec {
  static DEF_CODE() {
    throw new Error('This method is supposed to be overwritten, before any instances are created.');
  }

  constructor(command/* string */, config/*? IRunConfig */) {
    const augmentedConfig = Object.assign({sapVersion: 2}, config);
    const code = AliasSpecDefault.DEF_CODE(command, augmentedConfig);

    super(code, command);
    this.command = command;
  }
}

// Exports
module.exports = {
  Alias,
  AliasDefault,
  AliasSpec,
  AliasSpecDefault,
  AliasUnknown,
};
