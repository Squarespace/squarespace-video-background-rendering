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

export { getStartTime, getVideoID, getVideoSource, validatedImage }
