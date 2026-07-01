import initialContextCode from './initialContext.js?raw'
import layerCog from './layerCog.js?raw'
import layerGeojsonUrl from './layerGeojsonUrl.js?raw'
import layerGeojsonData from './layerGeojsonData.js?raw'
import layerMaplibreStyle from './layerMaplibreStyle.js?raw'
import layerOgcApi from './layerOgcApi.js?raw'
import layerStac from './layerStac.js?raw'
import layerWfs from './layerWfs.js?raw'
import layerWms from './layerWms.js?raw'
import layerWmsTime from './layerWmsTime.js?raw'
import layerWmsAttributeFilter from './layerWmsAttributeFilter.js?raw'
import layerWmts from './layerWmts.js?raw'
import layerXyz from './layerXyz.js?raw'
import setContext from './setContext.js?raw'
import getContext from './getContext.js?raw'
import setView from './setView.js?raw'
import event from './event.js?raw'

const SDK_DOCS_URL = 'https://camptocamp.github.io/geospatial-sdk/docs'
const SDK_CORE_PATH = `/api/%F0%9F%93%A6-core`
const SDK_GUIDES_PATH = '/guides'

const link = (title, path) => `<a target="_blank" href="${SDK_DOCS_URL}${path}">${title}</a>`

const guideLink = (title, page) => link(title, `${SDK_GUIDES_PATH}/${page}.html`)

const symbolLink = (type, symbol) => link(symbol, `${SDK_CORE_PATH}/${type}/${symbol}.html`)

const contextDoc = `
<p>
  See ${guideLink('Map Context', 'map-context')} for a detailed description.
<p>
`

const symbolDoc = (type, symbol) => `
<p>
  See ${symbolLink(type, symbol)} for details.
</p>
`

export const EXAMPLES = [
  {
    name: 'Set initial map context',
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
      ${symbolDoc('interfaces', 'MapContextLayerXyz')}
    `,
    code: layerXyz,
  },
  {
    name: 'Add WMS layer',
    description: `
      <h4>Add new WMS layer.</h4>
      ${symbolDoc('interfaces', 'MapContextLayerWms')}
    `,
    code: layerWms,
  },
  {
    name: 'Add WMS layer with TIME dimension',
    description: `
      <h4>Add a WMS layer that supports the TIME dimension.</h4>
      <p>A clock icon appears in the layer list, and a date picker is shown in the layer details panel.</p>
    `,
    code: layerWmsTime,
  },
  {
    name: 'Filter WMS layer by attributes',
    description: `
      <h4>Filter a WMS layer by its attributes.</h4>
      <p>
        Declare a Geonetwork index <code>dataSource</code>. The viewer reads the layer's Geonetwork
        metadata record: when its WFS resource carries an attribute-filter profile, it offers a
        <em>Filtre</em> tab to restrict the layer by attribute values via the WMS GetMap FILTER.
      </p>
    `,
    code: layerWmsAttributeFilter,
  },
  {
    name: 'Add WMTS layer',
    description: `
      <h4>Add new WMTS layer.</h4>
      ${symbolDoc('interfaces', 'MapContextLayerWmts')}
    `,
    code: layerWmts,
  },
  {
    name: 'Add WFS layer',
    description: `
      <h4>Add new WFS layer.</h4>
      ${symbolDoc('type-aliases', 'MapContextLayerWfs')}
    `,
    code: layerWfs,
  },
  {
    name: 'Add OGC API layer',
    description: `
      <h4>Add new OGC API layer.</h4>
      ${symbolDoc('type-aliases', 'MapContextLayerOgcApi')}
    `,
    code: layerOgcApi,
  },
  {
    name: 'Add COG layer',
    description: `
      <h4>Add new COG layer.</h4>
      ${symbolDoc('interfaces', 'MapContextLayerGeotiff')}
    `,
    code: layerCog,
  },
  {
    name: 'Add GeoJSON layer with URL and style',
    description: `
      <h4>Add new GeoJSON layer with URL and style.</h4>
      ${symbolDoc('interfaces', 'LayerGeojsonWithUrl')}
    `,
    code: layerGeojsonUrl,
  },
  {
    name: 'Add GeoJSON layer with data',
    description: `
      <h4>Add new GeoJSON layer with data.</h4>
      ${symbolDoc('interfaces', 'LayerGeojsonWithData')}
    `,
    code: layerGeojsonData,
  },
  {
    name: 'Add Maplibre style layer',
    description: `
      <h4>Add new Maplibre style layer.</h4>
      ${symbolDoc('interfaces', 'MapContextLayerMapLibreStyle')}
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
      ${symbolDoc('interfaces', 'ViewByZoomAndCenter')}
    `,
    code: setView,
  },
  {
    name: 'Listen event',
    description: `
      <h4>Be notified when map extent change.</h4><p>
      ${symbolDoc('interfaces', 'MapExtentChangeEvent')}
    `,
    code: event,
  },
]
