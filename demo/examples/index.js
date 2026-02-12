import initialContextCode from './initialContext.js?raw'
import layerCog from './layerCog.js?raw'
import layerGeojson from './layerGeojson.js?raw'
import layerMaplibreStyle from './layerMaplibreStyle.js?raw'
import layerOgcApi from './layerOgcApi.js?raw'
import layerStac from './layerStac.js?raw'
import layerWfs from './layerWfs.js?raw'
import layerWms from './layerWms.js?raw'
import layerWmts from './layerWmts.js?raw'
import layerXyz from './layerXyz.js?raw'
import setContext from './setContext.js?raw'
import getContext from './getContext.js?raw'
import setView from './setView.js?raw'
import event from './event.js?raw'

const SDK_DOCS_URL = 'https://camptocamp.github.io/geospatial-sdk/docs'
const SDK_CORE_INTERFACES_PATH = `/api/%F0%9F%93%A6-core/interfaces`
const SDK_GUIDES_PATH = '/guides'

// const SDK_GUIDE_LAYERS_URL = `${SDK_DOCS_URL}/guides/map-context.html#layers`

// const SDK_GUIDE_LAYERS_LINK = `<a target="_blank" href="${SDK_GUIDE_LAYERS_URL}">Geospatial SDK layers documentation</a>`
// const SDK_GUIDE_LAYERS_DOC = `
// <p>
//   See ${SDK_GUIDE_LAYERS_LINK} for details about available properties.
// </p>
// `

const link = (title, path) => `<a target="_blank" href="${SDK_DOCS_URL / path}">${title}</a>`

const guideLink = (title, page) => link(title, `${SDK_GUIDES_PATH}/${page}.html`)
const interfaceLink = (interfaceName) =>
  link(interfaceName, `${SDK_CORE_INTERFACES_PATH}/${interfaceName}.html`)

const contextDoc = `
<p>
  See ${guideLink('Map Context', 'map-context')} for a detailed description.
<p>
`

const layerDoc = (interfaceName) => `
<p>
  See ${interfaceLink(interfaceName)} for details about available properties.
</p>
`

export const EXAMPLES = [
  {
    name: 'Set inital map context',
    description: `
      <h4>Set initial map context.</h4>
      ${contextDoc}
    `,
    code: initialContextCode,
  },
  {
    name: 'Add XYZ layer',
    description: `
      <h4>Add new XYZ layer.</h4>
      ${layerDoc('MapContextLayerXyz')}
    `,
    code: layerXyz,
  },
  {
    name: 'Add WMS layer',
    description: `
      <h4>Add new WMS layer.</h4>
      ${layerDoc('MapContextLayerWms')}
    `,
    code: layerWms,
  },
  {
    name: 'Add WMTS layer',
    description: `
      <h4>Add new WMTS layer.</h4>
      ${layerDoc('MapContextLayerWmts')}
    `,
    code: layerWmts,
  },
  {
    name: 'Add WFS layer',
    description: `
      <h4>Add new WFS layer.</h4>
      ${layerDoc('MapContextLayerWfs')}
    `,
    code: layerWfs,
  },
  {
    name: 'Add OGC API layer',
    description: `
      <h4>Add new OGC API layer.</h4>
      ${layerDoc('MapContextLayerOgcApi')}
    `,
    code: layerOgcApi,
  },
  {
    name: 'Add COG layer',
    description: `
      <h4>Add new COG layer.</h4>
      ${layerDoc('MapContextLayerGeotiff')}
    `,
    code: layerCog,
  },
  {
    name: 'Add GeoJSON layer with style',
    description: `
      <h4>Add new GeoJSON layer.</h4>
      ${layerDoc('MapContextLayerGeojson')}
    `,
    code: layerGeojson,
  },
  {
    name: 'Add Maplibre style layer',
    description: `
      <h4>Add new Maplibre style layer.</h4>
    `,
    code: layerMaplibreStyle,
  },
  {
    name: 'Add STAC layer',
    description: `
      <h4>Add new STAC layer.</h4>
    `,
    code: layerStac,
  },
  {
    name: 'Set map context',
    description: `
      <h4>Replace the whole map context.</h4>
      ${contextDoc}
    `,
    code: setContext,
  },
  {
    name: 'Get map context',
    description: `
      <h4>Get the current map context.</h4>
      ${contextDoc}
    `,
    code: getContext,
  },
  {
    name: 'Set view by center and zoom',
    description: `
<h4>Change current view by center and zoom.</4>
<p>
  See ${interfaceLink('ViewByZoomAndCenter')} for details about available properties.
</p>
    `,
    code: setView,
  },
  {
    name: 'Listen event',
    description: `
<h4>Be notified when map extent change.</h4>
`,
    code: event,
  },
]
