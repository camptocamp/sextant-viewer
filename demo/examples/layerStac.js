const viewer = document.getElementById('viewer')

viewer.addLayer(
  {
    type: 'stac',
    url: 'https://stac-pg-api.ifremer.fr/collections/AVHRR_SST_METOP_B_OSISAF_L2P_v1_0',
    label: 'EUMETSAT OSI SAF (STAC)',
    visibility: true,
    hoverable: true,
  },
  true, // zoomToExtent
)
