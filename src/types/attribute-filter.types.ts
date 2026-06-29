// Viewer-specific attribute-filter types. The ES primitives live in `attributeIndex.types`.

import type {
  AttributeFieldConfig,
  GeonetworkSource,
} from '@/utils/attribute-filter/attributeIndex.types'

/** A data source declared on the map context, probed to detect whether a layer is indexed. */
export interface DataSource {
  url: string
  type: 'elasticsearch'
}

/** Active selections keyed by `esField`. */
export type ActiveFilters = Record<string, string[]>

/**
 * Per-layer attribute-filter state stored under `extras.attributeFilter`, persisted with the map
 * context across reloads. Detection sets `source`; `fields` and `active` are cached by the UI.
 */
export interface AttributeFilterState {
  source: GeonetworkSource
  /** Columns discovered from the index or curated from a profile, cached to rebuild the FILTER. */
  fields?: AttributeFieldConfig[]
  active?: ActiveFilters
}
