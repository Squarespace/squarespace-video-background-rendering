const filterOptions = [
  'none',
  'blur',
  'brightness',
  'contrast',
  'invert',
  'opacity',
  'saturate',
  'sepia',
  'drop-shadow',
  'grayscale',
  'hue-rotate'
];

/**
 * Each filter style needs to adjust the strength value (1 - 100) by a `modifier`
 * function and a unit, as appropriate. The `modifier` is purely subjective.
 */
const filterProperties = {
  blur: {
    modifier: value => value * 0.3,
    unit: 'px'
  },
  brightness: {
    modifier: value => value * 0.009 + 0.1,
    unit: ''
  },
  contrast: {
    modifier: value => value * 0.4 + 80,
    unit: '%'
  },
  grayscale: {
    modifier: value => value,
    unit: '%'
  },
  'hue-rotate': {
    modifier: value => value * 3.6,
    unit: 'deg'
  },
  invert: {
    modifier: value => 1,
    unit: ''
  },
  opacity: {
    modifier: value => value,
    unit: '%'
  },
  saturate: {
    modifier: value => value * 2,
    unit: '%'
  },
  sepia: {
    modifier: value => value,
    unit: '%'
  },
};

export {
  filterOptions,
  filterProperties
};
