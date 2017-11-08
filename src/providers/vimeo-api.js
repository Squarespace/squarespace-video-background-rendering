import Player from '@vimeo/player';

/**
 * Call the Vimeo API per their guidelines.
 */
const initializeVimeoAPI = () => {
  // No external API call is necessary; preserved for parity with YouTube and
  // potential additional integrations.
  return new Promise((resolve, reject) => {
    resolve('no api needed');
  });
};

/**
 * Initialize the player and bind player events.
 */
const initializeVimeoPlayer = (config) => {
  let playerElement = config.container.querySelector('#player');
  if (!playerElement) {
    playerElement = document.createElement('div');
    playerElement.id = 'player';
    config.container.appendChild(playerElement);
  }

  const player = new Player(playerElement, {
    id: config.videoId,
    width: playerElement.offsetWidth,
    loop: true,
    background: true
  })

  player.dimensions = {}

  const syncAndStartPlayback = () => {
    if (!player.dimensions.width || !player.dimensions.height || !player.duration) {
      return
    }

    player.iframe = player.element
    player.setVolume(0)
    player.play()
    config.readyCallback(player)
  }

  player.destroy = () => {
    config.container.removeChild(playerElement)
  }

  player.ready()
    .then(data => {
      data = data ? data : {}
      data.event = 'ready'
      config.stateChangeCallback('buffering', data)

      player.getVideoWidth().then(function(width) {
        player.dimensions.width = width
        syncAndStartPlayback(player)
      })
      player.getVideoHeight().then(function(height) {
        player.dimensions.height = height
        syncAndStartPlayback(player)
      })
      player.getDuration().then(function(duration) {
        player.duration = duration
        if (config.startTime >= player.duration) {
          config.startTime = 0;
        }
        syncAndStartPlayback(player)
      })
    })

  player.on('timeupdate', data => {
    data.event = 'timeupdate'
    config.stateChangeCallback('playing', data)
  })

  player.on('progress', data => {
    data.event = 'progress'
    config.stateChangeCallback('playing', data)
  })

  player.on('play', data => {
    data.event = 'play'
    config.stateChangeCallback('playing', data)
  })

  return new Promise((resolve, reject) => {
    resolve(player)
  })
}

export {
  initializeVimeoAPI,
  initializeVimeoPlayer
};
