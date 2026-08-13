const viewer = document.getElementById('viewer')

viewer.setInitialContext({
  backgroundLayers: [
    {
      type: 'xyz',
      id: 'basemap-osm',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      visibility: true,
      opacity: 1,
      label: 'OpenStreetMap',
      attributions: '© OpenStreetMap contributors',
      referrerPolicy: 'strict-origin-when-cross-origin',
    },
  ],
  layers: [],
  view: {
    center: [-4.56243, 48.36143],
    zoom: 8,
  },
  wpsServices: [
    { url: 'https://sextant.ifremer.fr/services/wps3/demo', label: 'Sextant WPS (démo)' },
    { url: 'https://sextant.ifremer.fr/services/wps3/surval', label: 'Sextant WPS (Surval)' },
    { url: 'https://sextant.ifremer.fr/services/wps3/sisaqua', label: 'Sextant WPS (SISAQUA)' },
  ],
})
