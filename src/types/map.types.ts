import type { MapContext, MapContextView } from '@geospatial-sdk/core'
import type { MapLayer } from '@/utils/layer.utils'
import type { DataSource } from '@/types/attribute-filter.types'

export interface ExtendedMapContext extends Omit<MapContext, 'layers'> {
  view: MapContextView
  layers: MapLayer[]
  backgroundLayers: MapLayer[]
  /** Data sources (e.g. ElasticSearch indexes) probed to detect filterable WMS layers. */
  dataSources?: DataSource[]
}
