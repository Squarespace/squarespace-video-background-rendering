/**
 * Set up the YouTube script include if it's not present
 */
const initializeYouTubeAPI = (win) => {
  return new Promise((resolve, reject) => {
    if (win.document.documentElement.querySelector('script[src*="www.youtube.com/iframe_api"].loaded')) {
      resolve('already loaded');
      return;
    }

    const tag = win.document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = win.document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    tag.addEventListener('load', (evt) => {
      evt.currentTarget.classList.add('loaded');
      resolve('created and loaded');
    }, true);
    tag.addEventListener('error', (evt) => {
      reject('Failed to load YouTube script: ', evt);
    });
  });
};

/**
 * YouTube event handler. Add the proper class to the player element, and set
 * player properties. All player methods via YouTube API.
 */
const onYouTubePlayerReady = (event, startTime) => {
  const player = event.target;
  player.mute();
  player.ready = true;
  player.seekTo(startTime < player.getDuration() ? startTime : 0);
  player.playVideo();
};

/**
 * YouTube event handler. Determine whether or not to loop the video.
 */
const onYouTubePlayerStateChange = (event, startTime, win, playbackSpeed = 1) => {
  const player = event.target;
  const duration = (player.getDuration() - startTime) / playbackSpeed;

  const doLoop = () => {
    if ((player.getCurrentTime() + 0.1) >= player.getDuration()) {
      player.pauseVideo();
      player.seekTo(startTime);
      player.playVideo();
    }
    requestAnimationFrame(doLoop);
  };

  if (event.data === win.YT.PlayerState.BUFFERING &&
     (player.getVideoLoadedFraction() !== 1) &&
     (player.getCurrentTime() === 0 || player.getCurrentTime() > duration - -0.1)) {
    return 'buffering';
  } else if (event.data === win.YT.PlayerState.PLAYING) {
    requestAnimationFrame(doLoop);
    return 'playing';
  } else if (event.data === win.YT.PlayerState.ENDED) {
    player.playVideo();
  }
};

/**
 * Initialize the player and bind player events.
 */
const initializeYouTubePlayer = (config) => {
  let playerElement = config.container.querySelector('#player');
  if (!playerElement) {
    playerElement = document.createElement('div');
    playerElement.id = 'player';
    config.container.appendChild(playerElement);
  }

  const isAPILoaded = () => {
    return config.win.YT.loaded === 1;
  };

  const makePlayer = () => {
    return new config.win.YT.Player(playerElement, {
      height: '315',
      width: '560',
      videoId: config.videoId,
      playerVars: {
        'autohide': 1,
        'autoplay': 0,
        'controls': 0,
        'enablejsapi': 1,
        'iv_load_policy': 3,
        'loop': 0,
        'modestbranding': 1,
        'playsinline': 1,
        'rel': 0,
        'showinfo': 0,
        'wmode': 'opaque'
      },
      events: {
        onReady: function(event) {
          onYouTubePlayerReady(event, config.startTime);
          config.readyCallback(event.target);
        },
        onStateChange: function(event) {
          const state = onYouTubePlayerStateChange(event, config.startTime, config.win, config.playbackSpeed);
          config.stateChangeCallback(state);
        }
      }
    });
  };

  return new Promise((resolve, reject) => {

    if (isAPILoaded()) {
      resolve(makePlayer());
    } else {
      let tx;
      tx = setInterval(() => {
        if (isAPILoaded()) {
          clearInterval(tx);
          resolve(makePlayer());
        }
      }, 50);
    }
  });
};

export {
  initializeYouTubeAPI,
  initializeYouTubePlayer
};
