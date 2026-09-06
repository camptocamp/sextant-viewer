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
    {
      type: 'wmts',
      id: 'sextant',
      url: 'https://sextant.ifremer.fr/geowebcache/service/wmts?SERVICE=wmts&REQUEST=getcapabilities',
      name: 'sextant',
      label: 'Sextant',
      visibility: false,
      opacity: 1,
    },
  ],
  layers: [],
  view: {
    center: [-4.56243, 48.36143],
    zoom: 15,
  },
})
