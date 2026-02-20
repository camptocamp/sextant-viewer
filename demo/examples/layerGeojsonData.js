const viewer = document.getElementById('viewer')

viewer.addLayer(
  {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'poi-1',
          geometry: { type: 'Point', coordinates: [3.06, 50.63] },
          properties: {
            name: 'Point avec URL HTTPS',
            description: 'Voir documentation: https://example.com/docs',
            website: 'https://www.openstreetmap.org',
            contact: 'email@example.com',
          },
        },
        {
          type: 'Feature',
          id: 'poi-2',
          geometry: { type: 'Point', coordinates: [3.07, 50.625] },
          properties: {
            name: 'Point avec URL HTTP',
            info: 'Source: http://data.example.org/api',
            note: 'Protocole non sécurisé',
          },
        },
        {
          type: 'Feature',
          id: 'poi-3',
          geometry: { type: 'Point', coordinates: [3.05, 50.635] },
          properties: {
            name: 'Point avec URLs multiples',
            links: 'Voir https://example.com et aussi https://another-site.org/page',
            documentation: 'https://docs.example.com/guide',
          },
        },
        {
          type: 'Feature',
          id: 'poi-4',
          geometry: { type: 'Point', coordinates: [3.055, 50.62] },
          properties: {
            name: 'Point avec protocoles non-HTTP',
            file_path: 'file:///home/user/data.txt',
            ftp_server: 'ftp://files.example.com/data',
            note: 'Ces URLs ne doivent PAS être cliquables',
          },
        },
      ],
    },
    label: 'Points de test (GeoJSON with data)',
    visibility: true,
    opacity: 1,
    attributions: 'Mock data',
    hoverable: true,
    style: {
      'circle-fill-color': '#888888',
      'circle-radius': 10,
      'circle-stroke-color': 'black',
      'circle-stroke-width': 3,
    },
  },
  true, // zoomToExtent
)
