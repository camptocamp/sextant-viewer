const viewer = document.getElementById('viewer')

viewer.addLayer({
  type: 'geojson',
  url: 'https://data.lillemetropole.fr/data/ogcapi/collections/mobilite_et_transport:sc_schema_cyclable_pm35_2023/items?f=geojson&limit=-1',
  label: 'Schéma cyclable 2035',
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
})
