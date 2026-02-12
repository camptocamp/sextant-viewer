const viewer = document.getElementById('viewer')

viewer.addLayer({
  type: 'wms',
  url: 'https://data.geopf.fr/wms-r/wms',
  name: 'INSEE.FILOSOFI.POPULATION',
  label: 'Population INSEE (Add WMS layer)',
  visibility: true,
  opacity: 0.7,
  attributions: '© IGN - INSEE',
})
