const viewer = document.getElementById('viewer')

// Twenty "start/end/P1D" segments from 2013 to today, with real gaps between them:
// the calendar greys out both the gap days and everything outside the range.
viewer.addLayer(
  {
    type: 'wms',
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    name: 'MLS_Temperature_46hPa_Day',
    label: 'Température MLS 46 hPa (TIME par intervalles)',
    visibility: true,
    opacity: 0.8,
    attributions: '© NASA EOSDIS GIBS',
  },
  true, // zoomToExtent
)

// A single "1980-01-01/2026-06-01/P1M" interval: only the first of each month is selectable.
viewer.addLayer({
  type: 'wms',
  url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
  name: 'MERRA2_2m_Air_Temperature_Assimilated_Monthly',
  label: 'Température MERRA-2 à 2 m (TIME mensuel)',
  visibility: true,
  opacity: 0.8,
  attributions: '© NASA EOSDIS GIBS',
})
