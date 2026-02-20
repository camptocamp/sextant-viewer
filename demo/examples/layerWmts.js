const viewer = document.getElementById('viewer')

viewer.addLayer({
  type: 'wmts',
  url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities',
  name: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
  label: 'PLANIGNV2 (WMTS)',
  visibility: true,
  opacity: 0.7,
  attributions: '© IGN',
})
