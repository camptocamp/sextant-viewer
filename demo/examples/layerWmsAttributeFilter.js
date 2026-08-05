const viewer = document.getElementById('viewer')

viewer.setInitialContext({
  dataSources: [
    {
      url: '/geonetwork/index/features',
      type: 'geonetwork-index',
    },
  ],
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
  layers: [
    {
      type: 'wms',
      url: 'https://sextant.ifremer.fr/services/wms/environnement_marin',
      name: 'surval_parametre_point,surval_parametre_ligne,surval_parametre_polygone',
      label: 'Surval — données par paramètre',
      visibility: true,
      attributions: '© Ifremer',
    },
  ],
  view: {
    center: [-4.56243, 48.36143],
    zoom: 8,
  },
})
