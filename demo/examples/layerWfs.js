const viewer = document.getElementById('viewer')

viewer.addLayer(
  {
    type: 'wfs',
    url: 'https://data.lillemetropole.fr/geoserver/dsp_ilevia/ows?REQUEST=GetCapabilities&SERVICE=WFS&VERSION=2.0.0',
    featureType: 'ilevia_traceslignes',
    label: 'Lignes de bus Ilevia (Add WFS layer)',
    visibility: true,
    opacity: 0.8,
    attributions: '© MEL - Ilevia',
  },
  true, // zoomToExtent
)
