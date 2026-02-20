const viewer = document.getElementById('viewer')

viewer.addLayer(
  {
    type: 'ogcapi',
    url: 'https://data.lillemetropole.fr/data/ogcapi/',
    collection: 'mobilite_et_transport:pm2035_action_sdvelo_pointsdurs',
    options: {
      outputFormat: 'application/geo+json',
      limit: -1,
    },
    label: 'Schéma cyclable - points durs (OGC API)',
    visibility: true,
    opacity: 0.8,
  },
  true, // zoomToExtent
)
