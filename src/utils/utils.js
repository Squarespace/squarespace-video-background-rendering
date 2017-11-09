import { DEFAULT_PROPERTY_VALUES } from '../constants/instance.js'
import { YOUTUBE_REGEX, VIMEO_REGEX } from '../constants/instance.js'
import parseUrl from 'url-parse'

/**
 * @method getTimeParameter YouTube and Vimeo have optional URL formats to allow
 *    playback to begin from a certain point in the video.
 * @return {String or false} The appropriate time parameter or false.
 */
const getTimeParameter = (parsedUrl, source) => {
  if ((source === 'youtube' && (!parsedUrl.query || !parsedUrl.query.t)) ||
    (source === 'vimeo' && (!parsedUrl.hash))
  ) {
    return false
  }
  let timeParam
  if (source === 'youtube') {
    timeParam = parsedUrl.query.t
  } else if (source === 'vimeo') {
    timeParam = parsedUrl.hash
  }
  return timeParam
}

/**
 * @method getStartTime Parse the start time base on the URL formats of YouTube and Vimeo.
 * @param {String} [url] The URL for the video, including any time code parameters.
 * @return {Number} Time in seconds
 */
const getStartTime = (url, source) => {
  const parsedUrl = new parseUrl(url, true)
  let timeParam = getTimeParameter(parsedUrl)
  if (!timeParam) {
    return false
  }

  const timeRegexYoutube = /[hms]/
  const timeRegexVimeo = /[#t=s]/

  let match
  switch (source) {
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
 * @method getVideoSource Determine the video source from the URL via regex.
 * @param {String} [url] The URL for the video
 * @return {String} Video provider name
 */
const getVideoSource = (url = DEFAULT_PROPERTY_VALUES.url) => {
  let match = url.match(YOUTUBE_REGEX)
  if (match && match[2].length) {
    return 'youtube'
  }

  match = url.match(VIMEO_REGEX)
  if (match && match[2].length) {
    return 'vimeo'
  }

  console.error(`Video source ${ url } does not match supported types`)
}

/**
 * @method getVideoId Get the video ID for use in the provider APIs.
 * @param {String} [url] The URL for the video
 * @param {String} [source] Video provider name
 * @return {String} Video ID
 */
const getVideoID = (url = DEFAULT_PROPERTY_VALUES.url, source = null) => {
  let match
  if (source === 'youtube') {
    match = url.match(YOUTUBE_REGEX)
  } else if (source === 'vimeo') {
    match = url.match(VIMEO_REGEX)
  }
  if (match && match[2].length) {
    return match[2]
  }

  console.error(`Video id at ${ url } is not valid`)
}

/**
 * @method validatedImage Ensure the element is an image
 * @param {Node} [img] Image element
 * @return {Node or false}
 */
const validatedImage = (img) => {
  if (!img) {
    return false
  }
  let isValid = img.nodeName === 'IMG' ? img : false;
  if (!isValid) {
    console.warn('Element is not a valid image element.');
  }

  return isValid
}

/**
 * @method findPlayerAspectRatio Determine the aspect ratio of the actual video itself,
 *    which may be different than the IFRAME returned by the video provider.
 * @return {Number} A ratio of width divided by height.
 */
const findPlayerAspectRatio = (container, player, videoSource) => {
  let w
  let h
  if (videoSource === 'youtube' && player) {
    // The YouTube API seemingly does not expose the actual width and height dimensions
    // of the video itself. The video's dimensions and ratio may be completely different
    // than the IFRAME's. This hack finds those values inside some private objects.
    // Since this is not part of the public API, the dimensions will fall back to the
    // container width and height in case YouTube changes the internals unexpectedly.
    for (let p in player) {
      let prop = player[p]
      if (typeof prop === 'object' && prop.width && prop.height) {
        w = prop.width
        h = prop.height
        break
      }
    }
  } else if (videoSource === 'vimeo' && player) {
    if (player.dimensions) {
      w = player.dimensions.width
      h = player.dimensions.height
    } else if (player.iframe) {
      w = player.iframe.clientWidth
      h = player.iframe.clientHeight
    }
  }
  if (!w || !h) {
    w = container.clientWidth
    h = container.clientHeight
    console.warn('Video player dimensions not found.')
  }
  return parseInt(w, 10) / parseInt(h, 10)
}

const getPlayerElement = (container) => {
  let playerElement = container.querySelector('#player');
  if (!playerElement) {
    playerElement = document.createElement('div');
    playerElement.id = 'player';
    container.appendChild(playerElement);
  }

  playerElement.setAttribute('style', 'position: absolute; top: 0; bottom: 0; left: 0; right: 0;')

  return playerElement
}

export { findPlayerAspectRatio, getPlayerElement, getStartTime, getVideoID, getVideoSource, validatedImage }
