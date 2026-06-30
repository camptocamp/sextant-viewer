const viewer = document.getElementById('viewer')

viewer.addLayer(
  {
    type: 'wms',
    url: 'https://tds0.ifremer.fr/thredds/wms/LPO-GLOBAL-ISAS13-CLIM_TIME_SERIE',
    name: 'TEMP',
    label: 'Température ISAS13 (WMS + TIME)',
    visibility: true,
    opacity: 0.8,
    attributions: '© Ifremer',
  },
  true, // zoomToExtent
)
