import Player from '@vimeo/player'
import { getPlayerElement } from '../utils/utils'

/**
 * Call the Vimeo API per their guidelines.
 */
const initializeVimeoAPI = () => {
  // No external API call is necessary, preserved for parity with YouTube and
  // potential additional integrations.
  return new Promise((resolve, reject) => {
    resolve('no api needed')
  })
}

/**
 * Initialize the player and bind player events.
 */
const initializeVimeoPlayer = ({
  container, videoId, readyCallback, stateChangeCallback
}) => {
  let playerElement = getPlayerElement(container)
  playerElement.setAttribute('data-vimeo-background', 'true')

  const player = new Player(playerElement, {
    id: videoId,
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
    readyCallback(player)
  }

  player.destroy = () => {
    container.removeChild(playerElement)
  }

  player.ready()
    .then(data => {
      data = data ? data : {}
      data.event = 'ready'
      stateChangeCallback('buffering', data)

      Promise.all([
        player.getVideoWidth(),
        player.getVideoHeight(),
        player.getDuration()
      ]).then(values => {
        player.dimensions = {
          width: values[0],
          height: values[1]
        }

        player.duration = values[2]
        syncAndStartPlayback()
      })
    })

  player.on('timeupdate', data => {
    data.event = 'timeupdate'
    stateChangeCallback('playing', data)
  })

  player.on('progress', data => {
    data.event = 'progress'
    stateChangeCallback('playing', data)
  })

  player.on('play', data => {
    data.event = 'play'
    stateChangeCallback('playing', data)
  })

  return new Promise((resolve, reject) => {
    resolve(player)
  })
}

export {
  initializeVimeoAPI,
  initializeVimeoPlayer
}
