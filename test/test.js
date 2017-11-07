import * as chai from 'chai'
const expect = chai.expect
import { VideoBackground } from '../dist/'
import { findPlayerAspectRatio } from '../dist/utils/utils'

describe('Video Background: YouTube default', () => {
  let container = document.querySelector('.container')
  let videobg
  before(() => {
    videobg = new VideoBackground({
      container
    })
  })

  describe('videobg instanceof VideoBackground', () => {
    it('should be true', () => {
      const result = videobg instanceof VideoBackground
      expect(result).to.equal(true)
    })
  })

  describe('Player aspect ratio', () => {
    it('should be about 1.778', () => {
      const result = findPlayerAspectRatio(videobg.container, videobg.player, videobg.source).toFixed(3)
      expect(result).to.equal('1.778')
    })
  })

})
