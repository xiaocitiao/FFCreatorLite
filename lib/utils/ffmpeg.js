'use strict';

/**
 * FFmpegUtils - Utility function collection of ffmpeg
 *
 * ####Example:
 *
 *     FFmpegUtils.addDefaultOptions({
 *        command: this.mainCommand,
 *        audio: this.getConf('audio'),
 *     });
 *
 * @object
 */
const isArray = require('lodash/isArray');
const forEach = require('lodash/forEach');
const ffmpeg = require('fluent-ffmpeg');

const FFmpegUtils = {
  getFFmpeg() {
    return ffmpeg;
  },

  setFFmpegPath(path) {
    ffmpeg.setFfmpegPath(path);
  },

  setFFprobePath(path) {
    ffmpeg.setFfprobePath(path);
  },

  createCommand(conf = {}) {
    const {threads = 1} = conf;
    const command = ffmpeg();
    if (threads > 1) command.addOptions([`-threads ${threads}`]);
    return command;
  },

  concatOpts(opts, arr) {
    if (isArray(arr)) {
      forEach(arr, o => opts.push(o));
    } else {
      opts.push(arr);
    }
  },

  // add some basic output properties
  addDefaultOptions({command, audio}) {
    let outputOptions = []
      //---- misc ----
      .concat([
        '-map',
        '0',
        '-hide_banner', // hide_banner - parameter, you can display only meta information
        '-map_metadata',
        '-1',
        '-map_chapters',
        '-1',
      ])

      //---- video ----
      .concat([
        '-c:v',
        'libx264', // c:v - H.264
        '-profile:v',
        'main', // profile:v - main profile: mainstream image quality. Provide I / P / B frames
        '-preset',
        'medium', // preset - compromised encoding speed
        '-crf',
        '20', // crf - The range of quantization ratio is 0 ~ 51, where 0 is lossless mode, 23 is the default value, 51 may be the worst
        '-movflags',
        'faststart',
        '-pix_fmt',
        'yuv420p',
      ]);

    //---- audio ----
    if (audio) {
      outputOptions = outputOptions.concat(['-c:a', 'copy', '-shortest']);
    }

    command.outputOptions(outputOptions);
    return command;
  },

  // Add event to command
  addCommandEvents({
    command,
    log = false,
    start,
    complete,
    error,
    progress,
    totalFrames,
    type = '',
  }) {
    command
      .on('start', commandLine => {
        if (log) console.log(`${type}: ${commandLine}`);
        const event = {type: `${type}-start`, command: commandLine};
        start && start(event);
      })
      .on('progress', function(p) {
        const frames = p.frames;
        const fpercent = frames / totalFrames;
        const event = {type: `${type}-progress`, fpercent, frames, totalFrames};
        progress && progress(event);
      })
      .on('end', () => {
        const event = {type: `${type}-complete`};
        complete && complete(event);
      })
      .on('error', err => {
        const event = {type: `${type}-error`, error: err};
        error && error(event);
      });

    return command;
  },
};

module.exports = FFmpegUtils;
