import type { MapContext } from '@geospatial-sdk/core'

/**
 * Default MapContext configuration for the map application
 * Contains OpenStreetMap as the base layer with a world view
 */
export const DEFAULT_MAP_CONTEXT: MapContext = {
  layers: [
    {
      type: 'xyz',
      id: 'basemap-osm',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      visibility: true,
      opacity: 1,
      label: 'OpenStreetMap',
      attributions: '© OpenStreetMap contributors',
    },
  ],
  view: {
    center: [0, 0],
    zoom: 2,
  },
}
