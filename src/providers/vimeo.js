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
const initializeVimeoPlayer = (context) => {
  const playerIframe = context.windowContext.document.createElement('iframe');
  playerIframe.id = 'vimeoplayer';
  playerIframe.classList.add('background-video');
  const playerConfig = '&background=1';
  playerIframe.src = '//player.vimeo.com/video/' + context.videoId + '?api=1' + playerConfig;
  context.container.appendChild(playerIframe);
  context.player.iframe = playerIframe;

  /**
   * Creates cross frame postMessage handlers, gets proper dimensions of player,
   * and sets ready state for the player and container.
   *
   */
  const player = context.player;
  let playerOrigin = '*';

  const postMessageManager = (action, value) => {
    const data = {
      method: action
    };

    if (value) {
      data.value = value;
    }

    const message = JSON.stringify(data);
    context.windowContext.eval('(function(ctx){ ctx.player.iframe.contentWindow.postMessage(' +
      message + ', ' + JSON.stringify(playerOrigin) + '); })')(context);
  };
  player.postMessageManager = postMessageManager;

  const syncAndStartPlayback = () => {
    if (!player.dimensions.width || !player.dimensions.height || !player.duration) {
      return;
    }
    context.syncPlayer();

    const readyEvent = new CustomEvent('ready');
    context.container.dispatchEvent(readyEvent);
    document.body.classList.add('ready');

    // Only required for Vimeo Basic videos, or video URLs with a start time hash.
    // Plus and Pro utilize `background=1` URL parameter.
    // See https://vimeo.com/forums/topic:278001
    postMessageManager('setVolume', '0');
    postMessageManager('setLoop', 'true');
    postMessageManager('seekTo', context.timeCode.start);
    postMessageManager('play');
    postMessageManager('addEventListener', 'playProgress');
  };

  const onReady = () => {
    player.dimensions = {};
    postMessageManager('getDuration');
    postMessageManager('getVideoHeight');
    postMessageManager('getVideoWidth');
  };

  const onPlaying = () => {
    clearTimeout(player.playTimeout);
    player.playTimeout = null;
    player.ready = true;
    player.iframe.classList.add('ready');

    if (!context.canAutoPlay) {
      context.canAutoPlay = true;
      context.container.classList.remove('mobile');
    }
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
    context.logger(data);

    switch (data.event) {
    case 'ready':
      onReady();
      break;

    case 'playProgress':
    case 'timeupdate':
      postMessageManager('setVolume', '0');
      if (player.playTimeout !== null) {
        onPlaying();
      }
      if (data.data.percent >= 0.98 && context.timeCode.start > 0) {
        postMessageManager('seekTo', context.timeCode.start);
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
      if (context.timeCode.start >= player.duration) {
        context.timeCode.start = 0;
      }
      syncAndStartPlayback();
      break;
    }
  };

  const messageHandler = e => {
    onMessageReceived(e);
  };

  context.windowContext.addEventListener('message', messageHandler, false);
  context.autoPlayTestTimeout();

  player.destroy = () => {
    context.windowContext.removeEventListener('message', messageHandler);
    // If the iframe node has already been removed from the DOM by the
    // implementer, parentElement.removeChild will error out unless we do
    // this check here first.
    if (player.iframe.parentElement) {
      player.iframe.parentElement.removeChild(player.iframe);
    }
  };
};

export {
  initializeVimeoAPI,
  initializeVimeoPlayer
};
