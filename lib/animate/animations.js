'use strict';

/**
 * FFAnimations - A collection class used to manage animation
 *
 * ####Example:
 *
 *     const animations = new FFAnimations(this);
 *     animations.setAnimations(animations);
 *     animations.addAnimate(animation);
 *
 *
 * @class
 */
const forEach = require('lodash/forEach');
const Utils = require('../utils/utils');
const Effects = require('./effects');
const FFAnimation = require('./animation');
const {mergeIntoNewOverflyFilter, replaceOverflyFilter} = require('./move');
const {mergeIntoNewRotateFilter, replaceRotateFilter} = require('./rotate');
const {mergeIntoNewAlphaFilter, replaceAlphaFilter} = require('./alpha');
const {mergeIntoNewZoompanFilter, replaceZoomFilter} = require('./zoom');

class FFAnimations {
  constructor(animations) {
    this.list = [];
    this.setAnimations(animations);
  }

  setTarget(target) {
    this.target = target;
  }

  setAnimations(animations = []) {
    forEach(animations, ani => this.addAnimate(ani));
  }

  addEffect(type, time, delay) {
    let conf = {};
    if (time === undefined) {
      conf = Utils.clone(type);
      type = conf.type;
      time = conf.time;
      delay = conf.delay;
    } else {
      conf = {type, time, delay};
    }

    const params = Effects.effects[type];
    if (!params) return;

    if (Array.isArray(params)) {
      forEach(params, p => {
        Utils.excludeBind(p, conf, ['type']);
        this.addAnimate(p);
      });
    } else {
      Utils.excludeBind(params, conf, ['type']);
      this.addAnimate(params);
    }
  }

  addAnimate(animation) {
    this.replaceFadeToAlphaByText(animation);

    if (!animation.isFFAni) animation = new FFAnimation({...animation});
    this.list.push(animation);
    animation.parent = this.target;
    return animation;
  }

  replaceFadeToAlphaByText(animation) {
    if (this.target.type != 'text') return animation;
    if (!animation.isFFAni) {
      if (animation.type == 'fade' || animation.type == 'show') animation.type = 'alpha';
    } else {
      if (animation.getFromConf('type') == 'fade' || animation.getFromConf('type') == 'show')
        animation.setToConf('type', 'alpha');
    }

    return animation;
  }

  hasAnimate(itype) {
    let has = false;
    forEach(this.list, ani => {
      const type = ani.getFromConf('type');
      if (type === itype) has = true;
    });

    return has;
  }

  hasZoompanPad() {
    let has = false;
    forEach(this.list, ani => {
      const type = ani.getFromConf('type');
      const pad = ani.getFromConf('pad');
      if (type == 'zoom' && pad) has = true;
    });

    return has;
  }

  getMaxScale() {
    let maxScale = 1;
    forEach(this.list, ani => {
      const pad = ani.getFromConf('pad');
      const type = ani.getFromConf('type');
      if (type == 'zoom' && pad) {
        const {from, to} = ani.getFromTo();
        maxScale = Math.max(from, to);
      }
    });
    return maxScale;
  }

  // concat filters 
  concatFilters() {
    let filters = this.mergeListFilters();
    // Filter order is very important
    // rotate -> zoompan -> fade -> overlay
    filters = this.mergeSpecialFilters('alpha', filters);
    filters = this.mergeSpecialFilters('rotate', filters);
    filters = this.mergeSpecialFilters('zoompan', filters);
    filters = this.swapFadeFilterPosition(filters);
    filters = this.mergeSpecialFilters('overlay', filters);
    filters = this.convertToFFmpegFilter(filters);

    return filters;
  }

  convertToFFmpegFilter(filters) {
    let cfilters = [];
    forEach(filters, filter => cfilters.push(filter.filter));
    return cfilters;
  }

  replaceEffectConfVal() {
    forEach(this.list, ani => {
      const {conf} = ani;
      for (let key in conf) {
        const val = conf[key];
        const newVal = Effects.mapping(val, this.target);
        conf[key] = newVal === null ? val : newVal;
      }
    });
  }

  swapFadeFilterPosition(filters) {
    let cfilters = [...filters];
    let tfilters = [];

    // 1. filter and delete all overlay
    forEach(filters, aniFilter => {
      if (aniFilter.name === 'fade') {
        tfilters.push(aniFilter);
        Utils.deleteArrayElement(cfilters, aniFilter);
      }
    });

    return cfilters.concat(tfilters);
  }

  mergeListFilters() {
    let filters = [];
    forEach(this.list, ani => {
      const filter = ani.toFilter();
      if (filter.type == 'array') {
        filters = filters.concat(filter);
      } else {
        filters.push(filter);
      }
    });

    return filters;
  }

  // merge zoompan filters 
  mergeSpecialFilters(type, filters) {
    let cfilters = [...filters];
    let tfilters = [];

    // 1. filter and delete all overlay
    forEach(filters, aniFilter => {
      if (aniFilter.name === type) {
        tfilters.push(aniFilter);
        Utils.deleteArrayElement(cfilters, aniFilter);
      }
    });

    // 2-1. if only one push all overlay to last
    // [filter] -> [cfilters ...filter(last)]
    if (tfilters.length == 1) {
      const aniFilter = tfilters[0];
      if (type == 'zoompan') {
        replaceZoomFilter(aniFilter);
      } else if (type == 'overlay') {
        replaceOverflyFilter(aniFilter);
      } else if (type == 'rotate') {
        replaceRotateFilter(aniFilter);
      } else if (type == 'alpha') {
        replaceAlphaFilter(aniFilter);
      }

      cfilters = cfilters.concat(tfilters);
    }

    // 2-2 if more than one merge all tfilters
    // 1. [filter-in, filter-out] -> [cfilters ...filter-in, filter-out(last)]
    else if (tfilters.length > 1) {
      tfilters = Utils.sortArrayByKey(tfilters, 'showType', 'in');
      let newFilter;
      if (type == 'zoompan') {
        newFilter = mergeIntoNewZoompanFilter(tfilters);
      } else if (type == 'overlay') {
        newFilter = mergeIntoNewOverflyFilter(tfilters);
      } else if (type == 'rotate') {
        newFilter = mergeIntoNewRotateFilter(tfilters);
      } else if (type == 'alpha') {
        newFilter = mergeIntoNewAlphaFilter(tfilters);
      }

      newFilter && cfilters.push(newFilter);
    }

    return cfilters;
  }

  // get duration from animations 
  getDuration() {
    let duration = 0;
    forEach(this.list, ani => {
      const showType = ani.getFromConf('showType');
      const time = ani.getFromConf('time');
      const delay = ani.getFromConf('delay');
      if (showType === 'out') {
        duration = time + delay;
      }
    });

    return duration;
  }

  // modify delay time Less appearTime 
  modifyDelayTime(appearTime) {
    forEach(this.list, ani => {
      let delay = ani.getFromConf('delay');
      delay -= appearTime;
      ani.setToConf('delay', Math.max(delay, 0));
    });
  }

  // get appearTime from animations 
  getAppearTime() {
    let appearTime = 0;
    forEach(this.list, ani => {
      const showType = ani.getFromConf('showType');
      const delay = ani.getFromConf('delay');
      if (showType === 'in') {
        appearTime = delay || 0;
      }
    });
    return appearTime;
  }
}

module.exports = FFAnimations;
