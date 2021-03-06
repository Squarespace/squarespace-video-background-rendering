import merge from 'lodash.merge'
import testBrowserAutoplaySupport from './utils/browserAutoplayTest'
import { initializeVimeoAPI, initializeVimeoPlayer } from './providers/vimeo'
import { initializeYouTubeAPI, initializeYouTubePlayer } from './providers/youtube'
import { DEFAULT_PROPERTY_VALUES, UNSUPPORTED_VIDEO_SOURCE } from './constants/instance'
import { filterOptions as FILTER_OPTIONS } from './constants/filter'
import { filterProperties as FILTER_PROPERTIES } from './constants/filter'
import { findPlayerAspectRatio, getStartTime, getVideoID, getVideoSource, validatedImage } from './utils/utils'

const videoSourceModules = {
  vimeo: {
    api: initializeVimeoAPI,
    player: initializeVimeoPlayer
  },
  youtube: {
    api: initializeYouTubeAPI,
    player: initializeYouTubePlayer
  }
}

/**
 * A class which uses the YouTube or Vimeo APIs to initialize an IFRAME with an embedded player.
 * Additional display options and functionality are configured through a set of properties,
 * superceding default properties.
 */
class VideoBackground {
  /**
   * @param {Object} props - An optional object with configuation.
   * @param {Object} windowContext - The parent window object (due to .sqs-site-frame).
   */
  constructor(props, windowContext = window) {
    this.windowContext = windowContext
    this.events = []
    this.browserCanAutoPlay = false
    this.videoCanAutoPlay = false

    const arePropertiesSet = this.setInstanceProperties(props)
    if (!arePropertiesSet) {
      return
    }
    this.renderFallbackBehavior()

    // Test browser support for autoplay for video elements
    testBrowserAutoplaySupport().then((value) => {
      this.logger(value)
      this.browserCanAutoPlay = true
      this.initializeVideoAPI()
    }, (reason) => {
      // If there is no browser support, go to fall back behavior
      this.logger(reason)
      this.browserCanAutoPlay = false
    }).then(() => {
      this.setDisplayEffects()
      this.bindUI()

      if (this.DEBUG.enabled === true) {
        window.vdbg = this
      }
    })
  }

