// Adds the Class instance to the window for easier debugging
const DEBUG = true
// Allows logging in detail
const DEBUG_VERBOSE = false

const DEFAULT_PROPERTY_VALUES = {
  container: '.background-wrapper',
  url: 'https://youtu.be/xkEmYQvJ_68',
  source: 'youtube',
  fitMode: 'fill',
  scaleFactor: 1,
  playbackSpeed: 1,
  filter: 1,
  filterStrength: 50,
  timeCode: { start: 0, end: null },
  DEBUG,
  DEBUG_VERBOSE
}

// eslint-disable-next-line no-useless-escape
const YOUTUBE_REGEX = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]{11}).*/
// eslint-disable-next-line no-useless-escape
const VIMEO_REGEX = /^.*(vimeo\.com\/)([0-9]{7,}(#t\=.*s)?)/

export {
  DEBUG,
  DEBUG_VERBOSE,
  DEFAULT_PROPERTY_VALUES,
  YOUTUBE_REGEX,
  VIMEO_REGEX
}
