const viewer = document.getElementById('viewer')

viewer.addLayer({
  type: 'maplibre-style',
  styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  label: 'Maplibre style',
})
