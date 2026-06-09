const viewer = document.getElementById('viewer')

viewer.setContext({
  backgroundLayers: [
    {
      type: 'wmts',
      url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities',
      name: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
      label: 'PLANIGNV2',
      visibility: true,
      opacity: 0.7,
      attributions: '© IGN',
      extras: {
        basemap: true,
      },
    },
  ],
  layers: [
    {
      type: 'wms',
      url: 'https://data.geopf.fr/wms-r/wms',
      name: 'INSEE.FILOSOFI.POPULATION',
      label: 'Population INSEE (Add WMS layer)',
      visibility: true,
      opacity: 0.7,
      attributions: '© IGN - INSEE',
    },
  ],
  view: {
    center: [-4.56243, 48.36143],
    zoom: 15,
  },
})
