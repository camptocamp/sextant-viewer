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
        basemap: true,
      },
    },
    {
      type: 'wms',
      id: 'wms-population',
      url: 'https://data.geopf.fr/wms-r/wms',
      name: 'INSEE.FILOSOFI.POPULATION',
      label: 'Population INSEE',
      visibility: true,
      opacity: 0.7,
      attributions: '© IGN - INSEE',
    },
    {
      type: 'wfs',
      id: 'wfs-bus-lines',
      url: 'https://data.lillemetropole.fr/geoserver/dsp_ilevia/ows?REQUEST=GetCapabilities&SERVICE=WFS&VERSION=2.0.0',
      featureType: 'ilevia_traceslignes',
      label: 'Lignes de bus Ilevia',
      visibility: true,
      opacity: 0.8,
      attributions: '© MEL - Ilevia',
    },
    {
      type: 'geojson',
      id: 'geojson-bike-racks',
      url: 'https://data.lillemetropole.fr/data/ogcapi/collections/roubaix:implantation_des_arceaux_velos_a_roubaix/items?f=geojson&limit=-1',
      label: 'Arceaux vélos Roubaix',
      visibility: false,
      opacity: 1,
      attributions: '© Ville de Roubaix',
    },
  ],
  view: {
    center: [3.0586, 50.6292],
    zoom: 11,
  },
}
