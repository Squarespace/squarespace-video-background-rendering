import { DEFAULT_PROPERTY_VALUES } from '../constants/instance.js'
import { YOUTUBE_REGEX, VIMEO_REGEX } from '../constants/instance.js'
import parseUrl from 'url-parse'

/**
 * @method getTimeParameter YouTube and Vimeo have optional URL formats to allow
 *    playback to begin from a certain point in the video.
 * @return {String or false} The appropriate time parameter or false.
 */
const getTimeParameter = (parsedUrl) => {
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

/**
 * @method getStartTime Parse the start time base on the URL formats of YouTube and Vimeo.
 * @param {String} [url] The URL for the video, including any time code parameters.
 * @return {Number} Time in seconds
 */
const getStartTime = (url) => {
  const parsedUrl = new parseUrl(url, true)
  let timeParam = getTimeParameter(parsedUrl)
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
 * Determine the video source from the URL via regex.
 */
const getVideoSource = (value = DEFAULT_PROPERTY_VALUES.url) => {
  let match = value.match(YOUTUBE_REGEX)
  if (match && match[2].length) {
    return 'youtube'
  }

  match = value.match(VIMEO_REGEX)
  if (match && match[2].length) {
    return 'vimeo'
  }

  console.error(`Video source ${ value } does not match supported types`)
  return null
}

/**
 * Get the video ID for use in the provider APIs.
 */
const getVideoID = (value = DEFAULT_PROPERTY_VALUES.url, source = 'youtube') => {
  let match
  if (source === 'youtube') {
    match = value.match(YOUTUBE_REGEX)
  } else if (source === 'vimeo') {
    match = value.match(VIMEO_REGEX)
  }
  if (match && match[2].length) {
    return match[2]
  }

  console.error(`Video id at ${ value } is not valid`)
  return null
}

/**
 * Ensure the element is an image
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

export { getStartTime, getVideoID, getVideoSource, validatedImage }
