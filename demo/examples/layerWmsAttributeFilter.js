const viewer = document.getElementById('viewer')

viewer.addDataSource({
  url: '/geonetwork/index/features',
  type: 'geonetwork-index',
})

viewer.addLayer({
  type: 'wms',
  url: 'https://sextant.ifremer.fr/services/wms/environnement_marin',
  name: 'surval_parametre_point,surval_parametre_ligne,surval_parametre_polygone',
  label: 'Surval — données par paramètre',
  visibility: true,
  attributions: '© Ifremer',
})
