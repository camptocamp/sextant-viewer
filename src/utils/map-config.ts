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
      extras: {
        basemap: true
      }
    },
    {
      type: 'wms',
      url: 'https://data.geopf.fr/wms-r/wms',
      name: 'INSEE.FILOSOFI.POPULATION',
    },
    {
      type: 'wfs',
      url: 'https://data.lillemetropole.fr/geoserver/dsp_ilevia/ows?REQUEST=GetCapabilities&SERVICE=WFS&VERSION=2.0.0',
      featureType: 'ilevia_traceslignes',
      label: 'Tracé des lignes de bus',
      visibility: true,
      attributions: 'camptocamp',
      opacity: 0.5,
    },
    {
      id: 'geojson',
      type: 'geojson',
      url: 'https://data.lillemetropole.fr/data/ogcapi/collections/roubaix:implantation_des_arceaux_velos_a_roubaix/items?f=geojson&limit=-1',
    },
  ],
  view: {
    center: [0, 0],
    zoom: 2,
  },
}
