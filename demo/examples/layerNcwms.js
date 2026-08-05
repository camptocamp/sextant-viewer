const viewer = document.getElementById('viewer')

viewer.addLayer(
  {
    type: 'wms',
    url: 'https://tds0.ifremer.fr/thredds/wms/LPO_GLOBANA_ISAS20_ARGO_MNTH_TIME_SERIE',
    name: 'TEMP',
    label: 'Température GLOBANA ISAS20 (NcWMS)',
    visibility: true,
    opacity: 0.8,
    attributions: '© Ifremer / SEANOE',
  },
  true, // zoomToExtent
)
