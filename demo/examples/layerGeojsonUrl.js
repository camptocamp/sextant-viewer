const viewer = document.getElementById('viewer')

viewer.addLayer({
  type: 'geojson',
  url: 'https://data.lillemetropole.fr/data/ogcapi/collections/mobilite_et_transport:sc_schema_cyclable_pm35_2023/items?f=geojson&limit=-1',
  label: 'Schéma cyclable 2035 (GeoJSON with URL)',
  visibility: true,
  opacity: 0.8,
  style: [
    {
      'stroke-color': '#000000',
      'stroke-width': 5,
      'stroke-line-cap': 'butt',
      'stroke-line-join': 'miter',
    },
    {
      'stroke-color': '#2ecc71',
      'stroke-width': 3,
      'stroke-line-cap': 'butt',
      'stroke-line-join': 'miter',
    },
  ],
  hoverable: true,
  hoverStyle: [
    {
      filter: ['==', ['geometry-type'], 'Point'],
      style: {
        'circle-fill-color': '#ffcc00',
        'circle-radius': 13,
        'circle-stroke-color': 'white',
        'circle-stroke-width': 3,
      },
    },
    {
      filter: ['==', ['geometry-type'], 'LineString'],
      style: [
        { 'stroke-color': 'white', 'stroke-width': 8 },
        { 'stroke-color': '#ffcc00', 'stroke-width': 5 },
      ],
    },
    {
      filter: ['==', ['geometry-type'], 'Polygon'],
      style: {
        'stroke-color': '#ffcc00',
        'stroke-width': 4,
        'fill-color': 'rgba(255, 204, 0, 0.3)',
      },
    },
  ],
})
