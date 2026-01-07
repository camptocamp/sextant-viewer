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
    {
      type: 'xyz',
      id: 'layer-1',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      visibility: true,
      opacity: 0.7,
      label: 'Satellite Imagery',
      attributions: '© Esri',
    },
    {
      type: 'wms',
      id: 'layer-2',
      url: 'https://example.com/wms',
      name: 'population_density',
      visibility: true,
      opacity: 0.8,
      label: 'Population Density Data Layer',
      attributions: '© Example Data Provider',
    },
    {
      type: 'wms',
      id: 'layer-3',
      url: 'https://example.com/wms',
      name: 'long_layer_name',
      visibility: true,
      opacity: 0.6,
      label:
        'Very Long Layer Name That Should Be Truncated With Ellipsis To Test The Truncation Feature',
      attributions: '© Test Data',
    },
    {
      type: 'geojson',
      id: 'layer-4',
      url: 'https://example.com/boundaries.geojson',
      visibility: true,
      opacity: 1,
      label: 'Administrative Boundaries',
      attributions: '© OpenStreetMap',
    },
  ],
  view: {
    center: [0, 0],
    zoom: 2,
  },
}
