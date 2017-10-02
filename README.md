Squarespace Video Background Rendering
--------------------

Use the YouTube or Vimeo API to display a video background inside a container element with configurable properties.

*NOTICE: This code is licensed to you pursuant to Squarespace’s Developer Terms of Use. See license section below.*

## Usage

```sh
npm install --save @squarespace/video-background-rendering
```

```js
import { VideoBackground as VideoBackgroundRenderer } from '@squarespace/video-background-rendering';
const config = {
  container: document.documentElement.querySelector('#myContainer'),
  url: 'https://www.youtube.com/watch?v=IWBcS6sDIDM'
};
const myVideoBackground = new VideoBackgroundRenderer(config);
```

### Using ES6

If you prefer to handle transpiling and polyfilling on your own, you can import ES6 from Video Background Rendering:

```js
import controller from '@squarespace/video-background-rendering/src';
```

Alternately, Video Background Rendering specifies a `module` property in `package.json` that points to the uncompiled `src/index.js`, so you may be able to simply import `@squarespace/video-background-rendering` if you're using one of the following bundlers:
* [Webpack 2](https://webpack.js.org/configuration/resolve/#resolve-mainfields)
* [Rollup](https://github.com/rollup/rollup-plugin-node-resolve#rollup-plugin-node-resolve)


## Reference

### new VideoBackgroundRenderer(config)
**Params**
* config `Object` - Config object
* config.container `HTMLElement` or `string` - the element or CSS selector for the element which will contain the video background
* config.url `string` - YouTube or Vimeo video url
* [config.fitMode] `string` - Behaves similarly to the CSS property `object-fit`, where `fill` is analogous to `cover`, and `fit` appears like `contain`
* [config.useCustomFallbackImage] `boolean` - If `true` the renderer will display an image if the user agent is unable to display or autoplay the chosen video. The `container` element must have a child image with the class `custom-fallback-image`

### VideoBackgroundRenderer.destroy()
Unbind all listeners, removes state-related classes, clears all timers.

## License
Portions Copyright © 2016 Squarespace, Inc. This code is licensed to you pursuant to Squarespace’s Developer Terms of Use, available at http://developers.squarespace.com/developer-terms-of-use (the “Developer Terms”). You may only use this code on websites hosted by Squarespace, and in compliance with the Developer Terms. TO THE FULLEST EXTENT PERMITTED BY LAW, SQUARESPACE PROVIDES ITS CODE TO YOU ON AN “AS IS” BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
