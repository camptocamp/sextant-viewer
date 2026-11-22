import type { Extent } from '@geospatial-sdk/core'

// Bounds of an EPSG:4326 coordinate, in degrees.
export const MAX_LONGITUDE = 180
export const MAX_LATITUDE = 90

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value))

/** An EPSG:4326 extent clamped to the globe: an area drawn across the antimeridian overflows it. */
export function clampToGlobe([minx, miny, maxx, maxy]: Extent): Extent {
  return [
    clamp(minx, MAX_LONGITUDE),
    clamp(miny, MAX_LATITUDE),
    clamp(maxx, MAX_LONGITUDE),
    clamp(maxy, MAX_LATITUDE),
  ]
}
