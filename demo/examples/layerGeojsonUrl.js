const viewer = document.getElementById('viewer')

viewer.addLayer({
  type: 'geojson',
  url: 'https://data.lillemetropole.fr/geoserver/ogc/features/v1/collections/mel_mobilite_et_transport:pm2035_action_sdvelo_pointsdurs/items?f=application%2Fgeo%2Bjson&limit=-1',
  label: 'Schéma cyclable 2035 (GeoJSON with URL)',
  visibility: true,
  opacity: 0.8,
  style: [
    {
      style: {
        'circle-fill-color': '#2ecc71',
        'circle-radius': 6,
        'circle-stroke-color': '#000000',
        'circle-stroke-width': 2,
      },
    },
  ],
  hoverable: true,
  hoverStyle: [
    {
      style: {
        'circle-fill-color': '#ffcc00',
        'circle-radius': 13,
        'circle-stroke-color': 'white',
        'circle-stroke-width': 3,
      },
    },
  ],
})