  destroy() {
    if (this.events) {
      this.events.forEach(evt => evt.target.removeEventListener(evt.type, evt.handler, true))
    }
    this.events.length = 0

    if (this.player && typeof this.player.destroy === 'function') {
      // iframe might already have been removed from DOM
      if (this.player.iframe) {
        this.player.iframe.classList.remove('ready')
      }
      this.player.destroy()
      this.player = {}
    }

    if (typeof this.timer === 'number') {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  bindUI() {
    const resizeHandler = () => {
      this.windowContext.requestAnimationFrame(() => {
        this.scaleVideo()
      })
    }
    this.events.push({
      target: this.windowContext,
      type: 'resize',
      handler: resizeHandler
    })
    this.windowContext.addEventListener('resize', resizeHandler, true)
  }

  /**
   * @method setInstanceProperties Merge configuration properties with defaults with some minimal validation.
   * @param {Object} [props] Configuration options
   * @return {Boolean} have the properties been properly updated
   */
  setInstanceProperties(props = {}) {
    props = merge({}, DEFAULT_PROPERTY_VALUES, props)

    if (props.container.nodeType === 1) {
      this.container = props.container
    } else if (typeof props.container === 'string') {
      this.container = document.querySelector(props.container)
    }
    if (!this.container) {
      console.error('Container ' + props.container + ' not found')
      return false
    }

    this.videoSource = getVideoSource(props.url)
    if (this.videoSource === UNSUPPORTED_VIDEO_SOURCE) {
      return false
    }
    this.videoId = getVideoID(props.url, this.videoSource)
    if (typeof this.videoId !== 'string') {
      return false
    }
    this.customFallbackImage = validatedImage(props.customFallbackImage || props.container.querySelector('img'))
    this.filter = props.filter
    this.filterStrength = props.filterStrength
    this.fitMode = props.fitMode
    this.scaleFactor = props.scaleFactor
    this.playbackSpeed = parseFloat(props.playbackSpeed) < 0.5 ? 1 : parseFloat(props.playbackSpeed)
    this.timeCode = {
      start: getStartTime(props.url, this.videoSource) || props.timeCode.start,
      end: props.timeCode.end
    }
    this.player = {}
    this.DEBUG = props.DEBUG
    return true
  }

  onFallbackImageLoaded() {
    this.customFallbackImage.classList.add('loaded')
  }

  /**
   * @method setFallbackImage Loads a custom fallback image if the player cannot autoplay.
   * @return {undefined}
   */
  setFallbackImage() {
    const customFallbackImage = this.customFallbackImage
    if (!customFallbackImage) {
      return
    }
    if (customFallbackImage.hasAttribute('src') && customFallbackImage.complete) {
      this.onFallbackImageLoaded()
      return
    }
    customFallbackImage.addEventListener('load', () => {
      this.onFallbackImageLoaded()
    }, { once: true })
    if (this.windowContext.ImageLoader) {
      this.windowContext.ImageLoader.load(customFallbackImage, { load: true })
      return
    }
    // Forcing a load event on the image when ImageLoader is not present
    customFallbackImage.src = customFallbackImage.src // eslint-disable-line no-self-assign
  }

  /**
   * @method initializeVideoAPI Load the API for the appropriate source. This abstraction normalizes the
   * interfaces for YouTube and Vimeo, and potentially other providers.
   * @return {undefined}
   */
  initializeVideoAPI() {
    if (this.browserCanAutoPlay && this.videoSource && this.videoId) {
      this.player.ready = false

      const sourceAPIFunction = videoSourceModules[this.videoSource].api
      const apiPromise = sourceAPIFunction(this.windowContext)
      apiPromise.then((message) => {
        this.logger(message)
        this.player.ready = false
        this.initializeVideoPlayer()
      }).catch((message) => {
        document.body.classList.add('ready')
        this.logger(message)
      })
    } else {
      document.body.classList.add('ready')
    }
  }

  /**
   * @method initializeVideoPlayer Initialize the video player and register its callbacks.
   * @return {undefined}
   */
  initializeVideoPlayer() {
    if (this.player.ready) {
      try {
        this.player.destroy()
      } catch (e) {
        // nothing to destroy
      }
      this.player.ready = false
    }

    const sourcePlayerFunction = videoSourceModules[this.videoSource].player
    const playerPromise = sourcePlayerFunction({
      instance: this,
      container: this.container,
      win: this.windowContext,
      videoId: this.videoId,
      startTime: this.timeCode.start,
      speed: this.playbackSpeed,
      readyCallback: () => {
        this.player.iframe.classList.add('background-video')
        this.videoAspectRatio = findPlayerAspectRatio(this.container, this.player, this.videoSource)
        this.syncPlayer()
        const readyEvent = new CustomEvent('ready')
        this.container.dispatchEvent(readyEvent)
      },
      stateChangeCallback: (state, data) => {
        switch (state) {
        case 'playing':
          if (!this.videoCanAutoPlay) {
            // The video element begain to auto play.
            this.logger('video started playing')
            this.videoCanAutoPlay = true
            this.player.ready = true
            this.player.iframe.classList.add('ready')
            this.container.classList.remove('mobile')
          }
          break
        }
        if (state) {
          this.logger(state)
        }
        if (data) {
          this.logger(data)
        }
      }
    })

    playerPromise.then(player => {
      this.player = player
    }, reason => {
      // Either the video embed failed to load for any reason (e.g. network latency, deleted video, etc.),
      // or the video element in the embed was not configured to properly auto play.
      this.logger(reason)
    })
  }

  /**
    * @method renderFallbackBehavior Initialize mobile fallback behavior
    * @return {undefined}
    */
  renderFallbackBehavior() {
    this.setFallbackImage()
    this.container.classList.add('mobile')
    this.logger('added mobile')
  }

  /**
    * @method syncPlayer Apply the purely visual effects.
    * @return {undefined}
    */
  syncPlayer() {
    this.setDisplayEffects()
    this.setSpeed()
    this.scaleVideo()
  }

  /**
   * @method scaleVideo The IFRAME will be the entire width and height of its container, but the video
   * may be a completely different size and ratio. Scale up the IFRAME so the inner video
   * behaves in the proper `fitMode`, with optional additional scaling to zoom in. Also allow
   * ImageLoader to reload the custom fallback image, if appropriate.
   * @param {Number} [scaleValue] A multiplier used to increase the scaled size of the media.
   * @return {undefined}
   */
  scaleVideo(scaleValue) {
    this.setFallbackImage()

    const playerIframe = this.player.iframe
    if (!playerIframe) {
      return
    }

    let scale = scaleValue || this.scaleFactor

    if (this.fitMode !== 'fill') {
      playerIframe.style.width = ''
      playerIframe.style.height = ''
      return
    }

    const containerWidth = playerIframe.parentNode.clientWidth
    const containerHeight = playerIframe.parentNode.clientHeight
    const containerRatio = containerWidth / containerHeight
    let pWidth = 0
    let pHeight = 0
    if (containerRatio > this.videoAspectRatio) {
      // at the same width, the video is taller than the window
      pWidth = containerWidth * scale
      pHeight = containerWidth * scale / this.videoAspectRatio
    } else if (this.videoAspectRatio > containerRatio) {
      // at the same width, the video is shorter than the window
      pWidth = containerHeight * scale * this.videoAspectRatio
      pHeight = containerHeight * scale
    } else {
      // the window and video ratios match
      pWidth = containerWidth * scale
      pHeight = containerHeight * scale
    }
    playerIframe.style.width = pWidth + 'px'
    playerIframe.style.height = pHeight + 'px'
    playerIframe.style.left = 0 - ((pWidth - containerWidth) / 2) + 'px'
    playerIframe.style.top = 0 - ((pHeight - containerHeight) / 2) + 'px'
  }

  /**
   * @method setSpeed Play back speed options, based on the YouTube API options.
   * @param {Number} [speedValue] Set the playback rate for YouTube videos.
   * @return {undefined}
   */
  setSpeed(speedValue) {
    this.playbackSpeed = parseFloat(this.playbackSpeed)
    if (this.player.setPlaybackRate) {
      this.player.setPlaybackRate(this.playbackSpeed)
    }
  }

  /**
   * @method setDisplayEffects All diplay related effects should be applied prior to the
   * video loading to ensure the effects are visible on the fallback image, as well.
   * @return {undefined}
   */
  setDisplayEffects() {
    // there were to be others here... now so lonely
    this.setFilter()
  }

  /**
   * @method setFilter Apply filter with values based on filterStrength.
   * @return {undefined}
   */
  setFilter() {
    const containerStyle = this.container.style
    const filter = FILTER_OPTIONS[this.filter - 1]
    let filterStyle = ''
    if (filter !== 'none') {
      filterStyle = this.getFilterStyle(filter, this.filterStrength)
    }

    // To prevent the blur effect from displaying the background at the edges as
    // part of the blur the media elements need to be scaled slightly.
    const isBlur = filter === 'blur'
    containerStyle.webkitFilter = isBlur ? '' : filterStyle
    containerStyle.filter = isBlur ? '' : filterStyle
    this.container.classList.toggle('filter-blur', isBlur)

    Array.prototype.slice.call(this.container.children).forEach((el) => {
      el.style.webkitFilter = !isBlur ? '' : filterStyle
      el.style.filter = !isBlur ? '' : filterStyle
    })
  }

  /**
   * @method getFilterStyle Construct the style based on the filter, strength and `FILTER_PROPERTIES`.
   * @param {String} [filter] A string from `FILTER_PROPERTIES`.
   * @param {Number}[strength] A number from 0 to 100 to apply to the filter.
   */
  getFilterStyle(filter, strength) {
    return `${filter}(${FILTER_PROPERTIES[filter].modifier(strength) + FILTER_PROPERTIES[filter].unit})`
  }

  /**
   * @method logger A guarded console logger.
   * @return {undefined}
   */
  logger(msg) {
    if (!this.DEBUG.enabled || !this.DEBUG.verbose) {
      return
    }

    this.windowContext.console.log(msg)
  }
}

export default VideoBackground
