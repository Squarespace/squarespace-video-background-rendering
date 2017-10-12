import parseUrl from 'url-parse';
import testAutoPlay from './utils/videoAutoplayTest';
import { initializeVimeoAPI, initializeVimeoPlayer } from './providers/vimeo';
import { initializeYouTubeAPI, initializeYouTubePlayer } from './providers/youtube';

const videoSourceModules = {
  vimeo: {
    api: initializeVimeoAPI,
    player: initializeVimeoPlayer
  },
  youtube: {
    api: initializeYouTubeAPI,
    player: initializeYouTubePlayer
  }
};

const DEBUG = true;
// Allows logging in detail
const DEBUG_VERBOSE = false;

const DEFAULT_PROPERTY_VALUES = {
  'container': '.background-wrapper',
  'url': 'https://youtu.be/xkEmYQvJ_68',
  'fitMode': 'fill',
  'scaleFactor': 1,
  'playbackSpeed': 1,
  'filter': 1,
  'filterStrength': 50,
  'timeCode': { 'start': 0, 'end': null },
  DEBUG_VERBOSE
};

const FILTER_OPTIONS = require('./constants/filter.js').filterOptions;
const FILTER_PROPERTIES = require('./constants/filter.js').filterProperties;

const YOUTUBE_REGEX = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]{11}).*/;
const VIMEO_REGEX = /^.*(vimeo\.com\/)([0-9]{7,}(#t\=.*s)?)/;

/**
 * A class which uses the YouTube API to initialize an IFRAME with a YouTube video.
 * Additional display options and functionality are configured through a set of properties,
 * superceding default properties.
 */
class VideoBackground {
  /**
   * @param {Object} props - An optional object with configuation.
   * @param {Object} windowContext - The parent window object (due to .sqs-site-frame).
   */
  constructor(props, windowContext = window) {
    this.windowContext = windowContext;
    this.events = [];

    this.setProperties(props);
    testAutoPlay().then((value) => {
      this.logger(value);
      this.canAutoPlay = true;
    }, (reason) => {
      this.logger(reason);
      this.canAutoPlay = false;
      this.container.classList.add('mobile');
      this.logger('added mobile');
    }).then((value) => {
      this.logger(value);
      this.setDisplayEffects();
      this.setFallbackImage();
      this.initializeVideoAPI();
      this.bindUI();

      if (DEBUG === true) {
        window.vdbg = this;
      }
    });
  }

  destroy() {
    if (this.events) {
      this.events.forEach(evt => evt.target.removeEventListener(evt.type, evt.handler, true));
    }
    this.events = null;

    if (this.player && typeof this.player.destroy === 'function') {
      this.player.iframe.classList.remove('ready');
      clearTimeout(this.player.playTimeout);
      this.player.playTimeout = null;
      this.player.destroy();
      this.player = {};
    }

    if (typeof this.timer === 'number') {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  bindUI() {
    const resizeEvent = typeof window.orientation === 'undefined' ? 'resize' : 'orientationchange';
    const resizeHandler = () => {
      if (resizeEvent === 'resize' && this.player.iframe) {
        this.windowContext.requestAnimationFrame(() => {
          this.scaleVideo();
        });
      } else {
        this.setFallbackImage();
      }
    };
    this.events.push({
      'target': this.windowContext,
      'type': 'resize',
      'handler': resizeHandler
    });
    this.windowContext.addEventListener(resizeEvent, resizeHandler, true);
  }

  /**
   * Merge configuration properties with defaults with minimal validation.
   */
  setProperties(props = {}) {
    props = Object.assign({}, DEFAULT_PROPERTY_VALUES, props);
    if (props.container.nodeType === 1) {
      this.container = props.container;
    } else if (typeof props.container === 'string') {
      this.container = document.querySelector(props.container);
    } else {
      console.error('Container ' + props.container + ' not found');
      return false;
    }
    this.videoSource = this.getVideoSource(props.url);
    this.videoId = this.getVideoID(props.url);
    this.filter = props.filter;
    this.filterStrength = props.filterStrength;
    this.fitMode = props.fitMode;
    this.scaleFactor = props.scaleFactor;
    this.playbackSpeed = parseFloat(props.playbackSpeed) === 0.0 ? 1 : parseFloat(props.playbackSpeed);
    this.timeCode = {
      start: this._getStartTime(props.url) || props.timeCode.start,
      end: props.timeCode.end
    };
    this.player = {};
    this.currentLoop = 0;
    this.DEBUG_VERBOSE = props.DEBUG_VERBOSE;
  }

  /**
   * Determine the video source from the URL via regex.
   */
  getVideoSource(value) {
    if (!value) {
      value = DEFAULT_PROPERTY_VALUES.url;
    }

    let match = value.match(YOUTUBE_REGEX);
    if (match && match[2].length) {
      return 'youtube';
    }

    match = value.match(VIMEO_REGEX);
    if (match && match[2].length) {
      return 'vimeo';
    }

    console.error(`Video source ${ value } does not match supported types`);
    return null;
  }

  /**
   * Get the video ID for use in the provider APIs.
   */
  getVideoID(value) {
    if (!value) {
      value = DEFAULT_PROPERTY_VALUES.url;
    }

    let match;
    if (this.videoSource === 'youtube') {
      match = value.match(YOUTUBE_REGEX);
    } else if (this.videoSource === 'vimeo') {
      match = value.match(VIMEO_REGEX);
    }
    if (match && match[2].length) {
      return match[2];
    }

    console.error(`Video id at ${ value } is not valid`);
    return null;
  }

  /**
   * Sets a custom fallback image
   */
  setFallbackImage() {
    const customFallbackImage = this.container.querySelector('img[data-src]');
    if (!customFallbackImage) {
      return;
    }
    customFallbackImage.addEventListener('load', () => {
      customFallbackImage.classList.add('loaded');
    });
    window.ImageLoader.load(customFallbackImage, { load: true });
  }

  /**
   * Load the API for the appropriate source, then
   */
  initializeVideoAPI() {
    if (this.canAutoPlay && this.videoSource && this.videoId) {
      this.player.ready = false;

      const sourceAPIFunction = videoSourceModules[this.videoSource].api;
      const apiPromise = sourceAPIFunction(this.windowContext);
      apiPromise.then((message) => {
        this.logger(message);
        this.player.ready = false;
        this.initializeVideoPlayer();
      }).catch((message) => {
        this.canAutoPlay = false;
        this.container.classList.add('mobile');
        document.body.classList.add('ready');
        this.logger(message);
      });
    } else {
      this.container.classList.add('mobile');
      document.body.classList.add('ready');
    }
  }

  /**
   * Initialize the video player and register its callbacks
   */
  initializeVideoPlayer() {
    if (this.player.ready) {
      try {
        this.player.destroy();
        this.player.ready = false;
      } catch (e) {
        // nothing to destroy
      }
    }

    const sourcePlayerFunction = videoSourceModules[this.videoSource].player;
    const playerPromise = sourcePlayerFunction({
      container: this.container,
      win: this.windowContext,
      videoId: this.videoId,
      startTime: this.timeCode.start,
      speed: this.playbackSpeed,
      readyCallback: (player, data) => {
        this.player.iframe.classList.add('background-video');
        this.syncPlayer();
        const readyEvent = new CustomEvent('ready');
        this.container.dispatchEvent(readyEvent);
        document.body.classList.add('ready');
      },
      stateChangeCallback: (state, data) => {
        if (state === 'buffering') {
          this.autoPlayTestTimeout();
        } else if (state === 'playing') {
          if (this.player.playTimeout !== null) {
            clearTimeout(this.player.playTimeout);
            this.player.playTimeout = null;
            this.player.ready = true;
            this.player.iframe.classList.add('ready');

            if (!this.canAutoPlay) {
              this.canAutoPlay = true;
              this.container.classList.remove('mobile');
            }
          }
        }
        if (data) {
          this.logger(data);
        }
      }
    });

    playerPromise.then((player) => {
      this.player = player;
    });
  }

  /**
   * The IFRAME will be the entire width and height of its container, but the video
   * may be a completely different size and ratio. Scale up the IFRAME so the inner video
   * behaves in the proper `fitMode`, with optional additional scaling to zoom in.
   */
  scaleVideo(scaleValue) {
    let scale = scaleValue || this.scaleFactor;
    const playerIframe = this.player.iframe;
    const videoDimensions = this._findPlayerDimensions();

    if (this.fitMode !== 'fill') {
      playerIframe.style.width = '';
      playerIframe.style.height = '';
      return false;
    }

    const containerWidth = playerIframe.parentNode.clientWidth;
    const containerHeight = playerIframe.parentNode.clientHeight;
    const containerRatio = containerWidth / containerHeight;
    const videoRatio = videoDimensions.width / videoDimensions.height;
    let pWidth = 0;
    let pHeight = 0;
    if (containerRatio > videoRatio) {
      // at the same width, the video is taller than the window
      pWidth = containerWidth * scale;
      pHeight = containerWidth * scale / videoRatio;
      playerIframe.style.width = pWidth + 'px';
      playerIframe.style.height = pHeight + 'px';
    } else if (videoRatio > containerRatio) {
      // at the same width, the video is shorter than the window
      pWidth = containerHeight * scale * videoRatio;
      pHeight = containerHeight * scale;
      playerIframe.style.width = pWidth + 'px';
      playerIframe.style.height = pHeight + 'px';
    } else {
      // the window and video ratios match
      pWidth = containerWidth * scale;
      pHeight = containerHeight * scale;
      playerIframe.style.width = pWidth + 'px';
      playerIframe.style.height = pHeight + 'px';
    }
    playerIframe.style.left = 0 - ((pWidth - containerWidth) / 2) + 'px';
    playerIframe.style.top = 0 - ((pHeight - containerHeight) / 2) + 'px';
  }

  /**
   * Play back speed options, based on the YouTube API options.
   */
  setSpeed(speedValue) {
    this.playbackSpeed = parseFloat(this.playbackSpeed);
    this.player.setPlaybackRate(this.playbackSpeed);
  }

  /**
   * All diplay related effects should be applied prior to the video loading to
   * ensure the effects are visible on the fallback image while loading.
   */
  setDisplayEffects() {
    this.setFilter();
  }

  /**
   * Apply filter with values based on filterStrength.
   */
  setFilter() {
    const containerStyle = this.container.style;
    const filter = FILTER_OPTIONS[this.filter - 1];
    let filterStyle = '';
    if (filter !== 'none') {
      filterStyle = this.getFilterStyle(filter, this.filterStrength);
    }

    // To prevent the blur effect from displaying the background at the edges as
    // part of the blur, the filer needs to be applied to the player and fallback image,
    // and those elements need to be scaled slightly.
    // No other combination of filter target and scaling seems to work.
    if (filter === 'blur') {
      containerStyle.webkitFilter = '';
      containerStyle.filter = '';
      this.container.classList.add('filter-blur');

      Array.prototype.slice.call(this.container.children).forEach((el) => {
        el.style.webkitFilter = filterStyle;
        el.style.filter = filterStyle;
      });
    } else {
      containerStyle.webkitFilter = filterStyle;
      containerStyle.filter = filterStyle;
      this.container.classList.remove('filter-blur');

      Array.prototype.slice.call(this.container.children).forEach((el) => {
        el.style.webkitFilter = '';
        el.style.filter = '';
      });
    }
  }

  /**
   * Construct the style based on the filter, strength and `FILTER_PROPERTIES`.
   */
  getFilterStyle(filter, strength) {
    return `${ filter }(${ FILTER_PROPERTIES[filter].modifier(strength) + FILTER_PROPERTIES[filter].unit })`;
  }

  /**
   * The YouTube API seemingly does not expose the actual width and height dimensions
   * of the video itself. The video's dimensions and ratio may be completely different
   * than the IFRAME's. This hack finds those values inside some private objects.
   * Since this is not part of the pbulic API, the dimensions will fall back to the
   * container width and height, in case YouTube changes the internals unexpectedly.
   */
  _findPlayerDimensions() {
    let w;
    let h;
    const player = this.player;
    if (this.videoSource === 'youtube' && player) {
      for (let p in player) {
        let prop = player[p];
        if (typeof prop === 'object' && prop.width && prop.height) {
          w = prop.width;
          h = prop.height;
          break;
        }
      }
    } else if (this.videoSource === 'vimeo' && player) {
      if (player.dimensions) {
        w = player.dimensions.width;
        h = player.dimensions.height;
      } else if (player.iframe) {
        w = player.iframe.clientWidth;
        h = player.iframe.clientHeight;
      }
    }
    if (!w || !h) {
      w = this.container.clientWidth;
      h = this.container.clientHeight;
      console.warn('Video player dimensions not found.');
    }
    return {
      'width': w,
      'height': h
    };
  }

  /**
   * Get the start time base on the URL formats of YouTube and Vimeo.
   */
  _getStartTime(url) {
    const parsedUrl = new parseUrl(url, true);
    let timeParam = this._getTimeParameter(parsedUrl);
    if (!timeParam) {
      return false;
    }

    const timeRegexYoutube = /[hms]/;
    const timeRegexVimeo = /[#t=s]/;

    let match;
    switch (this.videoSource) {
    case 'youtube' :
      match = timeParam.split(timeRegexYoutube).filter(Boolean);
      break;
    case 'vimeo' :
      match = timeParam.split(timeRegexVimeo).filter(Boolean);
      break;
    }
    let s = parseInt(match.pop(), 10) || 0;
    let m = parseInt(match.pop(), 10) * 60 || 0;
    let h = parseInt(match.pop(), 10) * 3600 || 0;
    return h + m + s;
  }

  /**
   * YouTube and Vimeo have optional URL formats to allow playback at a certain
   * timecode.
   * Returns the appropriate time parameter or false.
   */
  _getTimeParameter(parsedUrl) {
    if ((this.videoSource === 'youtube' && (!parsedUrl.query || !parsedUrl.query.t)) ||
      (this.videoSource === 'vimeo' && (!parsedUrl.hash))
    ) {
      return false;
    }
    let timeParam;
    if (this.videoSource === 'youtube') {
      timeParam = parsedUrl.query.t;
    } else if (this.videoSource === 'vimeo') {
      timeParam = parsedUrl.hash;
    }
    return timeParam;
  }

  /**
    * Since we cannot inspect the video element inside the provider's IFRAME to
    * check for `autoplay` and `playsinline` attributes, set a timeout that will
    * tell this instance that the media cannot auto play. The timeout will be
    * cleared via the media's playback API if it does begin playing.
    */
  autoPlayTestTimeout() {
    this.player.playTimeout = setTimeout(() => {
      this.canAutoPlay = false;
      this.container.classList.add('mobile');
      this.logger('added mobile');
    }, 2500);
  }

  /**
    * Apply the purely visual effects.
    */
  syncPlayer() {
    this.setDisplayEffects();
    this.setSpeed();
    this.scaleVideo();
  }

  logger(msg) {
    if (!DEBUG || !this.DEBUG_VERBOSE) {
      return;
    }

    this.windowContext.console.log(msg);
  }
}

export default VideoBackground;
