import merge from 'lodash.merge'
import parseUrl from 'url-parse'
import testBrowserAutoplaySupport from './utils/videoAutoplayTest'
import { initializeVimeoAPI, initializeVimeoPlayer } from './providers/vimeo'
import { initializeYouTubeAPI, initializeYouTubePlayer } from './providers/youtube'

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

import { DEFAULT_PROPERTY_VALUES } from './constants/instance'
import { filterOptions as FILTER_OPTIONS } from './constants/filter'
import { filterProperties as FILTER_PROPERTIES } from './constants/filter'
import { getVideoID, getVideoSource, validatedImage } from './utils/utils'
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
    this.canAutoPlay = false

    this.setInstanceProperties(props)

    // Test browser support for autoplay for video elements
    testBrowserAutoplaySupport().then((value) => {
      this.logger(value)
      this.canAutoPlay = true
    }, (reason) => {
      // If there is no browser support, go to fall back behavior
      this.logger(reason)
      this.canAutoPlay = false
      this.container.classList.add('mobile')
      this.logger('added mobile')
    }).then((value) => {
      this.logger(value)
      this.setDisplayEffects()
      this.setFallbackImage()
      this.initializeVideoAPI()
      this.bindUI()

      if (this.DEBUG === true) {
        window.vdbg = this
      }
    })
  }

  destroy() {
    if (this.events) {
      this.events.forEach(evt => evt.target.removeEventListener(evt.type, evt.handler, true))
    }
    this.events = null

    if (this.player && typeof this.player.destroy === 'function') {
      this.player.iframe.classList.remove('ready')
      clearTimeout(this.player.playTimeout)
      this.player.playTimeout = null
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
        this.scaleMedia()
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
   * Merge configuration properties with defaults with minimal validation.
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
    this.videoId = getVideoID(props.url, this.videoSource)
    this.customFallbackImage = validatedImage(props.customFallbackImage)
    this.filter = props.filter
    this.filterStrength = props.filterStrength
    this.fitMode = props.fitMode
    this.scaleFactor = props.scaleFactor
    this.playbackSpeed = parseFloat(props.playbackSpeed) === 0.0 ? 1 : parseFloat(props.playbackSpeed)
    this.timeCode = {
      start: this._getStartTime(props.url) || props.timeCode.start,
      end: props.timeCode.end
    }
    this.player = {}
    this.currentLoop = 0
    this.DEBUG = props.DEBUG
    this.DEBUG_VERBOSE = props.DEBUG_VERBOSE
  }

  /**
   * Sets a custom fallback image
   */
  setFallbackImage() {
    const customFallbackImage = this.customFallbackImage
    if (!customFallbackImage || !this.windowContext.ImageLoader) {
      return
    }
    customFallbackImage.addEventListener('load', () => {
      customFallbackImage.classList.add('loaded')
    }, { once: true })
    this.windowContext.ImageLoader.load(customFallbackImage, { load: true })
  }

  /**
   * Load the API for the appropriate source
   */
  initializeVideoAPI() {
    if (this.canAutoPlay && this.videoSource && this.videoId) {
      this.player.ready = false

      const sourceAPIFunction = videoSourceModules[this.videoSource].api
      const apiPromise = sourceAPIFunction(this.windowContext)
      apiPromise.then((message) => {
        this.logger(message)
        this.player.ready = false
        this.initializeVideoPlayer()
      }).catch((message) => {
        this.canAutoPlay = false
        this.container.classList.add('mobile')
        document.body.classList.add('ready')
        this.logger(message)
      })
    } else {
      this.container.classList.add('mobile')
      document.body.classList.add('ready')
    }
  }

  /**
   * Initialize the video player and register its callbacks
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
      container: this.container,
      win: this.windowContext,
      videoId: this.videoId,
      startTime: this.timeCode.start,
      speed: this.playbackSpeed,
      readyCallback: (player, data) => {
        this.player.iframe.classList.add('background-video')
        this.videoAspectRatio = this.findPlayerAspectRatio()
        this.syncPlayer()
        const readyEvent = new CustomEvent('ready')
        this.container.dispatchEvent(readyEvent)
        document.body.classList.add('ready')
      },
      stateChangeCallback: (state, data) => {
        if (state === 'buffering') {
          this.testVideoEmbedAutoplay({ success: false })
        } else if (state === 'playing') {
          if (this.player.playTimeout !== null) {
            this.testVideoEmbedAutoplay({ success: true })
            clearTimeout(this.player.playTimeout)
            this.player.playTimeout = null
            this.player.ready = true
            this.player.iframe.classList.add('ready')

            if (!this.canAutoPlay) {
              this.canAutoPlay = true
              this.container.classList.remove('mobile')
            }
          }
        }
        if (data) {
          this.logger(data)
        }
      }
    })

    playerPromise.then((player) => {
      this.player = player
    })
  }

  /**
    * Since we cannot inspect the video element inside the provider's IFRAME to
    * check for `autoplay` and `playsinline` attributes, set a timeout that will
    * tell this instance that the media cannot auto play. The timeout will be
    * cleared via the media's playback API if it does begin playing.
    */
  testVideoEmbedAutoplay(options = { success: false }) {
    if (options.success === true) {
      clearTimeout(this.player.playTimeout)
      this.player.playTimeout = null
      return
    }
    this.player.playTimeout = setTimeout(() => {
      this.canAutoPlay = false
      this.container.classList.add('mobile')
      this.player.playTimeout = null
      this.logger('added mobile')
    }, 2500)
  }

  /**
    * Apply the purely visual effects.
    */
  syncPlayer() {
    this.setDisplayEffects()
    this.setSpeed()
    this.scaleMedia()
  }

  /**
   * The IFRAME will be the entire width and height of its container, but the video
   * may be a completely different size and ratio. Scale up the IFRAME so the inner video
   * behaves in the proper `fitMode`, with optional additional scaling to zoom in.
   */
  scaleMedia(scaleValue) {
    this.setFallbackImage()

    const playerIframe = this.player.iframe
    if (!playerIframe) {
      return
    }

    let scale = scaleValue || this.scaleFactor

    if (this.fitMode !== 'fill') {
      playerIframe.style.width = ''
      playerIframe.style.height = ''
      return false
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
      playerIframe.style.width = pWidth + 'px'
      playerIframe.style.height = pHeight + 'px'
    } else if (this.videoAspectRatio > containerRatio) {
      // at the same width, the video is shorter than the window
      pWidth = containerHeight * scale * this.videoAspectRatio
      pHeight = containerHeight * scale
      playerIframe.style.width = pWidth + 'px'
      playerIframe.style.height = pHeight + 'px'
    } else {
      // the window and video ratios match
      pWidth = containerWidth * scale
      pHeight = containerHeight * scale
      playerIframe.style.width = pWidth + 'px'
      playerIframe.style.height = pHeight + 'px'
    }
    playerIframe.style.left = 0 - ((pWidth - containerWidth) / 2) + 'px'
    playerIframe.style.top = 0 - ((pHeight - containerHeight) / 2) + 'px'
  }

  /**
   * Play back speed options, based on the YouTube API options.
   */
  setSpeed(speedValue) {
    this.playbackSpeed = parseFloat(this.playbackSpeed)
    this.player.setPlaybackRate(this.playbackSpeed)
  }

  /**
   * All diplay related effects should be applied prior to the video loading to
   * ensure the effects are visible on the fallback image while loading.
   */
  setDisplayEffects() {
    // there were to be others here... now so lonely
    this.setFilter()
  }

  /**
   * Apply filter with values based on filterStrength.
   */
  setFilter() {
    const containerStyle = this.container.style
    const filter = FILTER_OPTIONS[this.filter - 1]
    let filterStyle = ''
    if (filter !== 'none') {
      filterStyle = this.getFilterStyle(filter, this.filterStrength)
    }

    // To prevent the blur effect from displaying the background at the edges as
    // part of the blur, the filer needs to be applied to the player and fallback image,
    // and those elements need to be scaled slightly.
    // No other combination of filter target and scaling seems to work.
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
   * Construct the style based on the filter, strength and `FILTER_PROPERTIES`.
   */
  getFilterStyle(filter, strength) {
    return `${ filter }(${ FILTER_PROPERTIES[filter].modifier(strength) + FILTER_PROPERTIES[filter].unit })`
  }

  /**
   * The YouTube API seemingly does not expose the actual width and height dimensions
   * of the video itself. The video's dimensions and ratio may be completely different
   * than the IFRAME's. This hack finds those values inside some private objects.
   * Since this is not part of the pbulic API, the dimensions will fall back to the
   * container width and height, in case YouTube changes the internals unexpectedly.
   */
  findPlayerAspectRatio() {
    let w
    let h
    const player = this.player
    if (this.videoSource === 'youtube' && player) {
      for (let p in player) {
        let prop = player[p]
        if (typeof prop === 'object' && prop.width && prop.height) {
          w = prop.width
          h = prop.height
          break
        }
      }
    } else if (this.videoSource === 'vimeo' && player) {
      if (player.dimensions) {
        w = player.dimensions.width
        h = player.dimensions.height
      } else if (player.iframe) {
        w = player.iframe.clientWidth
        h = player.iframe.clientHeight
      }
    }
    if (!w || !h) {
      w = this.container.clientWidth
      h = this.container.clientHeight
      console.warn('Video player dimensions not found.')
    }
    return parseInt(w, 10) / parseInt(h, 10)
  }

  /**
   * Get the start time base on the URL formats of YouTube and Vimeo.
   */
  _getStartTime(url) {
    const parsedUrl = new parseUrl(url, true)
    let timeParam = this._getTimeParameter(parsedUrl)
    if (!timeParam) {
      return false
    }

    const timeRegexYoutube = /[hms]/
    const timeRegexVimeo = /[#t=s]/

    let match
    switch (this.videoSource) {
    case 'youtube' :
      match = timeParam.split(timeRegexYoutube).filter(Boolean)
      break
    case 'vimeo' :
      match = timeParam.split(timeRegexVimeo).filter(Boolean)
      break
    }
    let s = parseInt(match.pop(), 10) || 0
    let m = parseInt(match.pop(), 10) * 60 || 0
    let h = parseInt(match.pop(), 10) * 3600 || 0
    return h + m + s
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
      return false
    }
    let timeParam
    if (this.videoSource === 'youtube') {
      timeParam = parsedUrl.query.t
    } else if (this.videoSource === 'vimeo') {
      timeParam = parsedUrl.hash
    }
    return timeParam
  }

  logger(msg) {
    if (!this.DEBUG || !this.DEBUG_VERBOSE) {
      return
    }

    this.windowContext.console.log(msg)
  }
}

export default VideoBackground
