const viewer = document.getElementById('viewer')

viewer.addLayer(
  {
    type: 'geotiff',
    url: 'https://oin-hotosm-temp.s3.us-east-1.amazonaws.com/66e43a1ecd0baa0001b62135/0/66e43a1ecd0baa0001b62136.tif',
    label: 'COG Brest (OpenAerialMap)',
    visibility: true,
    opacity: 1,
    attributions: '© OpenAerialMap contributors, CC-BY 4.0',
  },
  true, // zoomToExtent
)
