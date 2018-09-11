'use strict';

// Imports
const utils = require('./utils');

// Interfaces
/*
interface IAlias {
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

  getSpec(platform = utils.getPlatform())/* IAliasSpec */ {
    return this._specPerPlatform[platform] || this._specPerPlatform.default;
  }
}

class AliasDefault extends Alias {
  constructor(command/* string */, config/*? IRunConfig */) {
    super(new AliasSpecDefault(command, config));
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
    throw new Error('You are supposed to overwrite this method, before creating any instances.');
  }

  constructor(command/* string */, config/*? IRunConfig */) {
    super(AliasSpecDefault.DEF_CODE(command, config), command);
    this.command = command;
  }
}

// Exports
module.exports = {
  Alias,
  AliasDefault,
  AliasSpec,
  AliasSpecDefault,
};
