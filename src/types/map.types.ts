import type { MapContext, MapContextView } from '@geospatial-sdk/core'
import type { MapLayer } from '@/utils/layer.utils'
import type { DataSource } from '@/types/data-source.types'

export interface ExtendedMapContext extends Omit<MapContext, 'layers'> {
  view: MapContextView
  layers: MapLayer[]
  backgroundLayers: MapLayer[]
  dataSources?: DataSource[]
}
