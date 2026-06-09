import type { MapContext, MapContextView } from '@geospatial-sdk/core'
import type { MapLayer } from '@/utils/layer.utils'

export interface ExtendedMapContext extends Omit<MapContext, 'layers'> {
  view: MapContextView
  layers: MapLayer[]
  backgroundLayers: MapLayer[]
}
