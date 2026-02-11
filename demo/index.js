const EXAMPLES = [
  {
    name: 'Add WMS layer',
    code: `const viewer = document.getElementById('viewer');

viewer.addLayer(
  {
    type: 'wms',
    id: 'wms-population',
    url: 'https://data.geopf.fr/wms-r/wms',
    name: 'INSEE.FILOSOFI.POPULATION',
    label: 'Population INSEE (Add WMS layer)',
    visibility: true,
    opacity: 0.7,
    attributions: '© IGN - INSEE',
    version: 0,
  }
);`,
  },
  {
    name: 'Add WFS layer',
    code: `const viewer = document.getElementById('viewer');

viewer.addLayer(
  {
    type: 'wfs',
    id: 'wfs-bus-lines',
    url: 'https://data.lillemetropole.fr/geoserver/dsp_ilevia/ows?REQUEST=GetCapabilities&SERVICE=WFS&VERSION=2.0.0',
    featureType: 'ilevia_traceslignes',
    label: 'Lignes de bus Ilevia (Add WFS layer)',
    visibility: true,
    opacity: 0.8,
    attributions: '© MEL - Ilevia',
    version: 0,
  }
);`,
  },
  {
    name: 'Add COG layer',
    code: `const viewer = document.getElementById('viewer');

viewer.addLayer(
  {
    type: 'geotiff',
    id: 'cog-oam-brest',
    url: 'https://oin-hotosm-temp.s3.us-east-1.amazonaws.com/66e43a1ecd0baa0001b62135/0/66e43a1ecd0baa0001b62136.tif',
    label: 'COG Brest (OpenAerialMap)',
    visibility: true,
    opacity: 1,
    attributions: '© OpenAerialMap contributors, CC-BY 4.0',
    version: 0,
  }
);

viewer.setView({ center: [-4.746, 48.345], zoom: 16 });`,
  },
  {
    name: 'Set map context',
    code: `const viewer = document.getElementById('viewer');

viewer.setContext(
  {
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
  }
);`,
  },
  {
    name: 'Set view',
    code: `const viewer = document.getElementById('viewer');

viewer.setView(
  {
    center: [-4, 48.16667],
    zoom: 8,
  }
);`,
  },
  {
    name: 'Listen event',
    code: `const viewer = document.getElementById('viewer');

const el = document.createElement('div');
document.body.appendChild(el);

viewer.addEventListener('map-extent-change', (event) => {
  el.textContent = event.detail.toString()
});`,
  },
]

const exampleSelector = document.getElementById('example-selector')

const codeInputEl = document.getElementById('code-input')
const runBtn = document.getElementById('run-btn')

EXAMPLES.forEach((example, index) => {
  const option = document.createElement('option')
  option.value = index
  option.textContent = example.name
  exampleSelector.appendChild(option)
})

exampleSelector.addEventListener('change', (e) => {
  const selectedIndex = parseInt(e.target.value)
  if (EXAMPLES[selectedIndex]) {
    codeInputEl.value = EXAMPLES[selectedIndex].code
  }
})

function execCode() {
  const code = codeInputEl.value
  const execFn = new Function(code)
  execFn()
}

codeInputEl.value = EXAMPLES[0].code

runBtn.addEventListener('click', execCode)
