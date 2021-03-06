'use strict';

/**
 * FFBase - Basic classes in FFCreatorLite. Note: Its subclass is not necessarily a display class.
 *
 * ####Example:
 *
 *     class FFCon extends FFBase
 *
 * @class
 */
const EventEmitter = require('events');
const Conf = require('../conf/conf');
const Utils = require('../utils/utils');

class FFBase extends EventEmitter {
  constructor(conf) {
    super();

    this.conf = {type: 'base', ...conf};
    this.type = this.conf.type;
    this.parent = null;
    this.generateID();
  }

  /**
   * Generate self-increasing unique id
   * @return {string} unique id
   * @public
   */
  generateID() {
    const {type} = this.conf;
    this.id = Utils.generateID(type);
  }

  /**
   * Get the logical root node of the instance
   * @return {FFBase} root node
   * @public
   */
  root() {
    if (this.parent) return this.parent.root();
    else return this;
  }

  /**
   * Get the conf configuration on the logical root node of the instance
   * If the val parameter is set, the val value of conf is set
   * @param {string} key - configuration key
   * @param {any} val - configuration val
   * @return {object|any} root node
   * @public
   */
  rootConf(key, val) {
    let conf = Conf.getFakeConf();
    const root = this.root();
    if (root && root.type === 'creator') conf = root.conf;

    if (key) {
      if (val !== undefined) conf.setVal(key, val);
      return conf.getVal(key);
    } else {
      return conf;
    }
  }

  emits(event) {
    this.emit(event.type, event);
  }

  emitsClone(type, event) {
    event = Utils.clone(event);
    event.type = type;
    this.emits(event);
  }

  /**
   * Destroy the component
   * @public
   */
  destroy() {
    this.parent = null;
    this.removeAllListeners();
  }
}

module.exports = FFBase;
