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
 * Creates cross frame postMessage handlers, gets proper dimensions of player,
 * and sets ready state for the player and container.
 *
 */

let playerIframe;
let playerOrigin = '*';

const postMessageManager = (action, value) => {
  const data = {
    method: action
  };

  if (value) {
    data.value = value;
  }

  const message = JSON.stringify(data);
  playerIframe.ownerDocument.defaultView.eval('(function(playerIframe){ playerIframe.contentWindow.postMessage(' +
    message + ', ' + JSON.stringify(playerOrigin) + '); })')(playerIframe);
};

/**
 * Initialize the player and bind player events with a postMessage handler.
 */
const initializeVimeoPlayer = (config) => {
  playerIframe = config.win.document.createElement('iframe');
  playerIframe.id = 'vimeoplayer';
  const playerConfig = '&background=1';
  playerIframe.src = '//player.vimeo.com/video/' + config.videoId + '?api=1' + playerConfig;
  config.container.appendChild(playerIframe);

  const player = {
    iframe: playerIframe,
    setPlaybackRate: () => {}
  };

  const syncAndStartPlayback = () => {
    if (!player.dimensions.width || !player.dimensions.height || !player.duration) {
      return;
    }

    config.instance.logger(player.dimensions);

    // Only required for Vimeo Basic videos, or video URLs with a start time hash.
    // Plus and Pro utilize `background=1` URL parameter.
    // See https://vimeo.com/forums/topic:278001
    postMessageManager('setVolume', '0');
    postMessageManager('setLoop', 'true');
    postMessageManager('seekTo', config.startTime);
    postMessageManager('play');
    postMessageManager('addEventListener', 'playProgress');

    config.stateChangeCallback('buffering');
    config.readyCallback(player);
  };

  const onReady = () => {
    player.dimensions = {};
    postMessageManager('getDuration');
    postMessageManager('getVideoHeight');
    postMessageManager('getVideoWidth');
  };

  const onMessageReceived = (event) => {
    if (!(/^https?:\/\/player.vimeo.com/).test(event.origin)) {
      return false;
    }

    playerOrigin = event.origin;

    let data = event.data;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    switch (data.event) {
    case 'ready':
      onReady(playerOrigin);
      break;

    case 'playProgress':
    case 'timeupdate':
      config.stateChangeCallback('playing', data);
      postMessageManager('setVolume', '0');

      if (data.data.percent >= 0.98 && config.startTime > 0) {
        postMessageManager('seekTo', config.startTime);
      }
      break;
    }

    switch (data.method) {
    case 'getVideoHeight':
      player.dimensions.height = data.value;
      syncAndStartPlayback();
      break;
    case 'getVideoWidth':
      player.dimensions.width = data.value;
      syncAndStartPlayback();
      break;
    case 'getDuration':
      player.duration = data.value;
      if (config.startTime >= player.duration) {
        config.startTime = 0;
      }
      syncAndStartPlayback();
      break;
    }
  };

  const messageHandler = e => {
    onMessageReceived(e);
  };

  config.win.addEventListener('message', messageHandler, false);

  player.destroy = () => {
    config.win.removeEventListener('message', messageHandler);
    // If the iframe node has already been removed from the DOM by the
    // implementer, parentElement.removeChild will error out unless we do
    // this check here first.
    if (player.iframe.parentElement) {
      player.iframe.parentElement.removeChild(player.iframe);
    }
  };

  return new Promise((resolve, reject) => {
    resolve(player);
  });
};

export {
  initializeVimeoAPI,
  initializeVimeoPlayer
};
