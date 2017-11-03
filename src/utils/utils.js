import { DEFAULT_PROPERTY_VALUES } from '../constants/instance.js'
import { YOUTUBE_REGEX, VIMEO_REGEX } from '../constants/instance.js'

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

export { getVideoID, getVideoSource, validatedImage }
