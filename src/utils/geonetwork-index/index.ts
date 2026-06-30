export { discoverFields, buildFieldFilter, fetchFieldValues, fetchCount } from './attributeIndex'
export type { AttributeFieldConfig, FieldValue, FieldValues } from './attributeIndex.types'

import type { AttributeFilterState } from '@/types/attribute-filter.types'
import type { MapLayer } from '../layer.utils'

/**
 * Get the AttributeFilterState of a layer when present.
 */

//rename to "isLayerDataIndexed()" and move to layer utils
export function getAttributeFilterState(layer: MapLayer): AttributeFilterState | undefined {
  if (layer.type !== 'wms') return undefined

  // extras.attributeFilter is what marks the layer as filterable.
  const attributeFilter = layer.extras?.attributeFilter
  return attributeFilter?.source?.url ? attributeFilter : undefined
}
