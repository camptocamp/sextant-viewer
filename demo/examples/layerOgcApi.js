const viewer = document.getElementById('viewer')

viewer.addLayer(
  {
    type: 'ogcapi',
    url: 'https://data.lillemetropole.fr/data/ogcapi/collections/plu:gpu_prescription_lin/items?f=geojson',
    collection: 'plu:gpu_prescription_lin',
    options: { f: 'geojson' },
    label: 'Prescriptions linéaires',
    visibility: true,
    opacity: 0.8,
  },
  true, // zoomToExtent
)
