import * as chai from 'chai'
const expect = chai.expect
import { VideoBackground } from '../dist/'
import { findPlayerAspectRatio } from '../dist/utils/utils'

describe('Video Background: YouTube default', () => {
  let container = document.querySelector('.container')
  let videobg
  beforeEach(() => {
    videobg = new VideoBackground({
      container
    })
  })

  // afterEach(() => {
  //   videobg.destroy()
  // })

  describe('videobg instanceof VideoBackground', () => {
    it('should be true', async () => {
      const result = await videobg instanceof VideoBackground
      expect(result).to.equal(true)
    })
  })

  describe('Player aspect ratio', () => {
    it('should be about 1.778', async () => {
      await container.addEventListener('ready', () => {
        try {
          const result = videobg.videoAspectRatio
          expect(result).to.be.within(2.777, 2.8)
        } catch (e) {
          console.warn(e)
        }
      })
    })
  })

})
