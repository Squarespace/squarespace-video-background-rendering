import { getPlayerElement } from '../utils/utils'
import { TIMEOUT as timeoutDuration } from '../constants/instance'

let playerIframe
let playerOrigin = '*'
let playerPromiseTimer = null

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
 * Creates cross frame postMessage handlers, gets proper dimensions of player,
 * and sets ready state for the player and container.
 *
 */
const postMessageManager = (action, value) => {
  const data = {
    method: action
  }

  if (value) {
    data.value = value
  }

  const message = JSON.stringify(data)
  playerIframe.ownerDocument.defaultView.eval('(function(playerIframe){ playerIframe.contentWindow.postMessage(' +
    message + ', ' + JSON.stringify(playerOrigin) + ') })')(playerIframe)
}

/**
 * Initialize the player and bind player events with a postMessage handler.
 */
const initializeVimeoPlayer = ({
  win, instance, container, videoId, startTime, readyCallback, stateChangeCallback
}) => {
  return new Promise((resolve, reject) => {
    const logger = instance.logger || function() {}
    playerIframe = win.document.createElement('iframe')
    playerIframe.id = 'vimeoplayer'
    const playerConfig = '&background=1'
    playerIframe.src = '//player.vimeo.com/video/' + videoId + '?api=1' + playerConfig
    const wrapper = getPlayerElement(container)
    wrapper.appendChild(playerIframe)

    const player = {
      iframe: playerIframe,
      setPlaybackRate: () => {}
    }

    const getVideoDetails = () => {
      postMessageManager('getDuration')
      postMessageManager('getVideoHeight')
      postMessageManager('getVideoWidth')
    }

    let retryTimer = null
    const syncAndStartPlayback = (isRetrying = false) => {
      if (!isRetrying && (!player.dimensions.width || !player.dimensions.height || !player.duration)) {
        return
      }

      if (isRetrying) {
        getVideoDetails()
      }

      player.dimensions.width = player.dimensions.width || player.iframe.parentNode.offsetWidth
      player.dimensions.height = player.dimensions.height || player.iframe.parentNode.offsetHeight
      player.duration = player.duration || 10

      // Only required for Vimeo Basic videos, or video URLs with a start time hash.
      // Plus and Pro utilize `background=1` URL parameter.
      // See https://vimeo.com/forums/topic:278001
      postMessageManager('setVolume', '0')
      postMessageManager('setLoop', 'true')
      postMessageManager('seekTo', startTime) // `seekTo` handles playback as well
      postMessageManager('addEventListener', 'playProgress')

      readyCallback(player)
    }

    const onReady = () => {
      if (playerPromiseTimer) {
        clearTimeout(playerPromiseTimer)
        playerPromiseTimer = null
      }
      resolve(player)

      if (!player.dimensions) {
        player.dimensions = {}
        getVideoDetails()

        stateChangeCallback('buffering')
        retryTimer = setTimeout(() => {
          logger.call(instance, 'retrying')
          syncAndStartPlayback(true)
        }, timeoutDuration * 0.75)
      }
    }

    const onMessageReceived = event => {
      if (!(/^https?:\/\/player.vimeo.com/).test(event.origin)) {
        return false
      }

      playerOrigin = event.origin

      let data = event.data
      if (typeof data === 'string') {
        data = JSON.parse(data)
      }

      switch (data.event) {
      case 'ready':
        onReady(playerOrigin)
        break

      case 'playProgress':
      case 'timeupdate':
        if (retryTimer) {
          clearTimeout(retryTimer)
          retryTimer = null
        }
        stateChangeCallback('playing', data)
        postMessageManager('setVolume', '0')

        if (data.data.percent >= 0.98 && startTime > 0) {
          postMessageManager('seekTo', startTime)
        }
        break
      }

      switch (data.method) {
      case 'getVideoHeight':
        logger.call(instance, data.method)
        player.dimensions.height = data.value
        syncAndStartPlayback()
        break
      case 'getVideoWidth':
        logger.call(instance, data.method)
        player.dimensions.width = data.value
        syncAndStartPlayback()
        break
      case 'getDuration':
        logger.call(instance, data.method)
        player.duration = data.value
        if (startTime >= player.duration) {
          startTime = 0
        }
        syncAndStartPlayback()
        break
      }
    }

    const messageHandler = e => {
      onMessageReceived(e)
    }

    win.addEventListener('message', messageHandler, false)

    player.destroy = () => {
      win.removeEventListener('message', messageHandler)
      // If the iframe node has already been removed from the DOM by the
      // implementer, parentElement.removeChild will error out unless we do
      // this check here first.
      if (player.iframe.parentElement) {
        player.iframe.parentElement.removeChild(player.iframe)
      }
    }

    playerPromiseTimer = setTimeout(() => {
      reject('Ran out of time')
    }, timeoutDuration)

  })
}

export {
  initializeVimeoAPI,
  initializeVimeoPlayer
}
