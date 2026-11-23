import { describe, expect, it } from 'vitest'
import { transformExtent } from 'ol/proj'
import type { Extent } from '@geospatial-sdk/core'
import { drawnArea } from './useBboxDraw'

const WEB_MERCATOR = 'EPSG:3857'
const drawn = (lonLat: Extent) => transformExtent(lonLat, 'EPSG:4326', WEB_MERCATOR) as Extent

describe('drawnArea', () => {
  it('converts a box drawn in the main world to EPSG:4326, rounded', () => {
    expect(drawnArea(drawn([-5.123456, 48, -4, 49]), WEB_MERCATOR)).toEqual([-5.1235, 48, -4, 49])
  })

  it('brings a box drawn in a wrapped copy of the world back into the main one', () => {
    expect(drawnArea(drawn([190, 48, 200, 49]), WEB_MERCATOR)).toEqual([-170, 48, -160, 49])
    expect(drawnArea(drawn([-365, 48, -355, 49]), WEB_MERCATOR)).toEqual([-5, 48, 5, 49])
  })

  it('clamps a box across the antimeridian', () => {
    expect(drawnArea(drawn([165, 48, 190, 49]), WEB_MERCATOR)).toEqual([165, 48, 180, 49])
    expect(drawnArea(drawn([-190, 48, -165, 49]), WEB_MERCATOR)).toEqual([-180, 48, -165, 49])
  })

  it('leaves the drawn geometry extent untouched', () => {
    const extent = drawn([190, 48, 200, 49])
    const copy = [...extent]
    drawnArea(extent, WEB_MERCATOR)
    expect(extent).toEqual(copy)
  })
})
