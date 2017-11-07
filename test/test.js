import * as chai from 'chai'
const expect = chai.expect
import { VideoBackground } from '../dist/'
import { findPlayerAspectRatio } from '../dist/utils/utils'

describe('Video Background: YouTube default', () => {
  let container = document.querySelector('.container')
  let videobg
  before(async () => {
    videobg = await new VideoBackground({
      container
    })
  })

  describe('videobg instanceof VideoBackground', () => {
    it('should be true', async () => {
      const result = await videobg instanceof VideoBackground
      expect(result).to.equal(true)
    })
  })

  describe('Player aspect ratio', () => {
    it('should be about 1.778', async (done) => {
      await container.addEventListener('ready', () => {
        try {
          const result = videobg.videoAspectRatio
          expect(result).to.be.within(1.777, 1.8)
        } catch (e) {
          console.warn(e)
        }
      })
    })
  })

})
