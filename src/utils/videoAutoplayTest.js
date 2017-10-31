/*
The MIT License (MIT)
Copyright (c) 2016
Faruk Ates
Paul Irish
Alex Sexton
Ryan Seddon
Patrick Kettner
Stu Cox
Richard Herrera

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

const DEBUG = false;

const { OggVideo, Mp4Video } = require('../constants/videoTestBlobs');

const VideoAutoplayTest = () => {
  return new Promise((resolve, reject) => {
    if (DEBUG === 'resolve') {
      resolve(true);
      return;
    } else if (DEBUG === 'reject') {
      reject('rejected for debugging');
      return;
    }

    const elem = document.createElement('video');
    elem.autoplay = true;
    elem.muted = true;
    elem.volume = 0;
    elem.setAttribute('data-is-playing', 'false');
    elem.style.display = 'none';
    document.body.appendChild(elem);

    let failsafeTimer = null;

    try {
      if (elem.canPlayType('video/ogg; codecs="theora"').match(/^(probably)|(maybe)/)) {
        elem.src = OggVideo;
      } else if (elem.canPlayType('video/mp4; codecs="avc1.42E01E"').match(/^(probably)|(maybe)/)) {
        elem.src = Mp4Video;
      } else {
        elem.remove();
        reject('no autoplay: element does not support mp4 or ogg format');
        return;
      }
    } catch (err) {
      elem.remove();
      reject('no autoplay: ' + err);
      return;
    }

    elem.addEventListener('play', () => {
      elem.setAttribute('data-is-playing', 'true');
      failsafeTimer = setTimeout(() => {
        elem.remove();
        reject('no autoplay: unsure');
      }, 10000);
    });

    elem.addEventListener('canplay', () => {
      if (elem.getAttribute('data-is-playing') === 'true') {
        elem.remove();
        clearTimeout(failsafeTimer);
        resolve('autoplay supported');
        return true;
      }
      elem.remove();
      clearTimeout(failsafeTimer);
      reject('no autoplay: browser does not support autoplay');
      return false;
    });

    elem.load();
    elem.play();
  });
};

export default VideoAutoplayTest;
