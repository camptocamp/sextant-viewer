const viewer = document.getElementById('viewer')

// Declare a WPS service, offered as a suggestion in the "Traitements (WPS)" panel.
// The user can still type any other WPS URL in the same field.
//
// The URLs are relative: in dev they go through the Vite proxy (see vite.config.ts), which
// serves Sextant same-origin. Cross-origin Execute POSTs would otherwise be blocked, as
// Sextant sends CORS headers on the OPTIONS preflight but not on the Execute POST response.
viewer.addWpsService({
  url: 'https://sextant.ifremer.fr/services/wps3/demo',
  label: 'Sextant WPS (démo)',
})

viewer.addWpsService({
  url: 'https://sextant.ifremer.fr/services/wps3/surval',
  label: 'Sextant WPS (Surval)',
})
