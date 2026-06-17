const viewer = document.getElementById('viewer')

viewer.addLayer({
  type: 'xyz',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  visibility: true,
  opacity: 1,
  label: 'OpenStreetMap (XYZ)',
  attributions: '© OpenStreetMap contributors',
  referrerPolicy: 'strict-origin-when-cross-origin',
})
