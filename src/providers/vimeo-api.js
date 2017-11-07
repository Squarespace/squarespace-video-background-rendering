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
 * Initialize the player and bind player events with a postMessage handler.
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
    width: 640,
    loop: true
  })

  const syncAndStartPlayback = () => {
    if (!player.width || !player.height || !player.duration) {
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
      player.getVideoWidth().then(function(width) {
        player.width = width
        syncAndStartPlayback(player)
      })
      player.getVideoHeight().then(function(height) {
        player.height = height
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

  player.on('progress', data => {
    config.stateChangeCallback('playing', data)
  })

  player.on('play', data => {
    config.stateChangeCallback('playing', data)
  })

  player.on('timeUpdate', data => {
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
