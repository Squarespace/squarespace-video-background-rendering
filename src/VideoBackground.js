import parseUrl from 'url-parse';
import testAutoPlay from './utils/videoAutoplayTest';

const DEBUG = false;

const DEFAULT_PROPERTY_VALUES = {
  'container': '.background-wrapper',
  'url': 'https://youtu.be/xkEmYQvJ_68',
  'fitMode': 'fill',
  'maxLoops': '',
  'scaleFactor': 1,
  'playbackSpeed': 1,
  'filter': 1,
  'filterStrength': 50,
  'timeCode': { 'start': 0, 'end': null },
  'useCustomFallbackImage': false
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

    this.initializeProperties(props);
    testAutoPlay().then((value) => {
      this.canAutoPlay = true;
    }, (reason) => {
      this.canAutoPlay = false;
      this.container.classList.add('mobile');
      this.logger('added mobile');
    }).then((value) => {
      this.setDisplayEffects();
      this.setFallbackImage();
      this.callVideoAPI();
      this.bindUI();

      if (DEBUG === true) {
        window.vdbg = this;
        this.debugInterval = setInterval(() => {
          if (this.player.getCurrentTime) {
            this.logger((this.player.getCurrentTime() / this.player.getDuration()).toFixed(2));
          }
        }, 900);
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

    if (typeof this.debugInterval === 'number') {
      clearInterval(this.debugInterval);
      this.debugInterval = null;
    }
  }

  bindUI() {
    const resizeEvent = typeof window.orientation === 'undefined' ? 'resize' : 'orientationchange';
    const resizeHandler = () => {
      if (resizeEvent === 'resize' && this.player.iframe) {
        this.windowContext.requestAnimationFrame(() => {
          this.scaleVideo();
        });
      } else if (this.useCustomFallbackImage && this.windowContext.ImageLoader) {
        const customFallbackImage = this.container.querySelector('img[data-src]');
        this.windowContext.ImageLoader.load(customFallbackImage, true);
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
  initializeProperties(props = {}) {
    props = Object.assign({}, DEFAULT_PROPERTY_VALUES, props);
    if (props.container.nodeType === 1) {
      this.container = props.container;
    } else if (typeof props.container === 'string') {
      this.container = document.querySelector(props.container);
    } else {
      console.error('Container ' + props.container + ' not found');
      return false;
    }
    this.videoId = this.getVideoID(props.url);
    this.filter = props.filter;
    this.filterStrength = props.filterStrength;
    this.useCustomFallbackImage = props.useCustomFallbackImage;
    this.fitMode = props.fitMode;
    this.maxLoops = parseInt(props.maxLoops, 10) || null;
    this.scaleFactor = props.scaleFactor;
    this.playbackSpeed = parseFloat(props.playbackSpeed) === 0.0 ? 1 : parseFloat(props.playbackSpeed);
    this.timeCode = {
      start: this._getStartTime(props.url) || props.timeCode.start,
      end: props.timeCode.end
    };
    this.player = {};
    this.currentLoop = 0;
  }

  /**
   * The ID is the only unique property need to use in the YouTube and Vimeo APIs.
   */
  getVideoID(value) {
    if (!value) {
      value = DEFAULT_PROPERTY_VALUES.url;
    }

    let match = value.match(YOUTUBE_REGEX);
    if (match && match[2].length) {
      this.videoSource = 'youtube';
      return match[2];
    }

    match = value.match(VIMEO_REGEX);
    if (match && match[2].length) {
      this.videoSource = 'vimeo';
      return match[2];
    }

    return '';
  }

  /**
   * A default fallback image element will be create from the YouTube API, unless the
   * custom fallback image exists.
   */
  setFallbackImage() {
    if (this.useCustomFallbackImage) {
      const customFallbackImage = this.container.querySelector('.custom-fallback-image');
      customFallbackImage.addEventListener('load', () => {
        customFallbackImage.classList.add('loaded');
        customFallbackImage.classList.add('test');
      });
      window.ImageLoader.load(customFallbackImage, { load: true });
    }
  }

  /**
   * Determine which API to use
   */
  callVideoAPI() {
    if (this.videoSource === 'youtube') {
      this.initializeYouTubeAPI();
    }

    if (this.videoSource === 'vimeo') {
      this.initializeVimeoAPI();
    }
  }

  /**
   * Call YouTube API per their guidelines.
   */
  initializeYouTubeAPI() {
    if (!this.canAutoPlay) {
      return;
    }

    if (this.windowContext.document.documentElement.querySelector('script[src*="www.youtube.com/iframe_api"].loaded')) {
      this.setVideoPlayer();
      return;
    }

    this.player.ready = false;
    const tag = this.windowContext.document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = this.windowContext.document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    tag.addEventListener('load', (evt) => {
      evt.currentTarget.classList.add('loaded');
      this.setVideoPlayer();
    }, true);
  }

  /**
   * Call the Vimeo API per their guidelines.
   */
  initializeVimeoAPI() {
    // No external API call is necessary; preserved for parity with YouTube and
    // potential additional integrations.
    if (!this.canAutoPlay) {
      return;
    }

    this.setVideoPlayer();
  }

  /**
   * If the source is YouTube, initialize the video player and register its callbacks.
   * If the source is Vimeo, construct and append the player node and register handlers.
   */
  setVideoPlayer() {
    if (this.player.ready) {
      try {
        this.player.destroy();
        this.player.ready = false;
      } catch (e) {
        // nothing to destroy
      }
    }

    if (this.videoSource === 'youtube') {
      this.initializeYouTubePlayer();
    } else if (this.videoSource === 'vimeo') {
      this.initializeVimeoPlayer();
    }
  }

  /**
   * Initialize the player and bind player events.
   */
  initializeYouTubePlayer() {
    let awaitingLoopRequestedAt = null;

    // Poll until the API is ready.
    if (this.windowContext.YT.loaded !== 1) {
      setTimeout(this.setVideoPlayer.bind(this), 100);
      return false;
    }

    /**
     * YouTube event handler. Add the proper class to the player element, and set
     * player properties. All player methods via YouTube API.
     */
    const onYouTubePlayerReady = (event) => {
      const player = this.player;
      player.iframe = player.getIframe();
      player.iframe.classList.add('background-video');
      this.syncPlayer();
      player.mute();
      const readyEvent = new CustomEvent('ready');
      this.container.dispatchEvent(readyEvent);
      document.body.classList.add('ready');
      player.ready = true;
      if (!this.canAutoPlay) {
        return;
      }
      if (this.timeCode.start >= player.getDuration()) {
        this.timeCode.start = 0;
      }
      player.seekTo(this.timeCode.start);
      player.playVideo();
      this.logger('playing');
    };

    /**
     * YouTube event handler. Determine whether or not to loop the video.
     */
    const onYouTubePlayerStateChange = (event) => {
      const player = this.player;
      const playerIframe = player.getIframe();
      const duration = (player.getDuration() - this.timeCode.start) / this.playbackSpeed;

      const doLoop = () => {
        if (awaitingLoopRequestedAt === null) {
          if ((player.getCurrentTime() + 0.1) >= player.getDuration()) {
            if (this.maxLoops) {
              this.currentLoop++;
              if (this.currentLoop > this.maxLoops) {
                player.pauseVideo();
                this.currentLoop = 0;
                return;
              }
            }
            awaitingLoopRequestedAt = player.getCurrentTime();
            player.pauseVideo();
            player.seekTo(this.timeCode.start);
          }
        } else if (player.getCurrentTime() < awaitingLoopRequestedAt) {
          awaitingLoopRequestedAt = null;
          player.playVideo();
        }
        requestAnimationFrame(doLoop.bind(this));
      };

      if (event.data === this.windowContext.YT.PlayerState.BUFFERING &&
         (player.getVideoLoadedFraction() !== 1) &&
         (player.getCurrentTime() === 0 || player.getCurrentTime() > duration - -0.1)) {
        this.logger('BUFFERING');
        this.autoPlayTestTimeout();
      } else if (event.data === this.windowContext.YT.PlayerState.PLAYING) {
        if (this.player.playTimeout !== null) {
          clearTimeout(this.player.playTimeout);
          this.player.playTimeout = null;
        }
        if (!this.canAutoPlay) {
          this.canAutoPlay = true;
          this.container.classList.remove('mobile');
        }
        this.logger('PLAYING');
        playerIframe.classList.add('ready');
        requestAnimationFrame(doLoop.bind(this));
      } else if (event.data === this.windowContext.YT.PlayerState.ENDED) {
        player.playVideo();
      }
    };

    let playerElement = this.container.querySelector('#player');
    if (!playerElement) {
      playerElement = document.createElement('div');
      playerElement.id = 'player';
      this.container.appendChild(playerElement);
    }
    this.player = new this.windowContext.YT.Player(playerElement, {
      height: '315',
      width: '560',
      videoId: this.videoId,
      playerVars: {
        'autohide': 1,
        'autoplay': 0,
        'controls': 0,
        'enablejsapi': 1,
        'iv_load_policy': 3,
        'loop': 0,
        'modestbranding': 1,
        'playsinline': 1,
        'rel': 0,
        'showinfo': 0,
        'wmode': 'opaque'
      },
      events: {
        'onReady': (event) => {
          onYouTubePlayerReady(event);
        },
        'onStateChange': (event) => {
          onYouTubePlayerStateChange(event);
        }
      }
    });
  }

  /**
   * Initialize the player and bind player events with a postMessage handler.
   */
  initializeVimeoPlayer() {
    const playerIframe = this.windowContext.document.createElement('iframe');
    playerIframe.id = 'vimeoplayer';
    playerIframe.classList.add('background-video');
    const playerConfig = '&background=1';
    playerIframe.src = '//player.vimeo.com/video/' + this.videoId + '?api=1' + playerConfig;
    this.container.appendChild(playerIframe);
    this.player.iframe = playerIframe;

    /**
     * Creates cross frame postMessage handlers, gets proper dimensions of player,
     * and sets ready state for the player and container.
     *
     */
    const player = this.player;
    let playerOrigin = '*';

    const postMessageManager = (action, value) => {
      const data = {
        method: action
      };

      if (value) {
        data.value = value;
      }

      const message = JSON.stringify(data);
      this.windowContext.eval('(function(ctx){ ctx.player.iframe.contentWindow.postMessage(' +
        message + ', ' + JSON.stringify(playerOrigin) + '); })')(this);
    };
    player.postMessageManager = postMessageManager;

    const syncAndStartPlayback = () => {
      if (!player.dimensions.width || !player.dimensions.height || !player.duration) {
        return;
      }
      this.syncPlayer();

      const readyEvent = new CustomEvent('ready');
      this.container.dispatchEvent(readyEvent);
      document.body.classList.add('ready');

      // Only required for Vimeo Basic videos, or video URLs with a start time hash.
      // Plus and Pro utilize `background=1` URL parameter.
      // See https://vimeo.com/forums/topic:278001
      postMessageManager('setVolume', '0');
      postMessageManager('setLoop', 'true');
      postMessageManager('seekTo', this.timeCode.start);
      postMessageManager('play');
      postMessageManager('addEventListener', 'playProgress');
    };

    const onReady = () => {
      player.dimensions = {};
      postMessageManager('getDuration');
      postMessageManager('getVideoHeight');
      postMessageManager('getVideoWidth');
    };

    const onPlaying = () => {
      clearTimeout(player.playTimeout);
      player.playTimeout = null;
      player.ready = true;
      player.iframe.classList.add('ready');

      if (!this.canAutoPlay) {
        this.canAutoPlay = true;
        this.container.classList.remove('mobile');
      }
    };

    const onMessageReceived = (event) => {
      if (!(/^https?:\/\/player.vimeo.com/).test(event.origin)) {
        return false;
      }

      playerOrigin = event.origin;

      let data = event.data;
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      this.logger(data);

      switch (data.event) {
      case 'ready':
        onReady();
        break;

      case 'playProgress':
      case 'timeupdate':
        postMessageManager('setVolume', '0');
        if (player.playTimeout !== null) {
          onPlaying();
        }
        if (data.data.percent >= 0.98 && this.timeCode.start > 0) {
          postMessageManager('seekTo', this.timeCode.start);
        }
        break;
      }

      switch (data.method) {
      case 'getVideoHeight':
        player.dimensions.height = data.value;
        syncAndStartPlayback();
        break;
      case 'getVideoWidth':
        player.dimensions.width = data.value;
        syncAndStartPlayback();
        break;
      case 'getDuration':
        player.duration = data.value;
        if (this.timeCode.start >= player.duration) {
          this.timeCode.start = 0;
        }
        syncAndStartPlayback();
        break;
      }
    };

    const messageHandler = e => {
      onMessageReceived(e);
    };

    this.windowContext.addEventListener('message', messageHandler, false);
    this.autoPlayTestTimeout();

    player.destroy = () => {
      this.windowContext.removeEventListener('message', messageHandler);
      // If the iframe node has already been removed from the DOM by the
      // implementer, parentElement.removeChild will error out unless we do
      // this check here first.
      if (player.iframe.parentElement) {
        player.iframe.parentElement.removeChild(player.iframe);
      }
    };


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
    if (this.videoSource === 'youtube') {
      this.setSpeed();
    }
    this.scaleVideo();
  }

  logger(msg) {
    if (!DEBUG) {
      return;
    }

    console.log(msg);
  }
}

export default VideoBackground;
