const viewer = document.getElementById('viewer')

viewer.setInitialContext({
  layers: [
    {
      type: 'xyz',
      id: 'basemap-osm',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      visibility: true,
      opacity: 1,
      label: 'OpenStreetMap',
      attributions: '© OpenStreetMap contributors',
      extras: {
        basemap: true,
      },
    },
  ],
  view: {
    center: [-4.56243, 48.36143],
    zoom: 15,
  },
})
