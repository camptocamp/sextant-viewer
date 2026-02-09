const SDK_INTERFACES_URL = 'https://camptocamp.github.io/geospatial-sdk/docs/api/%F0%9F%93%A6-core/interfaces'
const SDK_GUIDE_LAYERS_URL = 'https://camptocamp.github.io/geospatial-sdk/docs/guides/map-context.html#layers'
const SDK_GUIDE_LAYERS_LINK = `<a href="${SDK_GUIDE_LAYERS_URL}">Geospatial SDK layers documentation</a>`
const SDK_GUIDE_LAYERS_DOC = `
<p>
  See ${SDK_GUIDE_LAYERS_LINK} for details about available properties.
</p>
`

const EXAMPLES = [
  {
    name: 'Add XYZ layer',
    description: `
<h4>Add new XYZ layer.</h4>
${SDK_GUIDE_LAYERS_DOC}
    `,
    code: `const viewer = document.getElementById('viewer');

viewer.addLayer(
  {
    type: 'xyz',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    visibility: true,
    opacity: 1,
    label: 'OpenStreetMap',
    attributions: '© OpenStreetMap contributors',
  },
);`,
  },
  {
    name: 'Add WMS layer',
    description: `
<h4>Add new WMS layer.</h4>
${SDK_GUIDE_LAYERS_DOC}
    `,
    code: `const viewer = document.getElementById('viewer');

viewer.addLayer(
  {
    type: 'wms',
    url: 'https://data.geopf.fr/wms-r/wms',
    name: 'INSEE.FILOSOFI.POPULATION',
    label: 'Population INSEE (Add WMS layer)',
    visibility: true,
    opacity: 0.7,
    attributions: '© IGN - INSEE',
  },
  true,  // zoomToExtent
);`,
  },
  {
    name: 'Add WMTS layer',
    description: `
<h4>Add new WMTS layer.</h4>
${SDK_GUIDE_LAYERS_DOC}
    `,
    code: `const viewer = document.getElementById('viewer');

viewer.addLayer(
  {
    type: 'wmts',
    url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities',
    name: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
    label: 'PLANIGNV2',
    visibility: true,
    opacity: 0.7,
    attributions: '© IGN',
  }
);`,
  },
  {
    name: 'Add WFS layer',
    description: `
<h4>Add new WFS layer.</h4>
${SDK_GUIDE_LAYERS_DOC}
    `,
    code: `const viewer = document.getElementById('viewer');

viewer.addLayer(
  {
    type: 'wfs',
    url: 'https://data.lillemetropole.fr/geoserver/dsp_ilevia/ows?REQUEST=GetCapabilities&SERVICE=WFS&VERSION=2.0.0',
    featureType: 'ilevia_traceslignes',
    label: 'Lignes de bus Ilevia (Add WFS layer)',
    visibility: true,
    opacity: 0.8,
    attributions: '© MEL - Ilevia',
  },
  true,  // zoomToExtent
);`,
  },
  {
    name: 'Add COG layer',
    description: `
<h4>Add new COG layer.</h4>
${SDK_GUIDE_LAYERS_DOC}
    `,
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
    name: 'Add GeoJSON layer with style',
    description: `
<h4>Add new GeoJSON layer.</h4>
${SDK_GUIDE_LAYERS_DOC}
    `,
    code: `const viewer = document.getElementById('viewer');

viewer.addLayer(
  {
    type: 'geojson',
    url: 'https://data.lillemetropole.fr/data/ogcapi/collections/mobilite_et_transport:sc_schema_cyclable_pm35_2023/items?f=geojson&limit=-1',
    label: 'Schéma cyclable 2035',
    visibility: true,
    opacity: 0.8,
    style: [
      {
        'stroke-color': '#000000',
        'stroke-width': 5,
        'stroke-line-cap': 'butt',
        'stroke-line-join': 'miter',
      },
      {
        'stroke-color': '#2ecc71',
        'stroke-width': 3,
        'stroke-line-cap': 'butt',
        'stroke-line-join': 'miter',
      }
    ],
  }
);`,
  },
  {
    name: 'Add STAC layer',
    description: `
<h4>Add new STAC layer.</h4>
    `,
    code: `const viewer = document.getElementById('viewer');

viewer.addLayer(
  {
    type: 'stac',
    url: 'https://stacapi-cdos.apps.okd.crocc.meso.umontpellier.fr/collections/sentinel-2-radiometric-indices',
    label: 'Example STAC layer',
    visibility: true,
  },
  true,  // zoomToExtent
)
    `,
  },
  {
    name: 'Set map context',
    description: `
<h4>Replace the whole map context.</h4>
<p>
  See interface
  <a href="${SDK_INTERFACES_URL}/MapContext.html">
    MapContext
  </a>
  for available properties.
</p>
    `,
    code: `const viewer = document.getElementById('viewer');

viewer.setContext(
  {
    layers: [
      {
        type: 'xyz',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        visibility: true,
        opacity: 1,
        label: 'OpenStreetMap',
        attributions: '© OpenStreetMap contributors',
        extras: {
          basemap: true,
        },
      },
      {
        type: 'stac',
        url: 'https://stacapi-cdos.apps.okd.crocc.meso.umontpellier.fr/collections/sentinel-2-radiometric-indices',
        label: 'Example STAC layer',
        visibility: true,
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
    name: 'Get map context',
    description: `
<h4>Get the current map context.</h4>
<p>
  See interface
  <a href="${SDK_INTERFACES_URL}/MapContext.html">
    MapContext
  </a>
  for available properties.
</p>
`,
    code: `const viewer = document.getElementById('viewer');

console.log(viewer.getContext());
    `,
  },
  {
    name: 'Set inital map context',
    code: `const viewer = document.getElementById('viewer');

viewer.setInitialContext(
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
      {
        type: 'stac',
        url: 'https://stac-pg-api.ifremer.fr/collections/AVHRR_SST_METOP_B_OSISAF_L2P_v1_0',
        id: 'AVHRR_SST_METOP_B_OSISAF_L2P_v1_0-no-collection-id',
        visibility: false,
      }
    ],
    view: {
      center: [-4.56243, 48.36143],
      zoom: 15,
    },
  }
);
    `,
  },
  {
    name: 'Set view by center and zoom',
    description: `
