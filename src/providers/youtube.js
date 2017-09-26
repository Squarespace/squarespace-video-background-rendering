let awaitingLoopRequestedAt = null;

const initializeYouTubeAPI = (context) => {
  if (!context.canAutoPlay) {
    return;
  }

  const doc = context.windowContext.document.documentElement;
  if (doc.querySelector('script[src*="www.youtube.com/iframe_api"].loaded')) {
    context.setVideoPlayer();
    return;
  }

  context.player.ready = false;
  const tag = context.windowContext.document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = context.windowContext.document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  tag.addEventListener('load', (evt) => {
    evt.currentTarget.classList.add('loaded');
    context.setVideoPlayer();
  }, true);
};

/**
 * YouTube event handler. Add the proper class to the player element, and set
 * player properties. All player methods via YouTube API.
 */
const onYouTubePlayerReady = (event, context) => {
  const player = context.player;
  player.iframe = player.getIframe();
  player.iframe.classList.add('background-video');
  context.syncPlayer();
  player.mute();
  const readyEvent = new CustomEvent('ready');
  context.container.dispatchEvent(readyEvent);
  document.body.classList.add('ready');
  player.ready = true;
  if (!context.canAutoPlay) {
    return;
  }
  if (context.timeCode.start >= player.getDuration()) {
    context.timeCode.start = 0;
  }
  player.seekTo(context.timeCode.start);
  player.playVideo();
  context.logger('playing');
};

/**
 * YouTube event handler. Determine whether or not to loop the video.
 */
const onYouTubePlayerStateChange = (event, context) => {
  const player = context.player;
  const playerIframe = player.getIframe();
  const duration = (player.getDuration() - context.timeCode.start) / context.playbackSpeed;

  const doLoop = () => {
    if (awaitingLoopRequestedAt === null) {
      if ((player.getCurrentTime() + 0.1) >= player.getDuration()) {
        if (context.maxLoops) {
          context.currentLoop++;
          if (context.currentLoop > context.maxLoops) {
            player.pauseVideo();
            context.currentLoop = 0;
            return;
          }
        }
        awaitingLoopRequestedAt = player.getCurrentTime();
        player.pauseVideo();
        player.seekTo(context.timeCode.start);
      }
    } else if (player.getCurrentTime() < awaitingLoopRequestedAt) {
      awaitingLoopRequestedAt = null;
      player.playVideo();
    }
    requestAnimationFrame(doLoop.bind(context));
  };

  if (event.data === context.windowContext.YT.PlayerState.BUFFERING &&
     (player.getVideoLoadedFraction() !== 1) &&
     (player.getCurrentTime() === 0 || player.getCurrentTime() > duration - -0.1)) {
    context.logger('BUFFERING');
    context.autoPlayTestTimeout();
  } else if (event.data === context.windowContext.YT.PlayerState.PLAYING) {
    if (context.player.playTimeout !== null) {
      clearTimeout(context.player.playTimeout);
      context.player.playTimeout = null;
    }
    if (!context.canAutoPlay) {
      context.canAutoPlay = true;
      context.container.classList.remove('mobile');
    }
    context.logger('PLAYING');
    playerIframe.classList.add('ready');
    requestAnimationFrame(doLoop.bind(context));
  } else if (event.data === context.windowContext.YT.PlayerState.ENDED) {
    player.playVideo();
  }
};

/**
 * Initialize the player and bind player events.
 */
const initializeYouTubePlayer = (context) => {
  // Poll until the API is ready.
  if (context.windowContext.YT.loaded !== 1) {
    setTimeout(context.setVideoPlayer.bind(context), 100);
    return false;
  }

  let playerElement = context.container.querySelector('#player');
  if (!playerElement) {
    playerElement = document.createElement('div');
    playerElement.id = 'player';
    context.container.appendChild(playerElement);
  }
  context.player = new context.windowContext.YT.Player(playerElement, {
    height: '315',
    width: '560',
    videoId: context.videoId,
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
      onReady: (event) => {
        onYouTubePlayerReady(event, context);
      },
      onStateChange: (event) => {
        onYouTubePlayerStateChange(event, context);
      }
    }
  });
};

export {
  initializeYouTubeAPI,
  initializeYouTubePlayer
};
