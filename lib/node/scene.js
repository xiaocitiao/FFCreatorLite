'use strict';

/**
 * FFScene - Scene component, a container used to load display object components.
 *
 * ####Example:
 *
 *     const scene = new FFScene();
 *     scene.setBgColor("#ffcc00");
 *     scene.setDuration(6);
 *     creator.addChild(scene);
 *
 * @class
 */
const forEach = require('lodash/forEach');
const fs = require('fs-extra');
const rmfr = require('rmfr');
const FFCon = require('./cons');
const Utils = require('../utils/utils');
const FFContext = require('../core/context');
const FFmpegUtils = require('../utils/ffmpeg');
const FFBackGround = require('../node/background');

class FFScene extends FFCon {
  constructor(conf) {
    super({type: 'scene', ...conf});

    this.percent = 0;
    this.duration = 10;
    this.context = null;
    this.command = null;
    this.directory = '';
    this.pathId = Utils.uid();
    this.setBgColor('#000000');
  }

  // Get and Set method
  setDuration(duration) {
    this.background && this.background.setDuration(duration);
    this.duration = duration;
  }

  setBgColor(color) {
    if (this.background) this.removeChild(this.background);
    this.background = new FFBackGround({color});
    this.addChild(this.background);
  }

  getFile() {
    return this.filepath;
  }

  createFilepath() {
    const cacheDir = this.rootConf('cacheDir').replace(/\/$/, '');
    const cacheFormat = this.rootConf('cacheFormat');
    const dir = `${cacheDir}/${this.pathId}`;
    this.directory = dir.replace(/\/$/, '');
    this.filepath = `${this.directory}/${this.id}.${cacheFormat}`;
    fs.ensureDir(dir);
  }

  // about command
  createNewCommand() {
    const command = FFmpegUtils.createCommand({threads: 1});
    command.setDuration(this.duration);
    this.command = command;
    this.context = new FFContext();
  }

  toCommand() {
    const command = this.command;
    this.toInputCommand(command);
    this.toFiltersCommand(command);
    this.addCommandOptions(command);
    this.addCommandOutputs(command);
    this.addCommandEvents(command);

    return command;
  }

  start() {
    this.createNewCommand();
    this.toCommand();
    this.command.run();
  }

  addCommandOptions(command) {
    FFmpegUtils.addDefaultOptions({command, audio: false});
    const fps = this.rootConf().getVal('fps');
    if (fps != 25) command.outputFPS(fps);
  }

  addCommandOutputs(command) {
    this.createFilepath();
    command.output(this.getFile());
  }

  deleteCacheFile() {
    rmfr(this.directory);
  }

  // addInputs
  toInputCommand(command) {
    forEach(this.children, child => child.addInput(command));
  }

  // filters toCommand
  toFiltersCommand(command) {
    const filters = this.concatFilters();
    command.complexFilter(filters, this.context.input);
  }

  concatFilters() {
    forEach(this.children, child => {
      const filters = child.concatFilters(this.context);
      if (filters.length) this.filters = this.filters.concat(filters);
    });

    return this.filters;
  }

  getTotalFrames() {
    return this.rootConf().getVal('fps') * this.duration;
  }

  // add command events
  addCommandEvents(command) {
    const log = this.rootConf('log');
    FFmpegUtils.addCommandEvents({
      log,
      command,
      type: 'single',
      totalFrames: this.getTotalFrames(),
      start: this.commandEventHandler.bind(this),
      error: this.commandEventHandler.bind(this),
      complete: this.commandEventHandler.bind(this),
      progress: this.commandEventHandler.bind(this),
    });
  }

  commandEventHandler(event) {
    event.target = this;
    this.emits(event);
  }

  isReady() {
    return new Promise(resolve => {
      let readyIndex = 0;
      forEach(this.children, child => {
        child.isReady().then(() => {
          readyIndex++;
          if (readyIndex >= this.children.length) {
            resolve();
          }
        });
      });
    });
  }
}

module.exports = FFScene;