<h4>Change current view by center and zoom.</4>
<p>
  See interface
  <a href="${SDK_INTERFACES_URL}/ViewByExtent.html">
    MapContext
  </a>
  for all available properties.
</p>
    `,
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
    description: `
<h4>Be notified when map extent change.</h4>
`,
    code: `const viewer = document.getElementById('viewer');

const el = document.createElement('div');
document.body.appendChild(el);

viewer.addEventListener('map-extent-change', (event) => {
  el.textContent = event.detail.toString()
});`,
  },
]

const exampleSelector = document.getElementById('example-selector')
const exampleDoc = document.getElementById('example-doc')
const codeInputEl = document.getElementById('code-input')
const runBtn = document.getElementById('run-btn')

EXAMPLES.forEach((example, index) => {
  const option = document.createElement('option')
  option.value = index
  option.textContent = example.name
  exampleSelector.appendChild(option)
})

const showExample = (index) => {
  const example = EXAMPLES[index];
  if (example) {
    codeInputEl.value = example.code
    exampleDoc.innerHTML = example.description
  }
}
exampleSelector.addEventListener('change', (e) => {
  const selectedIndex = parseInt(e.target.value)
  showExample(selectedIndex)
})

// Temp config for dev
// exampleSelector.value = 5
// showExample(5)

function execCode() {
  const code = codeInputEl.value
  const execFn = new Function(code)
  execFn()
}

runBtn.addEventListener('click', execCode)
