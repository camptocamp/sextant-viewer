import { describe, expect, it } from 'vitest'
import { clampToGlobe } from './geo.utils'

describe('clampToGlobe', () => {
  it('clamps each side to ±180° longitude and ±90° latitude', () => {
    expect(clampToGlobe([170, -95, 200, 95])).toEqual([170, -90, 180, 90])
    expect(clampToGlobe([-200, 10, -170, 20])).toEqual([-180, 10, -170, 20])
  })

  it('leaves an extent within the globe untouched', () => {
    expect(clampToGlobe([-5, 48, -4, 49])).toEqual([-5, 48, -4, 49])
  })
})
