const DEBUG = {
  enabled: true, // Adds the Class instance to the window for easier debugging
  verbose: false // Allows logging in detail
}

const DEFAULT_PROPERTY_VALUES = {
  container: 'body',
  url: 'https://youtu.be/xkEmYQvJ_68',
  source: 'youtube',
  fitMode: 'fill',
  scaleFactor: 1,
  playbackSpeed: 1,
  filter: 1,
  filterStrength: 50,
  timeCode: { start: 0, end: null },
  DEBUG
}

const TIMEOUT = 2500

// eslint-disable-next-line no-useless-escape
const YOUTUBE_REGEX = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]{11}).*/
// eslint-disable-next-line no-useless-escape
const VIMEO_REGEX = /^.*(vimeo\.com\/)(channels\/[a-zA-Z0-9]*\/)*([0-9]{7,}(#t\=.*s)?)/

export {
  DEBUG,
  DEFAULT_PROPERTY_VALUES,
  TIMEOUT,
  YOUTUBE_REGEX,
  VIMEO_REGEX
}
